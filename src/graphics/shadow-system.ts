import type { Context } from "../core/context";
import { Mat4 } from "../math/mat4";
import { Vec3 } from "../math/vec3";
import type { Camera } from "./camera";
import type { Light, ShadowConfig } from "./light";
import { isStandardMaterial } from "./materials/material";
import type { Mesh } from "./mesh";

/**
 * Internal batch record shared with BatchManager.
 */
export interface InstanceBatch {
	/** GPUBuffer containing model matrices array for instancing. */
	buffer: GPUBuffer;
	/** GPUBindGroup mapping the instanced storage buffer. */
	bindGroup: GPUBindGroup;
	/** Allocated matrix capacity of this batch. */
	capacity: number;
}

/**
 * ShadowSystem coordinates standard orthographic shadow depth map passes for directional lights.
 * Handles shadow map resource allocations (depth textures, comparison samplers, uniform buffers),
 * computes orthographic camera matrices aligned with directional vectors, implements texel-snapping
 * to eliminate crawling shadow boundaries, and handles instanced batch drawing.
 */
export class ShadowSystem {
	/** Target context reference. */
	private ctx: Context;

	/** Allocated GPU depth texture. */
	public texture!: GPUTexture;

	/** Dedicated comparison sampler checking depth values. */
	public sampler!: GPUSampler;

	/** GPUBuffer containing light view-projection matrices and texel sizes. */
	public uniformBuffer!: GPUBuffer;

	/** GPUBindGroup mapping shadow uniforms to group 0. */
	public bindGroup!: GPUBindGroup;

	/** Resolution size (width/height) of the square shadow map texture. Defaults to `2048`. */
	public textureSize = 2048;

	/** Computed combined view-projection matrix from the light source's viewpoint. */
	public matrix: Mat4 = new Mat4();

	/**
	 * Instantiates a new ShadowSystem.
	 *
	 * @param ctx - Active context.
	 */
	constructor(ctx: Context) {
		this.ctx = ctx;
		this.init();
	}

	/**
	 * @internal Initializes physical GPU depth attachments, comparison samplers,
	 * uniform buffers, and bind groups.
	 */
	private init(): void {
		this.texture = this.ctx.device.createTexture({
			size: [this.textureSize, this.textureSize, 1],
			usage:
				GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
			format: "depth32float",
		});
		this.ctx.vramTracker.register(
			this.texture,
			"texture",
			"Shadow Map",
			this.textureSize * this.textureSize * 4,
			"ShadowSystem",
		);

		this.sampler = this.ctx.device.createSampler({
			compare: "less",
			magFilter: "linear",
			minFilter: "linear",
		});

		this.uniformBuffer = this.ctx.device.createBuffer({
			size: 80, // mat4x4 (64 bytes) + texelSize (4 bytes) + padding (12 bytes)
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});
		this.ctx.vramTracker.register(
			this.uniformBuffer,
			"buffer",
			"Shadow Camera Matrix",
			80,
			"ShadowSystem",
		);

		// Write default texelSize so the shader never sees 0 on the first frame
		const defaultParams = new Float32Array([
			1.0 / this.textureSize,
			0, // _pad1
			0, // _pad2
			0, // _pad3
		]);
		this.ctx.device.queue.writeBuffer(this.uniformBuffer, 64, defaultParams);

		this.bindGroup = this.ctx.device.createBindGroup({
			layout: this.ctx.pipelineManager.getShadowBindGroupLayout(),
			entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
		});
	}

	/**
	 * Re-allocates shadow depth texture if resolution settings changed.
	 * Returns true if new assets were allocated, signaling parent systems to mark bind groups as dirty.
	 *
	 * @param newSize - Requested resolution.
	 * @returns True if texture was re-created, false otherwise.
	 */
	public reinitIfNeeded(newSize: number): boolean {
		if (newSize === this.textureSize && this.texture) return false;
		this.textureSize = newSize;
		this.ctx.vramTracker.unregister(this.texture);
		this.texture.destroy();
		this.texture = this.ctx.device.createTexture({
			size: [newSize, newSize, 1],
			usage:
				GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
			format: "depth32float",
		});
		this.ctx.vramTracker.register(
			this.texture,
			"texture",
			"Shadow Map",
			newSize * newSize * 4,
			"ShadowSystem",
		);
		return true;
	}

	/**
	 * Propagates active PCF filtering settings to standard materials.
	 * Ensure that materials use the correct shader variant during final draw calls.
	 *
	 * @param meshes - Active mesh array.
	 * @param usePCF - Toggle PCF.
	 */
	public propagateVariant(meshes: ReadonlyArray<Mesh>, usePCF: boolean): void {
		for (const mesh of meshes) {
			if (
				isStandardMaterial(mesh.material) &&
				mesh.material.usePCF !== usePCF
			) {
				mesh.material.usePCF = usePCF;
			}
		}
	}

