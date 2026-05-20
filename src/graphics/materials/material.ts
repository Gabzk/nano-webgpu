import type { Context } from "../../core/context";
import type { CullMode } from "../cull-mode";
import type { ShaderMaterial } from "./shader-material";
import type { StandardMaterial } from "./standard-material";

export interface MaterialOptions {
	transparent?: boolean;
	cullMode?: CullMode;
}

export abstract class Material {
	private static _nextId = 0;

	public id: number;
	public type: string = "Material";
	public isDirty: boolean = true;
	protected _cullMode: CullMode | undefined = undefined;

	constructor() {
		this.id = Material._nextId++;
	}

	public get cullMode(): CullMode | undefined {
		return this._cullMode;
	}
	public set cullMode(value: CullMode | undefined) {
		this._cullMode = value;
	}

	/**
	 * Rebuilds or fetches the WebGPU Render Pipeline for this material architecture.
	 * @param topology - The primitive topology of the geometry being rendered (default: "triangle-list").
	 * @param indexFormat - The index buffer format (relevant for strip topologies).
	 * @param cullMode - Optional cull mode override. When undefined, the pipeline picks a default based on topology.
	 */
	public abstract getPipeline(
		ctx: Context,
		topology?: GPUPrimitiveTopology,
		indexFormat?: GPUIndexFormat,
		cullMode?: GPUCullMode,
	): GPURenderPipeline;

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
