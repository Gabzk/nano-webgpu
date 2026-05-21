import { Node3D } from "../core/node3d";
import { Color } from "../math/color";
import { Vec3 } from "../math/vec3";

/**
 * Base configuration parameters utilized during Light node instantiation.
 */
export interface LightOptions {
	/** Color of emitted light. Can be a Color instance, hex string, or RGB array. Defaults to `#ffffff`. */
	color?: Color | string | number[];
	/** Scalar multiplier for light emission intensity. Defaults to `1.0`. */
	intensity?: number;
	/** Optional initial position of the light node in 3D space. */
	position?: Vec3 | number[];
	/** Optional initial rotation Euler angles in radians. */
	rotation?: Vec3 | number[];
	/** Optional initial rotation Euler angles in degrees. */
	rotationDegrees?: Vec3 | number[];
}

/**
 * Configuration options specific to directional light sources.
 */
export interface DirectionalLightOptions extends LightOptions {
	/** If true, the light will cast shadows and generate an orthographic depth map. Defaults to `true`. */
	castShadow?: boolean;
	/** Resolution width/height of the shadow map texture. Defaults to `2048`. */
	shadowMapSize?: number;
	/** Toggle Percentage-Closer Filtering (PCF) to smooth out shadow edges. Defaults to `true`. */
	usePCF?: boolean;
	/** World-space boundary half-extent defining the orthographic shadow view box. Defaults to `20.0`. */
	shadowRadius?: number;
	/** Total depth range along the Z axis of the shadow projection frustum. Defaults to `200.0`. */
	shadowDepthRange?: number;
}

/**
 * Configuration options specific to point light sources.
 */
export interface PointLightOptions extends LightOptions {
	/** Initial spatial position of the point light source. */
	position?: Vec3 | number[];
	/** Physical radius threshold defining light attenuation distance. Defaults to `10.0`. */
	radius?: number;
	/** If true, the point light will cast shadows. Defaults to `false`. */
	castShadow?: boolean;
}

/**
 * Represents the binary GPU-ready memory alignment structure for individual lights.
 * Conforms precisely with the WGSL standard layout struct declared within the default shader.
 */
export interface LightGPUData {
	/** Spatial translation coordinates (point light) or normalized direction vector (directional light). */
	x: number;
	/** Spatial translation coordinates (point light) or normalized direction vector (directional light). */
	y: number;
	/** Spatial translation coordinates (point light) or normalized direction vector (directional light). */
	z: number;
	/**
	 * Bitwise/ordinal flag representing light type and shadow casting parameters.
	 * - `0.0`: Directional light, no shadows.
	 * - `1.0`: Directional light, shadow-casting.
	 * - `2.0`: Point light, no shadows.
	 * - `3.0`: Point light, shadow-casting.
	 */
	typeFlag: number;
	/** Red color component in sRGB/Linear space. */
	r: number;
	/** Green color component in sRGB/Linear space. */
	g: number;
	/** Blue color component in sRGB/Linear space. */
	b: number;
	/** Physical scale factor describing light brilliance. */
	intensity: number;
}

/**
 * Aggregates configuration details used when allocating depth maps and configuring PCF samplers.
 */
export interface ShadowConfig {
	/** Width/height resolution of the depth attachment texture. */
	shadowMapSize: number;
	/** Toggle Percentage-Closer Filtering (PCF) during fragment shader depth evaluations. */
	usePCF: boolean;
	/** Half-extent size of the orthographic shadow frustum. */
	shadowRadius: number;
	/** Linear depth range utilized by the orthographic shadow matrix projection. */
	shadowDepthRange: number;
}

/**
 * Base class representing a light source in the 3D scene.
 * Manages diffuse/specular colors, intensity, and provides standard polymorphic hooks
 * to stream packed GPU data to WebGPU buffers.
 */
export class Light extends Node3D {
	/** @internal Diffuse/specular color of the light source. */
	private _color: Color;
	/** @internal Attenuation/intensity scale factor. */
	private _intensity: number;

	/** Gets the Color instance of the light source. */
	get color(): Color {
		return this._color;
	}
	/** Sets the Color instance of the light source and registers coordinate change triggers. */
	set color(val: Color) {
		this._color = val;
		this._color.onChange = () => {
			this.isDirty = true;
		};
		this.isDirty = true;
	}

	/** Gets the scalar intensity multiplier. */
	get intensity(): number {
		return this._intensity;
	}
	/** Sets the scalar intensity multiplier and flags the node as dirty. */
	set intensity(val: number) {
		this._intensity = val;
		this.isDirty = true;
	}

	/**
	 * Instantiates a base Light node.
	 *
	 * @param options - Custom light parameters.
	 */
	constructor(options: LightOptions = {}) {
		super();
		this._color = Color.from(options.color ?? "#ffffff");
		this._color.onChange = () => {
			this.isDirty = true;
		};
		this._intensity = options.intensity ?? 1.0;
	}

	/**
	 * Formats and bundles raw components into standard aligned structures ready to write
	 * directly to GPUBuffers.
	 *
	 * @returns Aligned LightGPUData mapping.
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
	 * Retrieves the active shadow projection config mapping.
	 *
	 * @returns The configuration parameters, or null if shadow casting is disabled.
	 */
	public getShadowConfig(): ShadowConfig | null {
		return null;
	}
}

/**
 * DirectionalLight represents an infinitely far light source emitting parallel light rays
 * along a uniform coordinate direction (e.g. sunlight).
 * Can be configured to generate standard orthographic shadow depth maps.
 */
export class DirectionalLight extends Light {
	/** If true, enables rendering of a depth texture from this light's perspective. */
	public castShadow: boolean = true;
	/** Resolution of the generated shadow map texture. */
	public shadowMapSize: number = 2048;
	/** Enables hardware Percentage-Closer Filtering (PCF) to smooth shadow boundary edges. */
	public usePCF: boolean = true;
	/** Boundary half-extents defining width/height limits of the orthographic shadow view box. */
	public shadowRadius: number = 20.0;
	/** Near/Far depth boundary limits of the shadow projection volume. */
	public shadowDepthRange: number = 200.0;

	/**
	 * Instantiates a new DirectionalLight node.
	 *
	 * @param options - Custom DirectionalLight parameters.
	 */
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

	/**
	 * Overrides polymorphic routines to pack normalized direction vectors and shadow status flags.
	 * Uses the world matrix to project forward directional rays.
	 *
	 * @returns Aligned directional LightGPUData.
	 */
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

	/**
	 * Compiles and returns active shadow map configurations.
	 *
	 * @returns ShadowConfig descriptors, or null if shadow casting is disabled.
	 */
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

/**
 * PointLight represents an omnidirectional light source emitting light rays uniformly
 * outward from a single point in space (e.g. light bulbs).
 * Attenuates based on distance and defined radius limits.
 */
export class PointLight extends Light {
	/** Linear distance limit at which point light attenuation falls to zero. */
	public radius: number;
	/** Enables depth projection (not yet implemented for omnidirectional point lights). */
	public castShadow: boolean = false;

	/**
	 * Instantiates a new PointLight node.
	 *
	 * @param options - Custom PointLight parameters.
	 */
	constructor(options: PointLightOptions = {}) {
		super(options);
		this.position = Vec3.from(options.position ?? [0, 0, 0]);
		this.radius = options.radius ?? 10.0;
		if (options.castShadow !== undefined) this.castShadow = options.castShadow;
	}

	/**
	 * Packs world-space translation coordinates and point-light type flags.
	 *
	 * @returns Aligned point LightGPUData.
	 */
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
