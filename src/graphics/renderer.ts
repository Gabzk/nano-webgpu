import type { Context } from "../core/context";
import type { PerformanceTracker } from "../debug/performance-tracker";
import { VRAMTracker } from "../debug/vram-tracker";
import { Mat4 } from "../math/mat4";
import { Vec3 } from "../math/vec3";
import type { Camera } from "./camera";
import type { Light } from "./light";
import type { Mesh } from "./mesh";
import type { Scene } from "./scene";

export class Renderer {
	public ctx: Context;

	private depthTexture!: GPUTexture;
	private lightsBuffer!: GPUBuffer;

	private lightsDataFloat!: Float32Array;
	private lightsDataUint32!: Uint32Array;

	private globalsBindGroup!: GPUBindGroup;
	public globalsBindGroupDirty: boolean = true;

	private shadowTexture!: GPUTexture;
	private shadowSampler!: GPUSampler;
	private shadowUniformBuffer!: GPUBuffer;
	private shadowBindGroup!: GPUBindGroup;
	private shadowTextureSize = 2048;
	public shadowMatrix: Mat4 = new Mat4();

	// --- Instance Batching ---
	private instanceBatches: Map<
		string,
		{
			buffer: GPUBuffer;
			bindGroup: GPUBindGroup;
			capacity: number;
		}
	> = new Map();
	private instanceMatrixScratch: Float32Array = new Float32Array(16 * 64); // Reusable scratch for writing matrices

	constructor(ctx: Context) {
		this.ctx = ctx;
		this.resizeDepthTexture();
		this.ensureLightsBufferSize(0);
		this.initShadows();
	}

	private initShadows() {
		this.shadowTexture = this.ctx.device.createTexture({
			size: [this.shadowTextureSize, this.shadowTextureSize, 1],
			usage:
				GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
			format: "depth32float",
		});
		VRAMTracker.register(
			this.shadowTexture,
			"texture",
			"Shadow Map",
			this.shadowTextureSize * this.shadowTextureSize * 4,
			"Renderer",
		);

		this.shadowSampler = this.ctx.device.createSampler({
			compare: "less",
			magFilter: "linear",
			minFilter: "linear",
		});

		this.shadowUniformBuffer = this.ctx.device.createBuffer({
			size: 80, // mat4x4 (64) + texelSize (4) + _pad1 (4) + _pad2 (4) + _pad3 (4)
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});
		VRAMTracker.register(
			this.shadowUniformBuffer,
			"buffer",
			"Shadow Camera Matrix",
			80,
			"Renderer",
		);
		// Write default texelSize so the shader never sees 0 on the first frame
		const defaultShadowParams = new Float32Array([
			1.0 / this.shadowTextureSize,
			0, // _pad1
			0, // _pad2
			0, // _pad3
		]);
		this.ctx.device.queue.writeBuffer(
			this.shadowUniformBuffer,
			64,
			defaultShadowParams.buffer,
		);

		this.shadowBindGroup = this.ctx.device.createBindGroup({
			layout: this.ctx.pipelineManager.getShadowBindGroupLayout(),
			entries: [{ binding: 0, resource: { buffer: this.shadowUniformBuffer } }],
		});
	}

	private reinitShadowsIfNeeded(newSize: number): void {
		if (newSize === this.shadowTextureSize && this.shadowTexture) return;
		this.shadowTextureSize = newSize;
		VRAMTracker.unregister(this.shadowTexture);
		this.shadowTexture.destroy();
		this.shadowTexture = this.ctx.device.createTexture({
			size: [newSize, newSize, 1],
			usage:
				GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
			format: "depth32float",
		});
		VRAMTracker.register(
			this.shadowTexture,
			"texture",
			"Shadow Map",
			newSize * newSize * 4,
			"Renderer",
		);
		this.globalsBindGroupDirty = true;
	}

	/**
	 * Stamps the usePCF variant flag on every StandardMaterial in the scene.
	 * Called once per frame (before the main pass) when a shadow-casting light is present.
	 * Because getPipeline() is called per-mesh during the render loop, this ensures each
	 * material routes to the correct pre-compiled GPURenderPipeline variant.
	 */
	private propagateVariantToMeshes(scene: Scene, usePCF: boolean): void {
		for (const mesh of scene.meshes) {
			// biome-ignore lint/suspicious/noExplicitAny: StandardMaterial check via duck-typing
			const mat = mesh.material as any;
			if (typeof mat.usePCF === "boolean" && mat.usePCF !== usePCF) {
				mat.usePCF = usePCF;
			}
		}
	}

