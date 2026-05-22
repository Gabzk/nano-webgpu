import type { Context } from "../../core/context";
import { Color, type ColorLike } from "../../math/color";
import type { CullMode } from "../cull-mode";
import {
	isCullDisabled,
	normalizeCullMode,
	resolveCullMode,
} from "../cull-mode";
import { Texture } from "../texture";
import { Material, type MaterialOptions } from "./material";

/**
 * Configuration options utilized when instantiating a physically-based StandardMaterial.
 */
export interface StandardMaterialOptions extends MaterialOptions {
	/** Solid base color value or hex string representation. Defaults to white. */
	albedoColor?: ColorLike;
	/** Map containing surface color data, or file path. */
	albedoTexture?: Texture | string;

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

	/** When true, disables face culling so back and front polygons are rendered. */
	doubleSided?: boolean;
}

/**
 * StandardMaterial represents a Physically-Based Rendering (PBR) metallic-roughness material.
 * Manages material parameter uniform structures, linear samplers, lazy-loading sequences for texture assets,
 * handles shadow filtering variant compilation keys, and supports double-sided material rendering.
 */
export class StandardMaterial extends Material {
	/** Mappings of PBR parameters to Float32Array offsets matching the WGSL MaterialUniform struct layout. */
	public static readonly UNIFORM_OFFSETS = {
		ALBEDO_R: 0,
		ALBEDO_G: 1,
		ALBEDO_B: 2,
		ALBEDO_A: 3,
		ROUGHNESS: 4,
		METALLIC: 5,
		NORMAL_SCALE: 6,
		AO_INTENSITY: 7,
		HAS_NORMAL_MAP: 8,
		HAS_ROUGHNESS_MAP: 9,
		HAS_METALLIC_MAP: 10,
		HAS_AO_MAP: 11,
		HAS_ORM_MAP: 12,
		CULL_MODE: 13,
	} as const;

	/** @internal Solid base color coefficients. */
	private _albedoColor: Color = new Color();
	/** Map containing surface color data. */
	public albedoTexture: Texture | null = null;

	/** Tangent-space normal map detailing surface folds. */
	public normalTexture: Texture | null = null;
	/** @internal Scaling factor applied to normal tangent values. */
	private _normalScale: number = 1.0;

	/** @internal Surface roughness microfacet scattering coefficient. */
	private _roughness: number = 0.5;
	/** Map detailing roughness values. */
	public roughnessTexture: Texture | null = null;

	/** @internal Surface metallic conduction microfacet value. */
	private _metallic: number = 0.0;
	/** Map detailing metallic coefficients. */
	public metallicTexture: Texture | null = null;

	/** Map containing ambient occlusion details. */
	public aoTexture: Texture | null = null;
	/** @internal Intensity multiplier of ambient occlusion shadows. */
	private _aoIntensity: number = 1.0;

	/** Map containing packed Ambient Occlusion, Roughness, and Metallic (ORM) values. */
	public ormTexture: Texture | null = null;

	/** Gets the base albedo color. */
	get albedoColor(): Color {
		return this._albedoColor;
	}

	/** Sets the base albedo color, setting dirty status upon color component modifications. */
	set albedoColor(val: Color) {
		this._albedoColor = val;
		this._albedoColor.onChange = () => {
			this.isDirty = true;
		};
		this.isDirty = true;
	}

	/** Gets the normal tangent scale. */
	get normalScale(): number {
		return this._normalScale;
	}

	/** Sets the normal tangent scale and marks the material parameters as dirty. */
	set normalScale(val: number) {
		this._normalScale = val;
		this.isDirty = true;
	}

	/** Gets the microfacet roughness factor. */
	get roughness(): number {
		return this._roughness;
	}

	/** Sets the microfacet roughness factor and marks the material parameters as dirty. */
	set roughness(val: number) {
		this._roughness = val;
		this.isDirty = true;
	}

	/** Gets the microfacet metallic factor. */
	get metallic(): number {
		return this._metallic;
	}

	/** Sets the microfacet metallic factor and marks the material parameters as dirty. */
	set metallic(val: number) {
		this._metallic = val;
		this.isDirty = true;
	}

