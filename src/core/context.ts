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
	 * Initialize the WebGPU context
	 * @param {HTMLCanvasElement} canvas
	 * @returns {Promise<void>}
	 */
	public async init(canvas: HTMLCanvasElement): Promise<void> {
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
}
