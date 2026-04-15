import type { Context } from "../core/context";
import { defaultShaderWGSL } from "./shaders/default";

export class PipelineManager {
	private ctx: Context;

	private standardPipeline: GPURenderPipeline | null = null;
	private standardPipelineLayout: GPUPipelineLayout | null = null;

	private customPipelines: Map<string, GPURenderPipeline> = new Map();
	private customPipelineLayout: GPUPipelineLayout | null = null;

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
				],
				arrayStride: 32,
				stepMode: "vertex",
			},
		];
	}

	public getStandardPipelineLayout(): GPUPipelineLayout {
		if (!this.standardPipelineLayout) {
			this.buildBindGroupLayouts();
			this.standardPipelineLayout = this.ctx.device.createPipelineLayout({
				bindGroupLayouts: [
					this.bindGroupLayout0_Globals!,
					this.bindGroupLayout1_Model!,
					this.bindGroupLayout2_Material!,
				],
			});
		}
		return this.standardPipelineLayout;
	}

	public getStandardPipeline(): GPURenderPipeline {
		if (!this.standardPipeline) {
			const shaderModule = this.ctx.device.createShaderModule({
				label: "Standard Pipeline Shader",
				code: defaultShaderWGSL,
			});

			this.standardPipeline = this.ctx.device.createRenderPipeline({
				label: "Standard Render Pipeline",
				layout: this.getStandardPipelineLayout(),
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
				primitive: { topology: "triangle-list", cullMode: "back" },
				depthStencil: {
					depthWriteEnabled: true,
					depthCompare: "less",
					format: "depth24plus",
				},
			});
		}
		return this.standardPipeline;
	}

	public getCustomPipelineLayout(): GPUPipelineLayout {
		if (!this.customPipelineLayout) {
			this.buildBindGroupLayouts();
			// Custom supports group 3
			this.customPipelineLayout = this.ctx.device.createPipelineLayout({
				bindGroupLayouts: [
					this.bindGroupLayout0_Globals!,
					this.bindGroupLayout1_Model!,
					this.bindGroupLayout2_Material!,
					this.bindGroupLayout3_Custom!,
				],
			});
		}
		return this.customPipelineLayout;
	}

	public getCustomPipeline(shaderCode: string): GPURenderPipeline {
		// Simple hash via whole string
		if (this.customPipelines.has(shaderCode)) {
			return this.customPipelines.get(shaderCode)!;
		}

		const shaderModule = this.ctx.device.createShaderModule({
			label: "Custom Pipeline Shader",
			code: shaderCode,
		});

		const pipeline = this.ctx.device.createRenderPipeline({
			label: "Custom Render Pipeline",
			layout: this.getCustomPipelineLayout(),
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
			primitive: { topology: "triangle-list", cullMode: "back" },
			depthStencil: {
				depthWriteEnabled: true,
				depthCompare: "less",
				format: "depth24plus",
			},
		});

		this.customPipelines.set(shaderCode, pipeline);
		return pipeline;
	}

	public getGlobalsBindGroupLayout(): GPUBindGroupLayout {
		this.buildBindGroupLayouts();
		return this.bindGroupLayout0_Globals!;
	}

	public getModelBindGroupLayout(): GPUBindGroupLayout {
		this.buildBindGroupLayouts();
		return this.bindGroupLayout1_Model!;
	}
}
