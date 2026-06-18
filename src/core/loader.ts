/**
 * Asset loader for shaders, textures, and 3D models.
 * Model loading is driven by a pluggable ModelParser registry (Open/Closed Principle):
 * new formats can be added externally via `loader.registerParser(parser)`
 * without modifying this file.
 */

import type { ModelData, ModelParser, ModelPart } from "./loader-parser";

// ─── Built-in parsers ──────────────────────────────────────────────────────

/**
 * Built-in parser for GLTF and GLB (binary GLTF) 3D assets.
 * Parses nodes, meshes, primitives, interleaved accessors, textures, and physical PBR materials.
 * Handles automatic object URL creation/revocation for embedded asset streams.
 */
class GLTFParser implements ModelParser {
	/**
	 * Determines if this parser can decode the specified URL based on extension.
	 *
	 * @param url - The target resource address.
	 * @returns True if target is a `.gltf` or `.glb` file, false otherwise.
	 */
	canParse(url: string): boolean {
		return url.endsWith(".gltf") || url.endsWith(".glb");
	}

	/**
	 * Asynchronously parses a raw GLTF/GLB network response into standard ModelData.
	 *
	 * @param url - The web address of the asset.
	 * @param response - The raw, unconsumed network response.
	 * @returns Standardized ModelData structures with primitives separated into ModelParts.
	 */
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

