/// <reference types="@webgpu/types" />
import { describe, expect, it, vi } from "vitest";
import { Context, Scene } from "../src/index";

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
		createBuffer: vi.fn().mockReturnValue({}),
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
		},
	} as unknown as Context;
}

describe("Scene", () => {
	it("should initialize with custom rich RenderInfo defaults", () => {
		const mockContext = createMockContext();
		const scene = new Scene(mockContext);

		expect(scene.perfTracker).toBeDefined();

		const info = scene.getRenderInfo();
		expect(info.dt).toBe(0);
		expect(info.fps).toBe(0);
		expect(info.frameTimeMs).toBe(0);
		expect(info.meshCount).toBe(0);
		expect(info.visibleMeshCount).toBe(0);
		expect(info.lightCount).toBe(0);
		expect(info.nodeCount).toBe(0);
		expect(info.drawCalls).toBe(0);
		expect(info.trianglesDrawn).toBe(0);
		expect(info.verticesDrawn).toBe(0);
	});

	it("should support the instantiate alias", () => {
		const mockContext = createMockContext();
		const scene = new Scene(mockContext);
		expect(scene.addInstance).toBeDefined();
		expect(typeof scene.addInstance).toBe("function");
	});

	it("should support enableDebug with dynamic import", async () => {
		const mockContext = createMockContext();
		const scene = new Scene(mockContext);

		const canvas = document.createElement("canvas");
		(mockContext.context as any).canvas = canvas;

		const panel = await scene.enableDebug();
		expect(panel).toBeDefined();
		expect(scene.getRenderInfo()).toBeDefined();

		panel.destroy();
	});

	it("should support buildMesh with color vertex format and map attributes correctly", () => {
		const mockContext = createMockContext();
		const scene = new Scene(mockContext);

		const mesh = scene.buildMesh({
			topology: "triangle-list",
			vertexFormat: ["position", "color"],
			vertexBuffer: [
				-1, 0, 0,  1, 0, 0,
				 1, 0, 0,  0, 1, 0,
				 0, 1, 0,  0, 0, 1,
			],
		});

		expect(mesh).toBeDefined();
		expect(mesh.geometry).toBeDefined();
		expect(mesh.geometry.hasColors).toBe(true);
		expect(mesh.geometry.vertexCount).toBe(3);
	});
});
