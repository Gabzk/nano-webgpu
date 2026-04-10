import { Input } from "../core/input";
import { Node3D } from "../core/node3d";
import { Vec3 } from "../math/vec3";
import type { Camera } from "./camera";

export type CameraMode = "third-person" | "first-person" | "orbit";

export interface ThirdPersonOptions {
	/** The Node3D the camera follows */
	target: Node3D;
	/** Distance from the camera to the target */
	distance?: number;
	/** Height above the target */
	height?: number;
	/** Mouse sensitivity (radians per pixel) */
	sensitivity?: number;
	/** Minimum pitch angle in degrees (looking down) */
	minPitch?: number;
	/** Maximum pitch angle in degrees (looking up) */
	maxPitch?: number;
}

export interface FirstPersonOptions {
	/** The Node3D whose position the camera sits at */
	target: Node3D;
	/** Height offset for the "eyes" */
	eyeHeight?: number;
	/** Mouse sensitivity (radians per pixel) */
	sensitivity?: number;
	/** Minimum pitch angle in degrees */
	minPitch?: number;
	/** Maximum pitch angle in degrees */
	maxPitch?: number;
}

export interface OrbitOptions {
	/** The center point to orbit around */
	center?: Vec3 | number[];
	/** Distance from the center */
	distance?: number;
	/** Mouse sensitivity (radians per pixel) */
	sensitivity?: number;
	/** Whether the camera auto-rotates */
	autoRotate?: boolean;
	/** Speed of auto-rotation (radians/sec) */
	autoRotateSpeed?: number;
	/** Minimum pitch angle in degrees */
	minPitch?: number;
	/** Maximum pitch angle in degrees */
	maxPitch?: number;
}

/**
 * @module CameraController
 * @description
 * Pre-built camera behaviors that eliminate trigonometry for the developer.
 * Inspired by Godot's SpringArm3D + pivot node pattern, but condensed into
 * a single component that attaches to a Camera.
 *
 * Usage:
 * ```typescript
 * const ctrl = camera.addController("third-person", { target: player, distance: 10 });
 * ```
 */
export class CameraController {
	public mode: CameraMode;
	public yaw: number = 0;
	public pitch: number = 0;

	// References
	private camera: Camera;
	public target: Node3D | null = null;
	public center: Vec3;

	// Parameters
	public distance: number;
	public height: number;
	public eyeHeight: number;
	public sensitivity: number;
	public minPitch: number;
	public maxPitch: number;
	public autoRotate: boolean;
	public autoRotateSpeed: number;

	// Internal scratch vectors (avoid GC)
	private _forward: Vec3 = new Vec3();
	private _right: Vec3 = new Vec3();

	constructor(
		camera: Camera,
		mode: CameraMode,
		options: ThirdPersonOptions | FirstPersonOptions | OrbitOptions = {} as any,
	) {
		this.camera = camera;
		this.mode = mode;

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
	 * Called automatically by Scene._renderFrame() every frame.
	 * Reads Input.mouseMovement and updates the camera's position/target.
	 * @param dt - Delta time in seconds (used for auto-rotate)
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

	private updateThirdPerson(): void {
		if (!this.target) return;

		const tx = this.target.position.x;
		const ty = this.target.position.y;
		const tz = this.target.position.z;

		// Look-at point = character position + height (e.g., shoulder level)
		const lookAtY = ty + this.height;

		// Pure spherical orbit: camera is always exactly `distance` from the look-at point.
		// cos(pitch) shrinks XZ, sin(pitch) adds Y — total distance stays constant.
		const cosPitch = Math.cos(this.pitch);
		this.camera.position.set(
			tx + Math.sin(this.yaw) * cosPitch * this.distance,
			lookAtY + Math.sin(this.pitch) * this.distance,
			tz + Math.cos(this.yaw) * cosPitch * this.distance,
		);

		this.camera.target.set(tx, lookAtY, tz);
	}

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
	 * Returns the forward direction relative to the camera (XZ plane, no Y component).
	 * Use this for WASD movement:
	 * ```typescript
	 * cube.position.add(ctrl.getForward().scaled(speed * dt));
	 * ```
	 * Returns a **new** Vec3 each call — safe to modify.
	 */
	public getForward(): Vec3 {
		return new Vec3(this._forward.x, 0, this._forward.z);
	}

	/**
	 * Returns the right direction relative to the camera (XZ plane, no Y component).
	 * Returns a **new** Vec3 each call — safe to modify.
	 */
	public getRight(): Vec3 {
		return new Vec3(this._right.x, 0, this._right.z);
	}
}
