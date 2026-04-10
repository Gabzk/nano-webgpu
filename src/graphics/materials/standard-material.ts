import type { Context } from "../../core/context";
import { Color } from "../../math/color";
import { PipelineManager } from "../pipeline";
import { Texture } from "../texture";
import { Material } from "./material";

export interface StandardMaterialOptions {
	albedoColor?: Color | string;
	albedoTexture?: Texture | string;

	normalTexture?: Texture | string;
	normalScale?: number;

	roughness?: number;
	roughnessTexture?: Texture | string;

	metallic?: number;
	metallicTexture?: Texture | string;

	aoTexture?: Texture | string;
	aoIntensity?: number;

	ormTexture?: Texture | string;
}

export class StandardMaterial extends Material {
	private _albedoColor: Color = new Color();
	public albedoTexture: Texture | null = null;

	public normalTexture: Texture | null = null;
	private _normalScale: number = 1.0;

	private _roughness: number = 0.5;
	public roughnessTexture: Texture | null = null;

	private _metallic: number = 0.0;
	public metallicTexture: Texture | null = null;

	public aoTexture: Texture | null = null;
	private _aoIntensity: number = 1.0;

	public ormTexture: Texture | null = null;

	get albedoColor(): Color {
		return this._albedoColor;
	}
	set albedoColor(val: Color) {
		this._albedoColor = val;
		this._albedoColor.onChange = () => {
			this.isDirty = true;
		};
		this.isDirty = true;
	}

	get normalScale(): number {
		return this._normalScale;
	}
	set normalScale(val: number) {
		this._normalScale = val;
		this.isDirty = true;
	}

	get roughness(): number {
		return this._roughness;
	}
	set roughness(val: number) {
		this._roughness = val;
		this.isDirty = true;
	}

	get metallic(): number {
		return this._metallic;
	}
	set metallic(val: number) {
		this._metallic = val;
		this.isDirty = true;
	}

	get aoIntensity(): number {
		return this._aoIntensity;
	}
	set aoIntensity(val: number) {
		this._aoIntensity = val;
		this.isDirty = true;
	}

	private pendingTextures: { [key: string]: string } = {};

	private uniformBuffer!: GPUBuffer;
	private bindGroup!: GPUBindGroup;
	private bufferData!: Float32Array;

	constructor(options: StandardMaterialOptions = {}) {
		super();
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

		// 16 floats (64 bytes)
		this.bufferData = new Float32Array(16);
	}

	private updateBufferData() {
		this.bufferData[0] = this.albedoColor.r;
		this.bufferData[1] = this.albedoColor.g;
		this.bufferData[2] = this.albedoColor.b;
		this.bufferData[3] = this.albedoColor.a ?? 1.0;

		this.bufferData[4] = this.roughness;
		this.bufferData[5] = this.metallic;
		this.bufferData[6] = this.normalScale;
		this.bufferData[7] = this.aoIntensity;

		this.bufferData[8] = this.normalTexture ? 1.0 : 0.0;
		this.bufferData[9] = this.roughnessTexture ? 1.0 : 0.0;
		this.bufferData[10] = this.metallicTexture ? 1.0 : 0.0;
		this.bufferData[11] = this.aoTexture ? 1.0 : 0.0;

		this.bufferData[12] = this.ormTexture ? 1.0 : 0.0;
		this.bufferData[13] = 0.0;
		this.bufferData[14] = 0.0;
		this.bufferData[15] = 0.0;
	}

	public getPipeline(ctx: Context): GPURenderPipeline {
		return PipelineManager.getStandardPipeline(ctx);
	}

	public getBindGroup(ctx: Context): GPUBindGroup {
		if (Object.keys(this.pendingTextures).length > 0) {
			if (this.pendingTextures.albedo)
				this.albedoTexture = Texture.loadBackground(
					ctx,
					this.pendingTextures.albedo,
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

		// Gather all textures. If one is missing, provide a dummy texture so WebGPU bind group gets created successfully
		const tAlbedo = this.albedoTexture || Texture.getDummyWhite(ctx);
		const tNormal = this.normalTexture || Texture.getDummyNormal(ctx);
		const tRoughness = this.roughnessTexture || Texture.getDummyWhite(ctx);
		const tMetallic = this.metallicTexture || Texture.getDummyWhite(ctx);
		const tAO = this.aoTexture || Texture.getDummyWhite(ctx);
		const tORM = this.ormTexture || Texture.getDummyWhite(ctx);

		// To avoid constantly remaking bind group, we do it if not exists or if a texture finishes loading
		const needsRebuild = !this.bindGroup;
		const textures = [tAlbedo, tNormal, tRoughness, tMetallic, tAO, tORM];

		if (!needsRebuild) {
			return this.bindGroup;
		}

		const sampler = ctx.device.createSampler({
			minFilter: "linear",
			magFilter: "linear",
			mipmapFilter: "linear",
			maxAnisotropy: 4,
		});

		const tryBuild = () => {
			if (this.bindGroup) return; // Prevent double trigger
			this.bindGroup = ctx.device.createBindGroup({
				label: `StandardMaterial_${this.id}_BindGroup`,
				layout: PipelineManager.getStandardPipeline(ctx).getBindGroupLayout(2),
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
		};

		tryBuild();

		// Listen for async loading
		for (const tex of textures) {
			if (tex && !tex.isLoaded) {
				tex.onUpdate(() => {
					// Force rebuild the group
					//@ts-expect-error
					this.bindGroup = null;
					tryBuild();
				});
			}
		}

		return this.bindGroup;
	}
}
