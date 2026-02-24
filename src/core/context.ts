export class Context {
	public device!: GPUDevice;
	public context!: GPUCanvasContext;
	public format!: GPUTextureFormat;

	public static isSupported(): boolean {
		return !!navigator.gpu;
	}

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
