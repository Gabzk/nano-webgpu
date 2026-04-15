import type { Context } from "../core/context";
import { Node3D } from "../core/node3d";
import type { Geometry } from "./geometry";
import { Material } from "./materials/material";
import { StandardMaterial } from "./materials/standard-material";
import { Texture } from "./texture";

export class Mesh extends Node3D {
	public ctx: Context;
	public geometry: Geometry;
	public material: Material;

	constructor(
		ctx: Context,
		options: {
			geometry: Geometry;
			texture?: string | Texture;
			material?: Material;
		},
	) {
		super();
		this.ctx = ctx;
		this.geometry = options.geometry;

		if (options.material) {
			if (options.material instanceof Material) {
				this.material = options.material;
			} else {
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
}
