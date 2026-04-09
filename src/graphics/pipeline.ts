import type { Context } from "../core/context";
import { defaultShaderWGSL } from "./shaders/default";

export class PipelineManager {
	private static standardPipeline: GPURenderPipeline | null = null;
	private static standardPipelineLayout: GPUPipelineLayout | null = null;

	private static customPipelines: Map<string, GPURenderPipeline> = new Map();
	private static customPipelineLayout: GPUPipelineLayout | null = null;

	private static bindGroupLayout0_Globals: GPUBindGroupLayout | null = null;
	private static bindGroupLayout1_Model: GPUBindGroupLayout | null = null;
	private static bindGroupLayout2_Material: GPUBindGroupLayout | null = null;
	private static bindGroupLayout3_Custom: GPUBindGroupLayout | null = null;

	private static buildBindGroupLayouts(ctx: Context) {
		if (PipelineManager.bindGroupLayout0_Globals) return;

		// Group 0: Globals (Camera & Lights)
		PipelineManager.bindGroupLayout0_Globals = ctx.device.createBindGroupLayout(
			{
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
				],
			},
		);

		// Group 1: Model
		PipelineManager.bindGroupLayout1_Model = ctx.device.createBindGroupLayout({
			label: "Model Bind Group Layout",
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.VERTEX,
					buffer: { type: "uniform" },
				},
			],
		});

		// Group 2: Material
		PipelineManager.bindGroupLayout2_Material =
			ctx.device.createBindGroupLayout({
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
		PipelineManager.bindGroupLayout3_Custom = ctx.device.createBindGroupLayout({
			label: "Custom Empty Bind Group Layout",
			entries: [], // Can be customized later by advanced users via reflection, for now empty
		});
	}

	private static getVertexBuffers(): GPUVertexBufferLayout[] {
		return [
			{
				attributes: [
					{ shaderLocation: 0, offset: 0, format: "float32x3" }, // Position
					{ shaderLocation: 1, offset: 12, format: "float32x3" }, // Normal
					{ shaderLocation: 2, offset: 24, format: "float32x2" }, // UV
				],
				arrayStride: 32,
				stepMode: "vertex",
			},
		];
	}

	public static getStandardPipelineLayout(ctx: Context): GPUPipelineLayout {
		if (!PipelineManager.standardPipelineLayout) {
			PipelineManager.buildBindGroupLayouts(ctx);
			PipelineManager.standardPipelineLayout = ctx.device.createPipelineLayout({
				bindGroupLayouts: [
					PipelineManager.bindGroupLayout0_Globals!,
					PipelineManager.bindGroupLayout1_Model!,
					PipelineManager.bindGroupLayout2_Material!,
				],
			});
		}
		return PipelineManager.standardPipelineLayout;
	}

	public static getStandardPipeline(ctx: Context): GPURenderPipeline {
		if (!PipelineManager.standardPipeline) {
			const shaderModule = ctx.device.createShaderModule({
				label: "Standard Pipeline Shader",
				code: defaultShaderWGSL,
			});

			PipelineManager.standardPipeline = ctx.device.createRenderPipeline({
				label: "Standard Render Pipeline",
				layout: PipelineManager.getStandardPipelineLayout(ctx),
				vertex: {
					module: shaderModule,
					entryPoint: "vs_main",
					buffers: PipelineManager.getVertexBuffers(),
				},
				fragment: {
					module: shaderModule,
					entryPoint: "fs_main",
					targets: [
						{
							format: ctx.format,
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
				primitive: { topology: "triangle-list", cullMode: "back" },
				depthStencil: {
					depthWriteEnabled: true,
					depthCompare: "less",
					format: "depth24plus",
				},
			});
		}
		return PipelineManager.standardPipeline;
	}

	public static getCustomPipelineLayout(ctx: Context): GPUPipelineLayout {
		if (!PipelineManager.customPipelineLayout) {
			PipelineManager.buildBindGroupLayouts(ctx);
			// Custom supports group 3
			PipelineManager.customPipelineLayout = ctx.device.createPipelineLayout({
				bindGroupLayouts: [
					PipelineManager.bindGroupLayout0_Globals!,
					PipelineManager.bindGroupLayout1_Model!,
					PipelineManager.bindGroupLayout2_Material!,
					PipelineManager.bindGroupLayout3_Custom!,
				],
			});
		}
		return PipelineManager.customPipelineLayout;
	}

	public static getCustomPipeline(
		ctx: Context,
		shaderCode: string,
	): GPURenderPipeline {
		// Simple hash via whole string
		if (PipelineManager.customPipelines.has(shaderCode)) {
			return PipelineManager.customPipelines.get(shaderCode)!;
		}

		const shaderModule = ctx.device.createShaderModule({
			label: "Custom Pipeline Shader",
			code: shaderCode,
		});

		const pipeline = ctx.device.createRenderPipeline({
			label: "Custom Render Pipeline",
			layout: PipelineManager.getCustomPipelineLayout(ctx),
			vertex: {
				module: shaderModule,
				entryPoint: "vs_main",
				buffers: PipelineManager.getVertexBuffers(),
			},
			fragment: {
				module: shaderModule,
				entryPoint: "fs_main",
				targets: [
					{
						format: ctx.format,
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
			primitive: { topology: "triangle-list", cullMode: "back" },
			depthStencil: {
				depthWriteEnabled: true,
				depthCompare: "less",
				format: "depth24plus",
			},
		});

		PipelineManager.customPipelines.set(shaderCode, pipeline);
		return pipeline;
	}

	public static getGlobalsBindGroupLayout(ctx: Context): GPUBindGroupLayout {
		PipelineManager.buildBindGroupLayouts(ctx);
		return PipelineManager.bindGroupLayout0_Globals!;
	}

	public static getModelBindGroupLayout(ctx: Context): GPUBindGroupLayout {
		PipelineManager.buildBindGroupLayouts(ctx);
		return PipelineManager.bindGroupLayout1_Model!;
	}
}
