import { AABB } from "../math/aabb";
import { Vec3 } from "../math/vec3";

/**
 * Supported types of collision shapes for spatial bounding representation.
 * - `"box"`: An axis-aligned rectangular cuboid.
 * - `"sphere"`: A spherical bounding volume.
 *
 * @group Input & Physics
 */
export type ShapeType = "box" | "sphere";

/**
 * CollisionShape represents a bounding volume used for basic collision queries and overlap checks.
 * Centered locally around its parent Node3D's origin, it provides local-space AABB bounds that
 * are transformed into world-space when resolving intersections.
 *
 * @group Input & Physics
 */
export class CollisionShape {
	/** The specific bounding geometry type represented by this shape. */
	public type: ShapeType;

	/**
	 * Bounding half-extents (dimensions divided by two) along local X, Y, and Z axes.
	 * Primarily utilized when shape type is `"box"`.
	 */
	public halfExtents: Vec3;

	/**
	 * Radius of the bounding sphere.
	 * Primarily utilized when shape type is `"sphere"`.
	 */
	public radius: number;

	/** @internal Cached local-space AABB. */
	private _localAABB: AABB | null = null;

	/**
	 * Internal constructor to initialize a CollisionShape with given attributes.
	 * Use static factory methods `.box()` or `.sphere()` to instantiate.
	 *
	 * @param type - Bounding shape type.
	 * @param halfExtents - Initial half-extents vector.
	 * @param radius - Initial radius factor.
	 */
	private constructor(type: ShapeType, halfExtents: Vec3, radius: number) {
		this.type = type;
		this.halfExtents = halfExtents;
		this.radius = radius;
		this.halfExtents.onChange = () => {
			this._localAABB = null;
		};
	}

	/**
	 * Factory method to instantiate a box-shaped bounding volume.
	 *
	 * @param size - Full dimension size. Can be a single scalar for cubes or a Vec3 specifying width, height, and depth.
	 * @returns A newly created box CollisionShape.
	 */
	public static box(size: Vec3 | number = 1.0): CollisionShape {
		let he: Vec3;
		if (typeof size === "number") {
			he = new Vec3(size * 0.5, size * 0.5, size * 0.5);
		} else {
			he = new Vec3(size.x * 0.5, size.y * 0.5, size.z * 0.5);
		}
		return new CollisionShape("box", he, 0);
	}

	/**
	 * Factory method to instantiate a sphere-shaped bounding volume.
	 *
	 * @param radius - Radius dimension of the bounding sphere.
	 * @returns A newly created sphere CollisionShape.
	 */
	public static sphere(radius: number = 0.5): CollisionShape {
		return new CollisionShape(
			"sphere",
			new Vec3(radius, radius, radius),
			radius,
		);
	}

	/**
	 * Computes the local axis-aligned bounding box (AABB) centered at origin (0, 0, 0) for this shape,
	 * before any spatial node transformations are applied.
	 *
	 * @returns The calculated local-space AABB.
	 */
	public getLocalAABB(): AABB {
		if (!this._localAABB) {
			const he = this.halfExtents;
			this._localAABB = AABB.fromCenterHalfExtents(new Vec3(0, 0, 0), he);
		}
		return this._localAABB;
	}
}
