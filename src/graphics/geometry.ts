import type { Context } from "../core/context";
import type { CullMode } from "./cull-mode";

/**
 * Geometry encapsulates physical vertex and index GPUBuffers allocated in VRAM,
 * standardizing heterogeneous coordinate data into uniform 11-float vertex formats.
 */
export class Geometry {
	/** @internal Sequential static counter generating unique geometry identifiers. */
	private static _nextId = 0;

	/** Unique runtime geometry block identifier. */
	public readonly id: number;

	/** GPUBuffer instance containing interleaved vertex attribute components. */
	public vertexBuffer!: GPUBuffer;

	/** GPUBuffer instance containing index element arrays. */
	public indexBuffer!: GPUBuffer;

	/** Total vertex elements present in the vertex buffer. */
	public vertexCount: number = 0;

	/** Total index elements present in the index buffer. */
	public indexCount: number = 0;

	/** Boolean flag showing if the source array contained UV coordinate components. */
	public hasUVs: boolean = false;

	/** Boolean flag showing if the source array contained surface normal components. */
	public hasNormals: boolean = false;

	/** Index mapping format (either `"uint16"` or `"uint32"`). */
	public indexFormat: GPUIndexFormat = "uint16";

	/** Boolean flag showing if the source array contained vertex color components. */
	public hasColors: boolean = false;

	/** GPU primitive assembly topology configuration. */
	public topology: GPUPrimitiveTopology = "triangle-list";

	/** Optional culling mode override. Defaults to pipeline/topology preferences when undefined. */
	public cullMode: CullMode | undefined = undefined;

	/**
	 * Instantiates a new Geometry resource block, allocating and writing vertex and index buffers.
	 * Programmatically expands and translates raw coordinates into standard 11-float GPU formats
	 * (pos:3, norm:3, uv:2, color:3).
	 *
	 * @param ctx - Active framework context.
	 * @param vertices - Source raw float vertex components.
	 * @param indices - Source index arrays.
	 * @param options - Attribute specifications and topology overrides.
	 */
	constructor(
		ctx: Context,
		vertices: Float32Array,
		indices: Uint16Array | Uint32Array,
		options: {
			hasUVs?: boolean;
			hasNormals?: boolean;
			hasColors?: boolean;
			topology?: GPUPrimitiveTopology;
			cullMode?: CullMode;
		} = {},
	) {
		this.id = Geometry._nextId++;
		this.hasUVs = options.hasUVs ?? false;
		this.hasNormals = options.hasNormals ?? false;
		this.hasColors = options.hasColors ?? false;
		this.topology = options.topology ?? "triangle-list";
		this.cullMode = options.cullMode;

		const inputStride =
			3 +
			(this.hasNormals ? 3 : 0) +
			(this.hasUVs ? 2 : 0) +
			(this.hasColors ? 3 : 0);
		this.vertexCount = vertices.length / inputStride;
		this.indexCount = indices.length;
		this.indexFormat = indices instanceof Uint32Array ? "uint32" : "uint16";

		// ALWAYS convert the buffer to the full 11-float GPU layout: Position(3), Normal(3), UV(2), Color(3)
		const gpuStride = 11;
		const gpuVertices = new Float32Array(this.vertexCount * gpuStride);

		for (let i = 0; i < this.vertexCount; i++) {
			const srcOffset = i * inputStride;
			const dstOffset = i * gpuStride;

			// 1. Position
			gpuVertices[dstOffset + 0] = vertices[srcOffset + 0];
			gpuVertices[dstOffset + 1] = vertices[srcOffset + 1];
			gpuVertices[dstOffset + 2] = vertices[srcOffset + 2];

			// 2. Normal (default to facing camera [0, 0, 1] if not present)
			let normalX = 0;
			let normalY = 0;
			let normalZ = 1;
			let srcCursor = 3;

			if (this.hasNormals) {
				normalX = vertices[srcOffset + srcCursor];
				normalY = vertices[srcOffset + srcCursor + 1];
				normalZ = vertices[srcOffset + srcCursor + 2];
				srcCursor += 3;
			}
			gpuVertices[dstOffset + 3] = normalX;
			gpuVertices[dstOffset + 4] = normalY;
			gpuVertices[dstOffset + 5] = normalZ;

			// 3. UV (default to [0, 0] if not present)
			let uvU = 0;
			let uvV = 0;
			if (this.hasUVs) {
				uvU = vertices[srcOffset + srcCursor];
				uvV = vertices[srcOffset + srcCursor + 1];
				srcCursor += 2;
			}
			gpuVertices[dstOffset + 6] = uvU;
			gpuVertices[dstOffset + 7] = uvV;

			// 4. Color (default to white [1, 1, 1] if not present)
			let colorR = 1.0;
			let colorG = 1.0;
			let colorB = 1.0;
			if (this.hasColors) {
				colorR = vertices[srcOffset + srcCursor];
				colorG = vertices[srcOffset + srcCursor + 1];
				colorB = vertices[srcOffset + srcCursor + 2];
			}
			gpuVertices[dstOffset + 8] = colorR;
			gpuVertices[dstOffset + 9] = colorG;
			gpuVertices[dstOffset + 10] = colorB;
		}

		// Create Vertex Buffer using gpuVertices
		this.vertexBuffer = ctx.device.createBuffer({
			label: "Geometry Vertex Buffer",
			size: gpuVertices.byteLength,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
		});
		// biome-ignore lint/suspicious/noExplicitAny: native typed array copy
		ctx.device.queue.writeBuffer(this.vertexBuffer, 0, gpuVertices as any);
		ctx.vramTracker.register(
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
			// biome-ignore lint/suspicious/noExplicitAny: native typed array copy
			ctx.device.queue.writeBuffer(this.indexBuffer, 0, indices as any);
		}
		ctx.vramTracker.register(
			this.indexBuffer,
			"buffer",
			"Geometry Index Buffer",
			alignedIndexSize,
			"Geometry",
		);
	}

	/**
	 * Releases vertex and index buffers from GPU memory and unregisters resources from VRAM trackers.
	 *
	 * @param ctx - Shared context instance.
	 */
	public destroy(ctx: Context): void {
		if (this.vertexBuffer) {
			ctx.vramTracker.unregister(this.vertexBuffer);
			this.vertexBuffer.destroy();
		}
		if (this.indexBuffer) {
			ctx.vramTracker.unregister(this.indexBuffer);
			this.indexBuffer.destroy();
		}
	}
}
