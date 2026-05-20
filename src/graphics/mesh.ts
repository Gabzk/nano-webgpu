import { CollisionShape } from "../core/collision-shape";
import type { Context } from "../core/context";
import { Node3D } from "../core/node3d";
import { AABB } from "../math/aabb";
import { Vec3 } from "../math/vec3";
import type { CullMode } from "./cull-mode";
import { Geometry } from "./geometry";
import { Material } from "./materials/material";
import {
	StandardMaterial,
	type StandardMaterialOptions,
} from "./materials/standard-material";
import { Texture } from "./texture";

export interface MeshOptions {
	geometry: Geometry;
	texture?: string | Texture;
	material?: Material | StandardMaterialOptions;
	position?: number[];
	rotation?: number[];
	scale?: number | number[];
}

export interface BuildMeshOptions {
	vertexFormat: string[];
	vertexBuffer: number[];
	indices?: number[];
	topology?: GPUPrimitiveTopology;
	/** Override face culling. Defaults to "back" for triangle-list, "none"/"disabled" for everything else. */
	cullMode?: CullMode;
	material?: Material;
	position?: number[] | Vec3;
	rotation?: number[] | Vec3;
	rotationDegrees?: number[] | Vec3;
	scale?: number | number[];
	addToScene?: boolean;
}

export class Mesh extends Node3D {
	public ctx: Context;
	public geometry: Geometry;
	public material: Material;

	public static readonly FORMAT_SIZES: Record<string, number> = {
		position: 3,
		normal: 3,
		uv: 2,
		color: 3,
		tangent: 4,
	};

	/**
	 * Build a mesh from raw vertex data.
	 * Inspired by OpenGL's immediate mode but using modern buffer-based approach.
	 */
	public static build(ctx: Context, config: BuildMeshOptions): Mesh {
		const {
			vertexFormat,
			vertexBuffer,
			indices,
			topology = "triangle-list",
			cullMode,
			material,
			addToScene = true,
			...transformOptions
		} = config;

		// Calculate stride from format
		let stride = 0;

		for (const attr of vertexFormat) {
			const size = Mesh.FORMAT_SIZES[attr];
			if (!size) {
				throw new Error(
					`buildMesh: Unknown vertex attribute "${attr}". Valid: ${Object.keys(Mesh.FORMAT_SIZES).join(", ")}`,
				);
			}
			stride += size;
		}

		const vertexCount = Math.floor(vertexBuffer.length / stride);
		if (vertexCount * stride !== vertexBuffer.length) {
			throw new Error(
				`buildMesh: vertexBuffer length (${vertexBuffer.length}) is not evenly divisible by stride (${stride}). Check your vertexFormat.`,
			);
		}

		// Our standard pipeline expects: position(3) + normal(3) + uv(2) + color(3) = 11 floats per vertex.
		// We need to remap whatever the user gave us into that format.
		const pipelineStride = 11; // pos(3) + normal(3) + uv(2) + color(3)
		const remappedVertices = new Float32Array(vertexCount * pipelineStride);
		let hasColors = false;

		for (let v = 0; v < vertexCount; v++) {
			const srcOffset = v * stride;
			const dstOffset = v * pipelineStride;

			let cursor = 0;
			let pos = [0, 0, 0];
			let norm = [0, 0, 1]; // Default normal: facing camera
			let uv = [0, 0];
			let col = [1.0, 1.0, 1.0]; // Default color: white

			for (const attr of vertexFormat) {
				const attrSize = Mesh.FORMAT_SIZES[attr];
				if (attr === "position") {
					pos = [
						vertexBuffer[srcOffset + cursor],
						vertexBuffer[srcOffset + cursor + 1],
						vertexBuffer[srcOffset + cursor + 2],
					];
				} else if (attr === "normal") {
					norm = [
						vertexBuffer[srcOffset + cursor],
						vertexBuffer[srcOffset + cursor + 1],
						vertexBuffer[srcOffset + cursor + 2],
					];
				} else if (attr === "uv") {
					uv = [
						vertexBuffer[srcOffset + cursor],
						vertexBuffer[srcOffset + cursor + 1],
					];
				} else if (attr === "color") {
					hasColors = true;
					col = [
						vertexBuffer[srcOffset + cursor],
						vertexBuffer[srcOffset + cursor + 1],
						vertexBuffer[srcOffset + cursor + 2],
					];
				}
				cursor += attrSize;
			}

			// Write in pipeline order: position, normal, uv, color
			remappedVertices[dstOffset + 0] = pos[0];
			remappedVertices[dstOffset + 1] = pos[1];
			remappedVertices[dstOffset + 2] = pos[2];
			remappedVertices[dstOffset + 3] = norm[0];
			remappedVertices[dstOffset + 4] = norm[1];
			remappedVertices[dstOffset + 5] = norm[2];
			remappedVertices[dstOffset + 6] = uv[0];
			remappedVertices[dstOffset + 7] = uv[1];
			remappedVertices[dstOffset + 8] = col[0];
			remappedVertices[dstOffset + 9] = col[1];
			remappedVertices[dstOffset + 10] = col[2];
		}

		// Generate indices if not provided
		let indexArray: Uint16Array | Uint32Array;
		if (indices) {
			indexArray =
				vertexCount > 65535
					? new Uint32Array(indices)
					: new Uint16Array(indices);
		} else {
			const autoIndices = Array.from({ length: vertexCount }, (_, i) => i);
			indexArray =
				vertexCount > 65535
					? new Uint32Array(autoIndices)
					: new Uint16Array(autoIndices);
		}

		// Create Geometry
		const geometry = new Geometry(ctx, remappedVertices, indexArray, {
			hasNormals: true,
			hasUVs: true,
			hasColors: hasColors,
			topology,
			cullMode,
		});

		// Resolve material
		const finalMaterial =
			material instanceof Material ? material : new StandardMaterial();

		// Create Mesh
		const mesh = new Mesh(ctx, { geometry, material: finalMaterial });
		Mesh.applyTransformOptions(mesh, transformOptions);

		return mesh;
	}

