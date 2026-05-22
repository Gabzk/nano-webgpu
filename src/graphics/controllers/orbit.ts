import { Input } from "../../core/input";
import type { Camera } from "../camera";
import type { CameraMode } from "../camera-controller";
import { BaseCameraController } from "./base";

/**
 * OrbitCameraController implements professional Orbit Controls:
 * - Left-click drag: Rotate orbit around the focal center.
 * - Scroll wheel: Smooth zoom (adjusts radial distance).
 * - Right or Middle-click drag: Pan focal center along the camera's local axes.
 * - Auto-rotation is supported and suspended during manual left-click dragging.
 */
export class OrbitCameraController extends BaseCameraController {
	public override readonly mode: CameraMode = "orbit";

	private _canvasListenersAttached = false;
	private _lastActiveCanvas: HTMLCanvasElement | null = null;

	constructor(camera: Camera, options: any = {}) {
		super(camera, options);
	}

	/**
	 * Setup event listeners for wheel and contextmenu on the target canvas.
	 */
	private setupListeners(): void {
		if (this._canvasListenersAttached) return;

		const canvas = this.camera.ctx?.context.canvas as HTMLCanvasElement | null;
		if (!canvas) return;

		canvas.addEventListener("wheel", this.handleWheel, { passive: false });
		canvas.addEventListener("contextmenu", this.handleContextMenu);

		this._lastActiveCanvas = canvas;
		this._canvasListenersAttached = true;
	}

	/**
	 * Handles zoom via scroll wheel.
	 */
	private handleWheel = (e: WheelEvent): void => {
		e.preventDefault();
		const zoomSensitivity = 0.005;
		this.distance += e.deltaY * zoomSensitivity * (this.distance * 0.1);
		// Keep distance bounds reasonable
		this.distance = Math.max(0.1, Math.min(1000.0, this.distance));
	};

	/**
	 * Prevent default context menu on canvas so that right-click dragging pans without opening context menus.
	 */
	private handleContextMenu = (e: MouseEvent): void => {
		e.preventDefault();
	};

	public override update(dt: number): void {
		this.setupListeners();

		const input = this.camera.ctx?.input || Input;

		// 1. Orbit Rotation: ONLY if left mouse button (0) is pressed
		if (input.isMouseButtonPressed(0)) {
			this.yaw -= input.mouseMovement.x * this.sensitivity;
			this.pitch += input.mouseMovement.y * this.sensitivity;
			this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));
		} else if (this.autoRotate) {
			this.yaw += this.autoRotateSpeed * dt;
		}

		// 2. Camera Panning: If right click (2) or middle click (1) is pressed
		if (input.isMouseButtonPressed(1) || input.isMouseButtonPressed(2)) {
			const cosPitch = Math.cos(this.pitch);
			const sinPitch = Math.sin(this.pitch);
			const cosYaw = Math.cos(this.yaw);
			const sinYaw = Math.sin(this.yaw);

			// Right vector
			const rx = -cosYaw;
			const ry = 0;
			const rz = sinYaw;

			// Up vector (orthogonal to look vector and right vector)
			const ux = -sinYaw * sinPitch;
			const uy = cosPitch;
			const uz = -cosYaw * sinPitch;

			// Pan sensitivity scales with distance to feel natural
			const factor = 0.5;
			const panX =
				-input.mouseMovement.x * this.sensitivity * this.distance * factor;
			const panY =
				input.mouseMovement.y * this.sensitivity * this.distance * factor;

			this.center.x += rx * panX + ux * panY;
			this.center.y += ry * panX + uy * panY;
			this.center.z += rz * panX + uz * panY;
		}

		// Calculate final camera position and target
		const cx = this.center.x;
		const cy = this.center.y;
		const cz = this.center.z;

		const cosP = Math.cos(this.pitch);
		this.camera.position.set(
			cx + Math.sin(this.yaw) * cosP * this.distance,
			cy + Math.sin(this.pitch) * this.distance,
			cz + Math.cos(this.yaw) * cosP * this.distance,
		);

		this.camera.target.set(cx, cy, cz);

		// Update internal direction vectors
		this._forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
		this._right.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
	}

	public override destroy(): void {
		if (this._canvasListenersAttached && this._lastActiveCanvas) {
			this._lastActiveCanvas.removeEventListener("wheel", this.handleWheel);
			this._lastActiveCanvas.removeEventListener(
				"contextmenu",
				this.handleContextMenu,
			);
			this._canvasListenersAttached = false;
			this._lastActiveCanvas = null;
		}
		super.destroy();
	}
}
