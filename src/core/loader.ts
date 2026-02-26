/**
 * @module Loader
 * @description
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
		const text = await response.text();

		return this.parseOBJ(text);
	}

	/**
	 * Parse an OBJ model
	 * @param text The text of the model
	 * @returns The model
	 */
	private parseOBJ(text: string) {
		const vertices: number[] = [];
		const normals: number[] = [];
		const uvs: number[] = [];
		const indices: number[] = [];

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
					vertices.push(
						parseFloat(parts[1]),
						parseFloat(parts[2]),
						parseFloat(parts[3]),
					);
					break;
				case "vn":
					normals.push(
						parseFloat(parts[1]),
						parseFloat(parts[2]),
						parseFloat(parts[3]),
					);
					break;
				case "vt":
					uvs.push(parseFloat(parts[1]), parseFloat(parts[2]));
					break;
				case "f": {
					// Triangulate faces (supports triangulating quads)
					const faceIndices = [];
					for (let i = 1; i < parts.length; i++) {
						const face = parts[i].split("/");
						faceIndices.push(parseInt(face[0], 10) - 1);
					}

					// Simple convex triangulation (fan-style from the first vertex)
					for (let i = 1; i < faceIndices.length - 1; i++) {
						indices.push(faceIndices[0], faceIndices[i], faceIndices[i + 1]);
					}
					break;
				}
			}
		}

		return {
			vertices,
			normals,
			uvs,
			indices,
		};
	}
}
