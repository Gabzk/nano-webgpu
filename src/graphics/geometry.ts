import type { Context } from "../core/context";

export class Geometry {
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
		ctx.device.queue.writeBuffer(this.vertexBuffer, 0, vertices as any);

		// Create Index Buffer
		this.indexBuffer = ctx.device.createBuffer({
			label: "Geometry Index Buffer",
			size: indices.byteLength,
			usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
		});
		ctx.device.queue.writeBuffer(this.indexBuffer, 0, indices as any);
	}

	/**
	 * Frees the GPU buffers associated with this geometry.
	 * Be careful: only destroy a geometry if no other meshes are sharing it.
	 */
	public destroy(): void {
		if (this.vertexBuffer) this.vertexBuffer.destroy();
		if (this.indexBuffer) this.indexBuffer.destroy();
	}
}
