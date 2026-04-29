/**
 * @module VRAMTracker
 
 * Tracks GPU memory allocations (buffers and textures) created by the engine.
 * WebGPU does not expose a native API for querying total VRAM, so this uses
 * manual bookkeeping — every createBuffer/createTexture in the engine calls
 * VRAMTracker.register(), and every .destroy() calls VRAMTracker.unregister().
 *
 * Inspired by Godot's "Video RAM" debugger tab.
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

let _nextId = 1;

// biome-ignore lint/complexity/noStaticOnlyClass: disable rule for now
export class VRAMTracker {
	private static entries: Map<GPUBuffer | GPUTexture, VRAMEntry> = new Map();

	/**
	 * Register a newly created GPU resource.
	 * @param resource  The GPUBuffer or GPUTexture
	 * @param type      'buffer' or 'texture'
	 * @param label     Descriptive label
	 * @param sizeBytes Allocated size in bytes
	 * @param owner     Class name that owns this resource
	 */
	public static register(
		resource: GPUBuffer | GPUTexture,
		type: "buffer" | "texture",
		label: string,
		sizeBytes: number,
		owner: string,
	): void {
		VRAMTracker.entries.set(resource, {
			id: _nextId++,
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
	public static unregister(resource: GPUBuffer | GPUTexture): void {
		VRAMTracker.entries.delete(resource);
	}

	/**
	 * Returns all tracked entries sorted by size (largest first).
	 */
	public static getEntries(): VRAMEntry[] {
		return Array.from(VRAMTracker.entries.values()).sort(
			(a, b) => b.sizeBytes - a.sizeBytes,
		);
	}

	/**
	 * Total estimated VRAM in bytes.
	 */
	public static getTotalBytes(): number {
		let total = 0;
		for (const entry of VRAMTracker.entries.values()) {
			total += entry.sizeBytes;
		}
		return total;
	}

	/**
	 * Quick summary counts.
	 */
	public static getSummary(): {
		buffers: number;
		textures: number;
		totalBytes: number;
		totalResources: number;
	} {
		let buffers = 0;
		let textures = 0;
		let totalBytes = 0;
		for (const entry of VRAMTracker.entries.values()) {
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
	public static clear(): void {
		VRAMTracker.entries.clear();
		_nextId = 1;
	}
}
