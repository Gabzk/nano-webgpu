import type { Context } from "../../core/context";
import type { CullMode } from "../cull-mode";
import type { ShaderMaterial } from "./shader-material";
import type { StandardMaterial } from "./standard-material";

/**
 * Base configuration options common to all material types.
 *
 * @group Materials
 */
export interface MaterialOptions {
	/** If true, the material supports alpha transparency during rendering blending passes. */
	transparent?: boolean;
	/** Custom back-face/front-face/none culling mode selection. */
	cullMode?: CullMode;
	/** Toggle depth buffer writes. Defaults to `true`. */
	depthWriteEnabled?: boolean;
	/** Depth check comparison function. Defaults to `"less"`. */
	depthCompare?: GPUCompareFunction;
}

/**
 * Material represents the abstract shading template parent class.
 * Defines standard interfaces for pipeline resolutions, binding parameter bind groups,
 * and next-pass overlay layering (e.g. outline/highlight passes).
 *
 * @group Materials
 */
export abstract class Material {
	/** @internal Sequential static counter generating unique material instance identifiers. */
	private static _nextId = 0;

	/** Unique material identification key. */
	public id: number;

	/** Material class type string tag used for fast runtime polymorphism checks. */
	public type: string = "Material";

	/** Flag indicating if parameter properties are dirty, requiring a new bind group build. */
	public isDirty: boolean = true;

	/** @internal Toggle depth buffer updates. Defaults to `true`. */
	private _depthWriteEnabled: boolean = true;

	/** @internal Depth check comparison function. Defaults to `"less"`. */
	private _depthCompare: GPUCompareFunction = "less";

	/** @internal Material back/front face culling settings. */
	protected _cullMode: CullMode | undefined = undefined;

	/** @internal Toggle alpha transparency blending support. */
	protected _transparent: boolean = false;

	/**
	 * Secondary material rendered on top of the current pass.
	 * Assign a ShaderMaterial here to layer a second render pass (e.g., outline effect) over the primary material.
	 * The next pass automatically uses the same geometry and instance matrices, drawn immediately after.
	 */
	public nextPass: Material | null = null;

	/**
	 * Instantiates a new Material.
	 *
	 * @param options - Material base configuration options.
	 */
	constructor(options: MaterialOptions = {}) {
		this.id = Material._nextId++;
		if (options.cullMode !== undefined) this._cullMode = options.cullMode;
		if (options.depthWriteEnabled !== undefined)
			this._depthWriteEnabled = options.depthWriteEnabled;
		if (options.depthCompare !== undefined)
			this._depthCompare = options.depthCompare;
		if (options.transparent !== undefined)
			this._transparent = options.transparent;
	}

	/** Gets whether depth buffer updates are enabled. */
	public get depthWriteEnabled(): boolean {
		return this._depthWriteEnabled;
	}

	/** Sets whether depth buffer updates are enabled. */
	public set depthWriteEnabled(value: boolean) {
		if (this._depthWriteEnabled !== value) {
			this._depthWriteEnabled = value;
			this.isDirty = true;
		}
	}

	/** Gets the depth check comparison function. */
	public get depthCompare(): GPUCompareFunction {
		return this._depthCompare;
	}

	/** Sets the depth check comparison function. */
	public set depthCompare(value: GPUCompareFunction) {
		if (this._depthCompare !== value) {
			this._depthCompare = value;
			this.isDirty = true;
		}
	}

	/** Gets whether transparency blending is enabled. */
	public get transparent(): boolean {
		return this._transparent;
	}

	/** Sets whether transparency blending is enabled. */
	public set transparent(value: boolean) {
		if (this._transparent !== value) {
			this._transparent = value;
			this.isDirty = true;
		}
	}

	/** Gets the culling mode settings. */
	public get cullMode(): CullMode | undefined {
		return this._cullMode;
	}

	/** Sets the culling mode settings. */
	public set cullMode(value: CullMode | undefined) {
		if (this._cullMode !== value) {
			this._cullMode = value;
			this.isDirty = true;
		}
	}

	/**
	 * Abstract method compiling or retrieving the cached GPURenderPipeline matching specified topologies.
	 *
	 * @param ctx - Active context.
	 * @param topology - Primitive assembly topology option. Defaults to `"triangle-list"`.
	 * @param indexFormat - Index element data format. Defaults to `"uint16"`.
	 * @param cullMode - Pipeline culling override.
	 * @returns The resolved GPURenderPipeline.
	 */
	public abstract getPipeline(
		ctx: Context,
		topology?: GPUPrimitiveTopology,
		indexFormat?: GPUIndexFormat,
		cullMode?: GPUCullMode,
		useCSM?: boolean,
	): GPURenderPipeline;

	/**
	 * Abstract method compiling or fetching the primary GPUBindGroup (group index 2) representing PBR parameters.
	 *
	 * @param ctx - Active context.
	 * @param topology - Geometry topology.
	 * @param indexFormat - Geometry index format.
	 * @returns The resolved material GPUBindGroup.
	 */
	public abstract getBindGroup(
		ctx: Context,
		topology?: GPUPrimitiveTopology,
		indexFormat?: GPUIndexFormat,
	): GPUBindGroup;

	/**
	 * Custom parameter bind group (group index 3) utilized by custom ShaderMaterials.
	 * Returns null by default for StandardMaterial.
	 *
	 * @param _ctx - Active context.
	 * @returns The resolved custom parameters bind group or null.
	 */
	public getParamsBindGroup(_ctx: Context): GPUBindGroup | null {
		return null;
	}

	/**
	 * Abstract method performing resource cleanup (releasing GPU buffers and removing allocations tracker entries).
	 *
	 * @param ctx - Target framework context.
	 */
	public abstract destroy(ctx: Context): void;
}

/**
 * Type guard function to safely assert if a Material is a StandardMaterial.
 *
 * @param mat - Target Material node.
 * @returns True if the material is a StandardMaterial, false otherwise.
 *
 * @group Materials
 */
export function isStandardMaterial(mat: Material): mat is StandardMaterial {
	return mat.type === "StandardMaterial";
}

/**
 * Type guard function to safely assert if a Material is a ShaderMaterial.
 *
 * @param mat - Target Material node.
 * @returns True if the material is a ShaderMaterial, false otherwise.
 *
 * @group Materials
 */
export function isShaderMaterial(mat: Material): mat is ShaderMaterial {
	return mat.type === "ShaderMaterial";
}
