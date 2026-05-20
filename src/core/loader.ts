/**
 * @module Loader
 *
 * Asset loader for shaders, textures, and 3D models.
 * Model loading is now driven by a pluggable ModelParser registry (OCP):
 * new formats can be added externally via `loader.registerParser(parser)`
 * without modifying this file.
 */

import type { ModelData, ModelParser } from "./loader-parser";

// ─── Built-in parsers ──────────────────────────────────────────────────────

class GLTFParser implements ModelParser {
	canParse(url: string): boolean {
		return url.endsWith(".gltf") || url.endsWith(".glb");
	}

	async parse(url: string, response: Response): Promise<ModelData> {
		let jsonStr: string;
		let binBuffer: ArrayBuffer | null = null;

		if (url.endsWith(".glb")) {
			const arrayBuffer = await response.arrayBuffer();
			const dataView = new DataView(arrayBuffer);
			const magic = dataView.getUint32(0, true);
			if (magic !== 0x46546c67) throw new Error("Invalid GLB magic");

			const jsonChunkLength = dataView.getUint32(12, true);
			const jsonBytes = new Uint8Array(arrayBuffer, 20, jsonChunkLength);
			jsonStr = new TextDecoder().decode(jsonBytes);

			const binOffset = 20 + jsonChunkLength;
			if (arrayBuffer.byteLength > binOffset) {
				const binChunkLength = dataView.getUint32(binOffset, true);
				binBuffer = arrayBuffer.slice(
					binOffset + 8,
					binOffset + 8 + binChunkLength,
				);
			}
		} else {
			jsonStr = await response.text();
		}

		const gltf = JSON.parse(jsonStr);
		const baseUrl = url.substring(0, url.lastIndexOf("/") + 1);

		// Load external buffers
		const buffers: ArrayBuffer[] = [];
		if (gltf.buffers) {
			for (let i = 0; i < gltf.buffers.length; i++) {
				if (i === 0 && binBuffer) {
					buffers.push(binBuffer);
					continue;
				}
				const b = gltf.buffers[i];
				if (b.uri && !b.uri.startsWith("data:")) {
					buffers.push(await (await fetch(baseUrl + b.uri)).arrayBuffer());
				} else if (b.uri?.startsWith("data:")) {
					const data = b.uri.split(",")[1];
					const binary = atob(data);
					const ab = new ArrayBuffer(binary.length);
					const view = new Uint8Array(ab);
					for (let j = 0; j < binary.length; j++) {
						view[j] = binary.charCodeAt(j);
					}
					buffers.push(ab);
				}
			}
		}

		// Helper to extract typed arrays handling byteStride
		const getAccessorData = (accessorIdx: number) => {
			const accessor = gltf.accessors[accessorIdx];
			const bufferView = gltf.bufferViews[accessor.bufferView];
			const buffer = buffers[bufferView.buffer];
			const byteOffset =
				(bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
			const stride = bufferView.byteStride || 0;

			let numComponents = 1;
			if (accessor.type === "VEC2") numComponents = 2;
			else if (accessor.type === "VEC3") numComponents = 3;
			else if (accessor.type === "VEC4") numComponents = 4;

			const dataView = new DataView(buffer);
			const count = accessor.count;
			const output = new Float32Array(count * numComponents);

			let elementSize = 4; // default Float32
			if (accessor.componentType === 5123) elementSize = 2;

			const effectiveStride = stride > 0 ? stride : numComponents * elementSize;

			for (let i = 0; i < count; i++) {
				for (let c = 0; c < numComponents; c++) {
					const offset = byteOffset + i * effectiveStride + c * elementSize;
					if (accessor.componentType === 5126) {
						output[i * numComponents + c] = dataView.getFloat32(offset, true);
					} else if (accessor.componentType === 5123) {
						output[i * numComponents + c] = dataView.getUint16(offset, true);
					} else if (accessor.componentType === 5125) {
						output[i * numComponents + c] = dataView.getUint32(offset, true);
					}
				}
			}
			return { array: output, count };
		};

		const outVertices: number[] = [];
		const outIndices: number[] = [];
		let indexOffset = 0;

		for (const mesh of gltf.meshes || []) {
			for (const prim of mesh.primitives) {
				if (prim.attributes.POSITION === undefined) continue;

				const posData = getAccessorData(prim.attributes.POSITION);
				const normData =
					prim.attributes.NORMAL !== undefined
						? getAccessorData(prim.attributes.NORMAL)
						: null;
				const uvData =
					prim.attributes.TEXCOORD_0 !== undefined
						? getAccessorData(prim.attributes.TEXCOORD_0)
						: null;

				for (let i = 0; i < posData.count; i++) {
					outVertices.push(
						posData.array[i * 3],
						posData.array[i * 3 + 1],
						posData.array[i * 3 + 2],
					);

					if (normData) {
						outVertices.push(
							normData.array[i * 3],
							normData.array[i * 3 + 1],
							normData.array[i * 3 + 2],
						);
					} else outVertices.push(0, 1, 0);

					if (uvData) {
						outVertices.push(uvData.array[i * 2], uvData.array[i * 2 + 1]);
					} else outVertices.push(0, 0);
				}

				if (prim.indices !== undefined) {
					const indData = getAccessorData(prim.indices);
					for (let i = 0; i < indData.count; i++) {
						outIndices.push(indData.array[i] + indexOffset);
					}
				} else {
					for (let i = 0; i < posData.count; i++)
						outIndices.push(i + indexOffset);
				}

				indexOffset += posData.count;
			}
		}

		// Material extraction
		// biome-ignore lint/suspicious/noExplicitAny: GLTF JSON is dynamically typed
		let parsedMaterial: any = null;
		if (gltf.materials && gltf.materials.length > 0) {
			const mat = gltf.materials[0];
			parsedMaterial = {};

			// biome-ignore lint/suspicious/noExplicitAny: GLTF JSON is dynamically typed
			const getTexUri = (texRef: any) => {
				if (texRef === undefined) return null;
				const texture = gltf.textures[texRef.index];
				if (!texture) return null;
				const image = gltf.images[texture.source];

				if (image.uri) return baseUrl + image.uri;

				if (image.bufferView !== undefined) {
					const bv = gltf.bufferViews[image.bufferView];
					const buffer = buffers[bv.buffer];
					const byteOffset = bv.byteOffset || 0;
					const byteLength = bv.byteLength;
					const slice = buffer.slice(byteOffset, byteOffset + byteLength);
					const blob = new Blob([slice], {
						type: image.mimeType || "image/png",
					});
					return URL.createObjectURL(blob);
				}

				return null;
			};

			if (mat.pbrMetallicRoughness) {
				const bc = getTexUri(mat.pbrMetallicRoughness.baseColorTexture);
				if (bc) parsedMaterial.albedoTexture = bc;

				const mr = getTexUri(mat.pbrMetallicRoughness.metallicRoughnessTexture);
				if (mr) parsedMaterial.ormTexture = mr;

				const roughnessFactor = mat.pbrMetallicRoughness.roughnessFactor ?? 1.0;
				const metallicFactor = mat.pbrMetallicRoughness.metallicFactor ?? 1.0;
				parsedMaterial.roughness = roughnessFactor;
				parsedMaterial.metallic = metallicFactor;
			}
			const norm = getTexUri(mat.normalTexture);
			if (norm) parsedMaterial.normalTexture = norm;

			const occ = getTexUri(mat.occlusionTexture);
			if (occ && !parsedMaterial.ormTexture) {
				parsedMaterial.aoTexture = occ;
			}
		}

		return {
			vertices: outVertices,
			indices: outIndices,
			materialOptions: parsedMaterial,
		};
	}
}

class OBJParser implements ModelParser {
	canParse(url: string): boolean {
		return url.endsWith(".obj");
	}

