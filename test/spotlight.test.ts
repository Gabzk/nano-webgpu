/// <reference types="@webgpu/types" />
import { describe, expect, it, vi } from "vitest";
import { SpotLight } from "../src/graphics/light";
import { ShadowSystem } from "../src/graphics/shadow-system";
import { Camera, type Context } from "../src/index";

// Mock WebGPU globals for Node test environment
(globalThis as any).GPUTextureUsage = {
	COPY_SRC: 1,
	COPY_DST: 2,
	TEXTURE_BINDING: 4,
	STORAGE_BINDING: 8,
	RENDER_ATTACHMENT: 16,
};
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

describe("SpotLight", () => {
	it("should initialize default spotlight parameters correctly", () => {
		const spot = new SpotLight();
		expect(spot.castShadow).toBe(true);
		expect(spot.shadowMapSize).toBe(2048);
		expect(spot.usePCF).toBe(true);
		expect(spot.innerAngle).toBe(30.0);
		expect(spot.outerAngle).toBe(45.0);
		expect(spot.range).toBe(20.0);
		expect(spot.shadowNear).toBe(0.1);
	});

	it("should initialize custom spotlight options correctly", () => {
		const spot = new SpotLight({
			castShadow: false,
			shadowMapSize: 1024,
			usePCF: false,
			shadowBias: 0.0005,
			innerAngle: 25,
			outerAngle: 40,
			range: 35,
			shadowNear: 0.5,
		});
		expect(spot.castShadow).toBe(false);
		expect(spot.shadowMapSize).toBe(1024);
		expect(spot.usePCF).toBe(false);
		expect(spot.shadowBias).toBe(0.0005);
		expect(spot.innerAngle).toBe(25);
		expect(spot.outerAngle).toBe(40);
		expect(spot.range).toBe(35);
		expect(spot.shadowNear).toBe(0.5);
	});

	it("should pack GPU light data correctly conforming to 64-byte boundary structures", () => {
		const spot = new SpotLight({
			innerAngle: 30,
			outerAngle: 60,
			range: 15,
		});
		spot.position.set(1.0, 2.0, 3.0);
		spot.updateWorldMatrix(true);

		const data = spot.getLightData();
		expect(data.x).toBe(1.0);
		expect(data.y).toBe(2.0);
		expect(data.z).toBe(3.0);
		expect(data.typeFlag).toBe(5.0); // SpotLight casting shadow
		expect(data.range).toBe(15.0);
		expect(data.innerAngleCos).toBeCloseTo(Math.cos((30 * Math.PI) / 180));
		expect(data.outerAngleCos).toBeCloseTo(Math.cos((60 * Math.PI) / 180));
		expect(data.dirX).toBeDefined();
		expect(data.dirY).toBeDefined();
		expect(data.dirZ).toBeDefined();
	});

	it("should return the correct ShadowConfig mapping", () => {
		const spot = new SpotLight({
			shadowMapSize: 4096,
			usePCF: true,
			outerAngle: 45,
			range: 25,
			shadowBias: 0.0002,
			shadowNear: 0.2,
		});
		const config = spot.getShadowConfig();
		expect(config).not.toBeNull();
		expect(config!.shadowMapSize).toBe(4096);
		expect(config!.usePCF).toBe(true);
		expect(config!.shadowRadius).toBe(45); // FOV cone angle
		expect(config!.shadowDepthRange).toBe(25); // Spotlight range
		expect(config!.shadowBias).toBe(0.0002);
		expect(config!.shadowNear).toBe(0.2);
	});

	it("should return null for ShadowConfig when castShadow is disabled", () => {
		const spot = new SpotLight({ castShadow: false });
		expect(spot.getShadowConfig()).toBeNull();
	});
});

describe("ShadowSystem with SpotLight", () => {
	it("should render perspective shadows and verify perspective matrix values", () => {
		const ctx = createMockContext();
		const shadow = new ShadowSystem(ctx);
		const camera = new Camera();

		const spot = new SpotLight({
			castShadow: true,
			outerAngle: 45,
			range: 30,
			shadowNear: 0.1,
			shadowBias: 0.0001,
		});
		spot.position.set(0, 10, 0);
		spot.rotationDegrees.set(90, 0, 0); // Pointing straight down
		spot.updateWorldMatrix(true);

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
			[spot],
			camera,
			new Map(),
			new Map(),
			[],
		);

		expect(result).toBe(true);
		// Check that the computed projection/view matrix has no NaN elements
		for (const val of shadow.matrix.values) {
			expect(Number.isNaN(val)).toBe(false);
		}

		// Ensure perspective projection elements are present
		// For example, in perspective projection matrix under WebGPU:
		// values[11] (index representing row 2, column 3) is usually -1 or similar for division by W
		expect(shadow.matrix.values[11]).toBeCloseTo(-1);
	});
});
