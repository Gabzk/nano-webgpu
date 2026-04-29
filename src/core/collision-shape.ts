import { AABB } from "../math/aabb";
import { Vec3 } from "../math/vec3";

/**
 * @module CollisionShape
 
 * Defines the collision shape associated with a Node3D.
 * Inspired by Godot's CollisionShape3D node — here simplified as a plain data class
 * that is set on the Node3D directly instead of being a child node.
 */
export type ShapeType = "box" | "sphere";

export class CollisionShape {
	public type: ShapeType;

	/**
	 * For "box": half-extents on each axis.
	 * A cube of size 1 has half-extents (0.5, 0.5, 0.5).
	 */
	public halfExtents: Vec3;

	/**
	 * For "sphere": the radius.
	 */
	public radius: number;

	private constructor(type: ShapeType, halfExtents: Vec3, radius: number) {
		this.type = type;
		this.halfExtents = halfExtents;
		this.radius = radius;
	}

	/**
	 * Creates a box collision shape from a size (full extent) or a Vec3 of sizes.
	 * @param size - Full size on each axis. Can be a number (cube) or Vec3.
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
	 * Creates a sphere collision shape.
	 * @param radius - The radius of the sphere.
	 */
	public static sphere(radius: number = 0.5): CollisionShape {
		return new CollisionShape(
			"sphere",
			new Vec3(radius, radius, radius),
			radius,
		);
	}

	/**
	 * Computes this shape's local-space AABB (centered at origin, before any transform).
	 * The AABB for a sphere is the bounding cube that wraps it.
	 */
	public getLocalAABB(): AABB {
		const he = this.halfExtents;
		return AABB.fromCenterHalfExtents(new Vec3(0, 0, 0), he);
	}
}
