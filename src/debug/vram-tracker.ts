/**
 * @module VRAMTracker
 *
 * Tracks GPU memory allocations (buffers and textures) created by the engine.
 * WebGPU does not expose a native API for querying total VRAM, so this uses
 * manual bookkeeping — every createBuffer/createTexture in the engine calls
 * ctx.vramTracker.register(), and every .destroy() calls ctx.vramTracker.unregister().
 *
 * Inspired by Godot's "Video RAM" debugger tab.
 *
 * Now an instance class stored on Context to support multiple canvases and testability.
 */

export interface VRAMEntry {
	/** Auto-increment unique ID */
	id: number;
	/** 'buffer' or 'texture' */
	type: "buffer" | "texture";
	/** WebGPU label (e.g. "Geometry Vertex Buffer") */
	label: string;
	/** Size in bytes */
	sizeBytes: number;
	/** Owning class name (e.g. "Geometry", "Mesh", "Camera") */
	owner: string;
	/** performance.now() at registration */
	createdAt: number;
	/** The GPU resource reference (used as map key) */
	resource: GPUBuffer | GPUTexture;
}

export class VRAMTracker {
	private entries: Map<GPUBuffer | GPUTexture, VRAMEntry> = new Map();
	private nextId = 1;

	/**
	 * Register a newly created GPU resource.
	 */
	public register(
		resource: GPUBuffer | GPUTexture,
		type: "buffer" | "texture",
		label: string,
		sizeBytes: number,
		owner: string,
	): void {
		this.entries.set(resource, {
			id: this.nextId++,
			type,
			label,
			sizeBytes,
			owner,
			createdAt: performance.now(),
			resource,
		});
	}

	/**
	 * Unregister a GPU resource that has been destroyed.
	 */
	public unregister(resource: GPUBuffer | GPUTexture): void {
		this.entries.delete(resource);
	}

	/**
	 * Returns all tracked entries sorted by size (largest first).
	 */
	public getEntries(): VRAMEntry[] {
		return Array.from(this.entries.values()).sort(
			(a, b) => b.sizeBytes - a.sizeBytes,
		);
	}

	/**
	 * Total estimated VRAM in bytes.
	 */
	public getTotalBytes(): number {
		let total = 0;
		for (const entry of this.entries.values()) {
			total += entry.sizeBytes;
		}
		return total;
	}

	/**
	 * Quick summary counts.
	 */
	public getSummary(): {
		buffers: number;
		textures: number;
		totalBytes: number;
		totalResources: number;
	} {
		let buffers = 0;
		let textures = 0;
		let totalBytes = 0;
		for (const entry of this.entries.values()) {
			if (entry.type === "buffer") buffers++;
			else textures++;
			totalBytes += entry.sizeBytes;
		}
		return {
			buffers,
			textures,
			totalBytes,
			totalResources: buffers + textures,
		};
	}

	/**
	 * Formats bytes into human-readable string (e.g. "4.2 MB").
	 */
	public static formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
	}

	/**
	 * Clear all entries (useful for hot-reload / test scenarios).
	 */
	public clear(): void {
		this.entries.clear();
		this.nextId = 1;
	}
}
