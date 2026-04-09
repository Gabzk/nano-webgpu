import type { Context } from "../../core/context";

let NEXT_MATERIAL_ID = 0;

export abstract class Material {
	public id: number;
	public type: string = "Material";
	public isDirty: boolean = true;

	constructor() {
		this.id = NEXT_MATERIAL_ID++;
	}

	/**
	 * Rebuilds or fetches the WebGPU Render Pipeline for this material architecture.
	 */
	public abstract getPipeline(ctx: Context): GPURenderPipeline;

	/**
	 * Generates or fetches the Material's bound properties (like textures/colors) BindGroup.
	 */
	public abstract getBindGroup(ctx: Context): GPUBindGroup;
}