			// JSON chunk is padded to a 4-byte boundary in the file,
			// but the chunk length field stores the real (unpadded) byte count.
			const jsonChunkPaddedLength = Math.ceil(jsonChunkLength / 4) * 4;
			const binOffset = 20 + jsonChunkPaddedLength;
			if (arrayBuffer.byteLength > binOffset + 8) {
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

		// ── Helper: resolve texture URI from a texture reference ───────────────
		// biome-ignore lint/suspicious/noExplicitAny: GLTF JSON is dynamically typed
		const getTexUri = (texRef: any): string | null => {
			if (texRef === undefined) return null;
			const texture = gltf.textures?.[texRef.index];
			if (!texture) return null;
			const image = gltf.images?.[texture.source];
			if (!image) return null;

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

		// ── Helper: extract material options for a gltf.materials entry ─────────
		// biome-ignore lint/suspicious/noExplicitAny: GLTF JSON is dynamically typed
		const extractMaterial = (mat: any): Record<string, any> => {
			// biome-ignore lint/suspicious/noExplicitAny: GLTF JSON is dynamically typed
			const out: Record<string, any> = {};

			if (mat.pbrMetallicRoughness) {
				const pbr = mat.pbrMetallicRoughness;

				// Base color texture (takes priority over factor)
				const bc = getTexUri(pbr.baseColorTexture);
				if (bc) out.albedoTexture = bc;

				// Base color factor — used as albedoColor when there is no texture,
				// or as a multiplier tint when there is one.
				if (pbr.baseColorFactor) {
					const [r, g, b, a] = pbr.baseColorFactor as number[];
					// Convert to hex string for StandardMaterialOptions compatibility
					const toHex = (v: number) =>
						Math.round(Math.min(1, Math.max(0, v)) * 255)
							.toString(16)
							.padStart(2, "0");
					out.albedoColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
					if (a !== undefined && a < 1.0) {
						out.opacity = a;
					}
				}

				// Metallic / roughness texture
				const mr = getTexUri(pbr.metallicRoughnessTexture);
				if (mr) out.ormTexture = mr;

				out.roughness = pbr.roughnessFactor ?? 1.0;
				out.metallic = pbr.metallicFactor ?? 1.0;
			}

			const norm = getTexUri(mat.normalTexture);
			if (norm) out.normalTexture = norm;

			const occ = getTexUri(mat.occlusionTexture);
			if (occ && !out.ormTexture) {
				out.aoTexture = occ;
			}

			// Emissive factor and texture
			const em = getTexUri(mat.emissiveTexture);
			if (em) out.emissiveTexture = em;

			if (mat.emissiveFactor) {
				const [r, g, b] = mat.emissiveFactor as number[];
				const toHex = (v: number) =>
					Math.round(Math.min(1, Math.max(0, v)) * 255)
						.toString(16)
						.padStart(2, "0");
				out.emissiveColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
			}

			// KHR_materials_emissive_strength — HDR emissive multiplier (can exceed 1.0)
			const emissiveStrength =
				mat.extensions?.KHR_materials_emissive_strength?.emissiveStrength ??
				1.0;
			if (emissiveStrength !== 1.0) {
				out.emissiveStrength = emissiveStrength;
			}

			if (mat.doubleSided) out.doubleSided = true;

			return out;
		};

		// ── Build one ModelPart per GLTF primitive ───────────────────────────────
		const parts: ModelPart[] = [];

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

				const partVertices: number[] = [];
				for (let i = 0; i < posData.count; i++) {
					// Position (3 floats)
					partVertices.push(
						posData.array[i * 3],
						posData.array[i * 3 + 1],
						posData.array[i * 3 + 2],
					);
					// Normal (3 floats, default up)
					if (normData) {
						partVertices.push(
							normData.array[i * 3],
							normData.array[i * 3 + 1],
							normData.array[i * 3 + 2],
						);
					} else {
						partVertices.push(0, 1, 0);
					}
					// UV (2 floats, default 0,0)
					if (uvData) {
						partVertices.push(uvData.array[i * 2], uvData.array[i * 2 + 1]);
					} else {
						partVertices.push(0, 0);
					}
				}

				const partIndices: number[] = [];
				if (prim.indices !== undefined) {
					const indData = getAccessorData(prim.indices);
					for (let i = 0; i < indData.count; i++) {
						partIndices.push(indData.array[i]);
					}
				} else {
					for (let i = 0; i < posData.count; i++) {
						partIndices.push(i);
					}
				}

				// Resolve material for this primitive
				// biome-ignore lint/suspicious/noExplicitAny: GLTF JSON is dynamically typed
				let materialOptions: Record<string, any> | null = null;
				if (
					prim.material !== undefined &&
					gltf.materials &&
					gltf.materials[prim.material]
				) {
					materialOptions = extractMaterial(gltf.materials[prim.material]);
				} else if (gltf.materials && gltf.materials.length > 0) {
					// Fallback: use the first material if primitive has no material reference
					materialOptions = extractMaterial(gltf.materials[0]);
				}

				parts.push({
					name: mesh.name || "",
					vertices: partVertices,
					indices: partIndices,
					materialOptions,
				});
			}
		}

		return {
			vertices: [],
			indices: [],
			parts,
		};
	}
}

/**
 * Built-in parser for OBJ (Wavefront) 3D model assets.
 * Parses lines representing vertex coordinates (`v`), normal components (`vn`), texture coordinates (`vt`),
 * and polygons (`f`), constructing index buffers and resolving standard interleaved vertex arrays.
 */
class OBJParser implements ModelParser {
	/**
	 * Determines if this parser can decode the specified URL based on extension.
	 *
	 * @param url - The target resource address.
	 * @returns True if target is a `.obj` file, false otherwise.
	 */
	canParse(url: string): boolean {
		return url.endsWith(".obj");
	}

	/**
	 * Asynchronously parses a raw OBJ text network response into standard ModelData.
	 *
	 * @param _url - The web address of the asset.
	 * @param response - The raw, unconsumed network response.
	 * @returns Standardized ModelData structures with raw interleaved buffers.
	 */
	async parse(_url: string, response: Response): Promise<ModelData> {
		const text = await response.text();
		return this.parseOBJ(text);
	}

	/**
	 * Internal procedural parser for parsing Wavefront OBJ file lines.
	 *
	 * @param text - The raw text content of the OBJ file.
	 * @returns Standard format-agnostic model data structure.
	 */
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

