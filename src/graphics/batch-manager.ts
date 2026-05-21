import type { Context } from "../core/context";
import type { PerformanceTracker } from "../debug/performance-tracker";
import type { Mesh } from "./mesh";

/**
 * Internal batch record tracking instanced render metrics and buffers.
 */
export interface InstanceBatch {
	/** GPUBuffer containing sequence of model matrices array. */
	buffer: GPUBuffer;
	/** GPUBindGroup mapping this instance batch storage resource. */
	bindGroup: GPUBindGroup;
	/** Allocated matrix count limit capacity. */
	capacity: number;
}

/**
 * BatchManager organizes visible scene meshes into discrete material/geometry instanced batches.
 * Allocates and grows GPU STORAGE buffers containing transformation matrix arrays to drive
 * instanced draw calls, drastically optimizing drawing bottlenecks. Reuses data buffers
 * to prevent garbage collector memory churning pressure.
 */
export class BatchManager {
	/** Parent context reference. */
	private ctx: Context;

	/** @internal Map of active batch groups sorted by material+geometry composite keys. */
	private batchGroups: Map<string, Mesh[]> = new Map();

	/** @internal Map of allocated GPU InstanceBatch storage structures. */
	private instanceBatches: Map<string, InstanceBatch> = new Map();

	/** @internal Persistent scratch array used to bundle world transformation values for GPU uploads. */
	private instanceMatrixScratch: Float32Array = new Float32Array(16 * 64);

	/**
	 * Instantiates a new BatchManager.
	 *
	 * @param ctx - Active context.
	 */
	constructor(ctx: Context) {
		this.ctx = ctx;
	}

	/**
	 * Scans visible mesh configurations and partitions them into instanced batches.
	 * Reuses array collections from previous frames to eliminate garbage collection allocations.
	 * Must be executed every frame prior to rendering sequences.
	 *
	 * @param meshes - Flat list of all meshes in the scene.
	 */
	public rebuild(meshes: ReadonlyArray<Mesh>): void {
		for (const group of this.batchGroups.values()) {
			group.length = 0;
		}
		for (const mesh of meshes) {
			if (!mesh.visible) continue;
			const key = `${mesh.geometry.id}_${mesh.material.id}_${mesh.geometry.topology}`;
			let group = this.batchGroups.get(key);
			if (!group) {
				group = [];
				this.batchGroups.set(key, group);
			}
			group.push(mesh);
		}
	}

	/**
	 * Exposes visible batch groupings sorted by instanced keys.
	 *
	 * @returns Read-only Map of mesh groups.
	 */
	public getGroups(): Map<string, Mesh[]> {
		return this.batchGroups;
	}

	/**
	 * Exposes instanced storage buffers allocated in VRAM.
	 *
	 * @returns Map of InstanceBatches.
	 */
	public getInstanceBatches(): Map<string, InstanceBatch> {
		return this.instanceBatches;
	}

	/**
	 * Resolves the InstanceBatch details mapped to the specified key.
	 *
	 * @param key - The batch identification key.
	 * @returns The target InstanceBatch, or undefined if not allocated.
	 */
	public getBatch(key: string): InstanceBatch | undefined {
		return this.instanceBatches.get(key);
	}

	/**
	 * Bundles and uploads coordinate arrays for active batches, growing GPU STORAGE buffers as needed.
	 * Propagates updated visible mesh statistics into performance trackers.
	 *
	 * @param perfTracker - Optional PerformanceTracker to update.
	 */
	public uploadMatrices(perfTracker: PerformanceTracker | null): void {
		for (const [batchKey, batchMeshes] of this.batchGroups) {
			if (batchMeshes.length === 0) continue;
			const instanceCount = batchMeshes.length;

			// Grow scratch buffer if needed
			const floatsNeeded = instanceCount * 16;
			if (this.instanceMatrixScratch.length < floatsNeeded) {
				this.instanceMatrixScratch = new Float32Array(
					Math.max(floatsNeeded, this.instanceMatrixScratch.length * 2),
				);
			}

			for (let i = 0; i < instanceCount; i++) {
				this.instanceMatrixScratch.set(
					batchMeshes[i].worldMatrix.values,
					i * 16,
				);
			}

			let batch = this.instanceBatches.get(batchKey);
			if (!batch || batch.capacity < instanceCount) {
				if (batch) {
					this.ctx.vramTracker.unregister(batch.buffer);
					batch.buffer.destroy();
				}

				const capacity = Math.max(
					instanceCount,
					(batch?.capacity || 0) * 2,
					16,
				);
				const bufferSize = capacity * 64;

				const buffer = this.ctx.device.createBuffer({
					label: `Instance Storage (batch ${batchKey})`,
					size: bufferSize,
					usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
				});
				this.ctx.vramTracker.register(
					buffer,
					"buffer",
					`Instance Storage (batch ${batchKey})`,
					bufferSize,
					"BatchManager",
				);

				const bindGroup = this.ctx.device.createBindGroup({
					label: `Instance BindGroup (batch ${batchKey})`,
					layout: this.ctx.pipelineManager.getModelBindGroupLayout(),
					entries: [{ binding: 0, resource: { buffer } }],
				});

				batch = { buffer, bindGroup, capacity };
				this.instanceBatches.set(batchKey, batch);
			}

			this.ctx.device.queue.writeBuffer(
				batch.buffer,
				0,
				this.instanceMatrixScratch.buffer,
				0,
				instanceCount * 64,
			);
		}

		if (perfTracker) {
			perfTracker.visibleMeshes = [...this.batchGroups.values()].reduce(
				(s, g) => s + g.length,
				0,
			);
		}
	}
}