	private renderShadowPass(
		scene: Scene,
		commandEncoder: GPUCommandEncoder,
	): void {
		// biome-ignore lint/suspicious/noExplicitAny: disable rule for now
		let dirLight: any = null;
		for (const light of scene.lights) {
			if (
				light.constructor.name === "DirectionalLight" &&
				// biome-ignore lint/suspicious/noExplicitAny: disable rule for now
				(light as any).castShadow
			) {
				dirLight = light;
				break;
			}
		}

		if (!dirLight) return;

		this.reinitShadowsIfNeeded(dirLight.shadowMapSize);

		const lightDir = dirLight.worldMatrix.transformDirection(
			new Vec3(0, 0, -1),
		);
		const lightPos = lightDir.clone().scale(-50);

		const viewMat = new Mat4().lookAt(
			lightPos,
			new Vec3(0, 0, 0),
			new Vec3(0, 1, 0),
		);
		const projMat = new Mat4().ortho(-20, 20, -20, 20, 0.1, 100.0);

		this.shadowMatrix = projMat.multiply(viewMat);
		this.ctx.device.queue.writeBuffer(
			this.shadowUniformBuffer,
			0,
			this.shadowMatrix.values.buffer,
		);
		// Write shadow params: only texelSize at offset 64 (usePCF is now a compile-time variant)
		const shadowParams = new Float32Array([
			1.0 / this.shadowTextureSize,
			0, // _pad1
			0, // _pad2
			0, // _pad3
		]);
		this.ctx.device.queue.writeBuffer(
			this.shadowUniformBuffer,
			64,
			shadowParams.buffer,
		);

		// Stamp all scene meshes so their material picks the right compiled pipeline variant
		this.propagateVariantToMeshes(scene, dirLight.usePCF);

		const passEncoder = commandEncoder.beginRenderPass({
			colorAttachments: [],
			depthStencilAttachment: {
				view: this.shadowTexture.createView(),
				depthClearValue: 1.0,
				depthLoadOp: "clear",
				depthStoreOp: "store",
			},
		});

		passEncoder.setPipeline(this.ctx.pipelineManager.getShadowPipeline());
		passEncoder.setBindGroup(0, this.shadowBindGroup);

		// Group meshes
		const batchGroups = new Map<string, Mesh[]>();
		for (const mesh of scene.meshes) {
			if (!mesh.visible) continue;
			const key = `${mesh.geometry.id}_${mesh.material.id}`;
			let group = batchGroups.get(key);
			if (!group) {
				group = [];
				batchGroups.set(key, group);
			}
			group.push(mesh);
		}

		for (const [batchKey, batchMeshes] of batchGroups) {
			const instanceCount = batchMeshes.length;
			const representative = batchMeshes[0];

			// Assuming matrices are already updated by updateWorldMatrix
			const batch = this.instanceBatches.get(batchKey);
			if (batch) {
				passEncoder.setBindGroup(1, batch.bindGroup);
				passEncoder.setVertexBuffer(0, representative.geometry.vertexBuffer);
				passEncoder.setIndexBuffer(
					representative.geometry.indexBuffer,
					representative.geometry.indexFormat,
				);
				passEncoder.drawIndexed(
					representative.geometry.indexCount,
					instanceCount,
				);
			}
		}

		passEncoder.end();
	}

	public resizeDepthTexture() {
		if (this.depthTexture) {
			VRAMTracker.unregister(this.depthTexture);
			this.depthTexture.destroy();
		}
		const w = this.ctx.context.canvas.width || 1;
		const h = this.ctx.context.canvas.height || 1;

		this.depthTexture = this.ctx.device.createTexture({
			size: [w, h, 1],
			format: "depth24plus",
			usage: GPUTextureUsage.RENDER_ATTACHMENT,
		});

		// depth24plus = 4 bytes per pixel (padded)
		VRAMTracker.register(
			this.depthTexture,
			"texture",
			"Scene Depth Texture",
			w * h * 4,
			"Renderer",
		);
	}

