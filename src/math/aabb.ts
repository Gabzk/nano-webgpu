/**
 * @module AABB
 * Axis-Aligned Bounding Box used for broad-phase collision detection.
 */

import type { Mat4 } from "./mat4";
import { Vec3 } from "./vec3";

/**
 * Axis-Aligned Bounding Box used for broad-phase collision detection.
 * This is a pure math struct with no dependencies on the GPU or scene graph.
 *
 * @group Math
 */
export class AABB {
	/** Minimum corner of the box (left, bottom, back) */
	public min: Vec3;
	/** Maximum corner of the box (right, top, front) */
	public max: Vec3;

	constructor(
		min: Vec3 = new Vec3(Infinity, Infinity, Infinity),
		max: Vec3 = new Vec3(-Infinity, -Infinity, -Infinity),
	) {
		this.min = min.clone();
		this.max = max.clone();
	}

	/**
	 * Creates an AABB from a center point and a half-extents size.
	 * @param center - The center of the box
	 * @param halfExtents - The half-size on each axis
	 */
	public static fromCenterHalfExtents(center: Vec3, halfExtents: Vec3): AABB {
		return new AABB(
			new Vec3(
				center.x - halfExtents.x,
				center.y - halfExtents.y,
				center.z - halfExtents.z,
			),
			new Vec3(
				center.x + halfExtents.x,
				center.y + halfExtents.y,
				center.z + halfExtents.z,
			),
		);
	}

	/**
	 * Computes an AABB from a raw interleaved vertex buffer.
	 * Stride must be at least 3 (x, y, z) for positions at the beginning of each vertex.
	 * @param vertices - Flat array of vertex data (position first)
	 * @param stride - Number of floats per vertex (e.g. 8 for pos+norm+uv)
	 */
	public static fromVertices(
		vertices: number[] | Float32Array,
		stride: number = 8,
	): AABB {
		const aabb = new AABB();
		for (let i = 0; i < vertices.length; i += stride) {
			const x = vertices[i];
			const y = vertices[i + 1];
			const z = vertices[i + 2];
			if (x < aabb.min.x) aabb.min.x = x;
			if (y < aabb.min.y) aabb.min.y = y;
			if (z < aabb.min.z) aabb.min.z = z;
			if (x > aabb.max.x) aabb.max.x = x;
			if (y > aabb.max.y) aabb.max.y = y;
			if (z > aabb.max.z) aabb.max.z = z;
		}
		return aabb;
	}

	/**
	 * Returns the center of the AABB.
	 */
	public getCenter(): Vec3 {
		return new Vec3(
			(this.min.x + this.max.x) * 0.5,
			(this.min.y + this.max.y) * 0.5,
			(this.min.z + this.max.z) * 0.5,
		);
	}

	/**
	 * Returns the size (full extent) of the AABB on each axis.
	 */
	public getSize(): Vec3 {
		return new Vec3(
			this.max.x - this.min.x,
			this.max.y - this.min.y,
			this.max.z - this.min.z,
		);
	}

	/**
	 * Returns the half-extents of the AABB on each axis.
	 */
	public getHalfExtents(): Vec3 {
		return new Vec3(
			(this.max.x - this.min.x) * 0.5,
			(this.max.y - this.min.y) * 0.5,
			(this.max.z - this.min.z) * 0.5,
		);
	}

	/**
	 * Checks if this AABB overlaps with another AABB.
	 * Uses the standard Axis-Aligned Bounding Box intersection algorithm.
	 */
	public intersects(other: AABB): boolean {
		return (
			this.min.x <= other.max.x &&
			this.max.x >= other.min.x &&
			this.min.y <= other.max.y &&
			this.max.y >= other.min.y &&
			this.min.z <= other.max.z &&
			this.max.z >= other.min.z
		);
	}

	/**
	 * Checks if a point is inside this AABB.
	 */
	public containsPoint(point: Vec3): boolean {
		return (
			point.x >= this.min.x &&
			point.x <= this.max.x &&
			point.y >= this.min.y &&
			point.y <= this.max.y &&
			point.z >= this.min.z &&
			point.z <= this.max.z
		);
	}

