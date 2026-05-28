import type { Context } from "../core/context";
import { Mat4 } from "../math/mat4";
import { Vec3 } from "../math/vec3";
import type { InstanceBatch } from "./batch-manager";
import type { Camera } from "./camera";
import type { Light, ShadowConfig } from "./light";
import { isStandardMaterial } from "./materials/material";
import type { Mesh } from "./mesh";

/**
 * Standard column-major point transformation helper using Mat4.
 */
function transformPoint(m: Mat4, p: Vec3): Vec3 {
	const v = m.values;
	const x = p.x;
	const y = p.y;
	const z = p.z;
	const w = x * v[3] + y * v[7] + z * v[11] + v[15];
	const rw = w !== 0 ? 1.0 / w : 1.0;
	return new Vec3(
		(x * v[0] + y * v[4] + z * v[8] + v[12]) * rw,
		(x * v[1] + y * v[5] + z * v[9] + v[13]) * rw,
		(x * v[2] + y * v[6] + z * v[10] + v[14]) * rw,
	);
}

/**
 * Standard WebGPU orthographic projection matrix mapping [zNear, zFar] to NDC [0, 1].
 */
function orthoWebGPU(
	left: number,
	right: number,
	bottom: number,
	top: number,
	zNear: number,
	zFar: number,
): Mat4 {
	const m = new Mat4();
	const lr = 1 / (left - right);
	const bt = 1 / (bottom - top);
	const v = m.values;

	v[0] = -2 * lr;
	v[1] = 0;
	v[2] = 0;
	v[3] = 0;
	v[4] = 0;
	v[5] = -2 * bt;
	v[6] = 0;
	v[7] = 0;
	v[8] = 0;
	v[9] = 0;
	v[10] = 1 / (zFar - zNear);
	v[11] = 0;
	v[12] = (left + right) * lr;
	v[13] = (top + bottom) * bt;
	v[14] = -zNear / (zFar - zNear);
	v[15] = 1;

	return m;
}

/**
 * ShadowSystem coordinates standard orthographic shadow depth map passes for directional lights,
 * spotlight perspective shadow map passes, and Cascaded Shadow Maps (CSM) for directional lights.
 * Handles shadow map resource allocations (depth textures, comparison samplers, uniform buffers),
 * computes orthographic camera matrices aligned with directional vectors, implements texel-snapping
 * to eliminate crawling shadow boundaries, and handles instanced batch drawing.
 *
 * @group Lighting
 */
export class ShadowSystem {
	/** Target context reference. */
	private ctx: Context;

	/** Allocated GPU depth texture (single 2D texture or 2D texture array). */
	public texture!: GPUTexture;

	/** Dedicated comparison sampler checking depth values. */
	public sampler!: GPUSampler;

	/** GPUBuffer containing light view-projection matrices and texel sizes. */
	public uniformBuffer!: GPUBuffer;

	/** GPUBindGroup mapping shadow uniforms to group 0. */
	public bindGroup!: GPUBindGroup;

	/** Resolution size (width/height) of the square shadow map texture. Defaults to `2048`. */
	public textureSize = 2048;

	/** Computed combined view-projection matrix from the light source's viewpoint (non-CSM). */
	public matrix: Mat4 = new Mat4();

	/** If true, the shadow system is currently utilizing Cascaded Shadow Maps. */
	public useCSM = false;

	/** Active cascade count for CSM. */
	public cascadeCount = 4;

	/** Dedicated views of individual cascade layers of the 2D texture array. */
	private cascadeViews: GPUTextureView[] = [];

	/** Multi-matrix GPUBuffer for single shadow pass vertex shader bindings (CSM). */
	private cascadeUniformBuffer: GPUBuffer | null = null;

