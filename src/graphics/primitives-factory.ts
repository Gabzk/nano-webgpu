import type { Context } from "../core/context";
import type { Geometry } from "./geometry";
import {
	createCubeGeometry,
	createPlaneGeometry,
	createSphereGeometry,
} from "./primitives";

/**
 * Per-context cache for built-in primitive geometries (cube, plane, sphere).
 * Replaces the loosely-typed `ctx.defaultGeometries: { cube?: unknown }` pattern.
 * Stored on Context as `ctx.primitives`.
 */
export class PrimitivesFactory {
	private _cube: Geometry | null = null;
	private _plane: Geometry | null = null;
	private _sphere: Geometry | null = null;

	/**
	 * Returns the shared unit cube geometry, creating it once per context.
	 * @param size - Only used on the very first call; subsequent calls return the cached geometry.
	 */
	public getCube(ctx: Context, size = 1.0): Geometry {
		if (!this._cube) {
			this._cube = createCubeGeometry(ctx, size);
		}
		return this._cube;
	}

	/**
	 * Returns the shared unit plane geometry, creating it once per context.
	 */
	public getPlane(ctx: Context, width = 1.0, height = 1.0): Geometry {
		if (!this._plane) {
			this._plane = createPlaneGeometry(ctx, width, height);
		}
		return this._plane;
	}

	/**
	 * Returns the shared unit sphere geometry, creating it once per context.
	 */
	public getSphere(
		ctx: Context,
		radius = 1.0,
		widthSegments = 16,
		heightSegments = 16,
	): Geometry {
		if (!this._sphere) {
			this._sphere = createSphereGeometry(
				ctx,
				radius,
				widthSegments,
				heightSegments,
			);
		}
		return this._sphere;
	}
}
