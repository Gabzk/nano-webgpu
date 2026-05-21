import type { Context } from "../core/context";
import { buildDefaultShader } from "./shaders/default";
import { postProcessShader } from "./shaders/post-process";

/**
 * PipelineManager acts as a centralized caching compiling system for GPURenderPipelines.
 * Allocates reusable bind group layouts, caches compiled standard/custom/shadow/post-processing
 * pipelines to avoid redundant shader compilation overhead, and manages standard pipeline layouts.
 */
export class PipelineManager {
	/** @internal Target context reference. */
	private ctx: Context;

	/** @internal Collection of cached standard PBR pipelines keyed by compiled variant description strings. */
	private standardPipelines: Map<string, GPURenderPipeline> = new Map();
	/** @internal Cached pipeline layout for standard material bindings. */
	private standardPipelineLayout: GPUPipelineLayout | null = null;

	/** @internal Collection of cached custom render pipelines. */
	private customPipelines: Map<string, GPURenderPipeline> = new Map();
	/** @internal Cached pipeline layout for custom materials. */
	private customPipelineLayout: GPUPipelineLayout | null = null;

	/** @internal Cached shadow map rendering pipeline. */
	private shadowPipeline: GPURenderPipeline | null = null;
	/** @internal Cached bind group layout representing shadow projection uniforms. */
	private bindGroupLayout_Shadow: GPUBindGroupLayout | null = null;

	/** @internal Cached bind group layout 0 mapping global uniforms (camera matrices, lighting parameters). */
	private bindGroupLayout0_Globals: GPUBindGroupLayout | null = null;
	/** @internal Cached bind group layout 1 mapping model transformation arrays (instancing matrices). */
	private bindGroupLayout1_Model: GPUBindGroupLayout | null = null;
	/** @internal Cached bind group layout 2 mapping material parameter values and texture bindings. */
	private bindGroupLayout2_Material: GPUBindGroupLayout | null = null;
	/** @internal Cached empty bind group layout 3 for basic custom shaders. */
	private bindGroupLayout3_Custom: GPUBindGroupLayout | null = null;
	/** @internal Cached bind group layout 3 mapping custom shader parameter buffers. */
	private bindGroupLayout3_CustomParams: GPUBindGroupLayout | null = null;

	/** @internal Collection of cached custom pipelines that receive extra parameter uniforms. */
	private customParamsPipelines: Map<string, GPURenderPipeline> = new Map();
	/** @internal Cached pipeline layout for custom param-enabled shaders. */
	private customParamsPipelineLayout: GPUPipelineLayout | null = null;

	/**
	 * Instantiates a new PipelineManager.
	 *
	 * @param ctx - Active context.
	 */
	constructor(ctx: Context) {
		this.ctx = ctx;
	}

