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

export interface DirectionalLightOptions extends LightOptions {}

export interface PointLightOptions extends LightOptions {
	position?: Vec3 | number[];
	radius?: number;
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
}

export class DirectionalLight extends Light {
	constructor(options: DirectionalLightOptions = {}) {
		super(options);
	}
}

export class PointLight extends Light {
	public radius: number;

	constructor(options: PointLightOptions = {}) {
		super(options);
		this.position = Vec3.from(options.position ?? [0, 0, 0]);
		this.radius = options.radius ?? 10.0;
	}
}
