import type { Context } from "../core/context";
import { Node3D } from "../core/node3d";
import { Mat4 } from "../math/mat4";
import { Vec3 } from "../math/vec3";
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
	public ctx?: Context; // Optional because Example 6 doesn't pass ctx to new Camera()
	public projectionMatrix: Mat4 = new Mat4();
	public viewMatrix: Mat4 = new Mat4();
	public viewProjMatrix: Mat4 = new Mat4();

	public fov: number;
	public aspect: number;
	public near: number;
	public far: number;
	public target: Vec3;

	public uniformBuffer?: GPUBuffer;
	public bindGroup?: GPUBindGroup;

	constructor(options: CameraOptions = {}) {
		super();
		this.fov = options.fov ?? Math.PI / 4;
		this.aspect = options.aspect ?? 1.0;
		this.near = options.near ?? 0.1;
		this.far = options.far ?? 1000.0;

		this.position = Vec3.from(options.position ?? [0, 0, 5]);
		this.target = Vec3.from(options.target ?? [0, 0, 0]);

		this.updateProjection();
	}

	public initWebGPU(ctx: Context): void {
		this.ctx = ctx;
		this.uniformBuffer = ctx.device.createBuffer({
			label: "Camera Uniform Buffer",
			size: 64, // mat4x4
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		// Note: BindGroup is now managed by Scene (Group 0: Globals) combining Camera + Lights
	}

	public updateProjection(): void {
		this.projectionMatrix.perspective(
			this.fov,
			this.aspect,
			this.near,
			this.far,
		);
		this.isDirty = true;
	}

	public override updateLocalMatrix(): void {
		if (this.isDirty) {
			this.viewMatrix.lookAt(this.position, this.target, new Vec3(0, 1, 0));
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
}
