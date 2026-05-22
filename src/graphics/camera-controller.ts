import type { Node3D } from "../core/node3d";
import type { Vec3 } from "../math/vec3";
import type { Camera } from "./camera";
import { BaseCameraController } from "./controllers/base";
import { FirstPersonCameraController } from "./controllers/first-person";
import { OrbitCameraController } from "./controllers/orbit";
import { ThirdPersonCameraController } from "./controllers/third-person";

export {
	BaseCameraController,
	FirstPersonCameraController,
	OrbitCameraController,
	ThirdPersonCameraController,
};

/** Supported camera control styles. */
export type CameraMode = "third-person" | "first-person" | "orbit";

/** Parameters for configuring a third-person camera controller tracking a node from a distance. */
export interface ThirdPersonOptions {
	/** The target Node3D node that the camera orbits and tracks. */
	target: Node3D;
	/** Distance offset from the target node. Defaults to `8`. */
	distance?: number;
	/** Height offset above the target node (e.g. shoulder level). Defaults to `3`. */
	height?: number;
	/** Mouse rotation sensitivity (radians per mouse pixel movement). Defaults to `0.003`. */
	sensitivity?: number;
	/** Minimum pitch angle in degrees (prevents looking directly down). Defaults to `-80`. */
	minPitch?: number;
	/** Maximum pitch angle in degrees (prevents looking directly up). Defaults to `60`. */
	maxPitch?: number;
}

/** Parameters for configuring a first-person camera controller sitting inside a target node. */
export interface FirstPersonOptions {
	/** The target Node3D node whose spatial position is shared with the camera view. */
	target: Node3D;
	/** Vertical eyes offset height from target origin. Defaults to `1.7`. */
	eyeHeight?: number;
	/** Mouse rotation sensitivity. Defaults to `0.003`. */
	sensitivity?: number;
	/** Minimum pitch angle in degrees. Defaults to `-80`. */
	minPitch?: number;
	/** Maximum pitch angle in degrees. Defaults to `60`. */
	maxPitch?: number;
}

/** Parameters for configuring a standard orbiting camera around a static spatial focal point. */
export interface OrbitOptions {
	/** The central focal coordinates vector to orbit around. Defaults to `(0,0,0)`. */
	center?: Vec3 | number[];
	/** Orbit radius distance. Defaults to `8`. */
	distance?: number;
	/** Mouse rotation sensitivity. Defaults to `0.003`. */
	sensitivity?: number;
	/** Toggle auto-rotation. Defaults to `false`. */
	autoRotate?: boolean;
	/** Velocity of auto-rotation in radians per second. Defaults to `1.0`. */
	autoRotateSpeed?: number;
	/** Minimum pitch angle in degrees. Defaults to `-80`. */
	minPitch?: number;
	/** Maximum pitch angle in degrees. Defaults to `60`. */
	maxPitch?: number;
}

/**
 * CameraController implements spatial movement algorithms that drive Camera positions
 * and projection directions without requiring developers to write complex trigonometric calculations.
 * Supports orbital, first-person, and third-person camera schemes by delegating to specialized controllers.
 */
export class CameraController {
	/** @internal The actual specialized implementation class instance. */
	public impl: BaseCameraController;

	/**
	 * Creates a CameraController instance.
	 *
	 * @param camera - Driven Camera instance.
	 * @param mode - Operational style (orbit, first-person, or third-person).
	 * @param options - Configuration mapping parameters matching the selected mode.
	 */
	constructor(
		camera: Camera,
		mode: CameraMode,
		// biome-ignore lint/suspicious/noExplicitAny: type matching distinct option subsets
		options: ThirdPersonOptions | FirstPersonOptions | OrbitOptions = {} as any,
	) {
		if (mode === "orbit") {
			this.impl = new OrbitCameraController(camera, options);
		} else if (mode === "first-person") {
			this.impl = new FirstPersonCameraController(camera, options);
		} else {
			this.impl = new ThirdPersonCameraController(camera, options);
		}
	}

