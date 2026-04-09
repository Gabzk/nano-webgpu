/// <reference types="@webgpu/types" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Loader } from "../src/core/loader";

// Mock GPUTextureUsage for the test environment (which might not have WebGPU natively)
(globalThis as any).GPUTextureUsage = {
	TEXTURE_BINDING: 4,
	COPY_DST: 2,
	RENDER_ATTACHMENT: 16,
};

describe("Loader Module", () => {
	let mockDevice: GPUDevice;
	let loader: Loader;

	// Save original fetch
	let originalFetch: any;
	let originalCreateImageBitmap: any;

	beforeEach(() => {
		originalFetch = window.fetch;
		if ((window as any).createImageBitmap) {
			originalCreateImageBitmap = (window as any).createImageBitmap;
		}

		mockDevice = {
			createShaderModule: vi.fn(),
			createTexture: vi.fn().mockReturnValue({}),
			queue: {
				copyExternalImageToTexture: vi.fn(),
			},
		} as unknown as GPUDevice;

		loader = new Loader(mockDevice);

		(window as any).createImageBitmap = vi
			.fn()
			.mockResolvedValue({ width: 1024, height: 1024 });
	});

	afterEach(() => {
		window.fetch = originalFetch;
		if (originalCreateImageBitmap) {
			(window as any).createImageBitmap = originalCreateImageBitmap;
		}
		vi.restoreAllMocks();
	});

	describe("loadShader", () => {
		it("should load a shader successfully", async () => {
			const shaderCode = "fn main() {}";

			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				text: vi.fn().mockResolvedValue(shaderCode),
			});
			window.fetch = mockFetch;

			const expectedShaderModule = {};
			(mockDevice.createShaderModule as any).mockReturnValue(
				expectedShaderModule,
			);

			const result = await loader.loadShader("test.wgsl");

			expect(mockFetch).toHaveBeenCalledWith("test.wgsl");
			expect(mockDevice.createShaderModule).toHaveBeenCalledWith({
				label: "Shader: test.wgsl",
				code: shaderCode,
			});
			expect(result).toBe(expectedShaderModule);
		});

		it("should throw an error if the shader fetch fails", async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 404,
				statusText: "Not Found",
			});
			window.fetch = mockFetch;

			await expect(loader.loadShader("test.wgsl")).rejects.toThrow(
				"Failed to load shader: test.wgsl (HTTP 404)",
			);
		});
	});

	describe("loadTexture", () => {
		it("should load a texture successfully with default options", async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				blob: vi.fn().mockResolvedValue(new Blob()),
			});
			window.fetch = mockFetch;

			await loader.loadTexture("test.png");

			expect((window as any).createImageBitmap).toHaveBeenCalled();
			expect(mockDevice.createTexture).toHaveBeenCalledWith(
				expect.objectContaining({
					format: "rgba8unorm",
					size: [1024, 1024, 1],
				}),
			);
			expect(mockDevice.queue.copyExternalImageToTexture).toHaveBeenCalled();
		});

		it("should load a texture with custom formatting options", async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				blob: vi.fn().mockResolvedValue(new Blob()),
			});
			window.fetch = mockFetch;

			await loader.loadTexture("test.png", { format: "bgra8unorm", usage: 0 });

			expect(mockDevice.createTexture).toHaveBeenCalledWith(
				expect.objectContaining({
					format: "bgra8unorm",
					usage: 0,
				}),
			);
		});

		it("should throw an error if the texture fetch fails", async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
			});
			window.fetch = mockFetch;

			await expect(loader.loadTexture("test.png")).rejects.toThrow(
				"Failed to load texture: test.png (HTTP 500)",
			);
		});
	});

	describe("loadModel (OBJ Parser)", () => {
		it("should fetch and correctly parse a simple triangulated OBJ", async () => {
			const basicObj = `
# A simple triangle
v 0 0 0
v 1 0 0
v 0 1 0

vn 0 0 1

vt 0 0
vt 1 0
vt 0 1

f 1/1/1 2/2/1 3/3/1
`;
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				text: vi.fn().mockResolvedValue(basicObj),
			});
			window.fetch = mockFetch;

			const result = await loader.loadModel("triangle.obj");

			// Interleaved format: Pos(3), Norm(3), UV(2)
			expect(result.vertices).toEqual([
				0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0,
			]);
			expect(result.indices).toEqual([0, 1, 2]); // Using 0-based indexing
		});

		it("should handle parsing complex OBJs with quads and unexpected spaces", async () => {
			// Includes multiple spaces, empty lines, and a quad face (4 vertices)
			const complexObj = `
v  0 0 0
v  1 0 0
v  1 1 0
v  0 1 0

f  1/1/1   2/2/1   3/3/1   4/4/1 
`;
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				text: vi.fn().mockResolvedValue(complexObj),
			});
			window.fetch = mockFetch;

			const result = await loader.loadModel("quad.obj");

			// Interleaved format: default normal 0,1,0 and default UV 0,0 since vn/vt were absent
			expect(result.vertices).toEqual([
				0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0,
				0, 1, 0, 0, 1, 0, 0, 0,
			]);
			expect(result.indices).toEqual([0, 1, 2, 0, 2, 3]); // Triangulated quad
		});

		it("should throw an error if model fetch fails", async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 403,
			});
			window.fetch = mockFetch;

			await expect(loader.loadModel("test.obj")).rejects.toThrow(
				"Failed to load model: test.obj (HTTP 403)",
			);
		});
	});
});