			// Fast whitespace split without regex
			const parts: string[] = [];
			let start = 0;
			const len = line.length;
			for (let i = 0; i < len; i++) {
				const c = line.charCodeAt(i);
				if (c === 32 || c === 9 || c === 13) {
					// space, tab, carriage return
					if (start < i) {
						parts.push(line.substring(start, i));
					}
					start = i + 1;
				}
			}
			if (start < len) {
				parts.push(line.substring(start));
			}

			const type = parts[0];

			switch (type) {
				case "v":
					inputVertices.push(
						Number(parts[1]),
						Number(parts[2]),
						Number(parts[3]),
					);
					break;
				case "vn":
					inputNormals.push(
						Number(parts[1]),
						Number(parts[2]),
						Number(parts[3]),
					);
					break;
				case "vt":
					inputUVs.push(Number(parts[1]), Number(parts[2]));
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

							const vIdx = (Number(indices[0]) - 1) * 3;
							const vtIdx =
								indices.length > 1 && indices[1] !== ""
									? (Number(indices[1]) - 1) * 2
									: -1;
							const vnIdx =
								indices.length > 2 && indices[2] !== ""
									? (Number(indices[2]) - 1) * 3
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
									1.0 - inputUVs[vtIdx + 1], // Invert V component for WebGPU
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

/**
 * Loader class fetches, decodes, and manages 3D assets, textures, and shader modules.
 * Extensible through pluggable ModelParser registration.
 *
 * @group Core
 */
export class Loader {
	/**
	 * Active WebGPU GPUDevice instance used to compile shader modules and initialize GPUTextures.
	 */
	private device: GPUDevice;

	/**
	 * Internal list of registered model format parsers.
	 * Evaluated in order, with newly prepended custom parsers taking highest priority.
	 */
	private parsers: ModelParser[] = [new GLTFParser(), new OBJParser()];

	/**
	 * @internal Internal cache mapping texture URLs to their loaded GPUTexture promises.
	 * Optimizes network requests and VRAM allocation by preventing redundant assets.
	 */
	private textureCache = new Map<string, Promise<GPUTexture>>();

	/**
	 * Creates a Loader instance associated with a GPUDevice.
	 *
	 * @param device - Standard WebGPU device interface.
	 */
	constructor(device: GPUDevice) {
		this.device = device;
	}

	/**
	 * Prepend a custom ModelParser instance to the internal parser list.
	 * Allows custom formats (e.g. FBX, Collada) to take loading precedence.
	 *
	 * @param parser - The ModelParser implementation.
	 */
	public registerParser(parser: ModelParser): void {
		this.parsers.unshift(parser);
	}

	/**
	 * Fetches and compiles a WGSL shader code file from a URL.
	 *
	 * @param url - Web address pointing to the WGSL shader file.
	 * @returns A Promise resolving to a GPUShaderModule.
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
	 * Fetches an image file, decodes it into an ImageBitmap, and uploads it to WebGPU VRAM.
	 *
	 * @param url - Web address pointing to the image resource.
	 * @param options - Custom configuration format and texture usage flags.
	 * @returns A Promise resolving to an allocated GPUTexture.
	 */
	public async loadTexture(
		url: string,
		options: { format?: GPUTextureFormat; usage?: GPUTextureUsageFlags } = {},
	): Promise<GPUTexture> {
		const cacheKey = `${url}:${options.format || "rgba8unorm"}:${options.usage ?? ""}`;
		const cached = this.textureCache.get(cacheKey);
		if (cached) return cached;

		const loadPromise = (async () => {
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
		})().catch((err) => {
			this.textureCache.delete(cacheKey);
			throw err;
		});

		this.textureCache.set(cacheKey, loadPromise);
		return loadPromise;
	}

	/**
	 * Fetches and delegates parsing of a 3D model file to the first compatible parser.
	 *
	 * @param url - The web address of the 3D model asset.
	 * @returns A Promise resolving to format-agnostic ModelData.
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
