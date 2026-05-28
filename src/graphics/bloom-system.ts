import type { Context } from "../core/context";
import {
	bloomBrightPassShader,
	bloomBlurHShader,
	bloomBlurVShader,
} from "./shaders/chunks/bloom.chunk";

/**
 * Configuration options for the Bloom post-processing effect.
 *
 * @group Graphics
 */
export interface BloomOptions {
	/**
	 * Enables or disables the bloom effect. Defaults to `false`.
	 * When disabled, the post-process pass receives a transparent black texture.
	 */
	enabled: boolean;
	/**
	 * Luminance threshold above which bloom is applied.
	 * Pixels with luma below this value contribute no bloom. Defaults to `0.8`.
	 */
	threshold: number;
	/**
	 * Soft-knee width around the threshold for smooth bloom onset. Defaults to `0.1`.
	 */
	knee: number;
	/**
	 * Bloom intensity multiplier blended additively onto the final scene. Defaults to `0.5`.
	 */
	intensity: number;
	/**
	 * Number of full blur iterations (each adds one H + one V pass). Defaults to `3`.
	 * Higher values produce a wider, softer glow at the cost of more GPU passes.
	 */
	passes: number;
}

/**
 * BloomSystem manages the multi-pass bloom post-processing effect.
 * Uses a bright-pass extraction followed by separable Gaussian blur ping-pong,
 * producing a bloom texture that the final post-process shader blends additively.
 *
 * @group Graphics
 */
export class BloomSystem {
	/** Active bloom configuration options. */
	public options: BloomOptions;

	/** @internal Shared linear sampler for all bloom passes. */
	private sampler!: GPUSampler;

	/** @internal Bloom ping-pong texture A (bright-pass target / blur input). */
	private texA!: GPUTexture;
	/** @internal Bloom ping-pong texture B (blur intermediate). */
	private texB!: GPUTexture;
	/** @internal Cached view of texA. */
	private viewA!: GPUTextureView;
	/** @internal Cached view of texB. */
	private viewB!: GPUTextureView;

	/** @internal Uniform buffer for bloom params (threshold, knee, intensity). */
	private paramsBuffer!: GPUBuffer;
	/** @internal Bind group layout for the bright-pass (sampler + scene + params). */
	private brightPassLayout!: GPUBindGroupLayout;
	/** @internal Bind group layout for blur passes (sampler + input tex). */
	private blurLayout!: GPUBindGroupLayout;

	/** @internal Bind group for the bright-pass (reads sceneTexture). */
	private brightPassBindGroup!: GPUBindGroup;
	/** @internal Bind group for blur H pass reading texA. */
	private blurHBindGroupA!: GPUBindGroup;
	/** @internal Bind group for blur V pass reading texB. */
	private blurVBindGroupB!: GPUBindGroup;
	/** @internal Bind group for blur H pass reading texB (extra passes). */
	private blurHBindGroupB!: GPUBindGroup;
	/** @internal Bind group for blur V pass reading texA (extra passes). */
	private blurVBindGroupA!: GPUBindGroup;

	/** @internal Bright-pass render pipeline. */
	private brightPassPipeline!: GPURenderPipeline;
	/** @internal Horizontal Gaussian blur pipeline. */
	private blurHPipeline!: GPURenderPipeline;
	/** @internal Vertical Gaussian blur pipeline. */
	private blurVPipeline!: GPURenderPipeline;

	/** @internal Current canvas width. */
	private width = 1;
	/** @internal Current canvas height. */
	private height = 1;

	/** @internal Texture format used for bloom buffers. */
	private readonly format: GPUTextureFormat = "rgba8unorm";

	/**
	 * Creates a BloomSystem and builds all internal GPU pipelines.
	 *
	 * @param ctx - Active context.
	 * @param options - Initial bloom configuration.
	 */
	constructor(ctx: Context, options: Partial<BloomOptions> = {}) {
		this.options = {
			enabled: options.enabled ?? false,
			threshold: options.threshold ?? 0.8,
			knee: options.knee ?? 0.1,
			intensity: options.intensity ?? 0.5,
			passes: options.passes ?? 3,
		};
		this.buildPipelines(ctx);
		this.buildDummyTextures(ctx);
	}

