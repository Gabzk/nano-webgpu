import { CollisionShape } from "../core/collision-shape";
import type { Context } from "../core/context";
import { Loader } from "../core/loader";
import { Node3D } from "../core/node3d";
import { AABB } from "../math/aabb";
import { Vec3 } from "../math/vec3";
import { Geometry } from "./geometry";
import { Material } from "./materials/material";
import { StandardMaterial, type StandardMaterialOptions } from "./materials/standard-material";
import {
	createCubeGeometry,
	createPlaneGeometry,
	createSphereGeometry,
} from "./primitives";
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

	constructor(
		ctx: Context,
		options: MeshOptions,
	) {
		super();
		this.ctx = ctx;
		this.geometry = options.geometry;

		if (options.material) {
			if (options.material instanceof Material) {
				this.material = options.material;
			} else {
				// biome-ignore lint/suspicious/noExplicitAny: disable rule for now
				this.material = new StandardMaterial(options.material as any);
			}
		} else if (options.texture) {
			// Legacy shorthand approach: convert texture automatically to Standard Material
			let tex: Texture;
			if (typeof options.texture === "string") {
				tex = Texture.loadBackground(ctx, options.texture);
			} else {
				tex = options.texture;
			}
			this.material = new StandardMaterial({ albedoTexture: tex });
		} else {
			// Default material
			this.material = new StandardMaterial();
		}

		// Note: GPU buffers for model matrices are now managed by Scene's
		// instanced batching system (Storage Buffer per batch group).
	}

	/**
	 * Removes the mesh from its parent (and consequently from the scene)
	 * and optionally frees its geometry. Similar to Godot's queue_free().
	 * @param destroyGeometry Should we also destroy the shared geometry? Defaults to false to avoid accidentally breaking instanced copies.
	 */
	public destroy(destroyGeometry: boolean = false): void {
		// 1. Remove from Scene Graph
		if (this.parent) {
			this.parent.remove(this);
		}

		// 2. Optionally destroy the geometry (e.g., if this was uniquely created for this object)
		if (destroyGeometry && this.geometry) {
			this.geometry.destroy();
		}
	}

	// --- Static Helpers ---
	/**
	 * Applies transform options to a mesh.
	 */
	public static applyTransformOptions(mesh: Mesh, options: {
		position?: number[];
		scale?: number | number[];
		rotation?: number[];
		rotationDegrees?: number[];
	}) {
		if (options.position) mesh.position.copy(Vec3.from(options.position));
		if (options.scale !== undefined) {
			if (typeof options.scale === "number")
				mesh.scale.set(options.scale, options.scale, options.scale);
			else mesh.scale.copy(Vec3.from(options.scale as number[]));
		}
		if (options.rotation) mesh.rotation.copy(Vec3.from(options.rotation as number[]));
		if (options.rotationDegrees) mesh.rotationDegrees = options.rotationDegrees as any;
	}

	// --- Static Factory Methods ---

	/**
	 * Creates a cube mesh.
	 */
	public static createCube(ctx: Context, options: StandardMaterialOptions & { size?: number } = {}): Mesh {
		if (!ctx.defaultGeometries.cube) {
			ctx.defaultGeometries.cube = createCubeGeometry(ctx, options.size || 1.0);
		}
		const meshOptions: any = { ...options, geometry: ctx.defaultGeometries.cube };
		const mesh = new Mesh(ctx, meshOptions);
		Mesh.applyTransformOptions(mesh, options as any);
		mesh.collisionShape = CollisionShape.box(options.size || 1.0);
		return mesh;
	}

	// biome-ignore lint/suspicious/noExplicitAny: disable rule for now
	public static createPlane(ctx: Context, options: any): Mesh {
		if (!ctx.defaultGeometries.plane) {
			ctx.defaultGeometries.plane = createPlaneGeometry(
				ctx,
				options.width || 1.0,
				options.height || 1.0,
			);
		}
		options.geometry = ctx.defaultGeometries.plane;
		const mesh = new Mesh(ctx, options);
		Mesh.applyTransformOptions(mesh, options);
		return mesh;
	}

	// biome-ignore lint/suspicious/noExplicitAny: disable rule for now
	public static createSphere(ctx: Context, options: any): Mesh {
		if (!ctx.defaultGeometries.sphere) {
			ctx.defaultGeometries.sphere = createSphereGeometry(
				ctx,
				options.radius || 1.0,
				options.segments || 16,
				options.segments || 16,
			);
		}
		options.geometry = ctx.defaultGeometries.sphere;
		const mesh = new Mesh(ctx, options);
		Mesh.applyTransformOptions(mesh, options);
		mesh.collisionShape = CollisionShape.sphere(options.radius || 1.0);
		return mesh;
	}

	public static async load(
		ctx: Context,
		url: string,
		// biome-ignore lint/suspicious/noExplicitAny: disable rule for now
		options: any,
	): Promise<Mesh> {
		const loader = new Loader(ctx.device);
		const modelData = await loader.loadModel(url);
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
