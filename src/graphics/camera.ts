import type { Context } from "../core/context";
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

/**
 * Configuration options utilized during standard Camera instantiation.
 *
 * @group Camera
 */
export interface CameraOptions {
	/** Field of View angle in radians. Defaults to `Math.PI / 4` (45 degrees). */
	fov?: number;
	/** Projection aspect ratio (Viewport Width / Viewport Height). Defaults to `1.0`. */
	aspect?: number;
	/** Distance to near clipping boundary plane. Defaults to `0.1`. */
	near?: number;
	/** Distance to far clipping boundary plane. Defaults to `1000.0`. */
	far?: number;
	/** Initial spatial position coordinates of the camera. */
	position?: Vec3 | number[] | number;
	/** Spatial focus target coordinate vector for lookAt calculations. */
	target?: Vec3 | number[] | number;
}

/**
 * Camera represents a viewpoint node within the 3D scene.
 * It manages projection, view, and concatenated view-projection matrices,
 * and maintains dedicated WebGPU uniform buffers describing camera matrices
 * and spatial positions to fragment shaders.
 *
 * @group Camera
 */
export class Camera extends Node3D {
	/** @internal Parent render Context reference. */
	public ctx?: Context;

	/** Mathematical perspective projection matrix. */
	public projectionMatrix: Mat4 = new Mat4();

	/** Mathematical view matrix representing inverse coordinate space transformations. */
	public viewMatrix: Mat4 = new Mat4();

	/** Combined view-projection matrix representing global clip-space transforms. */
	public viewProjMatrix: Mat4 = new Mat4();

	/**
	 * Attached interactive controller handling standard input orbital,
	 * first-person, or third-person cameras.
	 */
	public controller: CameraController | null = null;

	/** @internal Field of view angle in radians. */
	private _fov: number;
	/** @internal Aspect ratio of projection frustum. */
	private _aspect: number;
	/** @internal Near clipping plane distance. */
	private _near: number;
	/** @internal Far clipping plane distance. */
	private _far: number;
	/** @internal View focus target coordinate vector. */
	private _target: Vec3;

	/** Dedicated WebGPU GPUBuffer holding camera matrices. */
	public uniformBuffer?: GPUBuffer;

	/** Shared resource GPUBindGroup layout mapping. */
	public bindGroup?: GPUBindGroup;

	/** Gets the Field of View angle in radians. */
	get fov(): number {
		return this._fov;
	}
	/** Sets the Field of View angle in radians and recomputes the projection matrix. */
	set fov(val: number) {
		this._fov = val;
		this.updateProjection();
	}

	/** Gets the projection aspect ratio. */
	get aspect(): number {
		return this._aspect;
	}
	/** Sets the projection aspect ratio and recomputes the projection matrix. */
	set aspect(val: number) {
		this._aspect = val;
		this.updateProjection();
	}

	/** Gets the near clipping plane distance. */
	get near(): number {
		return this._near;
	}
	/** Sets the near clipping plane distance and recomputes the projection matrix. */
	set near(val: number) {
		this._near = val;
		this.updateProjection();
	}

	/** Gets the far clipping plane distance. */
	get far(): number {
		return this._far;
	}
	/** Sets the far clipping plane distance and recomputes the projection matrix. */
	set far(val: number) {
		this._far = val;
		this.updateProjection();
	}

	/** Gets the view target focus vector. */
	get target(): Vec3 {
		return this._target;
	}
	/** Sets the view target focus vector and flags the view transform as dirty. */
	set target(val: Vec3) {
		this._target.copy(val);
		this.isDirty = true;
	}

	/**
	 * Instantiates a new Camera node with specified configurations.
	 *
	 * @param options - Custom camera configurations.
	 */
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

	/**
	 * Allocates logical GPUBuffers and registers camera memory tracking within the VRAM tracker.
	 *
	 * @param ctx - Shared framework context.
	 */
	public initWebGPU(ctx: Context): void {
		this.ctx = ctx;
		this.uniformBuffer = ctx.device.createBuffer({
			label: "Camera Uniform Buffer",
			size: 80, // mat4x4 (64 bytes) + vec4 cameraPos (16 bytes)
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});
		ctx.vramTracker.register(
			this.uniformBuffer,
			"buffer",
			"Camera Uniform Buffer",
			80,
			"Camera",
		);
	}

	/**
	 * Forces recomputation of the perspective projection matrix based on fov, aspect, near, and far.
	 */
	public updateProjection(): void {
		this.projectionMatrix.perspective(
			this._fov,
			this._aspect,
			this._near,
			this._far,
		);
		this.isDirty = true;
	}

	/**
	 * Recomputes the view matrix (`lookAt` transformation) and propagates
	 * view-projection matrices directly into GPU uniform buffer buffers.
	 */
	public override updateLocalMatrix(): void {
		if (this.isDirty) {
			this.viewMatrix.lookAt(this.position, this._target, new Vec3(0, 1, 0));
			this.localMatrix.copy(this.viewMatrix).invert();

			// viewProj = projection * view
			this.viewProjMatrix.copy(this.projectionMatrix).multiply(this.viewMatrix);

			if (this.ctx && this.uniformBuffer) {
				// Write viewProjMatrix (bytes 0-63)
				this.ctx.device.queue.writeBuffer(
					this.uniformBuffer,
					0,
					// biome-ignore lint/suspicious/noExplicitAny: native array representation
					this.viewProjMatrix.values as any,
				);
				// Write cameraPos (bytes 64-79) — used by fragment shader for view vector V
				const posData = new Float32Array([
					this.position.x,
					this.position.y,
					this.position.z,
					0.0,
				]);
				this.ctx.device.queue.writeBuffer(this.uniformBuffer, 64, posData);
			}
		}
	}

	/**
	 * Spawns and registers an interactive CameraController of the designated operational mode.
	 *
	 * @param mode - Orbit, first-person orbital, or target third-person camera controls.
	 * @param options - Custom configurations matching parameters of the specific mode.
	 * @returns The newly allocated CameraController instance.
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
	// biome-ignore lint/suspicious/noExplicitAny: options type matches distinct controller shapes
	public addController(mode: CameraMode, options: any = {}): CameraController {
		this.controller = new CameraController(this, mode, options);
		return this.controller;
	}
}
