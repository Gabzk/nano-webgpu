import { CollisionShape } from "../core/collision-shape";
import type { Context } from "../core/context";
import { Node3D } from "../core/node3d";
import { AABB } from "../math/aabb";
import { Vec3 } from "../math/vec3";
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

export class Mesh extends Node3D {
	public ctx: Context;
	public geometry: Geometry;
	public material: Material;

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
			position?: number[];
			scale?: number | number[];
			rotation?: number[];
			rotationDegrees?: number[];
		},
	) {
		if (options.position) mesh.position.copy(Vec3.from(options.position));
		if (options.scale !== undefined) {
			if (typeof options.scale === "number")
				mesh.scale.set(options.scale, options.scale, options.scale);
			else mesh.scale.copy(Vec3.from(options.scale as number[]));
		}
		if (options.rotation)
			mesh.rotation.copy(Vec3.from(options.rotation as number[]));
		if (options.rotationDegrees)
			mesh.rotationDegrees = options.rotationDegrees as Vec3 | number[];
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
