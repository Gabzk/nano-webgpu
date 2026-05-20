import type { Context } from "../core/context";
import { buildDefaultShader } from "./shaders/default";
import { postProcessShader } from "./shaders/post-process";

export class PipelineManager {
	private ctx: Context;

	// Keyed by variant string, e.g. "pcf" | "hard"
	private standardPipelines: Map<string, GPURenderPipeline> = new Map();
	private standardPipelineLayout: GPUPipelineLayout | null = null;

	private customPipelines: Map<string, GPURenderPipeline> = new Map();
	private customPipelineLayout: GPUPipelineLayout | null = null;

	private shadowPipeline: GPURenderPipeline | null = null;
	private bindGroupLayout_Shadow: GPUBindGroupLayout | null = null;

	private bindGroupLayout0_Globals: GPUBindGroupLayout | null = null;
	private bindGroupLayout1_Model: GPUBindGroupLayout | null = null;
	private bindGroupLayout2_Material: GPUBindGroupLayout | null = null;
	private bindGroupLayout3_Custom: GPUBindGroupLayout | null = null;

	constructor(ctx: Context) {
		this.ctx = ctx;
	}

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
					sampler: { type: "comparison" }, // Shadow Map Sampler
				},
				{
					binding: 4,
					visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
					buffer: { type: "uniform" }, // Shadow matrix
				},
				{
					binding: 5,
					visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
					buffer: { type: "uniform" }, // Render settings
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
					buffer: { type: "uniform" },
				},
				{
					binding: 1,
					visibility: GPUShaderStage.FRAGMENT,
					sampler: { type: "filtering" },
				},
				{
					binding: 2,
					visibility: GPUShaderStage.FRAGMENT,
					texture: { sampleType: "float", viewDimension: "2d" },
				}, // Albedo
				{
					binding: 3,
					visibility: GPUShaderStage.FRAGMENT,
					texture: { sampleType: "float", viewDimension: "2d" },
				}, // Normal
				{
					binding: 4,
					visibility: GPUShaderStage.FRAGMENT,
					texture: { sampleType: "float", viewDimension: "2d" },
				}, // Roughness
				{
					binding: 5,
					visibility: GPUShaderStage.FRAGMENT,
					texture: { sampleType: "float", viewDimension: "2d" },
				}, // Metallic
				{
					binding: 6,
					visibility: GPUShaderStage.FRAGMENT,
					texture: { sampleType: "float", viewDimension: "2d" },
				}, // AO
				{
					binding: 7,
					visibility: GPUShaderStage.FRAGMENT,
					texture: { sampleType: "float", viewDimension: "2d" },
				}, // ORM
			],
		});

		// Group 3: Empty Custom for advanced Shaders
		this.bindGroupLayout3_Custom = this.ctx.device.createBindGroupLayout({
			label: "Custom Empty Bind Group Layout",
			entries: [], // Can be customized later by advanced users via reflection, for now empty
		});
	}

	private getVertexBuffers(): GPUVertexBufferLayout[] {
		return [
			{
				attributes: [
					{ shaderLocation: 0, offset: 0, format: "float32x3" }, // Position
					{ shaderLocation: 1, offset: 12, format: "float32x3" }, // Normal
					{ shaderLocation: 2, offset: 24, format: "float32x2" }, // UV
					{ shaderLocation: 3, offset: 32, format: "float32x3" }, // Color
				],
				arrayStride: 44,
				stepMode: "vertex",
			},
		];
	}

	/**
	 * Shared descriptor builder for all main (non-shadow) render pipelines.
	 * Eliminates the ~40-line duplication between standard and custom pipelines.
	 */
	private buildRenderPipelineDescriptor(
		label: string,
		layout: GPUPipelineLayout,
		shaderModule: GPUShaderModule,
		topology: GPUPrimitiveTopology = "triangle-list",
		indexFormat: GPUIndexFormat = "uint16",
		cullMode?: GPUCullMode,
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
				depthWriteEnabled: true,
				depthCompare: "less",
				format: "depth24plus",
			},
		};
	}

	public getStandardPipelineLayout(): GPUPipelineLayout {
		if (!this.standardPipelineLayout) {
			this.buildBindGroupLayouts();
			this.standardPipelineLayout = this.ctx.device.createPipelineLayout({
				bindGroupLayouts: [
					// biome-ignore lint/style/noNonNullAssertion: disable rule for now
					this.bindGroupLayout0_Globals!,
					// biome-ignore lint/style/noNonNullAssertion: disable rule for now
					this.bindGroupLayout1_Model!,
					// biome-ignore lint/style/noNonNullAssertion: disable rule for now
					this.bindGroupLayout2_Material!,
				],
			});
		}
		return this.standardPipelineLayout;
	}

	/**
	 * Returns (and lazily compiles) the standard PBR pipeline for the requested variant.
	 * Each unique variant is compiled once and cached — subsequent calls are O(1) map lookups.
	 *
	 * @param usePCF - true → 3×3 PCF soft shadows; false → single-sample hard shadows (~9× cheaper).
	 * @param topology - WebGPU primitive topology (default: "triangle-list").
	 * @param indexFormat - Index buffer format used (relevant for strip topologies).
	 */
	public getStandardPipeline(
		usePCF: boolean,
		topology: GPUPrimitiveTopology = "triangle-list",
		indexFormat: GPUIndexFormat = "uint16",
		cullMode?: GPUCullMode,
	): GPURenderPipeline {
		const cullKey = cullMode ?? "default";
		const variantKey = `${usePCF ? "pcf" : "hard"}:${topology}:${indexFormat}:${cullKey}`;
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
			),
		);

		this.standardPipelines.set(variantKey, pipeline);
		return pipeline;
	}

	public getCustomPipelineLayout(): GPUPipelineLayout {
		if (!this.customPipelineLayout) {
			this.buildBindGroupLayouts();
			// Custom supports group 3
			this.customPipelineLayout = this.ctx.device.createPipelineLayout({
				bindGroupLayouts: [
					// biome-ignore lint/style/noNonNullAssertion: disable rule for now
					this.bindGroupLayout0_Globals!,
					// biome-ignore lint/style/noNonNullAssertion: disable rule for now
					this.bindGroupLayout1_Model!,
					// biome-ignore lint/style/noNonNullAssertion: disable rule for now
					this.bindGroupLayout2_Material!,
					// biome-ignore lint/style/noNonNullAssertion: disable rule for now
					this.bindGroupLayout3_Custom!,
				],
			});
		}
		return this.customPipelineLayout;
	}

	public getCustomPipeline(
		shaderCode: string,
		topology: GPUPrimitiveTopology = "triangle-list",
		indexFormat: GPUIndexFormat = "uint16",
		cullMode?: GPUCullMode,
	): GPURenderPipeline {
		const cullKey = cullMode ?? "default";
		const cacheKey = `${shaderCode}::${topology}::${indexFormat}::${cullKey}`;
		if (this.customPipelines.has(cacheKey)) {
			// biome-ignore lint/style/noNonNullAssertion: disable rule for now
			return this.customPipelines.get(cacheKey)!;
		}

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
			),
		);

		this.customPipelines.set(cacheKey, pipeline);
		return pipeline;
	}

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

	public getGlobalsBindGroupLayout(): GPUBindGroupLayout {
		this.buildBindGroupLayouts();
		// biome-ignore lint/style/noNonNullAssertion: disable rule for now
		return this.bindGroupLayout0_Globals!;
	}

	public getModelBindGroupLayout(): GPUBindGroupLayout {
		this.buildBindGroupLayouts();
		// biome-ignore lint/style/noNonNullAssertion: disable rule for now
		return this.bindGroupLayout1_Model!;
	}

	// --- Post Processing ---

	private postProcessPipeline: GPURenderPipeline | null = null;
	private bindGroupLayout_PostProcess: GPUBindGroupLayout | null = null;

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
