import type { Context } from "../core/context";
import type { PerformanceTracker } from "../debug/performance-tracker";
import { BatchManager } from "./batch-manager";
import type { Camera } from "./camera";
import { normalizeCullMode } from "./cull-mode";
import type { Light } from "./light";
import type { Scene } from "./scene";
import { ShadowSystem } from "./shadow-system";

/**
 * Renderer coordinates the forward rendering pipeline.
 * It manages core presentation textures (depth attachments, HDR color buffers), aggregates and uploads
 * light properties to storage buffers, compiles global viewport/ambient uniform bind groups, drives instanced
 * drawing via `BatchManager`, runs directional shadow map passes via `ShadowSystem`, supports multi-pass overlays
 * (using the `.nextPass` material feature), and applies fullscreen post-processing FXAA filters.
 */
export class Renderer {
	/** Parent context reference. */
	public ctx: Context;

	/** @internal Scene depth buffer texture. */
	private depthTexture!: GPUTexture;
	/** @internal Storage buffer holding packed light characteristics. */
	private lightsBuffer!: GPUBuffer;

	/** @internal CPU-side float cache mapping light fields. */
	private lightsDataFloat!: Float32Array;
	/** @internal CPU-side unsigned integer view mapping light count fields. */
	private lightsDataUint32!: Uint32Array;

	/** @internal Resolved global variables bind group containing camera and lights uniforms. */
	private globalsBindGroup!: GPUBindGroup;
	/** Flag indicating if global uniform matrices or light properties changed, requiring bind group re-creation. */
	public globalsBindGroupDirty: boolean = true;

	// --- Post Processing ---
	/** @internal Fullscreen color buffer captured prior to post-processing passes. */
	private sceneTexture!: GPUTexture;
	/** @internal Cached view of sceneTexture. */
	private sceneTextureView!: GPUTextureView;
	/** @internal Cached view of depthTexture. */
	private depthTextureView!: GPUTextureView;
	/** @internal Color buffer interpolation sampler. */
	private postProcessSampler!: GPUSampler;
	/** @internal Post-processing bind group containing scene color and sampler structures. */
	private postProcessBindGroup!: GPUBindGroup;
	/** Uniform buffer containing FXAA configuration flags and accumulated frame time. */
	public renderSettingsBuffer!: GPUBuffer;
	/** float32 render settings array. [0] = FXAA enable flag, [1] = elapsed seconds. */
	public renderSettingsFloat = new Float32Array(4);
	/** uint32 render settings array mapping the float array buffer directly. */
	public renderSettingsUint32 = new Uint32Array(
		this.renderSettingsFloat.buffer,
	);
	/** Accumulated rendering time in seconds. Driving shader animations. */
	public elapsedTime = 0;

	// --- Subsystems ---
	/** Directional orthographic shadow pass controller. */
	private shadow: ShadowSystem;
	/** Instanced geometry batching coordinator. */
	private batcher: BatchManager;

	/**
	 * Instantiates a new Renderer, allocating uniform buffers, depth attachments,
	 * and post-processing dependencies.
	 *
	 * @param ctx - Active context.
	 */
	constructor(ctx: Context) {
		this.ctx = ctx;
		this.shadow = new ShadowSystem(ctx);
		this.batcher = new BatchManager(ctx);
		this.initPostProcess();
		this.resizeDepthTexture();
		this.ensureLightsBufferSize(0);
	}

	/**
	 * @internal Allocates fullscreen post processing render parameters.
	 */
	private initPostProcess() {
		this.renderSettingsBuffer = this.ctx.device.createBuffer({
			size: 16,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});
		// Enable FXAA by default
		this.renderSettingsUint32[0] = 1;
		this.ctx.device.queue.writeBuffer(
			this.renderSettingsBuffer,
			0,
			this.renderSettingsFloat.buffer,
		);

		this.postProcessSampler = this.ctx.device.createSampler({
			magFilter: "linear",
			minFilter: "linear",
		});
	}

	/**
	 * Re-allocates presentation targets (depth textures, intermediate color buffers)
	 * to match updated canvas sizes.
	 */
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
		this.depthTextureView = this.depthTexture.createView();

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
		this.sceneTextureView = this.sceneTexture.createView();

