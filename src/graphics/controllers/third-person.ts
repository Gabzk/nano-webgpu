import { Input } from "../../core/input";
import type { Camera } from "../camera";
import type { CameraMode } from "../camera-controller";
import { BaseCameraController } from "./base";

/**
 * ThirdPersonCameraController implements a classic third-person follow-look camera,
 * tracking a target Node3D node from a distance.
 */
export class ThirdPersonCameraController extends BaseCameraController {
	public override readonly mode: CameraMode = "third-person";

	constructor(camera: Camera, options: any = {}) {
		super(camera, options);
	}

	public override update(dt: number): void {
		const input = this.camera.ctx?.input || Input;

		// Read mouse deltas: mouse up -> camera orbits UP -> += movementY
		this.yaw -= input.mouseMovement.x * this.sensitivity;
		this.pitch += input.mouseMovement.y * this.sensitivity;

		// Clamp pitch
		this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));

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

		// Update internal direction vectors
		this._forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
		this._right.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
	}
}