	/** @internal Builds all shared bloom pipelines and layouts. */
	private buildPipelines(ctx: Context): void {
		this.sampler = ctx.device.createSampler({
			minFilter: "linear",
			magFilter: "linear",
		});

		// ── Params uniform buffer (16 bytes: threshold, knee, intensity, _pad) ──
		this.paramsBuffer = ctx.device.createBuffer({
			label: "Bloom_Params_Buffer",
			size: 16,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		// ── Bright-pass layout: sampler + scene texture + params ──
		this.brightPassLayout = ctx.device.createBindGroupLayout({
			label: "Bloom_BrightPass_Layout",
			entries: [
				{ binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
				{ binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
				{ binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
			],
		});

		// ── Blur layout: sampler + input texture ──
		this.blurLayout = ctx.device.createBindGroupLayout({
			label: "Bloom_Blur_Layout",
			entries: [
				{ binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
				{ binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
			],
		});

		const fullscreenLayout = ctx.device.createPipelineLayout({
			label: "Bloom_BrightPass_PipelineLayout",
			bindGroupLayouts: [this.brightPassLayout],
		});

		const blurPipelineLayout = ctx.device.createPipelineLayout({
			label: "Bloom_Blur_PipelineLayout",
			bindGroupLayouts: [this.blurLayout],
		});

		// ── Bright-pass pipeline ──
		const brightMod = ctx.device.createShaderModule({
			label: "Bloom_BrightPass_Shader",
			code: bloomBrightPassShader,
		});
		this.brightPassPipeline = ctx.device.createRenderPipeline({
			label: "Bloom_BrightPass_Pipeline",
			layout: fullscreenLayout,
			vertex: { module: brightMod, entryPoint: "vs_main" },
			fragment: { module: brightMod, entryPoint: "fs_main", targets: [{ format: this.format }] },
			primitive: { topology: "triangle-list" },
		});

		// ── Horizontal blur pipeline ──
		const blurHMod = ctx.device.createShaderModule({
			label: "Bloom_BlurH_Shader",
			code: bloomBlurHShader,
		});
		this.blurHPipeline = ctx.device.createRenderPipeline({
			label: "Bloom_BlurH_Pipeline",
			layout: blurPipelineLayout,
			vertex: { module: blurHMod, entryPoint: "vs_main" },
			fragment: { module: blurHMod, entryPoint: "fs_main", targets: [{ format: this.format }] },
			primitive: { topology: "triangle-list" },
		});

		// ── Vertical blur pipeline ──
		const blurVMod = ctx.device.createShaderModule({
			label: "Bloom_BlurV_Shader",
			code: bloomBlurVShader,
		});
		this.blurVPipeline = ctx.device.createRenderPipeline({
			label: "Bloom_BlurV_Pipeline",
			layout: blurPipelineLayout,
			vertex: { module: blurVMod, entryPoint: "vs_main" },
			fragment: { module: blurVMod, entryPoint: "fs_main", targets: [{ format: this.format }] },
			primitive: { topology: "triangle-list" },
		});
	}

	/** @internal Creates 1×1 dummy textures so bind groups are always valid before the first resize. */
	private buildDummyTextures(ctx: Context): void {
		this.texA = ctx.device.createTexture({
			label: "Bloom_TexA",
			size: [1, 1, 1],
			format: this.format,
			usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
		});
		this.texB = ctx.device.createTexture({
			label: "Bloom_TexB",
			size: [1, 1, 1],
			format: this.format,
			usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
		});
		this.viewA = this.texA.createView();
		this.viewB = this.texB.createView();
	}

	/**
	 * Reallocates bloom ping-pong textures to match the new canvas dimensions.
	 * Must be called whenever the canvas resizes.
	 *
	 * @param ctx - Active context.
	 * @param width - New canvas pixel width.
	 * @param height - New canvas pixel height.
	 * @param sceneTextureView - The main scene color texture view (for the bright-pass bind group).
	 */
	public resize(ctx: Context, width: number, height: number, sceneTextureView: GPUTextureView): void {
		// Quarter resolution bloom for premium look and high performance!
		const bloomWidth = Math.max(1, Math.floor(width / 4));
		const bloomHeight = Math.max(1, Math.floor(height / 4));
		this.width = bloomWidth;
		this.height = bloomHeight;

		if (this.texA) this.texA.destroy();
		if (this.texB) this.texB.destroy();

		this.texA = ctx.device.createTexture({
			label: "Bloom_TexA",
			size: [bloomWidth, bloomHeight, 1],
			format: this.format,
			usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
		});
		this.texB = ctx.device.createTexture({
			label: "Bloom_TexB",
			size: [bloomWidth, bloomHeight, 1],
			format: this.format,
			usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
		});
		this.viewA = this.texA.createView();
		this.viewB = this.texB.createView();

		this.rebuildBindGroups(ctx, sceneTextureView);
	}

	/** @internal Rebuilds all bind groups after resize or scene texture change. */
	public rebuildBindGroups(ctx: Context, sceneTextureView: GPUTextureView): void {
		this.brightPassBindGroup = ctx.device.createBindGroup({
			label: "Bloom_BrightPass_BindGroup",
			layout: this.brightPassLayout,
			entries: [
				{ binding: 0, resource: this.sampler },
				{ binding: 1, resource: sceneTextureView },
				{ binding: 2, resource: { buffer: this.paramsBuffer } },
			],
		});

		this.blurHBindGroupA = ctx.device.createBindGroup({
			label: "Bloom_BlurH_A_BindGroup",
			layout: this.blurLayout,
			entries: [
				{ binding: 0, resource: this.sampler },
				{ binding: 1, resource: this.viewA },
			],
		});
		this.blurVBindGroupB = ctx.device.createBindGroup({
			label: "Bloom_BlurV_B_BindGroup",
			layout: this.blurLayout,
			entries: [
				{ binding: 0, resource: this.sampler },
				{ binding: 1, resource: this.viewB },
			],
		});
		this.blurHBindGroupB = ctx.device.createBindGroup({
			label: "Bloom_BlurH_B_BindGroup",
			layout: this.blurLayout,
			entries: [
				{ binding: 0, resource: this.sampler },
				{ binding: 1, resource: this.viewB },
			],
		});
		this.blurVBindGroupA = ctx.device.createBindGroup({
			label: "Bloom_BlurV_A_BindGroup",
			layout: this.blurLayout,
			entries: [
				{ binding: 0, resource: this.sampler },
				{ binding: 1, resource: this.viewA },
			],
		});
	}

	/**
	 * The final bloom texture view to bind in the post-process pass.
	 * After `renderPasses()`, this contains the blurred bright regions.
	 * When bloom is disabled it is still a valid (black) texture.
	 */
	public get bloomTextureView(): GPUTextureView {
		// After an odd number of blur passes, result is in texA (written by the last V pass into texA).
		// After an even number the result is in texB.
		// Since passes ≥ 1, the last V-pass target alternates:
		//   pass 1: bright→A, blurH A→B, blurV B→A  → result in A
		//   pass 2: blurH A→B, blurV B→A              → result in A
		// Always ends in texA because we start with bright→A and each round-trip ends in A.
		return this.viewA;
	}

	/**
	 * Executes all bloom render passes (bright-pass + N×blur) into the ping-pong textures.
	 * Call this between the main render pass and the post-process pass.
	 *
	 * @param ctx - Active context.
	 * @param commandEncoder - Current frame command encoder.
	 */
	public renderPasses(ctx: Context, commandEncoder: GPUCommandEncoder): void {
		// Always upload params (cheap write, ensures consistency)
		const paramsData = new Float32Array([
			this.options.threshold,
			this.options.knee,
			this.options.intensity,
			0.0,
		]);
		ctx.device.queue.writeBuffer(this.paramsBuffer, 0, paramsData);

		if (!this.options.enabled) {
			// Clear texA to black so the post-process shader sees no bloom
			const clearPass = commandEncoder.beginRenderPass({
				colorAttachments: [{
					view: this.viewA,
					clearValue: { r: 0, g: 0, b: 0, a: 1 },
					loadOp: "clear",
					storeOp: "store",
				}],
			});
			clearPass.end();
			return;
		}

		// ── Pass 1: Bright-pass → texA ────────────────────────────────────────
		{
			const pass = commandEncoder.beginRenderPass({
				colorAttachments: [{
					view: this.viewA,
					clearValue: { r: 0, g: 0, b: 0, a: 1 },
					loadOp: "clear",
					storeOp: "store",
				}],
			});
			pass.setPipeline(this.brightPassPipeline);
			pass.setBindGroup(0, this.brightPassBindGroup);
			pass.draw(3);
			pass.end();
		}

		// ── Passes 2…N+1: Gaussian ping-pong ─────────────────────────────────
		// Each iteration: blurH(A→B) then blurV(B→A), so result is always in A.
		const iterations = Math.max(1, this.options.passes);
		for (let i = 0; i < iterations; i++) {
			// Horizontal: A → B
			{
				const pass = commandEncoder.beginRenderPass({
					colorAttachments: [{
						view: this.viewB,
						clearValue: { r: 0, g: 0, b: 0, a: 1 },
						loadOp: "clear",
						storeOp: "store",
					}],
				});
				pass.setPipeline(this.blurHPipeline);
				pass.setBindGroup(0, this.blurHBindGroupA);
				pass.draw(3);
				pass.end();
			}
			// Vertical: B → A
			{
				const pass = commandEncoder.beginRenderPass({
					colorAttachments: [{
						view: this.viewA,
						clearValue: { r: 0, g: 0, b: 0, a: 1 },
						loadOp: "clear",
						storeOp: "store",
					}],
				});
				pass.setPipeline(this.blurVPipeline);
				pass.setBindGroup(0, this.blurVBindGroupB);
				pass.draw(3);
				pass.end();
			}
		}
	}

	/**
	 * Releases all GPU resources owned by the bloom system.
	 */
	public destroy(): void {
		if (this.texA) this.texA.destroy();
		if (this.texB) this.texB.destroy();
		if (this.paramsBuffer) this.paramsBuffer.destroy();
	}
}
