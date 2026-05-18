import type { Context } from "../../core/context";
import type { StandardMaterial } from "./standard-material";
import type { ShaderMaterial } from "./shader-material";

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

/**
 * Type guard — returns true if the material is a StandardMaterial.
 * Prefer this over `instanceof` or duck-typing with `as any`.
 */
export function isStandardMaterial(mat: Material): mat is StandardMaterial {
	return mat.type === "StandardMaterial";
}

/**
 * Type guard — returns true if the material is a ShaderMaterial.
 */
export function isShaderMaterial(mat: Material): mat is ShaderMaterial {
	return mat.type === "ShaderMaterial";
}
