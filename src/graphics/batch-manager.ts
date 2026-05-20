import type { Context } from "../core/context";
import type { PerformanceTracker } from "../debug/performance-tracker";
import type { Mesh } from "./mesh";

export interface InstanceBatch {
	buffer: GPUBuffer;
	bindGroup: GPUBindGroup;
	capacity: number;
}

/**
 * Manages GPU instance storage buffers and batch grouping for instanced rendering.
 * Extracted from Renderer to satisfy Single Responsibility Principle.
 *
 * Responsibilities:
 * - Groups visible meshes by geometry+material key (batchGroups)
 * - Allocates and grows GPU storage buffers per batch (instanceBatches)
 * - Uploads per-instance world matrices each frame
 */
export class BatchManager {
	private ctx: Context;

	/** Persistent batch-group map. Arrays are cleared/refilled each frame (no GC allocs). */
	private batchGroups: Map<string, Mesh[]> = new Map();

	/** Per-batch GPU storage buffers and their bind groups. */
	private instanceBatches: Map<string, InstanceBatch> = new Map();

	/** Reusable scratch buffer for matrix uploads. Grows as needed, never shrinks. */
	private instanceMatrixScratch: Float32Array = new Float32Array(16 * 64);

	constructor(ctx: Context) {
		this.ctx = ctx;
	}

	/**
	 * Groups visible meshes by geometry+material, reusing existing array objects to
	 * avoid per-frame GC pressure. Call once per frame before any render pass.
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

	/** Read-only access to the batch groups for render passes. */
	public getGroups(): Map<string, Mesh[]> {
		return this.batchGroups;
	}

	/** Read-only access to the instance GPU batches (bind groups + buffers). */
	public getInstanceBatches(): Map<string, InstanceBatch> {
		return this.instanceBatches;
	}

	/** Returns the GPU batch for a given batch key, or undefined if not yet allocated. */
	public getBatch(key: string): InstanceBatch | undefined {
		return this.instanceBatches.get(key);
	}

	/**
	 * Uploads world matrices for all batches and grows/allocates GPU buffers as needed.
	 * Must be called after rebuild() and before any render pass that reads instance data.
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
