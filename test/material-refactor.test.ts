/// <reference types="@webgpu/types" />
import { describe, expect, it, vi } from "vitest";
import { Context, Scene, Mesh, StandardMaterial, ShaderMaterial, Texture } from "../src/index";

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
		createBuffer: vi.fn().mockReturnValue({ destroy: vi.fn(), size: 64 }),
		createSampler: vi.fn().mockReturnValue({}),
		createTexture: vi.fn().mockReturnValue({
			createView: vi.fn().mockReturnValue({}),
			destroy: vi.fn(),
		}),
		createBindGroup: vi.fn().mockReturnValue({}),
		queue: {
			writeBuffer: vi.fn(),
			writeTexture: vi.fn(),
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
			getMaterialBindGroupLayout: vi.fn().mockReturnValue({}),
		},
		primitives: {
			getCube: vi.fn().mockReturnValue({}),
		},
		defaultTextures: {},
		stop: vi.fn(),
		destroy: vi.fn(),
	} as unknown as Context;
}

describe("Material System Refactoring & Developer Experience", () => {
	it("should expose standard PBR properties directly on abstract Material references", () => {
		const mockContext = createMockContext();
		
		// Create a mesh which defaults to a StandardMaterial
		const mesh = Mesh.createCube(mockContext, { size: 1.0 });
		
		// The material property on Mesh is typed as Material
		const mat = mesh.material;
		
		// Ensure standard PBR properties are defined and accessible without typecasting
		expect(mat.albedoColor).toBeDefined();
		expect(mat.albedoColor.r).toBe(1.0);
		
		mat.roughness = 0.8;
		expect(mat.roughness).toBe(0.8);
		
		mat.metallic = 0.2;
		expect(mat.metallic).toBe(0.2);
		
		mat.aoIntensity = 0.5;
		expect(mat.aoIntensity).toBe(0.5);
		
		mat.normalScale = 1.2;
		expect(mat.normalScale).toBe(1.2);
	});

	it("should support the direct texture getter/setter on Mesh as a proxy", () => {
		const mockContext = createMockContext();
		const mesh = Mesh.createCube(mockContext, { size: 1.0 });
		
		const mockTexture = {
			isLoaded: true,
			gpuTexture: { createView: vi.fn() },
		} as unknown as Texture;
		
		mesh.texture = mockTexture;
		expect(mesh.texture).toBe(mockTexture);
		expect(mesh.material.albedoTexture).toBe(mockTexture);
		
		mesh.texture = null;
		expect(mesh.texture).toBeNull();
		expect(mesh.material.albedoTexture).toBeNull();
	});

	it("should allow getting and setting texture alias directly on Material", () => {
		const mockContext = createMockContext();
		const mesh = Mesh.createCube(mockContext, { size: 1.0 });
		
		const mockTexture = {
			isLoaded: true,
			gpuTexture: { createView: vi.fn() },
		} as unknown as Texture;
		
		mesh.material.texture = mockTexture;
		expect(mesh.material.texture).toBe(mockTexture);
		expect(mesh.material.albedoTexture).toBe(mockTexture);
	});

	it("should support Standard PBR properties on ShaderMaterial and bind them to Group 2", () => {
		const mockContext = createMockContext();
		
		const shader = new ShaderMaterial({
			shaderCode: `
				struct MaterialUniform {
					albedo: vec4<f32>,
					roughness: f32,
					metallic: f32,
				}
				@group(2) @binding(0) var<uniform> mat: MaterialUniform;
				@vertex fn vs_main() -> @builtin(position) vec4<f32> { return vec4<f32>(0.0); }
				@fragment fn fs_main() {}
			`,
			roughness: 0.75,
			metallic: 0.1,
		});

		expect(shader.roughness).toBe(0.75);
		expect(shader.metallic).toBe(0.1);
		
		// Retrieve bind group to trigger buffer allocation and writeBuffer calls
		shader.getBindGroup(mockContext);
		
		// The queue writeBuffer should be called to populate Group 2 parameters
		expect(mockContext.device.queue.writeBuffer).toHaveBeenCalled();
	});
});
