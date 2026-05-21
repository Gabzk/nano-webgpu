import { Input } from "../core/input";
import type { Node3D } from "../core/node3d";
import { Vec3 } from "../math/vec3";
import type { Camera } from "./camera";

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
 * Supports orbital, first-person, and third-person camera schemes.
 */
export class CameraController {
	/** Active camera scheme mode. */
	public mode: CameraMode;
	/** Yaw rotation angle in radians (horizontal rotation around Y axis). */
	public yaw: number = 0;
	/** Pitch rotation angle in radians (vertical lookup/downwards rotation). */
	public pitch: number = 0;

	/** @internal Camera reference driven by this controller. */
	private camera: Camera;

	/** Target Node3D object (utilized by first-person and third-person modes). */
	public target: Node3D | null = null;

	/** Bounding focal center point in 3D space (utilized by orbit mode). */
	public center: Vec3;

	/** Radial orbit distance from the focal look-at target. */
	public distance: number;

	/** Orbit height offset above target (third-person mode). */
	public height: number;

	/** Vertical offset relative to target pivot for eye placement (first-person mode). */
	public eyeHeight: number;

	/** Mouse sensitivity multiplier. */
	public sensitivity: number;

	/** Minimum clamped pitch angle in radians. */
	public minPitch: number;

	/** Maximum clamped pitch angle in radians. */
	public maxPitch: number;

	/** Auto-rotation toggle (orbit mode). */
	public autoRotate: boolean;

	/** Auto-rotation velocity in radians per second. */
	public autoRotateSpeed: number;

	/** @internal Cached forward horizontal vector. */
	private _forward: Vec3 = new Vec3();

	/** @internal Cached right horizontal vector. */
	private _right: Vec3 = new Vec3();

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
		this.camera = camera;
		this.mode = mode;

		// biome-ignore lint/suspicious/noExplicitAny: type matching distinct option subsets
		const opts = options as any;
		this.target = opts.target ?? null;
		this.center = opts.center ? Vec3.from(opts.center) : new Vec3(0, 0, 0);
		this.distance = opts.distance ?? 8;
		this.height = opts.height ?? 3;
		this.eyeHeight = opts.eyeHeight ?? 1.7;
		this.sensitivity = opts.sensitivity ?? 0.003;
		this.minPitch = (opts.minPitch ?? -80) * (Math.PI / 180);
		this.maxPitch = (opts.maxPitch ?? 60) * (Math.PI / 180);
		this.autoRotate = opts.autoRotate ?? false;
		this.autoRotateSpeed = opts.autoRotateSpeed ?? 1;
	}

	/**
	 * Automatically invoked by the Scene update routines every frame.
	 * Resolves mouse input coordinate differentials, clamps angular pitches,
	 * and re-projects camera view matrix target vectors.
	 *
	 * @param dt - Delta frame time in seconds.
	 */
	public update(dt: number): void {
		// Read mouse deltas
		this.yaw -= Input.mouseMovement.x * this.sensitivity;

		// Pitch direction depends on mode:
		// Third-person: mouse up → camera orbits UP → += movementY
		// First-person: mouse up → look UP → -= movementY (FPS convention)
		if (this.mode === "first-person") {
			this.pitch -= Input.mouseMovement.y * this.sensitivity;
		} else {
			this.pitch += Input.mouseMovement.y * this.sensitivity;
		}

		// Clamp pitch
		this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));

		switch (this.mode) {
			case "third-person":
				this.updateThirdPerson();
				break;
			case "first-person":
				this.updateFirstPerson();
				break;
			case "orbit":
				this.updateOrbit(dt);
				break;
		}

		// Update internal direction vectors
		this._forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
		this._right.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
	}

	/**
	 * @internal Executes third-person orbiting and follow-look matrix updates.
	 */
	private updateThirdPerson(): void {
		if (!this.target) return;

		const tx = this.target.position.x;
		const ty = this.target.position.y;
		const tz = this.target.position.z;

		// Look-at point = character position + height (e.g., shoulder level)
		const lookAtY = ty + this.height;

		// Pure spherical orbit: camera is always exactly `distance` from the look-at point.
		const cosPitch = Math.cos(this.pitch);
		this.camera.position.set(
			tx + Math.sin(this.yaw) * cosPitch * this.distance,
			lookAtY + Math.sin(this.pitch) * this.distance,
			tz + Math.cos(this.yaw) * cosPitch * this.distance,
		);

		this.camera.target.set(tx, lookAtY, tz);
	}

	/**
	 * @internal Executes first-person eye positioning and target vector re-projection.
	 */
	private updateFirstPerson(): void {
		if (!this.target) return;

		const tx = this.target.position.x;
		const ty = this.target.position.y + this.eyeHeight;
		const tz = this.target.position.z;

		this.camera.position.set(tx, ty, tz);

		// Look in the direction of yaw + pitch
		this.camera.target.set(
			tx - Math.sin(this.yaw) * Math.cos(this.pitch),
			ty + Math.sin(this.pitch),
			tz - Math.cos(this.yaw) * Math.cos(this.pitch),
		);
	}

	/**
	 * @internal Executes standard orbital camera positioning with optional auto-rotation.
	 *
	 * @param dt - Frame delta time in seconds.
	 */
	private updateOrbit(dt: number): void {
		if (this.autoRotate) {
			this.yaw += this.autoRotateSpeed * dt;
		}

		const cx = this.center.x;
		const cy = this.center.y;
		const cz = this.center.z;

		const cosPitch = Math.cos(this.pitch);
		this.camera.position.set(
			cx + Math.sin(this.yaw) * cosPitch * this.distance,
			cy + Math.sin(this.pitch) * this.distance,
			cz + Math.cos(this.yaw) * cosPitch * this.distance,
		);

		this.camera.target.set(cx, cy, cz);
	}

	/**
	 * Computes and returns the forward direction vector aligned with the horizontal XZ plane (Y component zeroed).
	 * Extremely useful for driving character forward movements using keyboard controls.
	 *
	 * @returns A newly instantiated horizontal forward vector Vec3.
	 */
	public getForward(): Vec3 {
		return new Vec3(this._forward.x, 0, this._forward.z);
	}

	/**
	 * Computes and returns the rightward direction vector aligned with the horizontal XZ plane.
	 * Useful for character strafing and sideways movements.
	 *
	 * @returns A newly instantiated horizontal right vector Vec3.
	 */
	public getRight(): Vec3 {
		return new Vec3(this._right.x, 0, this._right.z);
	}
}