	private ensureLightsBufferSize(lightCount: number) {
		const currentLimit = this.lightsDataFloat
			? (this.lightsDataFloat.length - 4) / 8
			: 0;

		if (lightCount <= currentLimit && this.lightsBuffer) {
			return;
		}

		const newLimit = Math.max(16, Math.ceil(lightCount / 16) * 16);
		const newLength = 4 + newLimit * 8;

		const newFloatArray = new Float32Array(newLength);
		const newUintArray = new Uint32Array(newFloatArray.buffer);

		if (this.lightsDataFloat) {
			newFloatArray.set(this.lightsDataFloat);
		}

		this.lightsDataFloat = newFloatArray;
		this.lightsDataUint32 = newUintArray;

		if (this.lightsBuffer) {
			VRAMTracker.unregister(this.lightsBuffer);
			this.lightsBuffer.destroy();
		}

		const bufferSize = this.lightsDataFloat.byteLength;
		this.lightsBuffer = this.ctx.device.createBuffer({
			label: "Lights Uniform Buffer",
			size: bufferSize,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		});

		VRAMTracker.register(
			this.lightsBuffer,
			"buffer",
			"Lights Uniform Buffer",
			bufferSize,
			"Renderer",
		);

		this.globalsBindGroupDirty = true;
	}

	public updateLightsBuffer(lights: Light[]) {
		const limit = lights.length;
		this.ensureLightsBufferSize(limit);

		this.lightsDataUint32[0] = limit;

		for (let i = 0; i < limit; i++) {
			const light = lights[i];
			const offset = 4 + i * 8;
			let px = light.worldMatrix.values[12];
			let py = light.worldMatrix.values[13];
			let pz = light.worldMatrix.values[14];

			if (light.constructor.name === "DirectionalLight") {
				const baseLocalAxis = new Vec3(0, 0, -1);
				const finalDirection =
					light.worldMatrix.transformDirection(baseLocalAxis);
				px = finalDirection.x;
				py = finalDirection.y;
				pz = finalDirection.z;
				if ((light as any).castShadow) {
					this.lightsDataFloat[offset + 3] = 1.0; // castShadow=true, type is always 1.0; usePCF is in shadowUniformBuffer
				} else {
					this.lightsDataFloat[offset + 3] = 0.0;
				}
			} else if (light.constructor.name === "PointLight") {
				// type encoding: 2=point no shadow, 3=point with shadow
				// biome-ignore lint/suspicious/noExplicitAny: disable rule for now
				this.lightsDataFloat[offset + 3] = (light as any).castShadow
					? 3.0
					: 2.0;
			}

			this.lightsDataFloat[offset + 0] = px;
			this.lightsDataFloat[offset + 1] = py;
			this.lightsDataFloat[offset + 2] = pz;

			const color = light.color;
			this.lightsDataFloat[offset + 4] = color.r;
			this.lightsDataFloat[offset + 5] = color.g;
			this.lightsDataFloat[offset + 6] = color.b;
			this.lightsDataFloat[offset + 7] = light.intensity;
		}

		this.ctx.device.queue.writeBuffer(
			this.lightsBuffer,
			0,
			this.lightsDataFloat.buffer,
			0,
			16 + 32 * limit,
		);
	}