	/** Gets the ambient occlusion shadow intensity multiplier. */
	get aoIntensity(): number {
		return this._aoIntensity;
	}

	/** Sets the ambient occlusion shadow intensity multiplier and marks the material parameters as dirty. */
	set aoIntensity(val: number) {
		this._aoIntensity = val;
		this.isDirty = true;
	}

	/** Gets the cull mode settings. */
	public override get cullMode(): CullMode | undefined {
		return this._cullMode;
	}

	/** Sets the cull mode settings and marks the material parameters as dirty. */
	public override set cullMode(value: CullMode | undefined) {
		this._cullMode = value;
		this.isDirty = true;
	}

	/** Gets the double-sided rendering state. */
	get doubleSided(): boolean {
		return isCullDisabled(this._cullMode);
	}

	/** Sets the double-sided rendering state, adjusting internal cull modes accordingly. */
	set doubleSided(val: boolean) {
		if (val) {
			this.cullMode = "disabled";
		} else if (isCullDisabled(this._cullMode)) {
			this.cullMode = undefined;
		}
		this.isDirty = true;
	}

	/** @internal Path names of textures queued to load asynchronously in the background. */
	private pendingTextures: { [key: string]: string } = {};

	/** @internal Physical uniform buffer allocated in VRAM containing material parameters. */
	private uniformBuffer!: GPUBuffer;
	/** @internal Standard PBR bind group 2 containing parameter and texture bindings. */
	private bindGroup: GPUBindGroup | null = null;
	/** @internal Anisotropic filtering sampler. */
	private sampler: GPUSampler | null = null;
	/** @internal Float array cache containing sequentially packed parameters ready for GPU copies. */
	private bufferData!: Float32Array;

	/** @internal Tracks which PCF shadow variant the current bindGroup was built for. */
	private _bindGroupPCFVariant: boolean | null = null;
	/** @internal Tracks current pipeline-level culling status to match material parameter bindings. */
	private _lightingCullMode: GPUCullMode | undefined = undefined;

	/**
	 * Instantiates a PBR StandardMaterial, registering defaults and allocating float parameter arrays.
	 *
	 * @param options - PBR coefficients, texture assets, and spatial configurations.
	 */
	constructor(options: StandardMaterialOptions = {}) {
		super(options);
		this.type = "StandardMaterial";

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
			this.isDirty = true;
		};

		if (options.albedoTexture instanceof Texture)
			this.albedoTexture = options.albedoTexture;
		else if (typeof options.albedoTexture === "string")
			this.pendingTextures.albedo = options.albedoTexture;

		if (options.normalTexture instanceof Texture)
			this.normalTexture = options.normalTexture;
		else if (typeof options.normalTexture === "string")
			this.pendingTextures.normal = options.normalTexture;

		if (options.roughnessTexture instanceof Texture)
			this.roughnessTexture = options.roughnessTexture;
		else if (typeof options.roughnessTexture === "string")
			this.pendingTextures.roughness = options.roughnessTexture;

		if (options.metallicTexture instanceof Texture)
			this.metallicTexture = options.metallicTexture;
		else if (typeof options.metallicTexture === "string")
			this.pendingTextures.metallic = options.metallicTexture;

		if (options.aoTexture instanceof Texture)
			this.aoTexture = options.aoTexture;
		else if (typeof options.aoTexture === "string")
			this.pendingTextures.ao = options.aoTexture;

		if (options.ormTexture instanceof Texture)
			this.ormTexture = options.ormTexture;
		else if (typeof options.ormTexture === "string")
			this.pendingTextures.orm = options.ormTexture;

		this._roughness = options.roughness ?? 0.5;
		this._metallic = options.metallic ?? 0.0;
		this._normalScale = options.normalScale ?? 1.0;
		this._aoIntensity = options.aoIntensity ?? 1.0;
		if (options.cullMode !== undefined) {
			this.cullMode = options.cullMode;
		} else if (options.doubleSided) {
			this.cullMode = "disabled";
		}