	/** Active camera scheme mode. */
	public get mode(): CameraMode {
		return this.impl.mode;
	}
	public set mode(val: CameraMode) {
		if (val === this.impl.mode) return;
		const camera = this.impl.camera;

		// Capture active state to carry over seamlessly
		const savedYaw = this.impl.yaw;
		const savedPitch = this.impl.pitch;
		const opts = {
			target: this.impl.target,
			center: this.impl.center,
			distance: this.impl.distance,
			height: this.impl.height,
			eyeHeight: this.impl.eyeHeight,
			sensitivity: this.impl.sensitivity,
			minPitch: this.impl.minPitch * (180 / Math.PI),
			maxPitch: this.impl.maxPitch * (180 / Math.PI),
			autoRotate: this.impl.autoRotate,
			autoRotateSpeed: this.impl.autoRotateSpeed,
		};

		// Clean up old canvas-level event listeners
		this.impl.destroy();

		// Hot-swap the underlying subclass implementation
		if (val === "orbit") {
			this.impl = new OrbitCameraController(camera, opts);
		} else if (val === "first-person") {
			this.impl = new FirstPersonCameraController(camera, opts);
		} else {
			this.impl = new ThirdPersonCameraController(camera, opts);
		}

		// Restore active rotation state
		this.impl.yaw = savedYaw;
		this.impl.pitch = savedPitch;
	}

	/** Yaw rotation angle in radians (horizontal rotation around Y axis). */
	public get yaw(): number {
		return this.impl.yaw;
	}
	public set yaw(val: number) {
		this.impl.yaw = val;
	}

	/** Pitch rotation angle in radians (vertical lookup/downwards rotation). */
	public get pitch(): number {
		return this.impl.pitch;
	}
	public set pitch(val: number) {
		this.impl.pitch = val;
	}

	/** Target Node3D object (utilized by first-person and third-person modes). */
	public get target(): Node3D | null {
		return this.impl.target;
	}
	public set target(val: Node3D | null) {
		this.impl.target = val;
	}

	/** Bounding focal center point in 3D space (utilized by orbit mode). */
	public get center(): Vec3 {
		return this.impl.center;
	}
	public set center(val: Vec3) {
		this.impl.center = val;
	}

	/** Radial orbit distance from the focal look-at target. */
	public get distance(): number {
		return this.impl.distance;
	}
	public set distance(val: number) {
		this.impl.distance = val;
	}

	/** Orbit height offset above target (third-person mode). */
	public get height(): number {
		return this.impl.height;
	}
	public set height(val: number) {
		this.impl.height = val;
	}

	/** Vertical offset relative to target pivot for eye placement (first-person mode). */
	public get eyeHeight(): number {
		return this.impl.eyeHeight;
	}
	public set eyeHeight(val: number) {
		this.impl.eyeHeight = val;
	}

	/** Mouse sensitivity multiplier. */
	public get sensitivity(): number {
		return this.impl.sensitivity;
	}
	public set sensitivity(val: number) {
		this.impl.sensitivity = val;
	}

	/** Minimum clamped pitch angle in radians. */
	public get minPitch(): number {
		return this.impl.minPitch;
	}
	public set minPitch(val: number) {
		this.impl.minPitch = val;
	}

	/** Maximum clamped pitch angle in radians. */
	public get maxPitch(): number {
		return this.impl.maxPitch;
	}
	public set maxPitch(val: number) {
		this.impl.maxPitch = val;
	}

	/** Auto-rotation toggle (orbit mode). */
	public get autoRotate(): boolean {
		return this.impl.autoRotate;
	}
	public set autoRotate(val: boolean) {
		this.impl.autoRotate = val;
	}

	/** Auto-rotation velocity in radians per second. */
	public get autoRotateSpeed(): number {
		return this.impl.autoRotateSpeed;
	}
	public set autoRotateSpeed(val: number) {
		this.impl.autoRotateSpeed = val;
	}

	/**
	 * Automatically invoked by the Scene update routines every frame.
	 * Resolves mouse input coordinate differentials, clamps angular pitches,
	 * and re-projects camera view matrix target vectors.
	 *
	 * @param dt - Delta frame time in seconds.
	 */
	public update(dt: number): void {
		this.impl.update(dt);
	}

	/**
	 * Computes and returns the forward direction vector aligned with the horizontal XZ plane (Y component zeroed).
	 * Extremely useful for driving character forward movements using keyboard controls.
	 *
	 * @returns A newly instantiated horizontal forward vector Vec3.
	 */
	public getForward(): Vec3 {
		return this.impl.getForward();
	}

	/**
	 * Computes and returns the rightward direction vector aligned with the horizontal XZ plane.
	 * Useful for character strafing and sideways movements.
	 *
	 * @returns A newly instantiated horizontal right vector Vec3.
	 */
	public getRight(): Vec3 {
		return this.impl.getRight();
	}

	/**
	 * Cleans up resources, including local canvas event listeners.
	 */
	public destroy(): void {
		this.impl.destroy();
	}
}
