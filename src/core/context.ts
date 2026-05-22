import { VRAMTracker } from "../debug/vram-tracker";
import { PipelineManager } from "../graphics/pipeline";
import { PrimitivesFactory } from "../graphics/primitives-factory";
import { InputManager, setActiveInput } from "./input";
import { Loader } from "./loader";

/**
 * Context acts as the primary orchestrator for a WebGPU instance on a target HTMLCanvasElement.
 * It encapsulates the GPUDevice connection, the GPUCanvasContext configuration, and aggregates
 * key framework singletons such as the PipelineManager, asset Loader, VRAMTracker, and PrimitivesFactory.
 *
 * @group Core
 */
export class Context {
	/**
	 * The logical GPU device interface representing a connection to the physical GPU.
	 * Utilized for resource allocation (buffers, textures, pipelines).
	 */
	public device!: GPUDevice;

	/**
	 * The WebGPU-specific canvas rendering context.
	 * Configured to represent presentable textures rendered directly into the DOM canvas.
	 */
	public context!: GPUCanvasContext;

	/**
	 * The preferred color format optimized for display on the local system (usually 'bgra8unorm' or 'rgba8unorm').
	 */
	public format!: GPUTextureFormat;

	/**
	 * Pipeline manager associated with this context.
	 * Manages WebGPU pipeline compilations and cached bind group layouts.
	 */
	public pipelineManager!: PipelineManager;

	/**
	 * Asset loader instance associated with this context.
	 * Manages network loading, parsing of GLB/GLTF models, textures, and custom formats.
	 */
	public loader!: Loader;

	/**
	 * VRAM tracker instance.
	 * Monitored inside the context to log, register, and analyze VRAM allocations
	 * for debug visualizer purposes.
	 */
	public vramTracker: VRAMTracker = new VRAMTracker();

	/**
	 * Primitive geometry generator and cache.
	 * Avoids redundant pipeline / vertex allocations for standard geometric shapes like cubes, planes, or spheres.
	 */
	public primitives: PrimitivesFactory = new PrimitivesFactory();

	/** Local input manager instance for this context. */
	public input!: InputManager;

	/** @internal requestAnimationFrame recursion frame ID. */
	private _frameId: number | null = null;

	/**
	 * Shared fallback textures representing solid white colors and flat normal vectors.
	 * Declared as `unknown` to avoid direct circular dependencies with the `Texture` class.
	 */
	public defaultTextures: {
		/** Standard solid white 1x1 pixels texture. */
		white?: unknown;
		/** Default tangent-space normal map fallback (128, 128, 255). */
		normal?: unknown;
	} = {};

	/**
	 * Assesses whether the active navigator environment implements standard WebGPU interfaces.
	 *
	 * @returns True if WebGPU is supported, false otherwise.
	 */
	public static isSupported(): boolean {
		return !!navigator.gpu;
	}

	/**
	 * High-level initialization routine that resolves a canvas element and boots WebGPU services.
	 *
	 * @param selector - A CSS query selector string or a direct HTMLCanvasElement reference.
	 * @returns A Promise resolving to an initialized Context.
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
	 * Configures the HTML5 canvas for WebGPU, requests physical adapter connections,
	 * initializes GPUDevice capabilities, and instantiates shared managers.
	 *
	 * @param canvas - Target HTMLCanvasElement for WebGPU swapchain presentation.
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

		this.input = new InputManager();
		this.input.init(canvas);
		setActiveInput(this.input);
	}

	/**
	 * Executes a standard high-performance requestAnimationFrame render loop.
	 * Automatically calculates and supplies delta times while resetting frame-transient inputs.
	 *
	 * @param loopFunction - Callback invoked every render frame, receiving the frame delta time in seconds.
	 */
	public run(loopFunction: (dt: number) => void): void {
		let lastTime = performance.now();
		const frame = (t: number) => {
			this._frameId = requestAnimationFrame(frame);
			const dt = (t - lastTime) / 1000;
			lastTime = t;
			setActiveInput(this.input);
			loopFunction(dt);
			this.input.update();
		};
		this._frameId = requestAnimationFrame(frame);
	}

	/**
	 * Stops the active requestAnimationFrame render loop.
	 */
	public stop(): void {
		if (this._frameId !== null) {
			cancelAnimationFrame(this._frameId);
			this._frameId = null;
		}
	}

	/**
	 * Releases context resources, stops render loop, destroys default textures,
	 * and shuts down the logical GPU connection.
	 */
	public destroy(): void {
		this.stop();

		// Destroy default textures
		if (this.defaultTextures.white) {
			(this.defaultTextures.white as any).destroy(this);
			this.defaultTextures.white = undefined;
		}
		if (this.defaultTextures.normal) {
			(this.defaultTextures.normal as any).destroy(this);
			this.defaultTextures.normal = undefined;
		}

		// Destroy primitives
		if (this.primitives) {
			this.primitives.destroy(this);
		}

		// Destroy Input
		if (this.input) {
			this.input.destroy();
		}

		// Destroy GPUDevice
		if (this.device) {
			this.device.destroy();
			// @ts-expect-error - allow cleanup reference assignment
			this.device = null;
		}
	}
}
