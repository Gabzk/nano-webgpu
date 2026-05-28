import type { Context } from "../core/context";
import type { Geometry } from "./geometry";
import {
	createArrowGeometry,
	createConeGeometry,
	createCubeGeometry,
	createPlaneGeometry,
	createSphereGeometry,
} from "./primitives";

/**
 * PrimitivesFactory manages a per-context lazy-loaded cache of standard geometric shapes.
 * Promotes high-performance vertex/index buffer resource sharing and avoids redundant GPU allocations.
 *
 * @group Graphics
 */
export class PrimitivesFactory {
	/** @internal Cached cube geometry block. */
	private _cube: Geometry | null = null;
	/** @internal Cached plane geometry block. */
	private _plane: Geometry | null = null;
	/** @internal Cached sphere geometry block. */
	private _sphere: Geometry | null = null;
	/** @internal Cached cone geometry block. */
	private _cone: Geometry | null = null;
	/** @internal Cached arrow geometry block. */
	private _arrow: Geometry | null = null;

	/**
	 * Returns the shared unit cube geometry, instantiating it on the very first call.
	 *
	 * @param ctx - Active context.
	 * @param size - Sizing dimension. Only applied if the cube is first instantiated here. Defaults to `1.0`.
	 * @returns The cached or newly allocated Cube Geometry.
	 */
	public getCube(ctx: Context, size = 1.0): Geometry {
		if (!this._cube) {
			this._cube = createCubeGeometry(ctx, size);
		}
		return this._cube;
	}

	/**
	 * Returns the shared unit plane geometry, instantiating it on the very first call.
	 *
	 * @param ctx - Active context.
	 * @param width - Span width along the X axis. Defaults to `1.0`.
	 * @param height - Span depth along the Z axis. Defaults to `1.0`.
	 * @returns The cached or newly allocated Plane Geometry.
	 */
	public getPlane(ctx: Context, width = 1.0, height = 1.0): Geometry {
		if (!this._plane) {
			this._plane = createPlaneGeometry(ctx, width, height);
		}
		return this._plane;
	}

	/**
	 * Returns the shared sphere geometry, instantiating it on the very first call.
	 *
	 * @param ctx - Active context.
	 * @param radius - Radial size of the sphere. Defaults to `1.0`.
	 * @param widthSegments - Horizontal subdivision segments. Defaults to `16`.
	 * @param heightSegments - Vertical subdivision segments. Defaults to `16`.
	 * @returns The cached or newly allocated Sphere Geometry.
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

	/**
	 * Returns the shared cone geometry, instantiating it on the very first call.
	 *
	 * @param ctx - Active context.
	 * @param radialSegments - Subdivision segments around base. Defaults to `16`.
	 * @returns The cached or newly allocated Cone Geometry.
	 */
	public getCone(ctx: Context, radialSegments = 16): Geometry {
		if (!this._cone) {
			this._cone = createConeGeometry(ctx, radialSegments);
		}
		return this._cone;
	}

	/**
	 * Returns the shared arrow geometry, instantiating it on the very first call.
	 *
	 * @param ctx - Active context.
	 * @param radialSegments - Subdivision segments. Defaults to `8`.
	 * @returns The cached or newly allocated Arrow Geometry.
	 */
	public getArrow(ctx: Context, radialSegments = 8): Geometry {
		if (!this._arrow) {
			this._arrow = createArrowGeometry(ctx, radialSegments);
		}
		return this._arrow;
	}

	/**
	 * Releases all cached primitive geometries from GPU memory and unregisters them from the VRAM tracker.
	 *
	 * @param ctx - Active context.
	 */
	public destroy(ctx: Context): void {
		if (this._cube) {
			this._cube.destroy(ctx);
			this._cube = null;
		}
		if (this._plane) {
			this._plane.destroy(ctx);
			this._plane = null;
		}
		if (this._sphere) {
			this._sphere.destroy(ctx);
			this._sphere = null;
		}
		if (this._cone) {
			this._cone.destroy(ctx);
			this._cone = null;
		}
		if (this._arrow) {
			this._arrow.destroy(ctx);
			this._arrow = null;
		}
	}
}