	async parse(_url: string, response: Response): Promise<ModelData> {
		const text = await response.text();
		return this.parseOBJ(text);
	}

	private parseOBJ(text: string): ModelData {
		const inputVertices: number[] = [];
		const inputNormals: number[] = [];
		const inputUVs: number[] = [];

		const interleavedVertices: number[] = [];
		const interleavedIndices: number[] = [];

		const indexMap = new Map<string, number>();
		let nextIndex = 0;

		const lines = text.split("\n");
		for (let line of lines) {
			line = line.trim();
			if (line === "" || line.startsWith("#")) continue;

			const parts = line.split(/\s+/);
			const type = parts[0];

			switch (type) {
				case "v":
					inputVertices.push(
						parseFloat(parts[1]),
						parseFloat(parts[2]),
						parseFloat(parts[3]),
					);
					break;
				case "vn":
					inputNormals.push(
						parseFloat(parts[1]),
						parseFloat(parts[2]),
						parseFloat(parts[3]),
					);
					break;
				case "vt":
					inputUVs.push(parseFloat(parts[1]), parseFloat(parts[2]));
					break;
				case "f": {
					const faceIndices = [];
					for (let i = 1; i < parts.length; i++) {
						const key = parts[i];

						if (indexMap.has(key)) {
							// biome-ignore lint/style/noNonNullAssertion: key guaranteed in map
							faceIndices.push(indexMap.get(key)!);
						} else {
							const indices = key.split("/");

							const vIdx = (parseInt(indices[0], 10) - 1) * 3;
							const vtIdx =
								indices.length > 1 && indices[1] !== ""
									? (parseInt(indices[1], 10) - 1) * 2
									: -1;
							const vnIdx =
								indices.length > 2 && indices[2] !== ""
									? (parseInt(indices[2], 10) - 1) * 3
									: -1;

							interleavedVertices.push(
								inputVertices[vIdx] || 0,
								inputVertices[vIdx + 1] || 0,
								inputVertices[vIdx + 2] || 0,
							);

							if (vnIdx >= 0 && inputNormals.length > vnIdx) {
								interleavedVertices.push(
									inputNormals[vnIdx],
									inputNormals[vnIdx + 1],
									inputNormals[vnIdx + 2],
								);
							} else {
								interleavedVertices.push(0, 1, 0);
							}

							if (vtIdx >= 0 && inputUVs.length > vtIdx) {
								interleavedVertices.push(
									inputUVs[vtIdx],
									1.0 - inputUVs[vtIdx + 1], // Invert V for WebGPU
								);
							} else {
								interleavedVertices.push(0, 0);
							}

							indexMap.set(key, nextIndex);
							faceIndices.push(nextIndex);
							nextIndex++;
						}
					}

					for (let i = 1; i < faceIndices.length - 1; i++) {
						interleavedIndices.push(
							faceIndices[0],
							faceIndices[i],
							faceIndices[i + 1],
						);
					}
					break;
				}
			}
		}

		return {
			vertices: interleavedVertices,
			indices: interleavedIndices,
			materialOptions: null,
		};
	}
}

// ─── Loader ────────────────────────────────────────────────────────────────

export class Loader {
	/**
	 * The GPUDevice used for creating GPU resources (textures, shaders).
	 */
	private device: GPUDevice;