		this.postProcessBindGroup = this.ctx.device.createBindGroup({
			layout: this.ctx.pipelineManager.getPostProcessBindGroupLayout(),
			entries: [
				{ binding: 0, resource: this.postProcessSampler },
				{ binding: 1, resource: this.sceneTextureView },
				{ binding: 2, resource: { buffer: this.renderSettingsBuffer } },
			],
		});
	}

	/**
	 * @internal Dynamically enlarges the light storage buffer in memory if the active light count
	 * exceeds current allocations. Allocates in increments of 16 lights.
	 */
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
	 * Extracts light properties and updates the GPU storage buffers.
	 *
	 * @param lights - Current list of active lights in the scene.
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

	/**
	 * Computes and submits the complete rendering pass commands for the active frame.
	 * Groups meshes into instanced batches, executes shadow passes, resolves global variables,
	 * draws PBR base passes, runs secondary overlay passes (outline shaders), and draws fullscreen FXAA quads.
	 *
	 * @param scene - Source Scene node hierarchy.
	 * @param camera - Active viewport camera.
	 * @param perfTracker - Performance statistics recorder.
	 * @param dt - Delta time in seconds since the last frame.
	 */
	public render(
		scene: Scene,
		camera: Camera,
		perfTracker: PerformanceTracker | null,
		dt = 0,
	): void {
		// Update elapsed time for shader animations (settings.time_bits = bitcast of f32 seconds)
		this.elapsedTime += dt;
		this.renderSettingsFloat[1] = this.elapsedTime;
		this.ctx.device.queue.writeBuffer(
			this.renderSettingsBuffer,
			4,
			this.renderSettingsFloat.buffer,
			4,
			4,
		);
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
					view: this.sceneTextureView,
					// biome-ignore lint/suspicious/noExplicitAny: native clear array translation
					clearValue: scene.backgroundColor.toFloat32Array() as any,
					loadOp: "clear",
					storeOp: "store",
				},
			],
			depthStencilAttachment: {
				view: this.depthTextureView,
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
			const cullMode = normalizeCullMode(representative.material.cullMode);
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
				representative.material.getBindGroup(this.ctx, topology, indexFormat),
			);
			// Group 3: custom shader uniforms (ShaderMaterial only — null for StandardMaterial)
			const paramsGroup = representative.material.getParamsBindGroup(this.ctx);
			if (paramsGroup) passEncoder.setBindGroup(3, paramsGroup);

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

		// 5b. Next pass.
		// Re-renders each batch whose primary material has a `.nextPass` set,
		// using the next-pass material with the same instance matrices and geometry.
		for (const [batchKey, batchMeshes] of this.batcher.getGroups()) {
			if (batchMeshes.length === 0) continue;
			const representative = batchMeshes[0];
			const nextPass = representative.material.nextPass;
			if (!nextPass) continue;

			const batch = this.batcher.getBatch(batchKey);
			if (!batch) continue;

			const instanceCount = batchMeshes.length;
			const topology = representative.geometry.topology;
			const indexFormat = representative.geometry.indexFormat;
			const cullMode = normalizeCullMode(nextPass.cullMode);

			// Configure safe overlay defaults for the next pass so it renders cleanly on top of the base mesh
			const originalDepthWrite = nextPass.depthWriteEnabled;
			const originalDepthCompare = nextPass.depthCompare;

			// If the user hasn't customized the next pass depth settings, use overlay defaults
			if (nextPass.depthCompare === "less") {
				nextPass.depthCompare = "less-equal";
			}
			nextPass.depthWriteEnabled = false;

			const nextPipeline = nextPass.getPipeline(
				this.ctx,
				topology,
				indexFormat,
				cullMode,
			);

			// Restore original material depth properties
			nextPass.depthWriteEnabled = originalDepthWrite;
			nextPass.depthCompare = originalDepthCompare;

			passEncoder.setPipeline(nextPipeline);
			if (perfTracker) perfTracker.recordMaterialChange();

			passEncoder.setBindGroup(1, batch.bindGroup);
			passEncoder.setBindGroup(
				2,
				nextPass.getBindGroup(this.ctx, topology, indexFormat),
			);
			const nextParamsGroup = nextPass.getParamsBindGroup(this.ctx);
			if (nextParamsGroup) passEncoder.setBindGroup(3, nextParamsGroup);

			passEncoder.setVertexBuffer(0, representative.geometry.vertexBuffer);
			passEncoder.setIndexBuffer(
				representative.geometry.indexBuffer,
				indexFormat,
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

	/**
	 * Releases depth targets, color buffers, lights storage buffers, and cascades destruction to subsystems.
	 */
	public destroy(): void {
		if (this.shadow) {
			this.shadow.destroy();
		}
		if (this.batcher) {
			this.batcher.destroy();
		}
		if (this.depthTexture) {
			this.ctx.vramTracker.unregister(this.depthTexture);
			this.depthTexture.destroy();
			// @ts-expect-error - allow cleanup reference assignment
			this.depthTexture = null;
		}
		if (this.sceneTexture) {
			this.ctx.vramTracker.unregister(this.sceneTexture);
			this.sceneTexture.destroy();
			// @ts-expect-error - allow cleanup reference assignment
			this.sceneTexture = null;
		}
		if (this.lightsBuffer) {
			this.ctx.vramTracker.unregister(this.lightsBuffer);
			this.lightsBuffer.destroy();
			// @ts-expect-error - allow cleanup reference assignment
			this.lightsBuffer = null;
		}
		// @ts-expect-error - allow cleanup reference assignment
		this.sceneTextureView = null;
		// @ts-expect-error - allow cleanup reference assignment
		this.depthTextureView = null;
		if (this.renderSettingsBuffer) {
			this.renderSettingsBuffer.destroy();
			// @ts-expect-error - allow cleanup reference assignment
			this.renderSettingsBuffer = null;
		}
		// @ts-expect-error - allow cleanup reference assignment
		this.globalsBindGroup = null;
		// @ts-expect-error - allow cleanup reference assignment
		this.postProcessBindGroup = null;
		// @ts-expect-error - allow cleanup reference assignment
		this.postProcessSampler = null;
	}
}