	constructor(ctx: Context, options: MeshOptions) {
		super();
		this.ctx = ctx;
		this.geometry = options.geometry;

		if (options.material) {
			if (options.material instanceof Material) {
				this.material = options.material;
			} else {
				this.material = new StandardMaterial(
					options.material as StandardMaterialOptions,
				);
			}
		} else if (options.texture) {
			// Legacy shorthand: convert texture automatically to StandardMaterial
			let tex: Texture;
			if (typeof options.texture === "string") {
				tex = Texture.loadBackground(ctx, options.texture);
			} else {
				tex = options.texture;
			}
			this.material = new StandardMaterial({ albedoTexture: tex });
		} else {
			this.material = new StandardMaterial();
		}
	}

	/**
	 * Removes the mesh from its parent (and consequently from the scene)
	 * and optionally frees its geometry. Similar to Godot's queue_free().
	 * @param destroyGeometry Should we also destroy the shared geometry? Defaults to false
	 *   to avoid accidentally breaking instanced copies.
	 */
	public destroy(destroyGeometry: boolean = false): void {
		if (this.parent) {
			this.parent.remove(this);
		}
		if (destroyGeometry && this.geometry) {
			this.geometry.destroy(this.ctx);
		}
	}

	// --- Static Helpers ---
	/**
	 * Applies transform options to a mesh.
	 */
	public static applyTransformOptions(
		mesh: Mesh,
		options: {
			position?: number[] | Vec3;
			scale?: number | number[];
			rotation?: number[] | Vec3;
			rotationDegrees?: number[] | Vec3;
		},
	) {
		if (options.position) {
			if (options.position instanceof Vec3) {
				mesh.position.copy(options.position);
			} else {
				mesh.position.copy(Vec3.from(options.position));
			}
		}
		if (options.scale !== undefined) {
			if (typeof options.scale === "number") {
				mesh.scale.set(options.scale, options.scale, options.scale);
			} else {
				mesh.scale.copy(Vec3.from(options.scale as number[]));
			}
		}
		if (options.rotation) {
			if (options.rotation instanceof Vec3) {
				mesh.rotation.copy(options.rotation);
			} else {
				mesh.rotation.copy(Vec3.from(options.rotation));
			}
		}
		if (options.rotationDegrees) {
			mesh.rotationDegrees = options.rotationDegrees;
		}
	}