	/**
	 * Ordered list of model parsers. First matching parser wins.
	 * Built-in GLTF and OBJ parsers are registered by default.
	 * External parsers registered via registerParser() are prepended (higher priority).
	 */
	private parsers: ModelParser[] = [new GLTFParser(), new OBJParser()];

	constructor(device: GPUDevice) {
		this.device = device;
	}

	/**
	 * Register a custom model format parser.
	 * The new parser takes priority over built-in parsers.
	 */
	public registerParser(parser: ModelParser): void {
		this.parsers.unshift(parser);
	}

	/**
	 * Load a shader module from a URL.
	 */
	public async loadShader(url: string): Promise<GPUShaderModule> {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(
				`Failed to load shader: ${url} (HTTP ${response.status})`,
			);
		}
		const code = await response.text();

		return this.device.createShaderModule({
			label: `Shader: ${url}`,
			code: code,
		});
	}

	/**
	 * Load a texture from a URL.
	 */
	public async loadTexture(
		url: string,
		options: { format?: GPUTextureFormat; usage?: GPUTextureUsageFlags } = {},
	): Promise<GPUTexture> {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(
				`Failed to load texture: ${url} (HTTP ${response.status})`,
			);
		}

		const imageBitmap = await globalThis.createImageBitmap(
			await response.blob(),
		);

		const format = options.format || "rgba8unorm";
		const usage =
			options.usage ??
			GPUTextureUsage.TEXTURE_BINDING |
				GPUTextureUsage.COPY_DST |
				GPUTextureUsage.RENDER_ATTACHMENT;

		const texture = this.device.createTexture({
			label: `Texture: ${url}`,
			size: [imageBitmap.width, imageBitmap.height, 1],
			format: format,
			usage: usage,
		});

		this.device.queue.copyExternalImageToTexture(
			{ source: imageBitmap },
			{ texture: texture },
			[imageBitmap.width, imageBitmap.height],
		);

		return texture;
	}

	/**
	 * Load a 3D model from a URL.
	 * Delegates to the first registered parser whose canParse() returns true.
	 * Register additional parsers via registerParser() for new formats.
	 */
	public async loadModel(url: string): Promise<ModelData> {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Failed to load model: ${url} (HTTP ${response.status})`);
		}

		const parser = this.parsers.find((p) => p.canParse(url));
		if (!parser) {
			throw new Error(
				`No parser found for model: "${url}". Supported extensions: ${this.parsers
					.map((p) => p.constructor.name)
					.join(
						", ",
					)}. Register a custom parser via ctx.loader.registerParser().`,
			);
		}

		return parser.parse(url, response);
	}
}

export type { ModelData, ModelParser } from "./loader-parser";
