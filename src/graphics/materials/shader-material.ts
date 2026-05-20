import type { Context } from "../../core/context";
import type { CullMode } from "../cull-mode";
import { Material } from "./material";

export interface ShaderMaterialOptions {
	shaderCode: string;
	cullMode?: CullMode;
}

export class ShaderMaterial extends Material {
	public shaderCode: string;
	public customBindGroup: GPUBindGroup | null = null;

	constructor(options: ShaderMaterialOptions) {
		super();
		this.type = "ShaderMaterial";
		this.shaderCode = options.shaderCode;
		this.cullMode = options.cullMode;
	}

	public getPipeline(
		ctx: Context,
		topology: GPUPrimitiveTopology = "triangle-list",
		indexFormat: GPUIndexFormat = "uint16",
		cullMode?: GPUCullMode,
	): GPURenderPipeline {
		// Asks the caching PipelineManager for a pipeline matching this specific custom shader
		return ctx.pipelineManager.getCustomPipeline(
			this.shaderCode,
			topology,
			indexFormat,
			cullMode,
		);
	}

	public getBindGroup(
		ctx: Context,
		topology: GPUPrimitiveTopology = "triangle-list",
		indexFormat: GPUIndexFormat = "uint16",
	): GPUBindGroup {
		// Allow advanced developers to build completely custom BindGroups externally
		if (this.customBindGroup) return this.customBindGroup;

		// Default empty bind group so the pipeline doesn't crash if custom group(2) is defined empty in shader
		const pipeline = ctx.pipelineManager.getCustomPipeline(
			this.shaderCode,
			topology,
			indexFormat,
		);
		const layout = pipeline.getBindGroupLayout(2);

		return ctx.device.createBindGroup({
			label: `ShaderMaterial_${this.id}_EmptyBindGroup`,
			layout: layout,
			entries: [],
		});
	}
}
