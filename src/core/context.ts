import { PipelineManager } from "../graphics/pipeline";
import { Input } from "./input";

/**
 * @module Context
 
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
	 * Per-context pipeline manager (non-static, supports multiple canvases)
	 */
	public pipelineManager!: PipelineManager;

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

		// Initialize per-context pipeline manager
		this.pipelineManager = new PipelineManager(this);

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

	// biome-ignore lint/suspicious/noExplicitAny: disable rule for now
	public defaultGeometries: Record<string, any> = {};
}
