import type { Context } from "../../core/context";
import { Color, type ColorLike } from "../../math/color";
import type { CullMode } from "../cull-mode";
import { isCullDisabled } from "../cull-mode";
import { Texture } from "../texture";
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

	// --- Standard PBR Options for easy beginner usage ---
	/** Solid base color value or hex string representation. Defaults to white. */
	albedoColor?: ColorLike;
	/** Map containing surface color data, or file path. */
	albedoTexture?: Texture | string;
	/** Shorthand alias for albedoTexture. */
	texture?: Texture | string;

	/** Tangent-space normal map detailing high-frequency surface folds, or file path. */
	normalTexture?: Texture | string;
	/** Scaling factor applied to normal tangent values. Defaults to `1.0`. */
	normalScale?: number;

	/** Surface roughness microfacet scattering coefficient. Defaults to `0.5`. */
	roughness?: number;
	/** Map detailing roughness values, or file path. */
	roughnessTexture?: Texture | string;

	/** Surface metallic conduction microfacet value. Defaults to `0.0`. */
	metallic?: number;
	/** Map detailing metallic coefficients, or file path. */
	metallicTexture?: Texture | string;

	/** Map containing ambient occlusion details, or file path. */
	aoTexture?: Texture | string;
	/** Intensity multiplier of ambient occlusion shadows. Defaults to `1.0`. */
	aoIntensity?: number;

	/** Map containing packed Ambient Occlusion, Roughness, and Metallic (ORM) values, or file path. */
	ormTexture?: Texture | string;

	/** Solid emissive color value or hex string representation. Defaults to black. */
	emissiveColor?: ColorLike;
	/** Map containing emissive light data, or file path. */
	emissiveTexture?: Texture | string;
	/** Emissive intensity multiplier (supports values > 1 for HDR emission). Defaults to `1.0`. */
	emissiveStrength?: number;

	/** When true, disables face culling so back and front polygons are rendered. */
	doubleSided?: boolean;
	/** Surface opacity level (alpha). Automatically handles transparent rendering and depth buffer updates. */
	opacity?: number;
	/** Secondary material pass rendered immediately after this material. */
	nextPass?: Material;
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

	// ─── Standard PBR backing fields ──────────────────────────

	/** @internal Solid base color coefficients. */
	protected _albedoColor: Color = new Color();
	/** @internal Map containing surface color data. */
	protected _albedoTexture: Texture | null = null;
	/** @internal Tangent-space normal map detailing surface folds. */
	protected _normalTexture: Texture | null = null;
	/** @internal Scaling factor applied to normal tangent values. */
	protected _normalScale: number = 1.0;
	/** @internal Surface roughness microfacet scattering coefficient. */
	protected _roughness: number = 0.5;
	/** @internal Map detailing roughness values. */
	protected _roughnessTexture: Texture | null = null;
	/** @internal Surface metallic conduction microfacet value. */
	protected _metallic: number = 0.0;
	/** @internal Map detailing metallic coefficients. */
	protected _metallicTexture: Texture | null = null;
	/** @internal Map containing ambient occlusion details. */
	protected _aoTexture: Texture | null = null;
	/** @internal Intensity multiplier of ambient occlusion shadows. */
	protected _aoIntensity: number = 1.0;
	/** @internal Map containing packed Ambient Occlusion, Roughness, and Metallic (ORM) values. */
	protected _ormTexture: Texture | null = null;
	/** @internal Solid emissive color coefficients. */
	protected _emissiveColor: Color = new Color();
	/** @internal Map containing surface emissive light data. */
	protected _emissiveTexture: Texture | null = null;
	/** @internal Emissive intensity multiplier (supports HDR values > 1). */
	protected _emissiveStrength: number = 1.0;

	/** @internal Path names of textures queued to load asynchronously in the background. */
	protected pendingTextures: { [key: string]: string } = {};

	/** @internal Collection of active texture load listener unsubscribes. */
	protected _textureUnsubscribes: Map<Texture, () => void> = new Map();

	/** @internal Collection of texture assets created internally from string paths that this material owns. */
	protected _ownedTextures: Set<Texture> = new Set();

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

		// Initialize base PBR properties
		let initialColor: Color;
		if (options.albedoColor instanceof Color) {
			initialColor = options.albedoColor;
		} else if (typeof options.albedoColor === "string") {
			initialColor = Color.fromHex(options.albedoColor);
		} else {
			initialColor = Color.fromHex("#ffffff");
		}
		this._albedoColor = initialColor;
		this._albedoColor.onChange = () => {
			this.onPropertyChange();
		};

		const mainTexture = options.albedoTexture ?? options.texture;
		if (mainTexture instanceof Texture) {
			this._albedoTexture = mainTexture;
		} else if (typeof mainTexture === "string") {
			this.pendingTextures.albedo = mainTexture;
		}

		if (options.normalTexture instanceof Texture)
			this._normalTexture = options.normalTexture;
		else if (typeof options.normalTexture === "string")
			this.pendingTextures.normal = options.normalTexture;

		if (options.roughnessTexture instanceof Texture)
			this._roughnessTexture = options.roughnessTexture;
		else if (typeof options.roughnessTexture === "string")
			this.pendingTextures.roughness = options.roughnessTexture;

		if (options.metallicTexture instanceof Texture)
			this._metallicTexture = options.metallicTexture;
		else if (typeof options.metallicTexture === "string")
			this.pendingTextures.metallic = options.metallicTexture;

		if (options.aoTexture instanceof Texture)
			this._aoTexture = options.aoTexture;
		else if (typeof options.aoTexture === "string")
			this.pendingTextures.ao = options.aoTexture;

		if (options.ormTexture instanceof Texture)
			this._ormTexture = options.ormTexture;
		else if (typeof options.ormTexture === "string")
			this.pendingTextures.orm = options.ormTexture;

		// Initialize Emissive properties
		let initialEmissive: Color;
		if (options.emissiveColor instanceof Color) {
			initialEmissive = options.emissiveColor;
		} else if (typeof options.emissiveColor === "string") {
			initialEmissive = Color.fromHex(options.emissiveColor);
		} else {
			initialEmissive = Color.fromHex("#000000");
		}
		this._emissiveColor = initialEmissive;
		this._emissiveColor.onChange = () => {
			this.onPropertyChange();
		};

		if (options.emissiveTexture instanceof Texture) {
			this._emissiveTexture = options.emissiveTexture;
		} else if (typeof options.emissiveTexture === "string") {
			this.pendingTextures.emissive = options.emissiveTexture;
		}

		this._roughness = options.roughness ?? 0.5;
		this._metallic = options.metallic ?? 0.0;
		this._normalScale = options.normalScale ?? 1.0;
		this._aoIntensity = options.aoIntensity ?? 1.0;
		this._emissiveStrength = options.emissiveStrength ?? 1.0;

		if (options.cullMode !== undefined) {
			this.cullMode = options.cullMode;
		} else if (options.doubleSided) {
			this.cullMode = "disabled";
		}

		if (options.opacity !== undefined) {
			this.opacity = options.opacity;
		}

		if (options.nextPass !== undefined) {
			this.nextPass = options.nextPass;
		}
	}

	/** Hook called when any property changes. Subclasses override this to invalidate their specific GPU bind groups. */
	protected onPropertyChange(): void {
		this.isDirty = true;
	}

	/** Gets whether depth buffer updates are enabled. */
	public get depthWriteEnabled(): boolean {
		return this._depthWriteEnabled;
	}

	/** Sets whether depth buffer updates are enabled. */
	public set depthWriteEnabled(value: boolean) {
		if (this._depthWriteEnabled !== value) {
			this._depthWriteEnabled = value;
			this.onPropertyChange();
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
			this.onPropertyChange();
		}
	}

	/** Gets whether transparency blending is enabled. */
	public get transparent(): boolean {
		return this._transparent;
	}

	/** Sets whether transparency blending is enabled. Automatically sets depthWriteEnabled to false if transparent is true. */
	public set transparent(value: boolean) {
		if (this._transparent !== value) {
			this._transparent = value;
			if (value) {
				this._depthWriteEnabled = false;
			} else {
				this._depthWriteEnabled = true;
			}
			this.onPropertyChange();
		}
	}

	/** Gets the opacity component of the albedo color. */
	public get opacity(): number {
		return this.albedoColor.a;
	}

	/** Sets the opacity component of the albedo color, automatically enabling transparent rendering and disabling depth writing if opacity is less than 1.0. */
	public set opacity(value: number) {
		this.albedoColor = new Color(
			this.albedoColor.r,
			this.albedoColor.g,
			this.albedoColor.b,
			value,
		);
		if (value < 1.0) {
			this._transparent = true;
			this._depthWriteEnabled = false;
		} else {
			this._transparent = false;
			this._depthWriteEnabled = true;
		}
		this.onPropertyChange();
	}

	/** Gets the culling mode settings. */
	public get cullMode(): CullMode | undefined {
		return this._cullMode;
	}

	/** Sets the culling mode settings. */
	public set cullMode(value: CullMode | undefined) {
		if (this._cullMode !== value) {
			this._cullMode = value;
			this.onPropertyChange();
		}
	}

	// ─── Getters and setters for standard PBR properties ────────────────────

	/** Gets the base albedo color. */
	public get albedoColor(): Color {
		return this._albedoColor;
	}

	/** Sets the base albedo color, setting dirty status upon color component modifications. */
	public set albedoColor(val: ColorLike) {
		if (val instanceof Color) {
			this._albedoColor = val;
		} else if (typeof val === "string") {
			this._albedoColor = Color.fromHex(val);
		} else if (Array.isArray(val)) {
			this._albedoColor = new Color(val[0], val[1], val[2], val[3] ?? 1.0);
		}
		this._albedoColor.onChange = () => {
			this.onPropertyChange();
		};
		this.onPropertyChange();
	}

	/** Gets the base albedo texture. */
	public get albedoTexture(): Texture | null {
		return this._albedoTexture;
	}

	/** Sets the base albedo texture, marking parameters and bind groups as dirty. */
	public set albedoTexture(val: Texture | string | null) {
		if (typeof val === "string") {
			this.pendingTextures.albedo = val;
			this.onPropertyChange();
		} else if (this._albedoTexture !== val) {
			this._albedoTexture = val;
			this.onPropertyChange();
		}
	}

	/** Gets the normal tangent scale. */
	public get normalScale(): number {
		return this._normalScale;
	}

	/** Sets the normal tangent scale and marks the material parameters as dirty. */
	public set normalScale(val: number) {
		if (this._normalScale !== val) {
			this._normalScale = val;
			this.onPropertyChange();
		}
	}

	/** Gets the normal texture. */
	public get normalTexture(): Texture | null {
		return this._normalTexture;
	}

	/** Sets the normal texture, marking parameters and bind groups as dirty. */
	public set normalTexture(val: Texture | string | null) {
		if (typeof val === "string") {
			this.pendingTextures.normal = val;
			this.onPropertyChange();
		} else if (this._normalTexture !== val) {
			this._normalTexture = val;
			this.onPropertyChange();
		}
	}

	/** Gets the microfacet roughness factor. */
	public get roughness(): number {
		return this._roughness;
	}

	/** Sets the microfacet roughness factor and marks the material parameters as dirty. */
	public set roughness(val: number) {
		if (this._roughness !== val) {
			this._roughness = val;
			this.onPropertyChange();
		}
	}

	/** Gets the roughness texture. */
	public get roughnessTexture(): Texture | null {
		return this._roughnessTexture;
	}

	/** Sets the roughness texture, marking parameters and bind groups as dirty. */
	public set roughnessTexture(val: Texture | string | null) {
		if (typeof val === "string") {
			this.pendingTextures.roughness = val;
			this.onPropertyChange();
		} else if (this._roughnessTexture !== val) {
			this._roughnessTexture = val;
			this.onPropertyChange();
		}
	}

	/** Gets the microfacet metallic factor. */
	public get metallic(): number {
		return this._metallic;
	}

	/** Sets the microfacet metallic factor and marks the material parameters as dirty. */
	public set metallic(val: number) {
		if (this._metallic !== val) {
			this._metallic = val;
			this.onPropertyChange();
		}
	}

	/** Gets the metallic texture. */
	public get metallicTexture(): Texture | null {
		return this._metallicTexture;
	}

	/** Sets the metallic texture, marking parameters and bind groups as dirty. */
	public set metallicTexture(val: Texture | string | null) {
		if (typeof val === "string") {
			this.pendingTextures.metallic = val;
			this.onPropertyChange();
		} else if (this._metallicTexture !== val) {
			this._metallicTexture = val;
			this.onPropertyChange();
		}
	}

	/** Gets the ambient occlusion shadow intensity multiplier. */
	public get aoIntensity(): number {
		return this._aoIntensity;
	}

	/** Sets the ambient occlusion shadow intensity multiplier and marks the material parameters as dirty. */
	public set aoIntensity(val: number) {
		if (this._aoIntensity !== val) {
			this._aoIntensity = val;
			this.onPropertyChange();
		}
	}

	/** Gets the ambient occlusion texture. */
	public get aoTexture(): Texture | null {
		return this._aoTexture;
	}

	/** Sets the ambient occlusion texture, marking parameters and bind groups as dirty. */
	public set aoTexture(val: Texture | string | null) {
		if (typeof val === "string") {
			this.pendingTextures.ao = val;
			this.onPropertyChange();
		} else if (this._aoTexture !== val) {
			this._aoTexture = val;
			this.onPropertyChange();
		}
	}

	/** Gets the ORM texture. */
	public get ormTexture(): Texture | null {
		return this._ormTexture;
	}

	/** Sets the ORM texture, marking parameters and bind groups as dirty. */
	public set ormTexture(val: Texture | string | null) {
		if (typeof val === "string") {
			this.pendingTextures.orm = val;
			this.onPropertyChange();
		} else if (this._ormTexture !== val) {
			this._ormTexture = val;
			this.onPropertyChange();
		}
	}

	/** Gets the solid emissive color coefficients. */
	public get emissiveColor(): Color {
		return this._emissiveColor;
	}

	/** Sets the solid emissive color coefficients, setting dirty status upon color component modifications. */
	public set emissiveColor(val: ColorLike) {
		if (val instanceof Color) {
			this._emissiveColor = val;
		} else if (typeof val === "string") {
			this._emissiveColor = Color.fromHex(val);
		} else if (Array.isArray(val)) {
			this._emissiveColor = new Color(val[0], val[1], val[2], val[3] ?? 1.0);
		}
		this._emissiveColor.onChange = () => {
			this.onPropertyChange();
		};
		this.onPropertyChange();
	}

	/** Gets the emissive texture. */
	public get emissiveTexture(): Texture | null {
		return this._emissiveTexture;
	}

	/** Sets the emissive texture, marking parameters and bind groups as dirty. */
	public set emissiveTexture(val: Texture | string | null) {
		if (typeof val === "string") {
			this.pendingTextures.emissive = val;
			this.onPropertyChange();
		} else if (this._emissiveTexture !== val) {
			this._emissiveTexture = val;
			this.onPropertyChange();
		}
	}

	/** Gets the emissive intensity multiplier. */
	public get emissiveStrength(): number {
		return this._emissiveStrength;
	}

	/** Sets the emissive intensity multiplier and marks the material parameters as dirty. */
	public set emissiveStrength(val: number) {
		if (this._emissiveStrength !== val) {
			this._emissiveStrength = val;
			this.onPropertyChange();
		}
	}

	/** Gets the double-sided rendering state. */
	public get doubleSided(): boolean {
		return isCullDisabled(this._cullMode);
	}

	/** Sets the double-sided rendering state, adjusting internal cull modes accordingly. */
	public set doubleSided(val: boolean) {
		if (val) {
			this.cullMode = "disabled";
		} else if (isCullDisabled(this._cullMode)) {
			this.cullMode = undefined;
		}
		this.onPropertyChange();
	}

	/** Asynchronously loads pending texture strings in the background and resolves them into Texture objects. */
	protected resolvePendingTextures(ctx: Context): void {
		if (Object.keys(this.pendingTextures).length > 0) {
			if (this.pendingTextures.albedo) {
				const tex = Texture.loadBackground(ctx, this.pendingTextures.albedo, {
					format: "rgba8unorm-srgb",
				});
				this._albedoTexture = tex;
				this._ownedTextures.add(tex);
			}
			if (this.pendingTextures.normal) {
				const tex = Texture.loadBackground(ctx, this.pendingTextures.normal);
				this._normalTexture = tex;
				this._ownedTextures.add(tex);
			}
			if (this.pendingTextures.roughness) {
				const tex = Texture.loadBackground(ctx, this.pendingTextures.roughness);
				this._roughnessTexture = tex;
				this._ownedTextures.add(tex);
			}
			if (this.pendingTextures.metallic) {
				const tex = Texture.loadBackground(ctx, this.pendingTextures.metallic);
				this._metallicTexture = tex;
				this._ownedTextures.add(tex);
			}
			if (this.pendingTextures.ao) {
				const tex = Texture.loadBackground(ctx, this.pendingTextures.ao);
				this._aoTexture = tex;
				this._ownedTextures.add(tex);
			}
			if (this.pendingTextures.orm) {
				const tex = Texture.loadBackground(ctx, this.pendingTextures.orm);
				this._ormTexture = tex;
				this._ownedTextures.add(tex);
			}
			if (this.pendingTextures.emissive) {
				const tex = Texture.loadBackground(ctx, this.pendingTextures.emissive, {
					format: "rgba8unorm-srgb",
				});
				this._emissiveTexture = tex;
				this._ownedTextures.add(tex);
			}
			this.pendingTextures = {}; // Clear pending queue
			this.onPropertyChange();
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
