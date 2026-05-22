import type { Node3D } from "../../core/node3d";
import { Vec3 } from "../../math/vec3";
import type { Camera } from "../camera";
import type { CameraMode } from "../camera-controller";

/**
 * Abstract base class for all camera controllers.
 * Provides shared camera properties and methods.
 */
export abstract class BaseCameraController {
	/** Active camera scheme mode. */
	public abstract mode: CameraMode;

	/** Camera reference driven by this controller. */
	public camera: Camera;

	/** Yaw rotation angle in radians (horizontal rotation around Y axis). */
	public yaw: number = 0;

	/** Pitch rotation angle in radians (vertical lookup/downwards rotation). */
	public pitch: number = 0;

	/** Target Node3D object (utilized by first-person and third-person modes). */
	public target: Node3D | null = null;

	/** Bounding focal center point in 3D space (utilized by orbit mode). */
	public center: Vec3 = new Vec3();

	/** Radial orbit distance from the focal look-at target. */
	public distance: number = 8;

	/** Orbit height offset above target (third-person mode). */
	public height: number = 3;

	/** Vertical offset relative to target pivot for eye placement (first-person mode). */
	public eyeHeight: number = 1.7;

	/** Mouse sensitivity multiplier. */
	public sensitivity: number = 0.003;

	/** Minimum clamped pitch angle in radians. */
	public minPitch: number = -80 * (Math.PI / 180);

	/** Maximum clamped pitch angle in radians. */
	public maxPitch: number = 60 * (Math.PI / 180);

	/** Auto-rotation toggle (orbit mode). */
	public autoRotate: boolean = false;

	/** Auto-rotation velocity in radians per second. */
	public autoRotateSpeed: number = 1.0;

	/** @internal Cached forward horizontal vector. */
	protected _forward: Vec3 = new Vec3();

	/** @internal Cached right horizontal vector. */
	protected _right: Vec3 = new Vec3();

	constructor(camera: Camera, options: BaseCameraControllerOptions = {}) {
		this.camera = camera;
		this.target = options.target ?? null;
		if (options.center) {
			this.center.copy(Vec3.from(options.center));
		}
		this.distance = options.distance ?? 8;
		this.height = options.height ?? 3;
		this.eyeHeight = options.eyeHeight ?? 1.7;
		this.sensitivity = options.sensitivity ?? 0.003;
		this.minPitch = (options.minPitch ?? -80) * (Math.PI / 180);
		this.maxPitch = (options.maxPitch ?? 60) * (Math.PI / 180);
		this.autoRotate = options.autoRotate ?? false;
		this.autoRotateSpeed = options.autoRotateSpeed ?? 1.0;
	}

	/**
	 * Automatically invoked by the Scene update routines every frame.
	 *
	 * @param dt - Delta frame time in seconds.
	 */
	public abstract update(dt: number): void;

	/**
	 * Computes and returns the forward direction vector aligned with the horizontal XZ plane (Y component zeroed).
	 *
	 * @returns A newly instantiated horizontal forward vector Vec3.
	 */
	public getForward(): Vec3 {
		return new Vec3(this._forward.x, 0, this._forward.z);
	}

	/**
	 * Computes and returns the rightward direction vector aligned with the horizontal XZ plane.
	 *
	 * @returns A newly instantiated horizontal right vector Vec3.
	 */
	public getRight(): Vec3 {
		return new Vec3(this._right.x, 0, this._right.z);
	}

	/**
	 * Cleans up any registered event listeners on the canvas.
	 */
	public destroy(): void {}
}

export interface BaseCameraControllerOptions {
	target?: Node3D | null;
	center?: Vec3 | null;
	distance?: number;
	height?: number;
	eyeHeight?: number;
	sensitivity?: number;
	minPitch?: number;
	maxPitch?: number;
	autoRotate?: boolean;
	autoRotateSpeed?: number;
}