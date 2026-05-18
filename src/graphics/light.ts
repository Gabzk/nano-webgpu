import { Node3D } from "../core/node3d";
import { Color } from "../math/color";
import { Vec3 } from "../math/vec3";

export interface LightOptions {
	color?: Color | string | number[];
	intensity?: number;
	position?: Vec3 | number[];
	rotation?: Vec3 | number[];
	rotationDegrees?: Vec3 | number[];
}

export interface DirectionalLightOptions extends LightOptions {
	castShadow?: boolean;
	shadowMapSize?: number;
	usePCF?: boolean;
	/** World-space half-extent of the shadow frustum. Default: 20.0 */
	shadowRadius?: number;
	/** Depth range of the shadow frustum. Default: 200.0 */
	shadowDepthRange?: number;
}

export interface PointLightOptions extends LightOptions {
	position?: Vec3 | number[];
	radius?: number;
	castShadow?: boolean;
}

/**
 * Packed GPU-ready data for a single light entry in the lights storage buffer.
 * Layout matches the WGSL struct in the default shader.
 */
export interface LightGPUData {
	/** Direction (directional light) or world position (point light) */
	x: number;
	y: number;
	z: number;
	/**
	 * Type encoding:
	 * 0 = directional, no shadow
	 * 1 = directional, casts shadow
	 * 2 = point, no shadow
	 * 3 = point, casts shadow
	 */
	typeFlag: number;
	r: number;
	g: number;
	b: number;
	intensity: number;
}

/**
 * Shadow configuration for lights that produce shadow maps.
 * Returned by getShadowConfig(); null means "no shadow".
 */
export interface ShadowConfig {
	shadowMapSize: number;
	usePCF: boolean;
	shadowRadius: number;
	shadowDepthRange: number;
}

export class Light extends Node3D {
	private _color: Color;
	private _intensity: number;

	get color(): Color {
		return this._color;
	}
	set color(val: Color) {
		this._color = val;
		this._color.onChange = () => {
			this.isDirty = true;
		};
		this.isDirty = true;
	}

	get intensity(): number {
		return this._intensity;
	}
	set intensity(val: number) {
		this._intensity = val;
		this.isDirty = true;
	}

	constructor(options: LightOptions = {}) {
		super();
		this._color = Color.from(options.color ?? "#ffffff");
		this._color.onChange = () => {
			this.isDirty = true;
		};
		this._intensity = options.intensity ?? 1.0;
	}

	/**
	 * Returns the packed GPU data for this light's entry in the lights storage buffer.
	 * Override in subclasses to provide light-type-specific data without instanceof checks.
	 */
	public getLightData(): LightGPUData {
		return {
			x: 0,
			y: 0,
			z: 0,
			typeFlag: 0,
			r: this._color.r,
			g: this._color.g,
			b: this._color.b,
			intensity: this._intensity,
		};
	}

	/**
	 * Returns shadow map configuration if this light produces a shadow map, or null otherwise.
	 * Override in subclasses — base implementation returns null (no shadows).
	 */
	public getShadowConfig(): ShadowConfig | null {
		return null;
	}
}

export class DirectionalLight extends Light {
	public castShadow: boolean = true;
	public shadowMapSize: number = 2048;
	public usePCF: boolean = true;
	/** World-space half-extent of the orthographic shadow frustum. */
	public shadowRadius: number = 20.0;
	/** Depth range of the orthographic shadow frustum. */
	public shadowDepthRange: number = 200.0;

	constructor(options: DirectionalLightOptions = {}) {
		super(options);
		if (options.castShadow !== undefined) this.castShadow = options.castShadow;
		if (options.shadowMapSize !== undefined)
			this.shadowMapSize = options.shadowMapSize;
		if (options.usePCF !== undefined) this.usePCF = options.usePCF;
		if (options.shadowRadius !== undefined)
			this.shadowRadius = options.shadowRadius;
		if (options.shadowDepthRange !== undefined)
			this.shadowDepthRange = options.shadowDepthRange;
	}

	public override getLightData(): LightGPUData {
		const dir = this.worldMatrix.transformDirection(new Vec3(0, 0, -1));
		return {
			x: dir.x,
			y: dir.y,
			z: dir.z,
			typeFlag: this.castShadow ? 1.0 : 0.0,
			r: this.color.r,
			g: this.color.g,
			b: this.color.b,
			intensity: this.intensity,
		};
	}

	public override getShadowConfig(): ShadowConfig | null {
		if (!this.castShadow) return null;
		return {
			shadowMapSize: this.shadowMapSize,
			usePCF: this.usePCF,
			shadowRadius: this.shadowRadius,
			shadowDepthRange: this.shadowDepthRange,
		};
	}
}

export class PointLight extends Light {
	public radius: number;
	public castShadow: boolean = false;

	constructor(options: PointLightOptions = {}) {
		super(options);
		this.position = Vec3.from(options.position ?? [0, 0, 0]);
		this.radius = options.radius ?? 10.0;
		if (options.castShadow !== undefined) this.castShadow = options.castShadow;
	}

	public override getLightData(): LightGPUData {
		return {
			x: this.worldMatrix.values[12],
			y: this.worldMatrix.values[13],
			z: this.worldMatrix.values[14],
			typeFlag: this.castShadow ? 3.0 : 2.0,
			r: this.color.r,
			g: this.color.g,
			b: this.color.b,
			intensity: this.intensity,
		};
	}
}
