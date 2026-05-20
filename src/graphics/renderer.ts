import type { Context } from "../core/context";
import type { PerformanceTracker } from "../debug/performance-tracker";
import { BatchManager } from "./batch-manager";
import type { Camera } from "./camera";
import { normalizeCullMode } from "./cull-mode";
import type { Light } from "./light";
import type { Scene } from "./scene";
import { ShadowSystem } from "./shadow-system";

export class Renderer {
	public ctx: Context;

	private depthTexture!: GPUTexture;
	private lightsBuffer!: GPUBuffer;

	private lightsDataFloat!: Float32Array;
	private lightsDataUint32!: Uint32Array;

	private globalsBindGroup!: GPUBindGroup;
	public globalsBindGroupDirty: boolean = true;

	// --- Post Processing ---
	private sceneTexture!: GPUTexture;
	private postProcessSampler!: GPUSampler;
	private postProcessBindGroup!: GPUBindGroup;
	public renderSettingsBuffer!: GPUBuffer;
	public renderSettingsData = new Uint32Array(4); // fxaa_enabled, pad1, pad2, pad3

	// --- Subsystems ---
	private shadow: ShadowSystem;
	private batcher: BatchManager;

	constructor(ctx: Context) {
		this.ctx = ctx;
		this.shadow = new ShadowSystem(ctx);
		this.batcher = new BatchManager(ctx);
		this.initPostProcess();
		this.resizeDepthTexture();
		this.ensureLightsBufferSize(0);
	}

	private initPostProcess() {
		this.renderSettingsBuffer = this.ctx.device.createBuffer({
			size: 16,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});
		// Enable FXAA by default
		this.renderSettingsData[0] = 1;
		this.ctx.device.queue.writeBuffer(
			this.renderSettingsBuffer,
			0,
			this.renderSettingsData.buffer,
		);

		this.postProcessSampler = this.ctx.device.createSampler({
			magFilter: "linear",
			minFilter: "linear",
		});
	}

	public resizeDepthTexture() {
		if (this.depthTexture) {
			this.ctx.vramTracker.unregister(this.depthTexture);
			this.depthTexture.destroy();
		}
		if (this.sceneTexture) {
			this.ctx.vramTracker.unregister(this.sceneTexture);
			this.sceneTexture.destroy();
		}

		const w = this.ctx.context.canvas.width || 1;
		const h = this.ctx.context.canvas.height || 1;

		this.depthTexture = this.ctx.device.createTexture({
			size: [w, h, 1],
			format: "depth24plus",
			usage: GPUTextureUsage.RENDER_ATTACHMENT,
		});

		// depth24plus = 4 bytes per pixel (padded)
		this.ctx.vramTracker.register(
			this.depthTexture,
			"texture",
			"Scene Depth Texture",
			w * h * 4,
			"Renderer",
		);

		this.sceneTexture = this.ctx.device.createTexture({
			size: [w, h, 1],
			format: this.ctx.format,
			usage:
				GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
		});

		this.ctx.vramTracker.register(
			this.sceneTexture,
			"texture",
			"Scene Color Texture",
			w * h * 4,
			"Renderer",
		);

		this.postProcessBindGroup = this.ctx.device.createBindGroup({
			layout: this.ctx.pipelineManager.getPostProcessBindGroupLayout(),
			entries: [
				{ binding: 0, resource: this.postProcessSampler },
				{ binding: 1, resource: this.sceneTexture.createView() },
				{ binding: 2, resource: { buffer: this.renderSettingsBuffer } },
			],
		});
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
			this.ctx.vramTracker.unregister(this.lightsBuffer);
			this.lightsBuffer.destroy();
		}

		const bufferSize = this.lightsDataFloat.byteLength;
		this.lightsBuffer = this.ctx.device.createBuffer({
			label: "Lights Uniform Buffer",
			size: bufferSize,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		});

		this.ctx.vramTracker.register(
			this.lightsBuffer,
			"buffer",
			"Lights Uniform Buffer",
			bufferSize,
			"Renderer",
		);

