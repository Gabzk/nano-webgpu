import type { Context } from "../core/context";
import { Mat4 } from "../math/mat4";
import { Vec3 } from "../math/vec3";
import type { Camera } from "./camera";
import type { Light } from "./light";
import type { Mesh } from "./mesh";
import { isStandardMaterial } from "./materials/material";

/** Internal batch record shared with BatchManager. */
export interface InstanceBatch {
	buffer: GPUBuffer;
	bindGroup: GPUBindGroup;
	capacity: number;
}

/**
 * Manages the directional shadow map pass.
 * Extracted from Renderer to satisfy Single Responsibility Principle.
 * Owns: shadow texture, sampler, uniform buffer, bind group, frustum math.
 */
export class ShadowSystem {
	private ctx: Context;

	public texture!: GPUTexture;
	public sampler!: GPUSampler;
	public uniformBuffer!: GPUBuffer;
	public bindGroup!: GPUBindGroup;
	public textureSize = 2048;
	public matrix: Mat4 = new Mat4();

	constructor(ctx: Context) {
		this.ctx = ctx;
		this.init();
	}

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
			size: 80, // mat4x4 (64) + texelSize (4) + _pad1..3 (12)
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
	 * Recreates the shadow texture if the requested size changed.
	 * Returns true if the texture was recreated (signals globals bind group is dirty).
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
	 * Stamps the usePCF variant flag on every StandardMaterial in the mesh list.
	 * Called once per frame so each material routes to the correct compiled pipeline variant.
	 */
	public propagateVariant(meshes: Mesh[], usePCF: boolean): void {
		for (const mesh of meshes) {
			if (isStandardMaterial(mesh.material) && mesh.material.usePCF !== usePCF) {
				mesh.material.usePCF = usePCF;
			}
		}
	}

	/**
	 * Renders the shadow depth pass.
	 * Returns true if a shadow-casting directional light was found and rendered.
	 */
	public renderPass(
		commandEncoder: GPUCommandEncoder,
		lights: Light[],
		camera: Camera,
		batchGroups: Map<string, Mesh[]>,
		instanceBatches: Map<string, InstanceBatch>,
		meshes: Mesh[],
	): boolean {
		// Find the first shadow-casting directional light via polymorphic getShadowConfig()
		let shadowCaster: Light | null = null;
		for (const light of lights) {
			if (light.getShadowConfig()) {
				shadowCaster = light;
				break;
			}
		}
		if (!shadowCaster) return false;

		const config = shadowCaster.getShadowConfig()!;
		if (this.reinitIfNeeded(config.shadowMapSize)) {
			// Caller should mark globals bind group as dirty
		}

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

		const shadowParams = new Float32Array([
			1.0 / this.textureSize,
			0,
			0,
			0,
		]);
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
