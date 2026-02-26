/**
 * @module Vec3
 * @description
 * This module provides a 3D vector representation.
 */
export class Vec3 {
	/** @public X component */
	public x: number;
	/** @public Y component */
	public y: number;
	/** @public Z component */
	public z: number;

	/**
	 * Create a new Vec3
	 * @param {number} x X component
	 * @param {number} y Y component
	 * @param {number} z Z component
	 */
	constructor(x: number = 0, y: number = 0, z: number = 0) {
		this.x = x;
		this.y = y;
		this.z = z;
	}

	/**
	 * Linearly interpolate to a target vector (in-place)
	 * @param {Vec3} target The target vector to interpolate towards
	 * @param {number} t Interpolation factor (0.0 - 1.0)
	 * @returns {this} The current vector (for chaining)
	 */
	public lerp(target: Vec3, t: number): this {
		if (t < 0 || t > 1) {
			throw new Error("Invalid lerp values");
		}

		this.x += (target.x - this.x) * t;
		this.y += (target.y - this.y) * t;
		this.z += (target.z - this.z) * t;

		return this;
	}

	/**
	 * Linearly interpolate between two vectors into a new vector
	 * @param {Vec3} v1 Start vector
	 * @param {Vec3} v2 End vector
	 * @param {number} t Interpolation factor (0.0 - 1.0)
	 * @param {Vec3} [out] Optional vector to store the result
	 * @returns {Vec3} The interpolated vector
	 */
	public static lerp(
		v1: Vec3,
		v2: Vec3,
		t: number,
		out: Vec3 = new Vec3(),
	): Vec3 {
		if (t < 0 || t > 1) {
			throw new Error("Invalid lerp values");
		}

		out.x = v1.x + (v2.x - v1.x) * t;
		out.y = v1.y + (v2.y - v1.y) * t;
		out.z = v1.z + (v2.z - v1.z) * t;

		return out;
	}

	/**
	 * Get the vector as a Float32Array
	 * @returns {Float32Array} The vector as an array of floats
	 */
	public toFloat32Array(): Float32Array {
		return new Float32Array([this.x, this.y, this.z]);
	}
}
