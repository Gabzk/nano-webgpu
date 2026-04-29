import type { Context } from "../core/context";
import { VRAMTracker } from "../debug/vram-tracker";

export class Geometry {
	private static _nextId = 0;
	public readonly id: number;

	public vertexBuffer!: GPUBuffer;
	public indexBuffer!: GPUBuffer;
	public vertexCount: number = 0;
	public indexCount: number = 0;
	public hasUVs: boolean = false;
	public hasNormals: boolean = false;

	public indexFormat: GPUIndexFormat = "uint16";

	constructor(
		ctx: Context,
		vertices: Float32Array,
		indices: Uint16Array | Uint32Array,
		options: { hasUVs?: boolean; hasNormals?: boolean } = {},
	) {
		this.id = Geometry._nextId++;
		this.hasUVs = options.hasUVs ?? false;
		this.hasNormals = options.hasNormals ?? false;

		// Calculate vertex count based on attributes
		// Position: 3 floats
		// UV: 2 floats (if present)
		// Normal: 3 floats (if present)
		const stride = 3 + (this.hasUVs ? 2 : 0) + (this.hasNormals ? 3 : 0);
		this.vertexCount = vertices.length / stride;
		this.indexCount = indices.length;
		this.indexFormat = indices instanceof Uint32Array ? "uint32" : "uint16";

		// Create Vertex Buffer
		this.vertexBuffer = ctx.device.createBuffer({
			label: "Geometry Vertex Buffer",
			size: vertices.byteLength,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
		});
		// biome-ignore lint/suspicious/noExplicitAny: disable rule for now
		ctx.device.queue.writeBuffer(this.vertexBuffer, 0, vertices as any);
		VRAMTracker.register(
			this.vertexBuffer,
			"buffer",
			"Geometry Vertex Buffer",
			vertices.byteLength,
			"Geometry",
		);

		// Create Index Buffer
		// WebGPU requires buffer sizes and writeBuffer data to be 4-byte aligned.
		// Uint16Array with an odd number of elements (e.g. 3 indices = 6 bytes) would fail.
		const alignedIndexSize = Math.ceil(indices.byteLength / 4) * 4;
		this.indexBuffer = ctx.device.createBuffer({
			label: "Geometry Index Buffer",
			size: alignedIndexSize,
			usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
		});
		// If the index data isn't 4-byte aligned, copy into a padded buffer first
		if (indices.byteLength % 4 !== 0) {
			const padded = new Uint8Array(alignedIndexSize);
			padded.set(
				new Uint8Array(indices.buffer, indices.byteOffset, indices.byteLength),
			);
			ctx.device.queue.writeBuffer(this.indexBuffer, 0, padded);
		} else {
			// biome-ignore lint/suspicious/noExplicitAny: disable rule for now
			ctx.device.queue.writeBuffer(this.indexBuffer, 0, indices as any);
		}
		VRAMTracker.register(
			this.indexBuffer,
			"buffer",
			"Geometry Index Buffer",
			alignedIndexSize,
			"Geometry",
		);
	}

	/**
	 * Frees the GPU buffers associated with this geometry.
	 * Be careful: only destroy a geometry if no other meshes are sharing it.
	 */
	public destroy(): void {
		if (this.vertexBuffer) {
			VRAMTracker.unregister(this.vertexBuffer);
			this.vertexBuffer.destroy();
		}
		if (this.indexBuffer) {
			VRAMTracker.unregister(this.indexBuffer);
			this.indexBuffer.destroy();
		}
	}
}
