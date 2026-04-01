import { Context } from "../../core/context";
import { Material } from "./material";
import { PipelineManager } from "../pipeline";

export interface ShaderMaterialOptions {
    shaderCode: string;
}

export class ShaderMaterial extends Material {
    public shaderCode: string;
    public customBindGroup: GPUBindGroup | null = null;

    constructor(options: ShaderMaterialOptions) {
        super();
        this.type = "ShaderMaterial";
        this.shaderCode = options.shaderCode;
    }

    public getPipeline(ctx: Context): GPURenderPipeline {
        // Asks the caching PipelineManager for a pipeline matching this specific custom shader
        return PipelineManager.getCustomPipeline(ctx, this.shaderCode);
    }

    public getBindGroup(ctx: Context): GPUBindGroup {
        // Allow advanced developers to build completely custom BindGroups externally
        if (this.customBindGroup) return this.customBindGroup;

        // Default empty bind group so the pipeline doesn't crash if custom group(2) is defined empty in shader
        const pipeline = PipelineManager.getCustomPipeline(ctx, this.shaderCode);
        const layout = pipeline.getBindGroupLayout(2);
        
        return ctx.device.createBindGroup({
            label: `ShaderMaterial_${this.id}_EmptyBindGroup`,
            layout: layout,
            entries: []
        });
    }
}