		// 16 floats (64 bytes)
		this.bufferData = new Float32Array(16);
	}

	/**
	 * @internal Packages PBR coefficient scalars and map activation statuses sequentially into uniform float arrays.
	 */
	private updateBufferData() {
		const offsets = StandardMaterial.UNIFORM_OFFSETS;
		this.bufferData[offsets.ALBEDO_R] = this.albedoColor.r;
		this.bufferData[offsets.ALBEDO_G] = this.albedoColor.g;
		this.bufferData[offsets.ALBEDO_B] = this.albedoColor.b;
		this.bufferData[offsets.ALBEDO_A] = this.albedoColor.a ?? 1.0;

		this.bufferData[offsets.ROUGHNESS] = this.roughness;
		this.bufferData[offsets.METALLIC] = this.metallic;
		this.bufferData[offsets.NORMAL_SCALE] = this.normalScale;
		this.bufferData[offsets.AO_INTENSITY] = this.aoIntensity;

		this.bufferData[offsets.HAS_NORMAL_MAP] = this.normalTexture ? 1.0 : 0.0;
		this.bufferData[offsets.HAS_ROUGHNESS_MAP] = this.roughnessTexture ? 1.0 : 0.0;
		this.bufferData[offsets.HAS_METALLIC_MAP] = this.metallicTexture ? 1.0 : 0.0;
		this.bufferData[offsets.HAS_AO_MAP] = this.aoTexture ? 1.0 : 0.0;

		const lightingCull =
			this._lightingCullMode ?? normalizeCullMode(this._cullMode);
		const cullModeFlag =
			lightingCull === "front" ? 1.0 : lightingCull === "none" ? 2.0 : 0.0;

		this.bufferData[offsets.HAS_ORM_MAP] = this.ormTexture ? 1.0 : 0.0;
		this.bufferData[offsets.CULL_MODE] = cullModeFlag;
		this.bufferData[14] = 0.0;
		this.bufferData[15] = 0.0;
	}

	/** @internal Active shadow PCF option key. */
	private _usePCF: boolean = true;

	/** Gets active shadow PCF option key. */
	public get usePCF(): boolean {
		return this._usePCF;
	}

	/** Sets active shadow PCF option key, invalidating active cached bind groups if changed. */
	public set usePCF(value: boolean) {
		if (this._usePCF !== value) {
			this._usePCF = value;
			// Invalidate cached bind group — it was built against the old pipeline layout.
			this.bindGroup = null;
			this._bindGroupPCFVariant = null;
		}
	}

	/**
	 * Retrieves or compiles standard PBR pipelines matching specific primitive topology layouts.
	 *
	 * @param ctx - Active context.
	 * @param topology - Target geometry topology.
	 * @param indexFormat - Target index format.
	 * @param cullMode - Culling mode parameter.
	 * @returns Compiled render pipeline instance.
	 */
	public getPipeline(
		ctx: Context,
		topology: GPUPrimitiveTopology = "triangle-list",
		indexFormat: GPUIndexFormat = "uint16",
		cullMode?: GPUCullMode,
	): GPURenderPipeline {
		const resolvedCullMode = resolveCullMode(cullMode, topology);
		if (this._lightingCullMode !== resolvedCullMode) {
			this._lightingCullMode = resolvedCullMode;
			this.isDirty = true;
		}
		return ctx.pipelineManager.getStandardPipeline(
			this._usePCF,
			topology,
			indexFormat,
			cullMode,
			this.depthWriteEnabled,
			this.depthCompare,
		);
	}

	/**
	 * Allocates uniform buffers and packages textures, generating a standard bind group (index 2).
	 * Triggers asynchronous load sequences for string texture paths. Reuses dummy white/normal maps
	 * if optional texture arguments are omitted.
	 *
	 * @param ctx - Active context.
	 * @returns Standard bind group 2 instance.
	 */
	public getBindGroup(ctx: Context): GPUBindGroup {
		if (Object.keys(this.pendingTextures).length > 0) {
			if (this.pendingTextures.albedo)
				this.albedoTexture = Texture.loadBackground(
					ctx,
					this.pendingTextures.albedo,
					{ format: "rgba8unorm-srgb" },
				);
			if (this.pendingTextures.normal)
				this.normalTexture = Texture.loadBackground(
					ctx,
					this.pendingTextures.normal,
				);
			if (this.pendingTextures.roughness)
				this.roughnessTexture = Texture.loadBackground(
					ctx,
					this.pendingTextures.roughness,
				);
			if (this.pendingTextures.metallic)
				this.metallicTexture = Texture.loadBackground(
					ctx,
					this.pendingTextures.metallic,
				);
			if (this.pendingTextures.ao)
				this.aoTexture = Texture.loadBackground(ctx, this.pendingTextures.ao);
			if (this.pendingTextures.orm)
				this.ormTexture = Texture.loadBackground(ctx, this.pendingTextures.orm);
			this.pendingTextures = {}; // clear and only do this once
			this.isDirty = true;
		}
		if (!this.uniformBuffer) {
			this.uniformBuffer = ctx.device.createBuffer({
				label: `StandardMaterial_${this.id}_Buffer`,
				size: 64, // 16 floats * 4 bytes
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			});
			ctx.vramTracker.register(
				this.uniformBuffer,
				"buffer",
				`StandardMaterial_${this.id}_Buffer`,
				64,
				"StandardMaterial",
			);
			this.isDirty = true;
		}

		if (this.isDirty) {
			this.updateBufferData();
			ctx.device.queue.writeBuffer(
				this.uniformBuffer,
				0,
				this.bufferData.buffer,
			);
			this.isDirty = false;
		}

		// Gather all textures. If one is missing, provide a dummy so the bind group is always valid.
		const tAlbedo = this.albedoTexture || Texture.getDummyWhite(ctx);
		const tNormal = this.normalTexture || Texture.getDummyNormal(ctx);
		const tRoughness = this.roughnessTexture || Texture.getDummyWhite(ctx);
		const tMetallic = this.metallicTexture || Texture.getDummyWhite(ctx);
		const tAO = this.aoTexture || Texture.getDummyWhite(ctx);
		const tORM = this.ormTexture || Texture.getDummyWhite(ctx);

		// Return cached bind group if already built for the current PCF variant
		if (this.bindGroup && this._bindGroupPCFVariant === this._usePCF)
			return this.bindGroup;

		const textures = [tAlbedo, tNormal, tRoughness, tMetallic, tAO, tORM];

		if (!this.sampler) {
			this.sampler = ctx.device.createSampler({
				minFilter: "linear",
				magFilter: "linear",
				mipmapFilter: "linear",
				maxAnisotropy: 4,
			});
		}
		const sampler = this.sampler;

		const tryBuild = () => {
			if (this.bindGroup) return;
			this.bindGroup = ctx.device.createBindGroup({
				label: `StandardMaterial_${this.id}_BindGroup`,
				layout: ctx.pipelineManager
					.getStandardPipeline(this._usePCF)
					.getBindGroupLayout(2),
				entries: [
					{ binding: 0, resource: { buffer: this.uniformBuffer } },
					{ binding: 1, resource: sampler },
					{ binding: 2, resource: tAlbedo.gpuTexture.createView() },
					{ binding: 3, resource: tNormal.gpuTexture.createView() },
					{ binding: 4, resource: tRoughness.gpuTexture.createView() },
					{ binding: 5, resource: tMetallic.gpuTexture.createView() },
					{ binding: 6, resource: tAO.gpuTexture.createView() },
					{ binding: 7, resource: tORM.gpuTexture.createView() },
				],
			});
			this._bindGroupPCFVariant = this._usePCF;
		};

		tryBuild();

		// Listen for async texture loading — rebuild the bind group when a texture is ready
		for (const tex of textures) {
			if (tex && !tex.isLoaded) {
				tex.onUpdate(() => {
					this.bindGroup = null;
					this._bindGroupPCFVariant = null;
				});
			}
		}

		// biome-ignore lint/style/noNonNullAssertion: tryBuild() above always assigns this.bindGroup
		return this.bindGroup!;
	}

	/**
	 * Releases standard material resources (GPUBuffers) and unregisters entries from the VRAM tracker.
	 *
	 * @param ctx - Active context.
	 */
	public destroy(ctx: Context): void {
		if (this.uniformBuffer) {
			ctx.vramTracker.unregister(this.uniformBuffer);
			this.uniformBuffer.destroy();
			// @ts-expect-error - allow cleanup reference assignment
			this.uniformBuffer = null;
		}
		this.bindGroup = null;
		this.sampler = null;
	}
}
