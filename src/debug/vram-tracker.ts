/**
 * Struct representing a single tracked VRAM allocation entry.
 *
 * @group Debugging
 */
export interface VRAMEntry {
	/** Unique identification number incremented on registration. */
	id: number;
	/** Resource classification choice (`"buffer"` or `"texture"`). */
	type: "buffer" | "texture";
	/** WebGPU label description assigned to the allocation block. */
	label: string;
	/** Size of the allocated resource block in bytes. */
	sizeBytes: number;
	/** Owning class name that initiated the allocation. */
	owner: string;
	/** Epoch timestamp in milliseconds indicating when the resource was registered. */
	createdAt: number;
	/** Reference to the native WebGPU resource key. */
	resource: GPUBuffer | GPUTexture;
}

/**
 * VRAMTracker tracks GPU memory allocations (buffers and textures) created by the engine.
 * WebGPU does not expose a native API for querying total VRAM, so this uses
 * manual bookkeeping — every createBuffer/createTexture in the engine calls
 * `ctx.vramTracker.register()`, and every `.destroy()` calls `ctx.vramTracker.unregister()`.
 * An instance class stored on Context to support multiple canvases and testability.
 *
 * @group Debugging
 */
export class VRAMTracker {
	/** @internal Active entries collection mapping native WebGPU resources. */
	private entries: Map<GPUBuffer | GPUTexture, VRAMEntry> = new Map();
	/** @internal Next allocation identification number. */
	private nextId = 1;

	/**
	 * Registers a newly created GPU resource allocation, caching timing and size details.
	 *
	 * @param resource - Native WebGPU buffer or texture object.
	 * @param type - Resource classification category.
	 * @param label - Resource description label.
	 * @param sizeBytes - Resource size in bytes.
	 * @param owner - Name of the owning class.
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
	 * Unregisters a GPU resource that has been released or destroyed.
	 *
	 * @param resource - Native WebGPU buffer or texture reference.
	 */
	public unregister(resource: GPUBuffer | GPUTexture): void {
		this.entries.delete(resource);
	}

	/**
	 * Returns all tracked entries sorted by size (largest first).
	 *
	 * @returns Sorted array of tracked VRAMEntry items.
	 */
	public getEntries(): VRAMEntry[] {
		return Array.from(this.entries.values()).sort(
			(a, b) => b.sizeBytes - a.sizeBytes,
		);
	}

	/**
	 * Estimates the total VRAM consumption across all registered entries.
	 *
	 * @returns Total estimated VRAM in bytes.
	 */
	public getTotalBytes(): number {
		let total = 0;
		for (const entry of this.entries.values()) {
			total += entry.sizeBytes;
		}
		return total;
	}

	/**
	 * Extracts a concise summary count detailing active resource types and total byte sizes.
	 *
	 * @returns Metrics summary object.
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
	 * Formats raw byte counts into human-readable strings (e.g. `"4.25 MB"`).
	 *
	 * @param bytes - Size value in bytes.
	 * @returns Formatted string.
	 */
	public static formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
	}

	/**
	 * Clears all active registrations.
	 */
	public clear(): void {
		this.entries.clear();
		this.nextId = 1;
	}
}