	/** Cached bind groups for cascade rendering passes. */
	private cascadeBindGroups: GPUBindGroup[] = [];

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
			size: 96, // mat4x4 (64 bytes) + texelSize (4 bytes) + hasShadow (4 bytes) + lightDir (12 bytes) + padding (12 bytes)
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});
		this.ctx.vramTracker.register(
			this.uniformBuffer,
			"buffer",
			"Shadow Camera Matrix",
			96,
			"ShadowSystem",
		);

		// Write default texelSize so the shader never sees 0 on the first frame
		const defaultParams = new Float32Array([
			1.0 / this.textureSize, // texelSize
			0.0, // hasShadow
			0.0, // lightDirX
			0.0, // lightDirY
			0.0, // lightDirZ
			0.0, // bias
			0.0,
			0.0,
		]);
		this.ctx.device.queue.writeBuffer(this.uniformBuffer, 64, defaultParams);

		this.bindGroup = this.ctx.device.createBindGroup({
			layout: this.ctx.pipelineManager.getShadowBindGroupLayout(),
			entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
		});
	}

	/**
	 * Re-allocates shadow depth texture and views if resolution or cascade settings changed.
	 * Returns true if new assets were allocated, signaling parent systems to mark bind groups as dirty.
	 *
	 * @param newSize - Requested resolution.
	 * @param useCSM - Toggle CSM mode.
	 * @param cascadeCount - Active cascade layers count.
	 * @returns True if texture was re-created, false otherwise.
	 */
	public reinitIfNeeded(
		newSize: number,
		useCSM = false,
		cascadeCount = 4,
	): boolean {
		if (
			newSize === this.textureSize &&
			useCSM === this.useCSM &&
			cascadeCount === this.cascadeCount &&
			this.texture
		) {
			return false;
		}

		this.textureSize = newSize;
		this.useCSM = useCSM;
		this.cascadeCount = cascadeCount;

		this.ctx.vramTracker.unregister(this.texture);
		this.texture.destroy();

		this.cascadeViews = [];

		const depthOrArrayLayers = useCSM ? cascadeCount : 1;
		this.texture = this.ctx.device.createTexture({
			size: [newSize, newSize, depthOrArrayLayers],
			usage:
				GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
			format: "depth32float",
		});

		this.ctx.vramTracker.register(
			this.texture,
			"texture",
			useCSM ? `Shadow Map Array (${cascadeCount} cascades)` : "Shadow Map",
			newSize * newSize * 4 * depthOrArrayLayers,
			"ShadowSystem",
		);

		// Re-create active uniform buffers
		this.ctx.vramTracker.unregister(this.uniformBuffer);
		this.uniformBuffer.destroy();

		const uBufferSize = useCSM ? 320 : 96; // 320 bytes handles CSM params, 96 handles standard
		this.uniformBuffer = this.ctx.device.createBuffer({
			size: uBufferSize,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		this.ctx.vramTracker.register(
			this.uniformBuffer,
			"buffer",
			"Shadow Camera Uniforms",
			uBufferSize,
			"ShadowSystem",
		);

		this.bindGroup = this.ctx.device.createBindGroup({
			layout: this.ctx.pipelineManager.getShadowBindGroupLayout(),
			entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
		});

		// Allocate CSM cascade buffers/views
		if (useCSM) {
			if (this.cascadeUniformBuffer) {
				this.cascadeUniformBuffer.destroy();
			}
			this.cascadeUniformBuffer = this.ctx.device.createBuffer({
				size: 256 * cascadeCount,
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			});

			this.cascadeBindGroups = [];
			for (let i = 0; i < cascadeCount; i++) {
				this.cascadeViews.push(
					this.texture.createView({
						dimension: "2d",
						baseArrayLayer: i,
						arrayLayerCount: 1,
					}),
				);

				this.cascadeBindGroups.push(
					this.ctx.device.createBindGroup({
						layout: this.ctx.pipelineManager.getShadowBindGroupLayout(),
						entries: [
							{
								binding: 0,
								resource: {
									buffer: this.cascadeUniformBuffer,
									offset: i * 256,
									size: 64,
								},
							},
						],
					}),
				);
			}
		}

		return true;
	}

	/**
	 * Propagates active PCF filtering settings to standard PBR materials.
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
	 * Calculates camera splits, projects cascades, renders layered textures, or falls
	 * back to standard orthographic directional or perspective spotlight depth maps.
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
		// Find the first shadow-casting light
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

		if (!shadowCaster || !config) {
			this.reinitIfNeeded(2048, false, 4);
			const shadowParams = new Float32Array([
				1.0 / this.textureSize, // texelSize
				0.0, // hasShadow = 0.0 (inactive)
				0.0,
				0.0,
				0.0,
				0.0,
				0.0,
				0.0,
			]);
			this.ctx.device.queue.writeBuffer(this.uniformBuffer, 64, shadowParams);
			return false;
		}

		const isCSM = !!config.useCSM;
		const cascadeCount = config.cascadeCount ?? 4;
		this.reinitIfNeeded(config.shadowMapSize, isCSM, cascadeCount);

		if (isCSM) {
			const splits: number[] = [];
			const near = camera.near;
			const far = config.csmMaxDistance ?? 100.0;
			const lambda = config.cascadeSplitLambda ?? 0.85;

			// 1. Calculate logarithmic-linear splits
			splits.push(near);
			for (let i = 1; i <= cascadeCount; i++) {
				const p = i / cascadeCount;
				const dLog = near * (far / near) ** p;
				const dLin = near + p * (far - near);
				splits.push(lambda * dLog + (1 - lambda) * dLin);
			}

			// Direction
			const d = shadowCaster.getLightData();
			const lightDir = new Vec3(d.x, d.y, d.z).normalize();

			const cascadeMatrices: Mat4[] = [];
			const fov = camera.fov;
			const aspect = camera.aspect;
			const tanHalfFOV = Math.tan(fov / 2);

			const cameraForward = camera.worldMatrix
				.transformDirection(new Vec3(0, 0, -1))
				.normalize();

			// 2. Compute matrices and render each cascade
			for (let i = 0; i < cascadeCount; i++) {
				const n = splits[i];
				const f = splits[i + 1];

				const hn = n * tanHalfFOV;
				const wn = hn * aspect;
				const hf = f * tanHalfFOV;
				const wf = hf * aspect;

				// Corners in Camera Space
				const cornersCam = [
					new Vec3(-wn, hn, -n),
					new Vec3(wn, hn, -n),
					new Vec3(wn, -hn, -n),
					new Vec3(-wn, -hn, -n),
					new Vec3(-wf, hf, -f),
					new Vec3(wf, hf, -f),
					new Vec3(wf, -hf, -f),
					new Vec3(-wf, -hf, -f),
				];

				// Corners in World Space
				const cornersWorld = cornersCam.map((p) =>
					transformPoint(camera.worldMatrix, p),
				);

				// Compute Centroid
				const centroid = new Vec3(0, 0, 0);
				for (const pt of cornersWorld) {
					centroid.add(pt);
				}
				centroid.scale(1 / 8);

				// Compute stable Light View Matrix using Look-At
				// Place light backoff far enough to cover objects in front of the cascade
				const backoff = 200.0;
				const eye = centroid.clone().add(lightDir.clone().scale(-backoff));

				let worldUp = new Vec3(0, 1, 0);
				if (Math.abs(lightDir.dot(worldUp)) > 0.99) {
					worldUp = new Vec3(0, 0, 1);
				}
				const viewMat = new Mat4().lookAt(eye, centroid, worldUp);

				// Find Bounds in Light Space
				let minX = Number.MAX_VALUE,
					maxX = -Number.MAX_VALUE;
				let minY = Number.MAX_VALUE,
					maxY = -Number.MAX_VALUE;
				let minZ = Number.MAX_VALUE,
					maxZ = -Number.MAX_VALUE;

				for (const pt of cornersWorld) {
					const ptLight = transformPoint(viewMat, pt);
					minX = Math.min(minX, ptLight.x);
					maxX = Math.max(maxX, ptLight.x);
					minY = Math.min(minY, ptLight.y);
					maxY = Math.max(maxY, ptLight.y);
					minZ = Math.min(minZ, ptLight.z);
					maxZ = Math.max(maxZ, ptLight.z);
				}

				// Make orthographic bounds square and stabilized based on radius
				const extX = maxX - minX;
				const extY = maxY - minY;
				const size = Math.max(extX, extY);
				const halfSize = size * 0.5;
				const centerX = (minX + maxX) * 0.5;
				const centerY = (minY + maxY) * 0.5;

				let left = centerX - halfSize;
				let right = centerX + halfSize;
				let bottom = centerY - halfSize;
				let top = centerY + halfSize;

				// Snapping texels to eliminate crawling artifacts
				const texelSize = size / this.textureSize;
				left = Math.round(left / texelSize) * texelSize;
				right = Math.round(right / texelSize) * texelSize;
				bottom = Math.round(bottom / texelSize) * texelSize;
				top = Math.round(top / texelSize) * texelSize;

				// zNear (closest to light) must be maxZ (with a backoff towards the light eye)
				// zFar (furthest from light) must be minZ (with a backoff away from the light eye)
				const zNear = maxZ + 100.0;
				const zFar = minZ - 100.0;

				const projMat = orthoWebGPU(left, right, bottom, top, zNear, zFar);
				const cascadeMatrix = projMat.multiply(viewMat);
				cascadeMatrices.push(cascadeMatrix);

				// Write this cascade viewProj to the offset buffer
				this.ctx.device.queue.writeBuffer(
					this.cascadeUniformBuffer!,
					i * 256,
					cascadeMatrix.values as any,
				);
			}

			// 3. Write dynamic parameters to uniformBuffer (320 bytes)
			const csmData = new Float32Array(80); // 320 bytes / 4 bytes = 80 slots
			// viewProjs: array<mat4x4<f32>, 4> -> slots 0 to 63
			for (let i = 0; i < cascadeCount; i++) {
				csmData.set(cascadeMatrices[i].values, i * 16);
			}
			// splits: vec4<f32> -> slots 64 to 67
			csmData[64] = splits[1];
			csmData[65] = splits[2];
			csmData[66] = splits[3];
			csmData[67] = splits[4];
			// cameraForward: vec4<f32> -> slots 68 to 71
			csmData[68] = cameraForward.x;
			csmData[69] = cameraForward.y;
			csmData[70] = cameraForward.z;
			csmData[71] = 0.0;
			// texelSize, hasShadow, lightDirX, lightDirY -> slots 72 to 75
			csmData[72] = 1.0 / this.textureSize;
			csmData[73] = 2.0; // active CSM shadow casting = 2.0
			csmData[74] = lightDir.x;
			csmData[75] = lightDir.y;
			// lightDirZ, bias, cascadeCount, _pad2 -> slots 76 to 79
			csmData[76] = lightDir.z;
			csmData[77] = config.shadowBias;
			csmData[78] = cascadeCount;
			csmData[79] = 0.0;

			this.ctx.device.queue.writeBuffer(this.uniformBuffer, 0, csmData);

			// 4. Propagate PCF variant
			this.propagateVariant(meshes, config.usePCF);

			// 5. Draw the scene once for each cascade layer
			for (let i = 0; i < cascadeCount; i++) {
				const passEncoder = commandEncoder.beginRenderPass({
					colorAttachments: [],
					depthStencilAttachment: {
						view: this.cascadeViews[i],
						depthClearValue: 1.0,
						depthLoadOp: "clear",
						depthStoreOp: "store",
					},
				});

				passEncoder.setPipeline(this.ctx.pipelineManager.getShadowPipeline());
				passEncoder.setBindGroup(0, this.cascadeBindGroups[i]);

				for (const [batchKey, batchMeshes] of batchGroups) {
					if (batchMeshes.length === 0) continue;
					const representative = batchMeshes[0];
					const batch = instanceBatches.get(batchKey);
					if (batch) {
						passEncoder.setBindGroup(1, batch.bindGroup);
						passEncoder.setVertexBuffer(
							0,
							representative.geometry.vertexBuffer,
						);
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
			}
			return true;
		}

		// Fallback to standard directional/spot shadows
		const shadowRadius = config.shadowRadius;
		const shadowDepthRange = config.shadowDepthRange;

		// Direction via getLightData (avoids instanceof)
		const d = shadowCaster.getLightData();
		const isSpot = d.typeFlag > 3.5;
		const lightDir = isSpot
			? new Vec3(d.dirX!, d.dirY!, d.dirZ!).normalize()
			: new Vec3(d.x, d.y, d.z).normalize();

		let viewMat: Mat4;
		let projMat: Mat4;

		if (isSpot) {
			const lightPos = new Vec3(d.x, d.y, d.z);
			const target = lightPos.clone().add(lightDir);

			let worldUp = new Vec3(0, 1, 0);
			if (Math.abs(lightDir.dot(worldUp)) > 0.99) {
				worldUp = new Vec3(0, 0, 1);
			}

			viewMat = new Mat4().lookAt(lightPos, target, worldUp);

			const fovY = (shadowRadius * 2.0 * Math.PI) / 180.0;
			projMat = new Mat4().perspective(
				fovY,
				1.0,
				config.shadowNear ?? 0.1,
				shadowDepthRange,
			);
		} else {
			const center = camera.target.clone();

			let worldUp = new Vec3(0, 1, 0);
			if (Math.abs(lightDir.dot(worldUp)) > 0.99) {
				worldUp = new Vec3(0, 0, 1);
			}
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

			viewMat = new Mat4().lookAt(shadowEye, snappedCenter, new Vec3(0, 1, 0));
			// Standard shadows: pass -near and -far to match eye-space positive mapping
			projMat = orthoWebGPU(
				-shadowRadius,
				shadowRadius,
				-shadowRadius,
				shadowRadius,
				-0.1,
				-shadowDepthRange,
			);
		}

		this.matrix = projMat.multiply(viewMat);
		this.ctx.device.queue.writeBuffer(
			this.uniformBuffer,
			0,
			this.matrix.values as any,
		);

		const shadowParams = new Float32Array([
			1.0 / this.textureSize, // texelSize
			1.0, // hasShadow = 1.0 (active)
			lightDir.x,
			lightDir.y,
			lightDir.z,
			config.shadowBias, // bias
			0.0,
			0.0,
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

	/**
	 * Releases shadow depth maps and uniform buffer allocations from GPU memory.
	 */
	public destroy(): void {
		if (this.texture) {
			this.ctx.vramTracker.unregister(this.texture);
			this.texture.destroy();
			// @ts-expect-error - allow cleanup reference assignment
			this.texture = null;
		}
		if (this.uniformBuffer) {
			this.ctx.vramTracker.unregister(this.uniformBuffer);
			this.uniformBuffer.destroy();
			// @ts-expect-error - allow cleanup reference assignment
			this.uniformBuffer = null;
		}
		if (this.cascadeUniformBuffer) {
			this.cascadeUniformBuffer.destroy();
			this.cascadeUniformBuffer = null;
		}
		this.cascadeViews = [];
		this.cascadeBindGroups = [];
		// @ts-expect-error - allow cleanup reference assignment
		this.sampler = null;
		// @ts-expect-error - allow cleanup reference assignment
		this.bindGroup = null;
	}
}