	/**
	 * Expands this AABB to include the given point (in-place).
	 */
	public expand(point: Vec3): this {
		if (point.x < this.min.x) this.min.x = point.x;
		if (point.y < this.min.y) this.min.y = point.y;
		if (point.z < this.min.z) this.min.z = point.z;
		if (point.x > this.max.x) this.max.x = point.x;
		if (point.y > this.max.y) this.max.y = point.y;
		if (point.z > this.max.z) this.max.z = point.z;
		return this;
	}

	/**
	 * Returns a new AABB that is the union of this and another.
	 */
	public merge(other: AABB): AABB {
		return new AABB(
			new Vec3(
				Math.min(this.min.x, other.min.x),
				Math.min(this.min.y, other.min.y),
				Math.min(this.min.z, other.min.z),
			),
			new Vec3(
				Math.max(this.max.x, other.max.x),
				Math.max(this.max.y, other.max.y),
				Math.max(this.max.z, other.max.z),
			),
		);
	}

	/**
	 * Returns an AABB transformed into world-space by a Mat4.
	 * Uses the "8-corner transform" technique — correct for any affine transform.
	 *
	 * @param matrix - The transformation matrix.
	 * @param out - Optional pre-allocated AABB to store the result, avoiding Garbage Collection allocations.
	 */
	public transformed(matrix: Mat4, out?: AABB): AABB {
		const result = out || new AABB();
		const v = matrix.values;

		const minX = this.min.x;
		const minY = this.min.y;
		const minZ = this.min.z;
		const maxX = this.max.x;
		const maxY = this.max.y;
		const maxZ = this.max.z;

		// Start with the translation components of the matrix (w = 1 translation)
		let min_x = v[12];
		let max_x = v[12];
		let min_y = v[13];
		let max_y = v[13];
		let min_z = v[14];
		let max_z = v[14];

		// For each matrix column, multiply min/max components according to the sign of the matrix elements.
		// This is Jim Arvo's O(1) algorithm for transforming Axis-Aligned Bounding Boxes.
		
		// X Component of Output
		let a = v[0] * minX;
		let b = v[0] * maxX;
		if (a < b) { min_x += a; max_x += b; } else { min_x += b; max_x += a; }

		a = v[4] * minY;
		b = v[4] * maxY;
		if (a < b) { min_x += a; max_x += b; } else { min_x += b; max_x += a; }

		a = v[8] * minZ;
		b = v[8] * maxZ;
		if (a < b) { min_x += a; max_x += b; } else { min_x += b; max_x += a; }

		// Y Component of Output
		a = v[1] * minX;
		b = v[1] * maxX;
		if (a < b) { min_y += a; max_y += b; } else { min_y += b; max_y += a; }

		a = v[5] * minY;
		b = v[5] * maxY;
		if (a < b) { min_y += a; max_y += b; } else { min_y += b; max_y += a; }

		a = v[9] * minZ;
		b = v[9] * maxZ;
		if (a < b) { min_y += a; max_y += b; } else { min_y += b; max_y += a; }

		// Z Component of Output
		a = v[2] * minX;
		b = v[2] * maxX;
		if (a < b) { min_z += a; max_z += b; } else { min_z += b; max_z += a; }

		a = v[6] * minY;
		b = v[6] * maxY;
		if (a < b) { min_z += a; max_z += b; } else { min_z += b; max_z += a; }

		a = v[10] * minZ;
		b = v[10] * maxZ;
		if (a < b) { min_z += a; max_z += b; } else { min_z += b; max_z += a; }

		result.min.x = min_x;
		result.min.y = min_y;
		result.min.z = min_z;
		result.max.x = max_x;
		result.max.y = max_y;
		result.max.z = max_z;

		return result;
	}

	/**
	 * Returns a clone of this AABB.
	 */
	public clone(): AABB {
		return new AABB(this.min.clone(), this.max.clone());
	}
}
