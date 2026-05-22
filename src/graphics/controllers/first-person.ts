import { Input } from "../../core/input";
import type { Camera } from "../camera";
import type { CameraMode } from "../camera-controller";
import { BaseCameraController } from "./base";

/**
 * FirstPersonCameraController implements a classic first-person look scheme,
 * where the camera sits inside a target Node3D node and is controlled via mouse movement.
 */
export class FirstPersonCameraController extends BaseCameraController {
	public override readonly mode: CameraMode = "first-person";

	constructor(camera: Camera, options: any = {}) {
		super(camera, options);
	}

	public override update(dt: number): void {
		const input = this.camera.ctx?.input || Input;

		// Read mouse deltas: mouse up -> look UP -> -= movementY
		this.yaw -= input.mouseMovement.x * this.sensitivity;
		this.pitch -= input.mouseMovement.y * this.sensitivity;

		// Clamp pitch
		this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));

		if (!this.target) return;

		const tx = this.target.position.x;
		const ty = this.target.position.y + this.eyeHeight;
		const tz = this.target.position.z;

		this.camera.position.set(tx, ty, tz);

		// Look in the direction of yaw + pitch
		const cosPitch = Math.cos(this.pitch);
		this.camera.target.set(
			tx - Math.sin(this.yaw) * cosPitch,
			ty + Math.sin(this.pitch),
			tz - Math.cos(this.yaw) * cosPitch,
		);

		// Update internal direction vectors
		this._forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
		this._right.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
	}
}
