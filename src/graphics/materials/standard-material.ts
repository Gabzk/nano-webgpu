import type { Context } from "../../core/context";
import { normalizeCullMode, resolveCullMode } from "../cull-mode";
import { Texture } from "../texture";
import { Material, type MaterialOptions } from "./material";

/**
 * Configuration options utilized when instantiating a physically-based StandardMaterial.
 *
 * @group Materials
 */
export interface StandardMaterialOptions extends MaterialOptions {}

/**
 * StandardMaterial represents a Physically-Based Rendering (PBR) metallic-roughness material.
 * Manages material parameter uniform structures, linear samplers, lazy-loading sequences for texture assets,
 * handles shadow filtering variant compilation keys, and supports double-sided material rendering.
 *
 * @group Materials
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
		EMISSIVE_R: 16,
		EMISSIVE_G: 17,
		EMISSIVE_B: 18,
		HAS_EMISSIVE_MAP: 19,
	} as const;

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

		// 20 floats (80 bytes)
		this.bufferData = new Float32Array(20);
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
		this.bufferData[offsets.HAS_ROUGHNESS_MAP] = this.roughnessTexture
			? 1.0
			: 0.0;
		this.bufferData[offsets.HAS_METALLIC_MAP] = this.metallicTexture
			? 1.0
			: 0.0;
		this.bufferData[offsets.HAS_AO_MAP] = this.aoTexture ? 1.0 : 0.0;

		const lightingCull =
			this._lightingCullMode ?? normalizeCullMode(this._cullMode);
		const cullModeFlag =
			lightingCull === "front" ? 1.0 : lightingCull === "none" ? 2.0 : 0.0;

		this.bufferData[offsets.HAS_ORM_MAP] = this.ormTexture ? 1.0 : 0.0;
		this.bufferData[offsets.CULL_MODE] = cullModeFlag;
		this.bufferData[14] = 0.0;
		this.bufferData[15] = 0.0;

		this.bufferData[offsets.EMISSIVE_R] = this.emissiveColor.r;
		this.bufferData[offsets.EMISSIVE_G] = this.emissiveColor.g;
		this.bufferData[offsets.EMISSIVE_B] = this.emissiveColor.b;
		this.bufferData[offsets.HAS_EMISSIVE_MAP] = this.emissiveTexture
			? 1.0
			: 0.0;
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

	/** Invalidate cached bind group when properties change. */
	protected override onPropertyChange(): void {
		super.onPropertyChange();
		this.bindGroup = null;
		this._bindGroupPCFVariant = null;
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
		useCSM = false,
	): GPURenderPipeline {
		const resolvedCullMode = resolveCullMode(cullMode, topology);
		if (this._lightingCullMode !== resolvedCullMode) {
			this._lightingCullMode = resolvedCullMode;
			this.onPropertyChange();
		}
		return ctx.pipelineManager.getStandardPipeline(
			this._usePCF,
			topology,
			indexFormat,
			cullMode,
			this.depthWriteEnabled,
			this.depthCompare,
			useCSM,
		);
	}

	/**
	 * Allocates uniform buffers and packages textures, generating a standard bind group (index 2).
	 * Triggers asynchronous load sequences for string texture paths. Reuses dummy white/normal maps
	 * if optional texture arguments are omitted.
	 *
	 * @param ctx - Active context.
	 * @param _topology - Geometry topology.
	 * @param _indexFormat - Geometry index format.
	 * @returns Standard bind group 2 instance.
	 */
	public getBindGroup(
		ctx: Context,
		_topology?: GPUPrimitiveTopology,
		_indexFormat?: GPUIndexFormat,
	): GPUBindGroup {
		this.resolvePendingTextures(ctx);

		if (!this.uniformBuffer) {
			this.uniformBuffer = ctx.device.createBuffer({
				label: `StandardMaterial_${this.id}_Buffer`,
				size: 80, // 20 floats * 4 bytes
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			});
			ctx.vramTracker.register(
				this.uniformBuffer,
				"buffer",
				`StandardMaterial_${this.id}_Buffer`,
				80,
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
		const tEmissive = this.emissiveTexture || Texture.getDummyBlack(ctx);

		// Return cached bind group if already built for the current PCF variant
		if (this.bindGroup && this._bindGroupPCFVariant === this._usePCF)
			return this.bindGroup;

		const textures = [
			tAlbedo,
			tNormal,
			tRoughness,
			tMetallic,
			tAO,
			tORM,
			tEmissive,
		];

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
				layout: ctx.pipelineManager.getMaterialBindGroupLayout(),
				entries: [
					{ binding: 0, resource: { buffer: this.uniformBuffer } },
					{ binding: 1, resource: sampler },
					{ binding: 2, resource: tAlbedo.gpuTexture.createView() },
					{ binding: 3, resource: tNormal.gpuTexture.createView() },
					{ binding: 4, resource: tRoughness.gpuTexture.createView() },
					{ binding: 5, resource: tMetallic.gpuTexture.createView() },
					{ binding: 6, resource: tAO.gpuTexture.createView() },
					{ binding: 7, resource: tORM.gpuTexture.createView() },
					{ binding: 8, resource: tEmissive.gpuTexture.createView() },
				],
			});
			this._bindGroupPCFVariant = this._usePCF;
		};

		tryBuild();

		// Listen for async texture loading — rebuild the bind group when a texture is ready
		for (const tex of textures) {
			if (tex && !tex.isLoaded) {
				if (!this._textureUnsubscribes.has(tex)) {
					const unsub = tex.onUpdate(() => {
						this.bindGroup = null;
						this._bindGroupPCFVariant = null;
						if (tex.isLoaded) {
							const u = this._textureUnsubscribes.get(tex);
							if (u) {
								u();
								this._textureUnsubscribes.delete(tex);
							}
						}
					});
					this._textureUnsubscribes.set(tex, unsub);
				}
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
		// Unsubscribe all active loading listeners
		for (const unsub of this._textureUnsubscribes.values()) {
			unsub();
		}
		this._textureUnsubscribes.clear();

		if (this.uniformBuffer) {
			ctx.vramTracker.unregister(this.uniformBuffer);
			this.uniformBuffer.destroy();
			// @ts-expect-error - allow cleanup reference assignment
			this.uniformBuffer = null;
		}

		// Only destroy owned textures
		for (const tex of this._ownedTextures) {
			tex.destroy(ctx);
		}
		this._ownedTextures.clear();

		this._albedoTexture = null;
		this._normalTexture = null;
		this._roughnessTexture = null;
		this._metallicTexture = null;
		this._aoTexture = null;
		this._ormTexture = null;
		this._emissiveTexture = null;

		this.bindGroup = null;
		this.sampler = null;
	}
}
