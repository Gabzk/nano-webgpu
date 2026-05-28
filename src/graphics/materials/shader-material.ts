import type { Context } from "../../core/context";
import { Texture } from "../texture";
import { Material, type MaterialOptions } from "./material";
import { StandardMaterial } from "./standard-material";

/**
 * A record mapping custom WGSL parameter names to their numeric values, arrays, or Float32Arrays.
 *
 * > [!IMPORTANT]
 * > **Uniform Packing & Alignment**:
 * > WebGPU uniform buffers require strict layout alignment (std140 standard).
 * > For float-based structures in WGSL:
 * > - `f32` requires 4-byte alignment (1 float)
 * > - `vec2<f32>` requires 8-byte alignment (2 floats)
 * > - `vec3<f32>` and `vec4<f32>` require 16-byte alignment (4 floats)
 * > - `mat4x4<f32>` requires 64-byte alignment (16 floats)
 * >
 * > Parameters are packed sequentially based on the object's key insertion order.
 * > Ensure that your parameters object keys match the exact sequence and type alignment declared in your WGSL struct.
 * > You can use flat Float32Arrays or pad values manually to ensure alignment.
 *
 * @example
 * ```typescript
 * const material = new ShaderMaterial({
 *   shaderCode: myShader,
 *   parameters: {
 *     color: [1.0, 0.0, 0.0, 1.0], // vec4<f32> - 16 bytes
 *     intensity: 1.5,             // f32       - 4 bytes
 *     _padding: [0.0, 0.0, 0.0],  // pad to 16-byte boundary (12 bytes)
 *   }
 * });
 * ```
 *
 * @group Materials
 */
export type ShaderParameters = Record<string, number | number[] | Float32Array>;
/**
 * @deprecated Use ShaderParameters instead. Provided for backward compatibility.
 *
 * @group Materials
 */
export type ShaderUniforms = ShaderParameters;

/**
 * Configuration options utilized when creating a new custom ShaderMaterial.
 *
 * @group Materials
 */
export interface ShaderMaterialOptions extends MaterialOptions {
	/** WGSL custom shader code containing `vs_main` and `fs_main` entries. */
	shaderCode: string;
	/**
	 * Configurable parameters passed to the shader via `@group(3) @binding(0)`.
	 * Packed sequentially as 32-bit floats. Layout must align perfectly with target WGSL structures.
	 */
	parameters?: ShaderParameters;
	/** Legacy alias for parameters. */
	uniforms?: ShaderParameters;
}

/**
 * ShaderMaterial represents a fully customizable, user-driven shading material.
 * Enables integration of bespoke WGSL vertex and fragment shader scripts, providing
 * dynamic group 3 uniform buffers to drive animations and parameters. Automatically
 * maps dummy group 2 resources to fulfill baseline pipeline signatures.
 *
 * @group Materials
 */
export class ShaderMaterial extends Material {
	/** @internal WGSL custom shader code containing entry points. */
	private _shaderCode: string;

	/** Gets the WGSL custom shader code containing entry points. */
	get shaderCode(): string {
		return this._shaderCode;
	}

	/** Sets the WGSL custom shader code and marks the material as dirty. */
	set shaderCode(val: string) {
		if (this._shaderCode !== val) {
			this._shaderCode = val;
			this.onPropertyChange();
		}
	}

	/** @deprecated Direct custom bind group override. Set `customBindGroup` directly for fully custom group(2) setups. */
	public customBindGroup: GPUBindGroup | null = null;

	/** @internal Sequential packed parameter float values. */
	private _paramsData: Float32Array | null = null;

	// ── Group 2 default bind group (always required by the pipeline layout) ──
	/** @internal Default bind group 2 container. */
	private _defaultBindGroup: GPUBindGroup | null = null;
	/** @internal Default uniform buffer for material descriptors. */
	private _defaultUniformBuffer: GPUBuffer | null = null;
	/** @internal Linear filtering sampler. */
	private _defaultSampler: GPUSampler | null = null;

	// ── Group 3 params bind group ──
	/** @internal Custom uniform parameters buffer. */
	private _paramsBuffer: GPUBuffer | null = null;
	/** @internal Custom parameter bind group 3 container. */
	private _paramsBindGroup: GPUBindGroup | null = null;

