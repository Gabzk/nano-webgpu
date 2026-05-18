import { VRAMTracker } from "../debug/vram-tracker";
import { PrimitivesFactory } from "../graphics/primitives-factory";
import { PipelineManager } from "../graphics/pipeline";
import { Loader } from "./loader";
import { Input } from "./input";

/**
 * @module Context
 *
 * Holds all per-canvas WebGPU state: the GPU device, canvas context,
 * preferred format, and shared engine singletons (pipeline manager,
 * asset loader, VRAM tracker, primitive geometry cache).
 */
export class Context {
	/**
	 * The logical device interface to the GPU.
	 */
	public device!: GPUDevice;

	/**
	 * The WebGPU context associated with the canvas.
	 */
	public context!: GPUCanvasContext;

	/**
	 * The preferred canvas format for the user's system.
	 */
	public format!: GPUTextureFormat;

	/**
	 * Per-context pipeline manager (non-static, supports multiple canvases).
	 */
	public pipelineManager!: PipelineManager;

	/**
	 * Per-context asset loader. Use ctx.loader.loadTexture / loadModel / loadShader.
	 * Supports custom model parsers via ctx.loader.registerParser().
	 */
	public loader!: Loader;

	/**
	 * Per-context VRAM tracker. All GPU resource allocations are registered here
	 * so the debug panel can display accurate memory usage.
	 */
	public vramTracker: VRAMTracker = new VRAMTracker();

	/**
	 * Per-context typed cache for built-in primitive geometries (cube, plane, sphere).
	 */
	public primitives: PrimitivesFactory = new PrimitivesFactory();

	/**
	 * Cached dummy textures (white 1×1, flat-normal 1×1). Keyed by "white" | "normal".
	 * Stored as unknown to avoid a circular import with graphics/texture.ts.
	 */
	public defaultTextures: {
		white?: unknown;
		normal?: unknown;
	} = {};

	/**
	 * Check if WebGPU is supported.
	 */
	public static isSupported(): boolean {
		return !!navigator.gpu;
	}

	/**
	 * Express initialization of a Context from a CSS selector string or canvas element.
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
	 * Initialize the WebGPU context on a given canvas element.
	 */
	public async initCanvas(canvas: HTMLCanvasElement): Promise<void> {
		if (!Context.isSupported()) {
			throw new Error("WebGPU is not supported on this browser.");
		}

		const adapter = await navigator.gpu.requestAdapter();
		if (!adapter) {
			throw new Error("Adapter not found");
		}

		this.device = await adapter.requestDevice();

		this.context = canvas.getContext("webgpu") as GPUCanvasContext;
		this.format = navigator.gpu.getPreferredCanvasFormat();

		this.context.configure({
			device: this.device,
			format: this.format,
			alphaMode: "premultiplied",
		});

		this.pipelineManager = new PipelineManager(this);
		this.loader = new Loader(this.device);

		Input.init();
	}

	/**
	 * Runs a render loop, calling loopFunction each frame with delta time in seconds.
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
}
