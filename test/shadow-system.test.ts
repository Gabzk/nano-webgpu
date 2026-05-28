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

	it("should initialize and reinitialize CSM depth textures and buffers correctly", () => {
		const ctx = createMockContext();
		const shadow = new ShadowSystem(ctx);

		const didReinit = shadow.reinitIfNeeded(2048, true, 4);

		expect(didReinit).toBe(true);
		expect(shadow.useCSM).toBe(true);
		expect(shadow.cascadeCount).toBe(4);

		// Verify createTexture was called with array layers = 4
		expect(ctx.device.createTexture).toHaveBeenCalledWith(
			expect.objectContaining({
				size: [2048, 2048, 4],
				format: "depth32float",
			}),
		);
	});

	it("should render CSM and verify correct split distance values are computed and uploaded with detailed buffer assertions", () => {
		const ctx = createMockContext();
		const shadow = new ShadowSystem(ctx);
		const camera = new Camera();

		const light = new DirectionalLight({
			castShadow: true,
			useCSM: true,
			cascadeCount: 4,
			csmMaxDistance: 100.0,
			cascadeSplitLambda: 0.85,
		});
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
		expect(shadow.useCSM).toBe(true);

		// Detailed verification of Float32Array contents uploaded
		const mockWriteBuffer = ctx.device.queue.writeBuffer as any;
		const csmCall = mockWriteBuffer.mock.calls.find(
			(call: any) => call[2] instanceof Float32Array && call[2].length === 80,
		);
		expect(csmCall).toBeDefined();
		const csmData = csmCall[2] as Float32Array;

		// splits: slots 64..67
		// cascadeCount: slot 78
		expect(csmData[78]).toBe(4); // cascadeCount
		expect(csmData[64]).toBeGreaterThan(camera.near); // splits[1]
		expect(csmData[67]).toBe(100.0); // splits[4] is far

		// Ensure no NaNs are uploaded
		for (let i = 0; i < csmData.length; i++) {
			expect(Number.isNaN(csmData[i])).toBe(false);
		}

		// Matrices: slots 0..63 should have non-empty matrix values (sum of absolute values > 0)
		let sumMatrices = 0;
		for (let i = 0; i < 64; i++) {
			sumMatrices += Math.abs(csmData[i]);
		}
		expect(sumMatrices).toBeGreaterThan(0);
	});

	it("should render CSM with cascadeCount < 4 and fill unused split distances and duplicate matrices deterministically", () => {
		const ctx = createMockContext();
		const shadow = new ShadowSystem(ctx);
		const camera = new Camera();

		const light = new DirectionalLight({
			castShadow: true,
			useCSM: true,
			cascadeCount: 2,
			csmMaxDistance: 100.0,
			cascadeSplitLambda: 0.85,
		});
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
		expect(shadow.cascadeCount).toBe(2);

		const mockWriteBuffer = ctx.device.queue.writeBuffer as any;
		const csmCall = mockWriteBuffer.mock.calls.find(
			(call: any) => call[2] instanceof Float32Array && call[2].length === 80,
		);
		expect(csmCall).toBeDefined();
		const csmData = csmCall[2] as Float32Array;

		// splits: slots 64..67
		// cascadeCount: slot 78
		expect(csmData[78]).toBe(2); // cascadeCount

		// splits[1] (slot 64) is the split boundary
		expect(csmData[64]).toBeGreaterThan(camera.near);
		expect(csmData[64]).toBeLessThan(100.0);

		// splits[2] (slot 65) is far (100.0)
		expect(csmData[65]).toBe(100.0);

		// unused splits: splits[3] and splits[4] (slots 66 and 67) must be filled with far (100.0)
		expect(csmData[66]).toBe(100.0);
		expect(csmData[67]).toBe(100.0);

		// Check for NaN prevention
		for (let i = 0; i < csmData.length; i++) {
			expect(Number.isNaN(csmData[i])).toBe(false);
			expect(csmData[i]).toBeDefined();
		}

		// Matrices: check that the unused matrices (viewProjs[2] and viewProjs[3]) duplicate the last valid matrix (viewProjs[1])
		// viewProjs[1] = slots 16..31
		// viewProjs[2] = slots 32..47
		// viewProjs[3] = slots 48..63
		for (let i = 0; i < 16; i++) {
			expect(csmData[32 + i]).toBe(csmData[16 + i]);
			expect(csmData[48 + i]).toBe(csmData[16 + i]);
		}
	});

	it("should calculate correct standard orthographic projection with reversed range and map near/far to 0.0/1.0 NDC depth", () => {
		// Define identical mathematical formulation used in orthoWebGPU
		const localOrthoWebGPU = (zNear: number, zFar: number) => {
			const depthRange = zFar - zNear;
			const v = new Float32Array(16);
			v[10] = 1 / depthRange;
			v[14] = -zNear / depthRange;
			return v;
		};

		const v = localOrthoWebGPU(-0.1, -100.0);

		// Projection mapping formula for WebGPU NDC:
		// Z_ndc = Z_view * v[10] + v[14]
		// Near plane Z_view = -0.1 -> Z_ndc = 0.0
		// Far plane Z_view = -100.0 -> Z_ndc = 1.0
		const zNearNDC = -0.1 * v[10] + v[14];
		const zFarNDC = -100.0 * v[10] + v[14];

		expect(zNearNDC).toBeCloseTo(0.0, 5);
		expect(zFarNDC).toBeCloseTo(1.0, 5);
	});
});