		this.globalsBindGroupDirty = true;
	}

	/**
	 * Uploads all light data to the GPU lights buffer.
	 * Uses polymorphic getLightData() — no instanceof checks.
	 */
	public updateLightsBuffer(lights: ReadonlyArray<Light>) {
		const limit = lights.length;
		this.ensureLightsBufferSize(limit);

		this.lightsDataUint32[0] = limit;

		for (let i = 0; i < limit; i++) {
			const data = lights[i].getLightData();
			const offset = 4 + i * 8;
			this.lightsDataFloat[offset + 0] = data.x;
			this.lightsDataFloat[offset + 1] = data.y;
			this.lightsDataFloat[offset + 2] = data.z;
			this.lightsDataFloat[offset + 3] = data.typeFlag;
			this.lightsDataFloat[offset + 4] = data.r;
			this.lightsDataFloat[offset + 5] = data.g;
			this.lightsDataFloat[offset + 6] = data.b;
			this.lightsDataFloat[offset + 7] = data.intensity;
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

		const textureView = this.ctx.context.getCurrentTexture().createView();
		const renderPassDescriptor: GPURenderPassDescriptor = {
			colorAttachments: [
				{
					view: this.sceneTexture.createView(),
					// biome-ignore lint/suspicious/noExplicitAny: Color.toFloat32Array() returns compatible type
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

		// 1. Rebuild batch groups (reused in shadow + main pass)
		this.batcher.rebuild(scene.meshes);

		// 2. Upload instance matrices (also grows buffers if needed)
		this.batcher.uploadMatrices(perfTracker);

		// 3. Shadow pass (via ShadowSystem)
		const shadowRendered = this.shadow.renderPass(
			commandEncoder,
			scene.lights,
			camera,
			this.batcher.getGroups(),
			this.batcher.getInstanceBatches(),
			scene.meshes,
		);
		if (shadowRendered) {
			this.globalsBindGroupDirty = true;
		}

		// 4. (Re)build globals bind group if dirty
		if (this.globalsBindGroupDirty && camera.uniformBuffer) {
			this.globalsBindGroup = this.ctx.device.createBindGroup({
				label: "Scene_Globals_BindGroup",
				layout: this.ctx.pipelineManager.getGlobalsBindGroupLayout(),
				entries: [
					{ binding: 0, resource: { buffer: camera.uniformBuffer } },
					{ binding: 1, resource: { buffer: this.lightsBuffer } },
					{ binding: 2, resource: this.shadow.texture.createView() },
					{ binding: 3, resource: this.shadow.sampler },
					{ binding: 4, resource: { buffer: this.shadow.uniformBuffer } },
					{ binding: 5, resource: { buffer: this.renderSettingsBuffer } },
				],
			});
			this.globalsBindGroupDirty = false;
		}

		// 5. Main render pass
		const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

		if (this.globalsBindGroup) {
			passEncoder.setBindGroup(0, this.globalsBindGroup);
		}

		let lastPipeline: GPURenderPipeline | null = null;

		for (const [batchKey, batchMeshes] of this.batcher.getGroups()) {
			if (batchMeshes.length === 0) continue;
			const instanceCount = batchMeshes.length;
			const representative = batchMeshes[0];

			const batch = this.batcher.getBatch(batchKey);
			if (!batch) continue;

			const topology = representative.geometry.topology;
			const indexFormat = representative.geometry.indexFormat;
			const materialCull = normalizeCullMode(representative.material.cullMode);
			const geometryCull = normalizeCullMode(representative.geometry.cullMode);
			const cullMode = materialCull ?? geometryCull;
			const pipeline = representative.material.getPipeline(
				this.ctx,
				topology,
				indexFormat,
				cullMode,
			);
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

		// 6. Post-processing pass
		const postProcessPassDescriptor: GPURenderPassDescriptor = {
			colorAttachments: [
				{
					view: textureView,
					clearValue: { r: 0, g: 0, b: 0, a: 1 },
					loadOp: "clear",
					storeOp: "store",
				},
			],
		};

		const ppEncoder = commandEncoder.beginRenderPass(postProcessPassDescriptor);
		ppEncoder.setPipeline(this.ctx.pipelineManager.getPostProcessPipeline());
		ppEncoder.setBindGroup(0, this.postProcessBindGroup);
		ppEncoder.draw(3); // Full-screen triangle
		ppEncoder.end();

		this.ctx.device.queue.submit([commandEncoder.finish()]);
	}
}