	public render(
		scene: Scene,
		camera: Camera,
		perfTracker: PerformanceTracker | null,
	): void {
		if (
			camera.aspect !==
			this.ctx.context.canvas.width / this.ctx.context.canvas.height
		) {
			camera.aspect =
				this.ctx.context.canvas.width / this.ctx.context.canvas.height;
			camera.updateProjection();
			this.resizeDepthTexture();
		}

		if (this.globalsBindGroupDirty && camera.uniformBuffer) {
			this.globalsBindGroup = this.ctx.device.createBindGroup({
				label: "Scene_Globals_BindGroup",
				layout: this.ctx.pipelineManager.getGlobalsBindGroupLayout(),
				entries: [
					{ binding: 0, resource: { buffer: camera.uniformBuffer } },
					{ binding: 1, resource: { buffer: this.lightsBuffer } },

					{ binding: 2, resource: this.shadowTexture.createView() },
					{ binding: 3, resource: this.shadowSampler },
					{ binding: 4, resource: { buffer: this.shadowUniformBuffer } },
				],
			});
			this.globalsBindGroupDirty = false;
		}

		const textureView = this.ctx.context.getCurrentTexture().createView();
		const renderPassDescriptor: GPURenderPassDescriptor = {
			colorAttachments: [
				{
					view: textureView,
					// biome-ignore lint/suspicious/noExplicitAny: disable rule for now
					clearValue: scene.backgroundColor.toFloat32Array() as any,
					loadOp: "clear",
					storeOp: "store",
				},
			],
			depthStencilAttachment: {
				view: this.depthTexture.createView(),
				depthClearValue: 1.0,
				depthLoadOp: "clear",
				depthStoreOp: "store",
			},
		};

		const commandEncoder = this.ctx.device.createCommandEncoder();

		this.renderShadowPass(scene, commandEncoder);

		const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

		if (this.globalsBindGroup) {
			passEncoder.setBindGroup(0, this.globalsBindGroup);
		}

		const batchGroups = new Map<string, Mesh[]>();
		for (const mesh of scene.meshes) {
			if (!mesh.visible) continue;
			const key = `${mesh.geometry.id}_${mesh.material.id}`;
			let group = batchGroups.get(key);
			if (!group) {
				group = [];
				batchGroups.set(key, group);
			}
			group.push(mesh);
		}

		let lastPipeline: GPURenderPipeline | null = null;

		for (const [batchKey, batchMeshes] of batchGroups) {
			const instanceCount = batchMeshes.length;
			const representative = batchMeshes[0];

			const floatsNeeded = instanceCount * 16;
			if (this.instanceMatrixScratch.length < floatsNeeded) {
				this.instanceMatrixScratch = new Float32Array(
					Math.max(floatsNeeded, this.instanceMatrixScratch.length * 2),
				);
			}

			for (let i = 0; i < instanceCount; i++) {
				this.instanceMatrixScratch.set(
					batchMeshes[i].worldMatrix.values,
					i * 16,
				);
			}

			let batch = this.instanceBatches.get(batchKey);
			if (!batch || batch.capacity < instanceCount) {
				if (batch) {
					VRAMTracker.unregister(batch.buffer);
					batch.buffer.destroy();
				}

				const capacity = Math.max(
					instanceCount,
					(batch?.capacity || 0) * 2,
					16,
				);
				const bufferSize = capacity * 64;

				const buffer = this.ctx.device.createBuffer({
					label: `Instance Storage (batch ${batchKey})`,
					size: bufferSize,
					usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
				});
				VRAMTracker.register(
					buffer,
					"buffer",
					`Instance Storage (batch ${batchKey})`,
					bufferSize,
					"Renderer",
				);

				const bindGroup = this.ctx.device.createBindGroup({
					label: `Instance BindGroup (batch ${batchKey})`,
					layout: this.ctx.pipelineManager.getModelBindGroupLayout(),
					entries: [{ binding: 0, resource: { buffer } }],
				});

				batch = { buffer, bindGroup, capacity };
				this.instanceBatches.set(batchKey, batch);
			}

			this.ctx.device.queue.writeBuffer(
				batch.buffer,
				0,
				this.instanceMatrixScratch.buffer,
				0,
				instanceCount * 64,
			);

			const pipeline = representative.material.getPipeline(this.ctx);
			if (pipeline !== lastPipeline) {
				passEncoder.setPipeline(pipeline);
				lastPipeline = pipeline;
				if (perfTracker) perfTracker.recordMaterialChange();
			}

			passEncoder.setBindGroup(1, batch.bindGroup);
			passEncoder.setBindGroup(
				2,
				representative.material.getBindGroup(this.ctx),
			);
			passEncoder.setVertexBuffer(0, representative.geometry.vertexBuffer);
			passEncoder.setIndexBuffer(
				representative.geometry.indexBuffer,
				representative.geometry.indexFormat,
			);

			passEncoder.drawIndexed(
				representative.geometry.indexCount,
				instanceCount,
			);

			if (perfTracker) {
				perfTracker.recordDraw(
					representative.geometry.vertexCount * instanceCount,
					representative.geometry.indexCount * instanceCount,
				);
			}
		}

		passEncoder.end();
		this.ctx.device.queue.submit([commandEncoder.finish()]);
	}
}