	/** @internal Cached context reference for dynamic parameter updates and VRAM tracking. */
	private _ctx: Context | null = null;

	/**
	 * Instantiates a new ShaderMaterial.
	 *
	 * @param options - Shader options containing script code and custom parameters.
	 */
	constructor(options: ShaderMaterialOptions) {
		super(options);
		this.type = "ShaderMaterial";
		this._shaderCode = options.shaderCode;

		const params = options.parameters ?? options.uniforms;
		if (params) {
			this._paramsData = ShaderMaterial._packParams(params);
		}
	}

	// ─── Parameters helpers ───────────────────────────────────────────────────

	/**
	 * Packs key-value parameter sets into single sequential Float32Array streams.
	 * Pads data automatically to comply with 16-byte alignment limits required by WebGPU.
	 * Supports numbers, number arrays, and Float32Array inputs.
	 *
	 * @param params - Map of parameters to pack.
	 * @returns The packed Float32Array.
	 */
	private static _packParams(params: ShaderParameters): Float32Array {
		const floats: number[] = [];
		for (const value of Object.values(params)) {
			if (Array.isArray(value)) {
				floats.push(...value);
			} else if (value instanceof Float32Array) {
				floats.push(...Array.from(value));
			} else {
				floats.push(value);
			}
		}
		// Pad to 16-byte alignment (minimum uniform buffer size requirement)
		while (floats.length % 4 !== 0) floats.push(0);
		return new Float32Array(floats);
	}

	/**
	 * Updates custom shader parameters at runtime.
	 * Writes data to GPU uniform buffers immediately, altering visual features on the next frame.
	 * Re-allocates storage buffers if the float size count changes.
	 *
	 * @param params - Map of updated parameter values.
	 */
	public setParameters(params: ShaderParameters): void {
		this._paramsData = ShaderMaterial._packParams(params);
		this.isDirty = true;
		if (this._paramsBuffer) {
			const data = this._paramsData;
			if (this._paramsBuffer.size < data.byteLength) {
				// Buffer too small — destroy and recreate
				if (this._ctx) {
					this._ctx.vramTracker.unregister(this._paramsBuffer);
				}
				this._paramsBuffer.destroy();
				this._paramsBuffer = null;
				this._paramsBindGroup = null;
			}
		}
	}

	/**
	 * Legacy alias for setParameters().
	 *
	 * @param uniforms - Map of updated parameter values.
	 */
	public setUniforms(uniforms: ShaderParameters): void {
		this.setParameters(uniforms);
	}

	/** Invalidate cached bind group when properties change. */
	protected override onPropertyChange(): void {
		super.onPropertyChange();
		this._defaultBindGroup = null;
		this._paramsBindGroup = null;
	}

	// ─── Material interface ────────────────────────────────────────────────────

	/**
	 * Compiles or returns the cached GPURenderPipeline corresponding to this custom shader configuration.
	 *
	 * @param ctx - Active context.
	 * @param topology - Primitive geometry topology type.
	 * @param indexFormat - Geometry index buffer type.
	 * @param cullMode - Culling mode override.
	 * @returns The compiled GPURenderPipeline.
	 */
	public getPipeline(
		ctx: Context,
		topology: GPUPrimitiveTopology = "triangle-list",
		indexFormat: GPUIndexFormat = "uint16",
		cullMode?: GPUCullMode,
		useCSM = false,
	): GPURenderPipeline {
		if (this._paramsData) {
			return ctx.pipelineManager.getCustomPipelineWithParams(
				this.shaderCode,
				topology,
				indexFormat,
				cullMode,
				this.depthWriteEnabled,
				this.depthCompare,
				useCSM,
			);
		}
		return ctx.pipelineManager.getCustomPipeline(
			this.shaderCode,
			topology,
			indexFormat,
			cullMode,
			this.depthWriteEnabled,
			this.depthCompare,
			useCSM,
		);
	}

