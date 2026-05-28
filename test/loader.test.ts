/// <reference types="@webgpu/types" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Loader } from "../src/core/loader";

// Mock GPUTextureUsage for the test environment (which might not have WebGPU natively)
// biome-ignore lint/suspicious/noExplicitAny: disable rule for now
(globalThis as any).GPUTextureUsage = {
	TEXTURE_BINDING: 4,
	COPY_DST: 2,
	RENDER_ATTACHMENT: 16,
};

describe("Loader Module", () => {
	let mockDevice: GPUDevice;
	let loader: Loader;

	// Save original fetch
	// biome-ignore lint/suspicious/noExplicitAny: disable rule for now
	let originalFetch: any;
	// biome-ignore lint/suspicious/noExplicitAny: disable rule for now
	let originalCreateImageBitmap: any;

	beforeEach(() => {
		originalFetch = window.fetch;
		// biome-ignore lint/suspicious/noExplicitAny: disable rule for now
		if ((window as any).createImageBitmap) {
			// biome-ignore lint/suspicious/noExplicitAny: disable rule for now
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

		// biome-ignore lint/suspicious/noExplicitAny: disable rule for now
		(window as any).createImageBitmap = vi
			.fn()
			.mockResolvedValue({ width: 1024, height: 1024 });
	});

	afterEach(() => {
		window.fetch = originalFetch;
		if (originalCreateImageBitmap) {
			// biome-ignore lint/suspicious/noExplicitAny: disable rule for now
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
			// biome-ignore lint/suspicious/noExplicitAny: disable rule for now
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

			// biome-ignore lint/suspicious/noExplicitAny: disable rule for now
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

	describe("loadModel (GLTF Parser)", () => {
		/**
		 * Build a minimal GLB ArrayBuffer from a GLTF JSON object.
		 * The JSON chunk length in the header is set to the EXACT json byte count
		 * so the parser slices correctly (no garbage bytes included).
		 * The buffer is padded to 4-byte alignment as required by the spec.
		 */
		function buildGlb(gltf: object): ArrayBuffer {
			const jsonStr = JSON.stringify(gltf);
			const encoder = new TextEncoder();
			const jsonBytes = encoder.encode(jsonStr);
			const realJsonLen = jsonBytes.length;
			// Pad to 4-byte boundary (GLB spec), but store real length in header
			const paddedJsonLen = Math.ceil(realJsonLen / 4) * 4;

			const totalLen = 12 + 8 + paddedJsonLen; // GLB header + chunk header + json
			const buf = new ArrayBuffer(totalLen);
			const view = new DataView(buf);
			view.setUint32(0, 0x46546c67, true); // magic "glTF"
			view.setUint32(4, 2, true);            // version 2
			view.setUint32(8, totalLen, true);     // total file length
			// Store REAL json length so the parser slices exactly the valid JSON
			view.setUint32(12, realJsonLen, true);
			view.setUint32(16, 0x4e4f534a, true);  // chunk type "JSON"
			new Uint8Array(buf, 20).set(jsonBytes);
			return buf;
		}

		it("should extract baseColorFactor as albedoColor when no texture", async () => {
			// Model with no geometry data (no buffers/bufferViews/accessors) —
			// POSITION is absent so the primitive is skipped; we only care that
			// materialOptions are extracted from the GLTF material.
			// Use a primitive that has no POSITION so getAccessorData is never called.
			const gltf = {
				asset: { version: "2.0" },
				meshes: [{
					primitives: [
						// This primitive has no POSITION → skipped by the parser
						// but we still need materialOptions parsed.
						// Use a second primitive WITH POSITION that references accessor 0
						// pointing to an empty bufferView so count=0, zero iterations.
						{
							attributes: { POSITION: 0 },
							material: 0,
						},
					],
				}],
				materials: [{
					pbrMetallicRoughness: {
						baseColorFactor: [1.0, 0.0, 0.0, 1.0], // red
						roughnessFactor: 0.8,
						metallicFactor: 0.0,
					},
				}],
				accessors: [
					// count=0 so the loop in getAccessorData runs zero times — safe
					{ bufferView: 0, byteOffset: 0, componentType: 5126, count: 0, type: "VEC3" },
				],
				bufferViews: [
					{ buffer: 0, byteOffset: 0, byteLength: 0 },
				],
				buffers: [{ byteLength: 0 }],
			};

			const glbBuffer = buildGlb(gltf);

			// The bin chunk is absent from our GLB, so buffers[0] won't be in the
			// buffers array. We need to push an empty ArrayBuffer for buffer index 0.
			// The parser checks: if (i === 0 && binBuffer) → only if binBuffer exists.
			// Since our GLB has no bin chunk, buffers[0] won't be loaded from GLB.
			// But the GLTF references buffer 0 with byteLength 0. The parser skips
			// external buffers that have no uri and aren't the embedded bin.
			// To avoid the DataView error, give the buffer a data: URI with 0 bytes.
			const gltfWithDataUri = {
				...gltf,
				buffers: [{ byteLength: 0, uri: "data:application/octet-stream;base64," }],
			};
			const glbBuffer2 = buildGlb(gltfWithDataUri);

			window.fetch = vi.fn().mockResolvedValue({
				ok: true,
				arrayBuffer: vi.fn().mockResolvedValue(glbBuffer2),
			});

			const result = await loader.loadModel("model.glb");

			expect(result.parts).toBeDefined();
			expect(result.parts!.length).toBe(1);

			const part = result.parts![0];
			expect(part.materialOptions).toBeDefined();
			expect(part.materialOptions!.albedoColor).toBe("#ff0000");
			expect(part.materialOptions!.roughness).toBe(0.8);
			expect(part.materialOptions!.metallic).toBe(0.0);
			expect(part.materialOptions!.albedoTexture).toBeUndefined();
		});

		it("should extract emissiveFactor and emissiveTexture from glTF materials", async () => {
			const gltf = {
				asset: { version: "2.0" },
				meshes: [{
					primitives: [
						{
							attributes: { POSITION: 0 },
							material: 0,
						},
					],
				}],
				materials: [{
					emissiveFactor: [1.0, 0.5, 0.0], // orange glow
					emissiveTexture: { index: 0 },
					pbrMetallicRoughness: {
						baseColorFactor: [1.0, 1.0, 1.0, 1.0],
					},
				}],
				textures: [{ source: 0 }],
				images: [{ uri: "glow.png" }],
				accessors: [
					{ bufferView: 0, byteOffset: 0, componentType: 5126, count: 0, type: "VEC3" },
				],
				bufferViews: [
					{ buffer: 0, byteOffset: 0, byteLength: 0 },
				],
				buffers: [{ byteLength: 0, uri: "data:application/octet-stream;base64," }],
			};

			const glbBuffer = buildGlb(gltf);

			window.fetch = vi.fn().mockResolvedValue({
				ok: true,
				arrayBuffer: vi.fn().mockResolvedValue(glbBuffer),
			});

			const result = await loader.loadModel("emissive_model.glb");

			expect(result.parts).toBeDefined();
			expect(result.parts!.length).toBe(1);

			const part = result.parts![0];
			expect(part.materialOptions).toBeDefined();
			expect(part.materialOptions!.emissiveColor).toBe("#ff8000");
			expect(part.materialOptions!.emissiveTexture).toContain("glow.png");
		});

		it("should produce one part per GLTF primitive with independent materials", async () => {
			const gltf = {
				asset: { version: "2.0" },
				meshes: [{
					primitives: [
						{ attributes: { POSITION: 0 }, material: 0 },
						{ attributes: { POSITION: 0 }, material: 1 },
					],
				}],
				materials: [
					{ pbrMetallicRoughness: { baseColorFactor: [0, 1, 0, 1] } }, // green
					{ pbrMetallicRoughness: { baseColorFactor: [0, 0, 1, 1] } }, // blue
				],
				accessors: [
					{ bufferView: 0, byteOffset: 0, componentType: 5126, count: 0, type: "VEC3" },
				],
				bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 0 }],
				buffers: [{ byteLength: 0, uri: "data:application/octet-stream;base64," }],
			};

			const glbBuffer = buildGlb(gltf);
			window.fetch = vi.fn().mockResolvedValue({
				ok: true,
				arrayBuffer: vi.fn().mockResolvedValue(glbBuffer),
			});

			const result = await loader.loadModel("multipart.glb");

			expect(result.parts).toBeDefined();
			expect(result.parts!.length).toBe(2);
			expect(result.parts![0].materialOptions!.albedoColor).toBe("#00ff00");
			expect(result.parts![1].materialOptions!.albedoColor).toBe("#0000ff");
		});

		it("should use fallback material when primitive has no material reference", async () => {
			const gltf = {
				asset: { version: "2.0" },
				meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
				materials: [{
					pbrMetallicRoughness: { baseColorFactor: [0.5, 0.5, 0.5, 1.0] },
				}],
				accessors: [
					{ bufferView: 0, byteOffset: 0, componentType: 5126, count: 0, type: "VEC3" },
				],
				bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 0 }],
				buffers: [{ byteLength: 0, uri: "data:application/octet-stream;base64," }],
			};

			const glbBuffer = buildGlb(gltf);
			window.fetch = vi.fn().mockResolvedValue({
				ok: true,
				arrayBuffer: vi.fn().mockResolvedValue(glbBuffer),
			});

			const result = await loader.loadModel("fallback.glb");
			expect(result.parts!.length).toBe(1);
			expect(result.parts![0].materialOptions!.albedoColor).toBe("#808080");
		});

		it("should return empty parts array when mesh has no primitives", async () => {
			const gltf = {
				asset: { version: "2.0" },
				meshes: [{ primitives: [] }],
			};

			const glbBuffer = buildGlb(gltf);
			window.fetch = vi.fn().mockResolvedValue({
				ok: true,
				arrayBuffer: vi.fn().mockResolvedValue(glbBuffer),
			});

			const result = await loader.loadModel("empty.glb");
			expect(result.parts).toBeDefined();
			expect(result.parts!.length).toBe(0);
		});
	});
});
