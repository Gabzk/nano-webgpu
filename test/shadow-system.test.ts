/// <reference types="@webgpu/types" />
import { describe, expect, it, vi } from "vitest";
import { ShadowSystem } from "../src/graphics/shadow-system";
import { Camera, type Context, DirectionalLight } from "../src/index";

// Mock WebGPU globals for Node test environment
// biome-ignore lint/suspicious/noExplicitAny: mock globalThis
(globalThis as any).GPUTextureUsage = {
	COPY_SRC: 1,
	COPY_DST: 2,
	TEXTURE_BINDING: 4,
	STORAGE_BINDING: 8,
	RENDER_ATTACHMENT: 16,
};
// biome-ignore lint/suspicious/noExplicitAny: mock globalThis
(globalThis as any).GPUBufferUsage = {
	MAP_READ: 1,
	MAP_WRITE: 2,
	COPY_SRC: 4,
	COPY_DST: 8,
	INDEX: 16,
	VERTEX: 32,
	UNIFORM: 64,
	STORAGE: 128,
	INDIRECT: 256,
	QUERY_RESOLVE: 512,
};

function createMockContext(): Context {
	const mockDevice = {
		createBuffer: vi.fn().mockReturnValue({ destroy: vi.fn() }),
		createSampler: vi.fn().mockReturnValue({}),
		createTexture: vi.fn().mockReturnValue({
			createView: vi.fn().mockReturnValue({}),
			destroy: vi.fn(),
		}),
		createBindGroup: vi.fn().mockReturnValue({}),
		queue: {
			writeBuffer: vi.fn(),
		},
	} as unknown as GPUDevice;
	const mockFormat = "bgra8unorm" as GPUTextureFormat;

	return {
		device: mockDevice,
		format: mockFormat,
		context: {
			canvas: {
				width: 800,
				height: 600,
			},
		},
		vramTracker: {
			register: vi.fn(),
			unregister: vi.fn(),
			getSummary: vi.fn().mockReturnValue({ totalBytes: 0, totalResources: 0 }),
		},
		pipelineManager: {
			getPostProcessBindGroupLayout: vi.fn(),
			getPostProcessPipeline: vi.fn(),
			getShadowBindGroupLayout: vi.fn(),
			getShadowPipeline: vi.fn(),
		},
		stop: vi.fn(),
		destroy: vi.fn(),
	} as unknown as Context;
}

describe("ShadowSystem", () => {
	it("should initialize resources and uniform buffers correctly", () => {
		const ctx = createMockContext();
		const shadow = new ShadowSystem(ctx);

		expect(shadow).toBeDefined();
		expect(ctx.device.createTexture).toHaveBeenCalled();
		expect(ctx.device.createSampler).toHaveBeenCalled();
		expect(ctx.device.createBuffer).toHaveBeenCalled();
		expect(ctx.device.queue.writeBuffer).toHaveBeenCalled();
	});

	it("should reinitialize the depth texture when resolution changes", () => {
		const ctx = createMockContext();
		const shadow = new ShadowSystem(ctx);

		const firstTexture = shadow.texture;
		const didReinit = shadow.reinitIfNeeded(1024);

		expect(didReinit).toBe(true);
		expect(shadow.textureSize).toBe(1024);
		expect(firstTexture.destroy).toHaveBeenCalled();
		expect(ctx.device.createTexture).toHaveBeenCalledTimes(2);
	});

	it("should early exit renderPass when there are no shadow-casting lights", () => {
		const ctx = createMockContext();
		const shadow = new ShadowSystem(ctx);
		const camera = new Camera();
		const mockEncoder = {} as GPUCommandEncoder;

		const result = shadow.renderPass(
			mockEncoder,
			[],
			camera,
			new Map(),
			new Map(),
			[],
		);

		expect(result).toBe(false);
	});

	it("should render shadows and verify NaN prevention when light shines straight down", () => {
		const ctx = createMockContext();
		const shadow = new ShadowSystem(ctx);
		const camera = new Camera();

		// Add a directional light that points straight down along [0, -1, 0]
		const light = new DirectionalLight({
			castShadow: true,
			shadowBias: 0.0005,
		});
		// Set rotation to shine straight down
		light.rotationDegrees.set(90, 0, 0);
		light.updateWorldMatrix(true);

		const mockPassEncoder = {
			setPipeline: vi.fn(),
			setBindGroup: vi.fn(),
			setVertexBuffer: vi.fn(),
			setIndexBuffer: vi.fn(),
			drawIndexed: vi.fn(),
			end: vi.fn(),
		};
		const mockEncoder = {
			beginRenderPass: vi.fn().mockReturnValue(mockPassEncoder),
		} as unknown as GPUCommandEncoder;

		const result = shadow.renderPass(
			mockEncoder,
			[light],
			camera,
			new Map(),
			new Map(),
			[],
		);

		expect(result).toBe(true);
		// Check that the projection/view matrix values are loaded with valid numeric elements (no NaN)
		for (const val of shadow.matrix.values) {
			expect(Number.isNaN(val)).toBe(false);
		}

		// Ensure the dynamic bias is passed to the queue writeBuffer call
		expect(ctx.device.queue.writeBuffer).toHaveBeenLastCalledWith(
			shadow.uniformBuffer,
			64,
			expect.any(Float32Array),
		);
	});
});