	/**
	 * Renders shadow map depth passes.
	 * Locates the first active shadow-casting directional light, calculates frustum matrices,
	 * executes texel-snapping transformations to stabilize shadow border artifacts, and submits
	 * drawing commands.
	 *
	 * @param commandEncoder - GPU command encoder pipeline interface.
	 * @param lights - Current scene lights array.
	 * @param camera - Current active viewport camera.
	 * @param batchGroups - Grouped meshes sorted by instancing batch keys.
	 * @param instanceBatches - Allocated matrix buffer batches.
	 * @param meshes - Active scene meshes array.
	 * @returns True if depth rendering was completed, false otherwise.
	 */
	public renderPass(
		commandEncoder: GPUCommandEncoder,
		lights: ReadonlyArray<Light>,
		camera: Camera,
		batchGroups: Map<string, Mesh[]>,
		instanceBatches: Map<string, InstanceBatch>,
		meshes: ReadonlyArray<Mesh>,
	): boolean {
		// Find the first shadow-casting directional light via polymorphic getShadowConfig()
		let shadowCaster: Light | null = null;
		let config: ShadowConfig | null = null;
		for (const light of lights) {
			const c = light.getShadowConfig();
			if (c) {
				shadowCaster = light;
				config = c;
				break;
			}
		}
		if (!shadowCaster || !config) return false;

		this.reinitIfNeeded(config.shadowMapSize);

		// Compute shadow frustum
		const shadowRadius = config.shadowRadius;
		const shadowDepthRange = config.shadowDepthRange;

		// Direction via getLightData (avoids instanceof)
		const d = shadowCaster.getLightData();
		const lightDir = new Vec3(d.x, d.y, d.z).normalize();

		const center = camera.target.clone();

		const worldUp = new Vec3(0, 1, 0);
		const lightRight = worldUp.clone().cross(lightDir).normalize();
		const lightUp = lightDir.clone().cross(lightRight).normalize();

		// Texel-snapping to eliminate shadow-edge crawl
		const texelWorldSize = (shadowRadius * 2.0) / this.textureSize;
		const rawX = center.dot(lightRight);
		const rawY = center.dot(lightUp);
		const snappedX = Math.round(rawX / texelWorldSize) * texelWorldSize;
		const snappedY = Math.round(rawY / texelWorldSize) * texelWorldSize;

		const snappedCenter = center
			.clone()
			.add(lightRight.clone().scale(snappedX - rawX))
			.add(lightUp.clone().scale(snappedY - rawY));

		const shadowEye = snappedCenter
			.clone()
			.add(lightDir.clone().scale(-shadowDepthRange * 0.5));

		const viewMat = new Mat4().lookAt(
			shadowEye,
			snappedCenter,
			new Vec3(0, 1, 0),
		);
		const projMat = new Mat4().ortho(
			-shadowRadius,
			shadowRadius,
			-shadowRadius,
			shadowRadius,
			0.1,
			shadowDepthRange,
		);

		this.matrix = projMat.multiply(viewMat);
		this.ctx.device.queue.writeBuffer(
			this.uniformBuffer,
			0,
			this.matrix.values.buffer,
		);

		const shadowParams = new Float32Array([1.0 / this.textureSize, 0, 0, 0]);
		this.ctx.device.queue.writeBuffer(this.uniformBuffer, 64, shadowParams);

		// Propagate PCF variant
		this.propagateVariant(meshes, config.usePCF);

		const passEncoder = commandEncoder.beginRenderPass({
			colorAttachments: [],
			depthStencilAttachment: {
				view: this.texture.createView(),
				depthClearValue: 1.0,
				depthLoadOp: "clear",
				depthStoreOp: "store",
			},
		});

		passEncoder.setPipeline(this.ctx.pipelineManager.getShadowPipeline());
		passEncoder.setBindGroup(0, this.bindGroup);

		for (const [batchKey, batchMeshes] of batchGroups) {
			if (batchMeshes.length === 0) continue;
			const representative = batchMeshes[0];
			const batch = instanceBatches.get(batchKey);
			if (batch) {
				passEncoder.setBindGroup(1, batch.bindGroup);
				passEncoder.setVertexBuffer(0, representative.geometry.vertexBuffer);
				passEncoder.setIndexBuffer(
					representative.geometry.indexBuffer,
					representative.geometry.indexFormat,
				);
				passEncoder.drawIndexed(
					representative.geometry.indexCount,
					batchMeshes.length,
				);
			}
		}

		passEncoder.end();
		return true;
	}
}
