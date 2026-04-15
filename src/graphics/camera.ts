import type { Context } from "../core/context";
import { VRAMTracker } from "../debug/vram-tracker";
import { Node3D } from "../core/node3d";
import { Mat4 } from "../math/mat4";
import { Vec3 } from "../math/vec3";
import {
	CameraController,
	type CameraMode,
	type FirstPersonOptions,
	type OrbitOptions,
	type ThirdPersonOptions,
} from "./camera-controller";
import { PipelineManager } from "./pipeline";

export interface CameraOptions {
	fov?: number;
	aspect?: number;
	near?: number;
	far?: number;
	position?: Vec3 | number[] | number;
	target?: Vec3 | number[] | number;
}

export class Camera extends Node3D {
	public ctx?: Context;
	public projectionMatrix: Mat4 = new Mat4();
	public viewMatrix: Mat4 = new Mat4();
	public viewProjMatrix: Mat4 = new Mat4();

	/** Attached camera controller (third-person, first-person, orbit) */
	public controller: CameraController | null = null;

	private _fov: number;
	private _aspect: number;
	private _near: number;
	private _far: number;
	private _target: Vec3;

	public uniformBuffer?: GPUBuffer;
	public bindGroup?: GPUBindGroup;

	get fov(): number {
		return this._fov;
	}
	set fov(val: number) {
		this._fov = val;
		this.updateProjection();
	}

	get aspect(): number {
		return this._aspect;
	}
	set aspect(val: number) {
		this._aspect = val;
		this.updateProjection();
	}

	get near(): number {
		return this._near;
	}
	set near(val: number) {
		this._near = val;
		this.updateProjection();
	}

	get far(): number {
		return this._far;
	}
	set far(val: number) {
		this._far = val;
		this.updateProjection();
	}

	get target(): Vec3 {
		return this._target;
	}
	set target(val: Vec3) {
		this._target.copy(val);
		this.isDirty = true;
	}

	constructor(options: CameraOptions = {}) {
		super();
		this._fov = options.fov ?? Math.PI / 4;
		this._aspect = options.aspect ?? 1.0;
		this._near = options.near ?? 0.1;
		this._far = options.far ?? 1000.0;

		this._target = Vec3.from(options.target ?? [0, 0, 0]);
		this._target.onChange = () => {
			this.isDirty = true;
		};

		this.position = Vec3.from(options.position ?? [0, 0, 5]);

		this.updateProjection();
	}

	public initWebGPU(ctx: Context): void {
		this.ctx = ctx;
		this.uniformBuffer = ctx.device.createBuffer({
			label: "Camera Uniform Buffer",
			size: 64, // mat4x4
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});
		VRAMTracker.register(this.uniformBuffer, "buffer", "Camera Uniform Buffer", 64, "Camera");

		// Note: BindGroup is now managed by Scene (Group 0: Globals) combining Camera + Lights
	}

	public updateProjection(): void {
		this.projectionMatrix.perspective(
			this._fov,
			this._aspect,
			this._near,
			this._far,
		);
		this.isDirty = true;
	}

	public override updateLocalMatrix(): void {
		if (this.isDirty) {
			this.viewMatrix.lookAt(this.position, this._target, new Vec3(0, 1, 0));
			this.localMatrix.copy(this.viewMatrix).invert();

			// viewProj = projection * view
			this.viewProjMatrix.copy(this.projectionMatrix).multiply(this.viewMatrix);

			if (this.ctx && this.uniformBuffer) {
				this.ctx.device.queue.writeBuffer(
					this.uniformBuffer,
					0,
					this.viewProjMatrix.values as any,
				);
			}
		}
	}

	public enableOrbitControls(canvas?: HTMLCanvasElement | string): void {
		console.log("Orbit controls enabled for", canvas || "auto-detected canvas");
	}

	/**
	 * Attaches a pre-built camera controller.
	 * Modes:
	 * - "third-person": Camera orbits around a target node
	 * - "first-person": Camera sits at a target node's position
	 * - "orbit": Camera orbits around a fixed point
	 *
	 * The controller is automatically updated every frame by the Scene.
	 */
	public addController(
		mode: "third-person",
		options: ThirdPersonOptions,
	): CameraController;
	public addController(
		mode: "first-person",
		options: FirstPersonOptions,
	): CameraController;
	public addController(mode: "orbit", options?: OrbitOptions): CameraController;
	public addController(mode: CameraMode, options: any = {}): CameraController {
		this.controller = new CameraController(this, mode, options);
		return this.controller;
	}
}
