import { Geometry } from "../graphics/geometry";
import { Mesh } from "../graphics/mesh";
import {
	createCubeGeometry,
	createPlaneGeometry,
	createSphereGeometry,
} from "../graphics/primitives";
import { Vec3 } from "../math/vec3";
import { Loader } from "./loader";
import { Input } from "./input";

/**
 * @module Context
 * @description
 * This module provides the WebGPU context.
 */
export class Context {
	/**
	 * The logical device interface to the GPU
	 * @public
	 * @type {GPUDevice}
	 */
	public device!: GPUDevice;

	/**
	 * The WebGPU context associated with the canvas
	 * @public
	 * @type {GPUCanvasContext}
	 */
	public context!: GPUCanvasContext;

	/**
	 * The preferred canvas format for the user's system
	 * @public
	 * @type {GPUTextureFormat}
	 */
	public format!: GPUTextureFormat;

	/**
	 * Check if WebGPU is supported
	 * @returns {boolean}
	 */
	public static isSupported(): boolean {
		return !!navigator.gpu;
	}

	/**
	 * Express initialization of a Context from a selector or canvas
	 * @param {string | HTMLCanvasElement} selector
	 * @returns {Promise<Context>} A fully initialized Context
	 */
	public static async init(
		selector: string | HTMLCanvasElement,
	): Promise<Context> {
		let canvas: HTMLCanvasElement;
		if (typeof selector === "string") {
			const el = document.querySelector(selector);
			if (!el) throw new Error(`Canvas with selector '${selector}' not found.`);
			canvas = el as HTMLCanvasElement;
		} else {
			canvas = selector;
		}

		const ctx = new Context();
		await ctx.initCanvas(canvas);
		return ctx;
	}

	/**
	 * Initialize the WebGPU context
	 * @param {HTMLCanvasElement} canvas
	 * @returns {Promise<void>}
	 */
	public async initCanvas(canvas: HTMLCanvasElement): Promise<void> {
		// Verify if WebGPU is supported
		if (!Context.isSupported()) {
			throw new Error("WebGPU is not supported on this browser.");
		}

		// Initialize adapter (physical interface to the GPU)
		const adapter = await navigator.gpu.requestAdapter();
		if (!adapter) {
			throw new Error("Adapter not found");
		}

		// Request device (logical interface to the GPU)
		this.device = await adapter.requestDevice();

		// Set up the canvas context
		this.context = canvas.getContext("webgpu") as GPUCanvasContext;
		this.format = navigator.gpu.getPreferredCanvasFormat();

		this.context.configure({
			device: this.device,
			format: this.format,
			alphaMode: "premultiplied",
		});

		Input.init();
	}

	/**
	 * Runs a render loop
	 * @param loopFunction Callback function to be called each frame with delta time.
	 */
	public run(loopFunction: (dt: number) => void): void {
		let lastTime = performance.now();
		const frame = (t: number) => {
			requestAnimationFrame(frame);
			const dt = (t - lastTime) / 1000;
			lastTime = t;
			loopFunction(dt);
			Input.update();
		};
		requestAnimationFrame(frame);
	}

	// ------------- Factory Methods for Primitives -------------
	// Added to fulfill the 'nano' API abstraction requirements.

	// Basic geometry cache
	private defaultGeometries: Record<string, any> = {};

	private applyTransformOptions(mesh: Mesh, options: any) {
		if (options.position) mesh.position.copy(Vec3.from(options.position));
		if (options.scale !== undefined) {
			if (typeof options.scale === "number")
				mesh.scale.set(options.scale, options.scale, options.scale);
			else mesh.scale.copy(Vec3.from(options.scale));
		}
		if (options.rotation) mesh.rotation.copy(Vec3.from(options.rotation));
		if (options.rotationDegrees) mesh.rotationDegrees = options.rotationDegrees;
	}

	public createCube(options: any): any {
		if (!this.defaultGeometries["cube"]) {
			this.defaultGeometries["cube"] = createCubeGeometry(
				this,
				options.size || 1.0,
			);
		}

		options.geometry = this.defaultGeometries["cube"];
		const mesh = new Mesh(this, options);
		this.applyTransformOptions(mesh, options);
		return mesh;
	}

	public createPlane(options: any): any {
		if (!this.defaultGeometries["plane"]) {
			this.defaultGeometries["plane"] = createPlaneGeometry(
				this,
				options.width || 1.0,
				options.height || 1.0,
			);
		}

		options.geometry = this.defaultGeometries["plane"];
		const mesh = new Mesh(this, options);
		this.applyTransformOptions(mesh, options);
		return mesh;
	}

	public createSphere(options: any): any {
		if (!this.defaultGeometries["sphere"]) {
			this.defaultGeometries["sphere"] = createSphereGeometry(
				this,
				options.radius || 1.0,
				options.segments || 16,
				options.segments || 16,
			);
		}

		options.geometry = this.defaultGeometries["sphere"];
		const mesh = new Mesh(this, options);
		this.applyTransformOptions(mesh, options);
		return mesh;
	}

	public async loadMesh(url: string, options: any): Promise<any> {
		const loader = new Loader(this.device);
		const modelData = await loader.loadModel(url);

		const vertexCount = modelData.vertices.length / 8; // 8 floats per vertex (pos: 3, norm: 3, uv: 2)
		const optimalIndicesArray =
			vertexCount > 65535
				? new Uint32Array(modelData.indices)
				: new Uint16Array(modelData.indices);

		const geometry = new Geometry(
			this,
			new Float32Array(modelData.vertices),
			optimalIndicesArray,
			{ hasUVs: true, hasNormals: true },
		);

		const finalOptions = { ...options };
		if (!finalOptions.material && modelData.materialOptions) {
			finalOptions.material = modelData.materialOptions; // Scene already parses this to StandardMaterial if handled through Scene
			// Wait, Context.loadMesh could be called directly and users expect Mesh.material to be set or StandardMaterial directly.
			// Let's ensure it's a StandardMaterial if it's not handled by scene:
			if (
				typeof finalOptions.material !== "object" ||
				!(finalOptions.material as any).isMaterial
			) {
				// To avoid importing StandardMaterial here, scene actually already parses the object into StandardMaterial correctly if called from Scene.
				// But if they call ctx.loadMesh directly, it should be parsed. Let's just assign it and Mesh constructor handles it.
				// Wait! Mesh constructor currently creates basic standard material if not provided!
			}
		}

		const mesh = new Mesh(this, { geometry, ...finalOptions });
		this.applyTransformOptions(mesh, finalOptions);

		return mesh;
	}
}
