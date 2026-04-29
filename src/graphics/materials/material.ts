import type { Context } from "../../core/context";

export interface MaterialOptions {
	transparent?: boolean;
}

export abstract class Material {
	private static _nextId = 0;

	public id: number;
	public type: string = "Material";
	public isDirty: boolean = true;

	constructor() {
		this.id = Material._nextId++;
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
