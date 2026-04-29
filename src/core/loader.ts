/**
 * @module Loader
 
 * This module provides the loader.
 */
export class Loader {
	/**
	 * The GPUDevice used for creating resources (textures, shaders)
	 * @private
	 * @type {GPUDevice}
	 */
	private device: GPUDevice;

	/**
	 * Create a new loader
	 * @param device The GPU device
	 */
	constructor(device: GPUDevice) {
		this.device = device;
	}

	/**
	 * Load a shader module from a URL
	 * @param url The URL of the shader module
	 * @returns The shader module
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
	 * Load a texture from a URL
	 * @param url The URL of the texture
	 * @param options The options for the texture
	 * @returns The texture
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

		// Transform response in blob to create an image bitmap
		// Using globalThis ensures environments like happy-dom or jsdom can mock it
		const imageBitmap = await globalThis.createImageBitmap(
			await response.blob(),
		);

		const format = options.format || "rgba8unorm";
		const usage =
			options.usage ??
			GPUTextureUsage.TEXTURE_BINDING |
				GPUTextureUsage.COPY_DST |
				GPUTextureUsage.RENDER_ATTACHMENT;

		// Create texture on gpu device with the same size of image bitmap
		const texture = this.device.createTexture({
			label: `Texture: ${url}`,
			size: [imageBitmap.width, imageBitmap.height, 1],
			format: format,
			usage: usage,
		});

		// Copy pixels from cpu(ImageBitmap) to gpu(GPUTexture)
		this.device.queue.copyExternalImageToTexture(
			{ source: imageBitmap },
			{ texture: texture },
			[imageBitmap.width, imageBitmap.height],
		);

		return texture;
	}

	/**
	 * Load a model from a URL
	 * @param url The URL of the model
	 * @returns The model
	 */
	public async loadModel(url: string) {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Failed to load model: ${url} (HTTP ${response.status})`);
		}

		if (url.endsWith(".gltf") || url.endsWith(".glb")) {
			return this.parseGLTF(url, response);
		} else {
			const text = await response.text();
			return this.parseOBJ(text);
		}
	}

	/**
	 * Parse a GLTF/GLB model
	 */
	private async parseGLTF(url: string, response: Response) {
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
						// Using Float32Array as output container so downcast
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
		// biome-ignore lint/suspicious/noExplicitAny: disable rule for now
		let parsedMaterial: any = null;
		if (gltf.materials && gltf.materials.length > 0) {
			const mat = gltf.materials[0];
			parsedMaterial = {};

			// biome-ignore lint/suspicious/noExplicitAny: disable rule for now
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
				if (mr) {
					parsedMaterial.metallicTexture = mr;
					parsedMaterial.roughnessTexture = mr;
				}
			}
			const norm = getTexUri(mat.normalTexture);
			if (norm) parsedMaterial.normalTexture = norm;

			const occ = getTexUri(mat.occlusionTexture);
			if (occ) parsedMaterial.aoTexture = occ;
		}

		return {
			vertices: outVertices,
			indices: outIndices,
			materialOptions: parsedMaterial,
		};
	}

	/**
	 * Parse an OBJ model
	 * @param text The text of the model
	 * @returns The model
	 */
	private parseOBJ(text: string) {
		const inputVertices: number[] = [];
		const inputNormals: number[] = [];
		const inputUVs: number[] = [];

		const interleavedVertices: number[] = [];
		const interleavedIndices: number[] = [];

		// To avoid duplicating identical vertices, use a map of "v/vt/vn" to index
		const indexMap = new Map<string, number>();
		let nextIndex = 0;

		const lines = text.split("\n");
		for (let line of lines) {
			line = line.trim();
			// Skip empty lines and comments
			if (line === "" || line.startsWith("#")) continue;

			// Split by any whitespace
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
					// Triangulate faces (supports triangulating quads)
					const faceIndices = [];
					for (let i = 1; i < parts.length; i++) {
						const key = parts[i];

						if (indexMap.has(key)) {
							// biome-ignore lint/style/noNonNullAssertion: disable rule for now
							faceIndices.push(indexMap.get(key)!);
						} else {
							// Parse face component: v/vt/vn
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

							// 1. Push position
							interleavedVertices.push(
								inputVertices[vIdx] || 0,
								inputVertices[vIdx + 1] || 0,
								inputVertices[vIdx + 2] || 0,
							);

							// 2. Push normal
							if (vnIdx >= 0 && inputNormals.length > vnIdx) {
								interleavedVertices.push(
									inputNormals[vnIdx],
									inputNormals[vnIdx + 1],
									inputNormals[vnIdx + 2],
								);
							} else {
								interleavedVertices.push(0, 1, 0); // Default normal
							}

							// 3. Push UV
							if (vtIdx >= 0 && inputUVs.length > vtIdx) {
								interleavedVertices.push(
									inputUVs[vtIdx],
									1.0 - inputUVs[vtIdx + 1], // Invert V for WebGPU
								);
							} else {
								interleavedVertices.push(0, 0); // Default UV
							}

							indexMap.set(key, nextIndex);
							faceIndices.push(nextIndex);
							nextIndex++;
						}
					}

					// Simple convex triangulation (fan-style from the first vertex)
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
			materialOptions: undefined,
		};
	}
}