	/**
	 * @internal Build and allocate bind group layouts if they are not already instantiated.
	 * Defines standard binding indexes and shader visibility flags.
	 */
	private buildBindGroupLayouts() {
		if (this.bindGroupLayout0_Globals) return;

		// Group 0: Globals (Camera & Lights)
		this.bindGroupLayout0_Globals = this.ctx.device.createBindGroupLayout({
			label: "Globals Bind Group Layout",
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
					buffer: { type: "uniform" }, // Camera
				},
				{
					binding: 1,
					visibility: GPUShaderStage.FRAGMENT,
					buffer: { type: "read-only-storage" }, // Lights
				},
				{
					binding: 2,
					visibility: GPUShaderStage.FRAGMENT,
					texture: { sampleType: "depth" }, // Shadow Map Depth Texture
				},
				{
					binding: 3,
					visibility: GPUShaderStage.FRAGMENT,
					sampler: { type: "comparison" }, // Shadow Map Comparison Sampler
				},
				{
					binding: 4,
					visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
					buffer: { type: "uniform" }, // Shadow viewProj matrix
				},
				{
					binding: 5,
					visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
					buffer: { type: "uniform" }, // Global render settings
				},
			],
		});

		// Group 1: Model (Storage buffer for instanced matrices)
		this.bindGroupLayout1_Model = this.ctx.device.createBindGroupLayout({
			label: "Model Bind Group Layout",
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.VERTEX,
					buffer: { type: "read-only-storage" },
				},
			],
		});

		// Group 2: Material
		this.bindGroupLayout2_Material = this.ctx.device.createBindGroupLayout({
			label: "Material Bind Group Layout",
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.FRAGMENT,
					buffer: { type: "uniform" }, // Material coefficients
				},
				{
					binding: 1,
					visibility: GPUShaderStage.FRAGMENT,
					sampler: { type: "filtering" },
				},
				{
					binding: 2,
					visibility: GPUShaderStage.FRAGMENT,
					texture: { sampleType: "float", viewDimension: "2d" }, // Albedo Map
				},
				{
					binding: 3,
					visibility: GPUShaderStage.FRAGMENT,
					texture: { sampleType: "float", viewDimension: "2d" }, // Tangent Normal Map
				},
				{
					binding: 4,
					visibility: GPUShaderStage.FRAGMENT,
					texture: { sampleType: "float", viewDimension: "2d" }, // Roughness Map
				},
				{
					binding: 5,
					visibility: GPUShaderStage.FRAGMENT,
					texture: { sampleType: "float", viewDimension: "2d" }, // Metallic Map
				},
				{
					binding: 6,
					visibility: GPUShaderStage.FRAGMENT,
					texture: { sampleType: "float", viewDimension: "2d" }, // Ambient Occlusion Map
				},
				{
					binding: 7,
					visibility: GPUShaderStage.FRAGMENT,
					texture: { sampleType: "float", viewDimension: "2d" }, // PBR Packed ORM Map
				},
			],
		});

		// Group 3: Empty Custom for advanced Shaders
		this.bindGroupLayout3_Custom = this.ctx.device.createBindGroupLayout({
			label: "Custom Empty Bind Group Layout",
			entries: [],
		});

		// Group 3: Custom with a single uniform buffer at binding 0 (for ShaderMaterial uniforms)
		this.bindGroupLayout3_CustomParams = this.ctx.device.createBindGroupLayout({
			label: "Custom Params Bind Group Layout",
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
					buffer: { type: "uniform" },
				},
			],
		});
	}

	/**
	 * @internal Configures standard interleaved vertex attribute mappings matching engine geometries.
	 * Position (3 floats), Normal (3 floats), UV (2 floats), and Color (3 floats).
	 */
	private getVertexBuffers(): GPUVertexBufferLayout[] {
		return [
			{
				attributes: [
					{ shaderLocation: 0, offset: 0, format: "float32x3" }, // Position
					{ shaderLocation: 1, offset: 12, format: "float32x3" }, // Normal
					{ shaderLocation: 2, offset: 24, format: "float32x2" }, // UV
					{ shaderLocation: 3, offset: 32, format: "float32x3" }, // Color
				],
				arrayStride: 44, // Total stride (11 floats * 4 bytes)
				stepMode: "vertex",
			},
		];
	}

	/**
	 * @internal Helper routine building uniform descriptors for primary rendering pipelines.
	 * Avoids code redundancy by defining alpha blending states and depth parameters in one place.
	 */
	private buildRenderPipelineDescriptor(
		label: string,
		layout: GPUPipelineLayout,
		shaderModule: GPUShaderModule,
		topology: GPUPrimitiveTopology = "triangle-list",
		indexFormat: GPUIndexFormat = "uint16",
		cullMode?: GPUCullMode,
		depthWriteEnabled = true,
		depthCompare: GPUCompareFunction = "less",
	): GPURenderPipelineDescriptor {
		// Use explicit override if provided, otherwise fall back to topology-based defaults
		const resolvedCullMode: GPUCullMode =
			cullMode ?? (topology === "triangle-list" ? "back" : "none");

		// Strip topologies require a stripIndexFormat matching the geometry's index buffer format.
		const stripIndexFormat: GPUIndexFormat | undefined =
			topology === "line-strip" || topology === "triangle-strip"
				? indexFormat
				: undefined;

		return {
			label,
			layout,
			vertex: {
				module: shaderModule,
				entryPoint: "vs_main",
				buffers: this.getVertexBuffers(),
			},
			fragment: {
				module: shaderModule,
				entryPoint: "fs_main",
				targets: [
					{
						format: this.ctx.format,
						blend: {
							color: {
								srcFactor: "src-alpha",
								dstFactor: "one-minus-src-alpha",
								operation: "add",
							},
							alpha: {
								srcFactor: "one",
								dstFactor: "one-minus-src-alpha",
								operation: "add",
							},
						},
					},
				],
			},
			primitive: { topology, cullMode: resolvedCullMode, stripIndexFormat },
			depthStencil: {
				depthWriteEnabled,
				depthCompare,
				format: "depth24plus",
			},
		};
	}

	/**
	 * Resolves the pipeline layout driving standard materials (includes Globals, Model, and Material bind groups).
	 *
	 * @returns The standard GPUPipelineLayout.
	 */
	public getStandardPipelineLayout(): GPUPipelineLayout {
		if (!this.standardPipelineLayout) {
			this.buildBindGroupLayouts();
			this.standardPipelineLayout = this.ctx.device.createPipelineLayout({
				bindGroupLayouts: [
					// biome-ignore lint/style/noNonNullAssertion: guaranteed by buildBindGroupLayouts
					this.bindGroupLayout0_Globals!,
					// biome-ignore lint/style/noNonNullAssertion: guaranteed by buildBindGroupLayouts
					this.bindGroupLayout1_Model!,
					// biome-ignore lint/style/noNonNullAssertion: guaranteed by buildBindGroupLayouts
					this.bindGroupLayout2_Material!,
				],
			});
		}
		return this.standardPipelineLayout;
	}

	/**
	 * Fetches or programmatically compiles a standard PBR render pipeline matching specific topologies and shadow modes.
	 * Compiles shaders lazily once and caches them to avoid duplicate compile latency.
	 *
	 * @param usePCF - If true, compiles PCF soft shadow sampling operations. Otherwise uses cheap hard shadows.
	 * @param topology - Primitive rendering topology. Defaults to `"triangle-list"`.
	 * @param indexFormat - Index buffer format used for geometry strip restarts. Defaults to `"uint16"`.
	 * @param cullMode - Culling specification.
	 * @param depthWriteEnabled - Toggle depth testing buffer updates. Defaults to `true`.
	 * @param depthCompare - Depth comparative filter function. Defaults to `"less"`.
	 * @returns The resolved GPURenderPipeline.
	 */
	public getStandardPipeline(
		usePCF: boolean,
		topology: GPUPrimitiveTopology = "triangle-list",
		indexFormat: GPUIndexFormat = "uint16",
		cullMode?: GPUCullMode,
		depthWriteEnabled = true,
		depthCompare: GPUCompareFunction = "less",
	): GPURenderPipeline {
		const cullKey = cullMode ?? "default";
		const variantKey = `${usePCF ? "pcf" : "hard"}:${topology}:${indexFormat}:${cullKey}:${depthWriteEnabled ? "dw" : "ndw"}:${depthCompare}`;
		const cached = this.standardPipelines.get(variantKey);
		if (cached) return cached;

		const shaderCode = buildDefaultShader({ usePCF });
		const shaderModule = this.ctx.device.createShaderModule({
			label: `Standard Pipeline Shader [${variantKey}]`,
			code: shaderCode,
		});

		const pipeline = this.ctx.device.createRenderPipeline(
			this.buildRenderPipelineDescriptor(
				`Standard Render Pipeline [${variantKey}]`,
				this.getStandardPipelineLayout(),
				shaderModule,
				topology,
				indexFormat,
				cullMode,
				depthWriteEnabled,
				depthCompare,
			),
		);

		this.standardPipelines.set(variantKey, pipeline);
		return pipeline;
	}

	/**
	 * Resolves the pipeline layout driving basic custom materials (includes Globals, Model, Material, and Custom bind groups).
	 *
	 * @returns The custom GPUPipelineLayout.
	 */
	public getCustomPipelineLayout(): GPUPipelineLayout {
		if (!this.customPipelineLayout) {
			this.buildBindGroupLayouts();
			this.customPipelineLayout = this.ctx.device.createPipelineLayout({
				bindGroupLayouts: [
					// biome-ignore lint/style/noNonNullAssertion: guaranteed by buildBindGroupLayouts
					this.bindGroupLayout0_Globals!,
					// biome-ignore lint/style/noNonNullAssertion: guaranteed by buildBindGroupLayouts
					this.bindGroupLayout1_Model!,
					// biome-ignore lint/style/noNonNullAssertion: guaranteed by buildBindGroupLayouts
					this.bindGroupLayout2_Material!,
					// biome-ignore lint/style/noNonNullAssertion: guaranteed by buildBindGroupLayouts
					this.bindGroupLayout3_Custom!,
				],
			});
		}
		return this.customPipelineLayout;
	}

	/**
	 * Resolves the pipeline layout driving parameter-enabled custom materials (includes Globals, Model, Material, and CustomParams bind groups).
	 *
	 * @returns The custom params GPUPipelineLayout.
	 */
	public getCustomParamsPipelineLayout(): GPUPipelineLayout {
		if (!this.customParamsPipelineLayout) {
			this.buildBindGroupLayouts();
			this.customParamsPipelineLayout = this.ctx.device.createPipelineLayout({
				bindGroupLayouts: [
					// biome-ignore lint/style/noNonNullAssertion: guaranteed by buildBindGroupLayouts
					this.bindGroupLayout0_Globals!,
					// biome-ignore lint/style/noNonNullAssertion: guaranteed by buildBindGroupLayouts
					this.bindGroupLayout1_Model!,
					// biome-ignore lint/style/noNonNullAssertion: guaranteed by buildBindGroupLayouts
					this.bindGroupLayout2_Material!,
					// biome-ignore lint/style/noNonNullAssertion: guaranteed by buildBindGroupLayouts
					this.bindGroupLayout3_CustomParams!,
				],
			});
		}
		return this.customParamsPipelineLayout;
	}

	/**
	 * Compiles or returns a cached render pipeline driving parameter-enabled ShaderMaterials.
	 * Passes configurable uniforms in group 3 binding 0.
	 *
	 * @param shaderCode - WGSL custom source string.
	 * @param topology - Primitive topology. Defaults to `"triangle-list"`.
	 * @param indexFormat - Index format used for geometry strip restarts. Defaults to `"uint16"`.
	 * @param cullMode - Face culling specification.
	 * @param depthWriteEnabled - Toggle depth testing buffer updates. Defaults to `true`.
	 * @param depthCompare - Depth comparative filter function. Defaults to `"less"`.
	 * @returns The resolved custom GPURenderPipeline.
	 */
	public getCustomPipelineWithParams(
		shaderCode: string,
		topology: GPUPrimitiveTopology = "triangle-list",
		indexFormat: GPUIndexFormat = "uint16",
		cullMode?: GPUCullMode,
		depthWriteEnabled = true,
		depthCompare: GPUCompareFunction = "less",
	): GPURenderPipeline {
		const cullKey = cullMode ?? "default";
		const cacheKey = `${shaderCode}::${topology}::${indexFormat}::${cullKey}:${depthWriteEnabled ? "dw" : "ndw"}:${depthCompare}`;
		const cached = this.customParamsPipelines.get(cacheKey);
		if (cached) return cached;

		const shaderModule = this.ctx.device.createShaderModule({
			label: "Custom Params Pipeline Shader",
			code: shaderCode,
		});

		const pipeline = this.ctx.device.createRenderPipeline(
			this.buildRenderPipelineDescriptor(
				"Custom Params Render Pipeline",
				this.getCustomParamsPipelineLayout(),
				shaderModule,
				topology,
				indexFormat,
				cullMode,
				depthWriteEnabled,
				depthCompare,
			),
		);

		this.customParamsPipelines.set(cacheKey, pipeline);
		return pipeline;
	}

	/**
	 * Compiles or returns a cached render pipeline driving simple custom ShaderMaterials without uniforms.
	 *
	 * @param shaderCode - WGSL custom source string.
	 * @param topology - Primitive topology. Defaults to `"triangle-list"`.
	 * @param indexFormat - Index format used for geometry strip restarts. Defaults to `"uint16"`.
	 * @param cullMode - Face culling specification.
	 * @param depthWriteEnabled - Toggle depth testing buffer updates. Defaults to `true`.
	 * @param depthCompare - Depth comparative filter function. Defaults to `"less"`.
	 * @returns The resolved custom GPURenderPipeline.
	 */
	public getCustomPipeline(
		shaderCode: string,
		topology: GPUPrimitiveTopology = "triangle-list",
		indexFormat: GPUIndexFormat = "uint16",
		cullMode?: GPUCullMode,
		depthWriteEnabled = true,
		depthCompare: GPUCompareFunction = "less",
	): GPURenderPipeline {
		const cullKey = cullMode ?? "default";
		const cacheKey = `${shaderCode}::${topology}::${indexFormat}::${cullKey}:${depthWriteEnabled ? "dw" : "ndw"}:${depthCompare}`;
		const cached = this.customPipelines.get(cacheKey);
		if (cached) return cached;

		const shaderModule = this.ctx.device.createShaderModule({
			label: "Custom Pipeline Shader",
			code: shaderCode,
		});

		const pipeline = this.ctx.device.createRenderPipeline(
			this.buildRenderPipelineDescriptor(
				"Custom Render Pipeline",
				this.getCustomPipelineLayout(),
				shaderModule,
				topology,
				indexFormat,
				cullMode,
				depthWriteEnabled,
				depthCompare,
			),
		);

		this.customPipelines.set(cacheKey, pipeline);
		return pipeline;
	}

	/**
	 * Resolves the bind group layout driving shadow rendering (maps light view-projection uniforms at binding 0).
	 *
	 * @returns The shadow GPUBindGroupLayout.
	 */
	public getShadowBindGroupLayout(): GPUBindGroupLayout {
		this.buildBindGroupLayouts();
		if (!this.bindGroupLayout_Shadow) {
			this.bindGroupLayout_Shadow = this.ctx.device.createBindGroupLayout({
				label: "Shadow Bind Group Layout",
				entries: [
					{
						binding: 0,
						visibility: GPUShaderStage.VERTEX,
						buffer: { type: "uniform" }, // Light ViewProj Matrix (mat4x4<f32>)
					},
				],
			});
		}
		return this.bindGroupLayout_Shadow;
	}

	/**
	 * Compiles and returns the unified shadow map generation pipeline.
	 * Employs front-face culling to mitigate shadow maps peter-panning artifacts.
	 *
	 * @returns The compiled shadow GPURenderPipeline.
	 */
	public getShadowPipeline(): GPURenderPipeline {
		if (this.shadowPipeline) return this.shadowPipeline;

		const shaderCode = `
			struct ShadowCameraUniform {
				viewProj: mat4x4<f32>,
			}
			@group(0) @binding(0) var<uniform> shadowCamera: ShadowCameraUniform;

			@group(1) @binding(0) var<storage, read> models: array<mat4x4<f32>>;

			@vertex
			fn vs_main(
				@builtin(instance_index) instanceIdx: u32,
				@location(0) position: vec3<f32>
			) -> @builtin(position) vec4<f32> {
				let modelMatrix = models[instanceIdx];
				return shadowCamera.viewProj * modelMatrix * vec4<f32>(position, 1.0);
			}

			@fragment
			fn fs_main() {}
		`;

		const shaderModule = this.ctx.device.createShaderModule({
			label: "Shadow Pipeline Shader",
			code: shaderCode,
		});

		const layout = this.ctx.device.createPipelineLayout({
			label: "Shadow Pipeline Layout",
			bindGroupLayouts: [
				this.getShadowBindGroupLayout(),
				this.getModelBindGroupLayout(),
			],
		});

		this.shadowPipeline = this.ctx.device.createRenderPipeline({
			label: "Shadow Render Pipeline",
			layout,
			vertex: {
				module: shaderModule,
				entryPoint: "vs_main",
				buffers: this.getVertexBuffers(),
			},
			primitive: { topology: "triangle-list", cullMode: "front" }, // Front-face culling for shadows helps avoid peter-panning
			depthStencil: {
				depthWriteEnabled: true,
				depthCompare: "less",
				format: "depth32float", // Standard format for shadow maps
			},
		});

		return this.shadowPipeline;
	}

	/**
	 * Resolves GPUBindGroupLayout representing global parameters.
	 *
	 * @returns Global bind group layout interface.
	 */
	public getGlobalsBindGroupLayout(): GPUBindGroupLayout {
		this.buildBindGroupLayouts();
		// biome-ignore lint/style/noNonNullAssertion: guaranteed by buildBindGroupLayouts
		return this.bindGroupLayout0_Globals!;
	}

	/**
	 * Resolves GPUBindGroupLayout representing instanced model transformation arrays.
	 *
	 * @returns Model bind group layout interface.
	 */
	public getModelBindGroupLayout(): GPUBindGroupLayout {
		this.buildBindGroupLayouts();
		// biome-ignore lint/style/noNonNullAssertion: guaranteed by buildBindGroupLayouts
		return this.bindGroupLayout1_Model!;
	}

	// --- Post Processing ---

	/** @internal Post process render pipeline. */
	private postProcessPipeline: GPURenderPipeline | null = null;
	/** @internal Post process bind group layout description. */
	private bindGroupLayout_PostProcess: GPUBindGroupLayout | null = null;

	/**
	 * Resolves the bind group layout driving fullscreen post processing passes (sampler, color attachment, render settings).
	 *
	 * @returns The post process GPUBindGroupLayout.
	 */
	public getPostProcessBindGroupLayout(): GPUBindGroupLayout {
		if (!this.bindGroupLayout_PostProcess) {
			this.bindGroupLayout_PostProcess = this.ctx.device.createBindGroupLayout({
				label: "Post Process Bind Group Layout",
				entries: [
					{
						binding: 0,
						visibility: GPUShaderStage.FRAGMENT,
						sampler: { type: "filtering" },
					},
					{
						binding: 1,
						visibility: GPUShaderStage.FRAGMENT,
						texture: { sampleType: "float", viewDimension: "2d" },
					},
					{
						binding: 2,
						visibility: GPUShaderStage.FRAGMENT,
						buffer: { type: "uniform" }, // RenderSettings (fxaa_enabled, etc)
					},
				],
			});
		}
		return this.bindGroupLayout_PostProcess;
	}

	/**
	 * Compiles and returns the unified post processing pipeline.
	 *
	 * @returns The compiled post-processing GPURenderPipeline.
	 */
	public getPostProcessPipeline(): GPURenderPipeline {
		if (this.postProcessPipeline) return this.postProcessPipeline;

		const shaderModule = this.ctx.device.createShaderModule({
			label: "Post Process Shader",
			code: postProcessShader,
		});

		const layout = this.ctx.device.createPipelineLayout({
			label: "Post Process Pipeline Layout",
			bindGroupLayouts: [this.getPostProcessBindGroupLayout()],
		});

		this.postProcessPipeline = this.ctx.device.createRenderPipeline({
			label: "Post Process Pipeline",
			layout,
			vertex: {
				module: shaderModule,
				entryPoint: "vs_main",
			},
			fragment: {
				module: shaderModule,
				entryPoint: "fs_main",
				targets: [{ format: this.ctx.format }],
			},
			primitive: { topology: "triangle-list" },
		});

		return this.postProcessPipeline;
	}
}