	/**
	 * Resolves GPUBindGroup (group index 2) containing baseline material bindings.
	 * Updates baseline uniform buffers and binds actual standard textures.
	 *
	 * @param ctx - Active context.
	 * @param topology - Geometry topology.
	 * @param indexFormat - Geometry index format.
	 * @returns Baseline material GPUBindGroup.
	 */
	public override getBindGroup(
		ctx: Context,
		_topology: GPUPrimitiveTopology = "triangle-list",
		_indexFormat: GPUIndexFormat = "uint16",
	): GPUBindGroup {
		if (this.customBindGroup) return this.customBindGroup;

		this.resolvePendingTextures(ctx);

		this._ctx = ctx;
		if (!this._defaultUniformBuffer) {
			this._defaultUniformBuffer = ctx.device.createBuffer({
				label: `ShaderMaterial_${this.id}_UniformBuffer`,
				size: 80, // 20 floats × 4 bytes
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			});
			ctx.vramTracker.register(
				this._defaultUniformBuffer,
				"buffer",
				`ShaderMaterial_${this.id}_UniformBuffer`,
				80,
				"ShaderMaterial",
			);
			this.isDirty = true;
		}

		if (this.isDirty) {
			// Write standard PBR properties to the Group 2 uniform buffer immediately so a custom shader
			// can easily access them from group 2 at binding 0!
			const bufferData = new Float32Array(20);
			const offsets = StandardMaterial.UNIFORM_OFFSETS;

			bufferData[offsets.ALBEDO_R] = this.albedoColor.r;
			bufferData[offsets.ALBEDO_G] = this.albedoColor.g;
			bufferData[offsets.ALBEDO_B] = this.albedoColor.b;
			bufferData[offsets.ALBEDO_A] = this.albedoColor.a ?? 1.0;

			bufferData[offsets.ROUGHNESS] = this.roughness;
			bufferData[offsets.METALLIC] = this.metallic;
			bufferData[offsets.NORMAL_SCALE] = this.normalScale;
			bufferData[offsets.AO_INTENSITY] = this.aoIntensity;

			bufferData[offsets.HAS_NORMAL_MAP] = this.normalTexture ? 1.0 : 0.0;
			bufferData[offsets.HAS_ROUGHNESS_MAP] = this.roughnessTexture ? 1.0 : 0.0;
			bufferData[offsets.HAS_METALLIC_MAP] = this.metallicTexture ? 1.0 : 0.0;
			bufferData[offsets.HAS_AO_MAP] = this.aoTexture ? 1.0 : 0.0;
			bufferData[offsets.HAS_ORM_MAP] = this.ormTexture ? 1.0 : 0.0;

			const cullModeFlag =
				this.cullMode === "front" ? 1.0 : this.cullMode === "none" ? 2.0 : 0.0;
			bufferData[offsets.CULL_MODE] = cullModeFlag;

			bufferData[offsets.EMISSIVE_R] = this.emissiveColor.r;
			bufferData[offsets.EMISSIVE_G] = this.emissiveColor.g;
			bufferData[offsets.EMISSIVE_B] = this.emissiveColor.b;
			bufferData[offsets.HAS_EMISSIVE_MAP] = this.emissiveTexture ? 1.0 : 0.0;

			ctx.device.queue.writeBuffer(
				this._defaultUniformBuffer,
				0,
				bufferData.buffer,
			);
			this.isDirty = false;
		}

		if (this._defaultBindGroup) return this._defaultBindGroup;

		if (!this._defaultSampler) {
			this._defaultSampler = ctx.device.createSampler({
				minFilter: "linear",
				magFilter: "linear",
				mipmapFilter: "linear",
				maxAnisotropy: 4,
			});
		}

		const tAlbedo = this.albedoTexture || Texture.getDummyWhite(ctx);
		const tNormal = this.normalTexture || Texture.getDummyNormal(ctx);
		const tRoughness = this.roughnessTexture || Texture.getDummyWhite(ctx);
		const tMetallic = this.metallicTexture || Texture.getDummyWhite(ctx);
		const tAO = this.aoTexture || Texture.getDummyWhite(ctx);
		const tORM = this.ormTexture || Texture.getDummyWhite(ctx);
		const tEmissive = this.emissiveTexture || Texture.getDummyBlack(ctx);

		const layout = ctx.pipelineManager.getMaterialBindGroupLayout();

		this._defaultBindGroup = ctx.device.createBindGroup({
			label: `ShaderMaterial_${this.id}_DefaultBindGroup`,
			layout,
			entries: [
				{ binding: 0, resource: { buffer: this._defaultUniformBuffer } },
				{ binding: 1, resource: this._defaultSampler },
				{ binding: 2, resource: tAlbedo.gpuTexture.createView() },
				{ binding: 3, resource: tNormal.gpuTexture.createView() },
				{ binding: 4, resource: tRoughness.gpuTexture.createView() },
				{ binding: 5, resource: tMetallic.gpuTexture.createView() },
				{ binding: 6, resource: tAO.gpuTexture.createView() },
				{ binding: 7, resource: tORM.gpuTexture.createView() },
				{ binding: 8, resource: tEmissive.gpuTexture.createView() },
			],
		});

		// Listen for async texture loading — rebuild the bind group when a texture is ready
		const textures = [
			tAlbedo,
			tNormal,
			tRoughness,
			tMetallic,
			tAO,
			tORM,
			tEmissive,
		];
		for (const tex of textures) {
			if (tex && !tex.isLoaded) {
				if (!this._textureUnsubscribes.has(tex)) {
					const unsub = tex.onUpdate(() => {
						this._defaultBindGroup = null;
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

		return this._defaultBindGroup;
	}

	/**
	 * Resolves the custom GPUBindGroup (group index 3) containing active parameter values.
	 * Returns null if no custom parameters were initialized during construction.
	 *
	 * @param ctx - Active context.
	 * @returns Custom parameter GPUBindGroup or null.
	 */
	public override getParamsBindGroup(ctx: Context): GPUBindGroup | null {
		if (!this._paramsData) return null;

		// Upload dirty parameters data
		if (this._paramsBuffer && this.isDirty) {
			ctx.device.queue.writeBuffer(
				this._paramsBuffer,
				0,
				this._paramsData.buffer,
			);
			this.isDirty = false;
		}

		if (this._paramsBindGroup) return this._paramsBindGroup;

		this._ctx = ctx;
		// Create the parameters buffer
		const byteLength = this._paramsData.byteLength;
		this._paramsBuffer = ctx.device.createBuffer({
			label: `ShaderMaterial_${this.id}_ParamsBuffer`,
			size: byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});
		ctx.vramTracker.register(
			this._paramsBuffer,
			"buffer",
			`ShaderMaterial_${this.id}_ParamsBuffer`,
			byteLength,
			"ShaderMaterial",
		);
		ctx.device.queue.writeBuffer(
			this._paramsBuffer,
			0,
			this._paramsData.buffer,
		);
		this.isDirty = false;

		const layout = ctx.pipelineManager.getCustomParamsBindGroupLayout();

		this._paramsBindGroup = ctx.device.createBindGroup({
			label: `ShaderMaterial_${this.id}_ParamsBindGroup`,
			layout,
			entries: [{ binding: 0, resource: { buffer: this._paramsBuffer } }],
		});

		return this._paramsBindGroup;
	}

	/**
	 * Releases custom shader material resources (GPUBuffers) and unregisters entries from the VRAM tracker.
	 *
	 * @param ctx - Active context.
	 */
	public destroy(ctx: Context): void {
		this._ctx = ctx;
		// Unsubscribe all active loading listeners
		for (const unsub of this._textureUnsubscribes.values()) {
			unsub();
		}
		this._textureUnsubscribes.clear();

		if (this._defaultUniformBuffer) {
			ctx.vramTracker.unregister(this._defaultUniformBuffer);
			this._defaultUniformBuffer.destroy();
			this._defaultUniformBuffer = null;
		}
		if (this._paramsBuffer) {
			ctx.vramTracker.unregister(this._paramsBuffer);
			this._paramsBuffer.destroy();
			this._paramsBuffer = null;
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

		this._defaultBindGroup = null;
		this._defaultSampler = null;
		this._paramsBindGroup = null;
	}
}
