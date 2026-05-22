import type { Context } from "../../core/context";
import { Texture } from "../texture";
import { Material, type MaterialOptions } from "./material";

/**
 * A record mapping custom WGSL parameter names to their numeric floating point arrays.
 * Packed sequentially to match structural layout alignments.
 */
export type ShaderParameters = Record<string, number | number[]>;
/** @deprecated Use ShaderParameters instead. Provided for backward compatibility. */
export type ShaderUniforms = ShaderParameters;

/**
 * Configuration options utilized when creating a new custom ShaderMaterial.
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
 */
export class ShaderMaterial extends Material {
	/** WGSL custom shader code containing entry points. */
	public shaderCode: string;

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
		this.shaderCode = options.shaderCode;

		const params = options.parameters ?? options.uniforms;
		if (params) {
			this._paramsData = ShaderMaterial._packParams(params);
		}
	}

	// ─── Parameters helpers ───────────────────────────────────────────────────

	/**
	 * @internal Packs key-value parameter sets into single sequential Float32Array streams.
	 * Pads data automatically to comply with 16-byte alignment limits required by WebGPU.
	 */
	private static _packParams(params: ShaderParameters): Float32Array {
		const floats: number[] = [];
		for (const value of Object.values(params)) {
			if (Array.isArray(value)) {
				floats.push(...value);
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
		if (this._paramsBuffer) {
			const data = this._paramsData;
			if (this._paramsBuffer.size >= data.byteLength) {
				this.isDirty = true;
			} else {
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
	): GPURenderPipeline {
		if (this._paramsData) {
			return ctx.pipelineManager.getCustomPipelineWithParams(
				this.shaderCode,
				topology,
				indexFormat,
				cullMode,
				this.depthWriteEnabled,
				this.depthCompare,
			);
		}
		return ctx.pipelineManager.getCustomPipeline(
			this.shaderCode,
			topology,
			indexFormat,
			cullMode,
			this.depthWriteEnabled,
			this.depthCompare,
		);
	}

	/**
	 * Resolves GPUBindGroup (group index 2) containing baseline material bindings.
	 * Feeds placeholder dummy textures to comply with universal forward shader signatures.
	 *
	 * @param ctx - Active context.
	 * @param topology - Geometry topology.
	 * @param indexFormat - Geometry index format.
	 * @returns Baseline material GPUBindGroup.
	 */
	public getBindGroup(
		ctx: Context,
		topology: GPUPrimitiveTopology = "triangle-list",
		indexFormat: GPUIndexFormat = "uint16",
	): GPUBindGroup {
		if (this.customBindGroup) return this.customBindGroup;
		if (this._defaultBindGroup) return this._defaultBindGroup;

		this._ctx = ctx;
		if (!this._defaultUniformBuffer) {
			this._defaultUniformBuffer = ctx.device.createBuffer({
				label: `ShaderMaterial_${this.id}_UniformBuffer`,
				size: 64, // 16 floats × 4 bytes
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			});
			ctx.vramTracker.register(
				this._defaultUniformBuffer,
				"buffer",
				`ShaderMaterial_${this.id}_UniformBuffer`,
				64,
				"ShaderMaterial",
			);
		}

		if (!this._defaultSampler) {
			this._defaultSampler = ctx.device.createSampler({
				minFilter: "linear",
				magFilter: "linear",
			});
		}

		const dummyWhite = Texture.getDummyWhite(ctx);
		const dummyNormal = Texture.getDummyNormal(ctx);

		const pipeline = this._paramsData
			? ctx.pipelineManager.getCustomPipelineWithParams(
					this.shaderCode,
					topology,
					indexFormat,
				)
			: ctx.pipelineManager.getCustomPipeline(
					this.shaderCode,
					topology,
					indexFormat,
				);

		const layout = pipeline.getBindGroupLayout(2);

		this._defaultBindGroup = ctx.device.createBindGroup({
			label: `ShaderMaterial_${this.id}_DefaultBindGroup`,
			layout,
			entries: [
				{ binding: 0, resource: { buffer: this._defaultUniformBuffer } },
				{ binding: 1, resource: this._defaultSampler },
				{ binding: 2, resource: dummyWhite.gpuTexture.createView() },
				{ binding: 3, resource: dummyNormal.gpuTexture.createView() },
				{ binding: 4, resource: dummyWhite.gpuTexture.createView() },
				{ binding: 5, resource: dummyWhite.gpuTexture.createView() },
				{ binding: 6, resource: dummyWhite.gpuTexture.createView() },
				{ binding: 7, resource: dummyWhite.gpuTexture.createView() },
			],
		});

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

		const pipeline = ctx.pipelineManager.getCustomPipelineWithParams(
			this.shaderCode,
		);
		const layout = pipeline.getBindGroupLayout(3);

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
		this._defaultBindGroup = null;
		this._defaultSampler = null;
		this._paramsBindGroup = null;
	}
}