	// --- Static Factory Methods ---

	/**
	 * Creates a cube mesh.
	 * Uses ctx.primitives for a typed, per-context geometry cache.
	 */
	public static createCube(
		ctx: Context,
		options: StandardMaterialOptions & {
			size?: number;
			position?: number[];
			rotation?: number[];
			rotationDegrees?: number[];
			scale?: number | number[];
		} = {},
	): Mesh {
		const geometry = ctx.primitives.getCube(ctx, options.size || 1.0);
		const mesh = new Mesh(ctx, { ...options, geometry } as MeshOptions);
		Mesh.applyTransformOptions(mesh, options);
		mesh.collisionShape = CollisionShape.box(options.size || 1.0);
		return mesh;
	}

	public static createPlane(
		ctx: Context,
		options: StandardMaterialOptions & {
			width?: number;
			height?: number;
			position?: number[];
			rotation?: number[];
			rotationDegrees?: number[];
			scale?: number | number[];
		} = {},
	): Mesh {
		const geometry = ctx.primitives.getPlane(
			ctx,
			options.width || 1.0,
			options.height || 1.0,
		);
		const mesh = new Mesh(ctx, { ...options, geometry } as MeshOptions);
		Mesh.applyTransformOptions(mesh, options);
		return mesh;
	}

	public static createSphere(
		ctx: Context,
		options: StandardMaterialOptions & {
			radius?: number;
			segments?: number;
			position?: number[];
			rotation?: number[];
			rotationDegrees?: number[];
			scale?: number | number[];
		} = {},
	): Mesh {
		const geometry = ctx.primitives.getSphere(
			ctx,
			options.radius || 1.0,
			options.segments || 16,
			options.segments || 16,
		);
		const mesh = new Mesh(ctx, { ...options, geometry } as MeshOptions);
		Mesh.applyTransformOptions(mesh, options);
		mesh.collisionShape = CollisionShape.sphere(options.radius || 1.0);
		return mesh;
	}

	public static async load(
		ctx: Context,
		url: string,
		// biome-ignore lint/suspicious/noExplicitAny: options are passed through to StandardMaterial
		options: any,
	): Promise<Mesh> {
		const modelData = await ctx.loader.loadModel(url);
		const vertexCount = modelData.vertices.length / 8;
		const optimalIndicesArray =
			vertexCount > 65535
				? new Uint32Array(modelData.indices)
				: new Uint16Array(modelData.indices);
		const geometry = new Geometry(
			ctx,
			new Float32Array(modelData.vertices),
			optimalIndicesArray,
			{ hasUVs: true, hasNormals: true },
		);

		const finalOptions = { ...options };
		if (!finalOptions.material && modelData.materialOptions) {
			finalOptions.material = modelData.materialOptions;
		}

		const mesh = new Mesh(ctx, { geometry, ...finalOptions });
		Mesh.applyTransformOptions(mesh, finalOptions);

		const localAABB = AABB.fromVertices(modelData.vertices, 8);
		const halfExtents = localAABB.getHalfExtents();
		mesh.collisionShape = CollisionShape.box(
			new Vec3(halfExtents.x * 2, halfExtents.y * 2, halfExtents.z * 2),
		);
		return mesh;
	}
}
