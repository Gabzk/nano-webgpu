import { Loader } from "./loader";
import { Mesh } from "../graphics/mesh";
import { Geometry } from "../graphics/geometry";
import { createCubeGeometry, createPlaneGeometry, createSphereGeometry } from "../graphics/primitives";
import { Vec3 } from "../math/vec3";

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
	public static async init(selector: string | HTMLCanvasElement): Promise<Context> {
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
	}

	/**
	 * Runs a render loop
	 * @param loopFunction Callback function to be called each frame with delta time.
	 */
	public run(loopFunction: (dt: number) => void): void {
		let lastTime = performance.now();
		const frame = (t: number) => {
			const dt = (t - lastTime) / 1000;
			lastTime = t;
			loopFunction(dt);
			requestAnimationFrame(frame);
		};
		requestAnimationFrame(frame);
	}

	// ------------- Factory Methods for Primitives -------------
	// Added to fulfill the 'nano' API abstraction requirements.
	
	// Basic geometry cache
	private defaultGeometries: Record<string, any> = {};

	public createCube(options: any): any {
		if (!this.defaultGeometries["cube"]) {
			this.defaultGeometries["cube"] = createCubeGeometry(this, options.size || 1.0);
		}
		
		options.geometry = this.defaultGeometries["cube"];
		const mesh = new Mesh(this, options);
		if (options.position) mesh.position.copy(Vec3.from(options.position));
		return mesh;
	}

	public createPlane(options: any): any {
		if (!this.defaultGeometries["plane"]) {
			this.defaultGeometries["plane"] = createPlaneGeometry(this, options.width || 1.0, options.height || 1.0);
		}
		
		options.geometry = this.defaultGeometries["plane"];
		const mesh = new Mesh(this, options);
		if (options.position) mesh.position.copy(Vec3.from(options.position));
		return mesh;
	}

	public createSphere(options: any): any {
		if (!this.defaultGeometries["sphere"]) {
			this.defaultGeometries["sphere"] = createSphereGeometry(this, options.radius || 1.0, options.segments || 16, options.segments || 16);
		}
		
		options.geometry = this.defaultGeometries["sphere"];
		const mesh = new Mesh(this, options);
		if (options.position) mesh.position.copy(Vec3.from(options.position));
		return mesh;
	}

	public async loadMesh(url: string, options: any): Promise<any> {
		const loader = new Loader(this.device);
		const modelData = await loader.loadModel(url);
		
		const geometry = new Geometry(
			this, 
			new Float32Array(modelData.vertices), 
			new Uint16Array(modelData.indices),
			{ hasUVs: true, hasNormals: true }
		);

		const mesh = new Mesh(this, { geometry, ...options });
		if (options.position) mesh.position.copy(Vec3.from(options.position));
		if (options.scale) {
			if (typeof options.scale === "number") mesh.scale.set(options.scale, options.scale, options.scale);
			else mesh.scale.copy(Vec3.from(options.scale));
		}
		
		return mesh;
	}
}
