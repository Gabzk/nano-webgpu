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
	 * @param {number} [x=0] - X component
	 * @param {number} [y=0] - Y component
	 * @param {number} [z=0] - Z component
	 */
	constructor(x: number = 0, y: number = 0, z: number = 0) {
		this.x = x;
		this.y = y;
		this.z = z;
	}

	/**
	 * Set the x, y and z components of this vector
	 * @param {number} x - The new x value
	 * @param {number} y - The new y value
	 * @param {number} z - The new z value
	 * @returns {this} The current vector (for chaining)
	 */
	public set(x: number, y: number, z: number): this {
		this.x = x;
		this.y = y;
		this.z = z;
		return this;
	}

	/**
	 * Copy the values of another vector into this vector
	 * @param {Vec3} v - The vector to copy from
	 * @returns {this} The current vector (for chaining)
	 */
	public copy(v: Vec3): this {
		this.x = v.x;
		this.y = v.y;
		this.z = v.z;
		return this;
	}

	/**
	 * Clone this vector into a new Vec3
	 * @returns {Vec3} A new vector with the same x, y, and z values
	 */
	public clone(): Vec3 {
		return new Vec3(this.x, this.y, this.z);
	}

	/**
	 * Adds another vector to this one (in-place)
	 * @param {Vec3} v - The vector to add
	 * @returns {this} The current vector (for chaining)
	 */
	public add(v: Vec3): this {
		this.x += v.x;
		this.y += v.y;
		this.z += v.z;
		return this;
	}

	/**
	 * Subtracts another vector from this one (in-place)
	 * @param {Vec3} v - The vector to subtract
	 * @returns {this} The current vector (for chaining)
	 */
	public sub(v: Vec3): this {
		this.x -= v.x;
		this.y -= v.y;
		this.z -= v.z;
		return this;
	}

	/**
	 * Multiplies this vector by another vector (in-place)
	 * @param {Vec3} v - The vector to multiply by
	 * @returns {this} The current vector (for chaining)
	 */
	public multiply(v: Vec3): this {
		this.x *= v.x;
		this.y *= v.y;
		this.z *= v.z;
		return this;
	}

	/**
	 * Scales this vector by a scalar value (in-place)
	 * @param {number} n - The scalar value
	 * @returns {this} The current vector (for chaining)
	 */
	public scale(n: number): this {
		this.x *= n;
		this.y *= n;
		this.z *= n;
		return this;
	}

	/**
	 * Calculates the dot product of this vector and another
	 * @param {Vec3} v - The other vector
	 * @returns {number} The dot product
	 */
	public dot(v: Vec3): number {
		return this.x * v.x + this.y * v.y + this.z * v.z;
	}

	/**
	 * Computes the cross product of this vector and another (in-place)
	 * @param {Vec3} v - The vector to cross with
	 * @returns {this} The current vector (for chaining)
	 */
	public cross(v: Vec3): this {
		const ax = this.x, ay = this.y, az = this.z;
		const bx = v.x, by = v.y, bz = v.z;
		this.x = ay * bz - az * by;
		this.y = az * bx - ax * bz;
		this.z = ax * by - ay * bx;
		return this;
	}

	/**
	 * Computes the cross product of two vectors into a new vector
	 * @param {Vec3} v1 - The first vector
	 * @param {Vec3} v2 - The second vector
	 * @param {Vec3} [out] - Optional vector to store the result
	 * @returns {Vec3} The vector resulting from the cross product
	 */
	public static cross(v1: Vec3, v2: Vec3, out: Vec3 = new Vec3()): Vec3 {
		const ax = v1.x, ay = v1.y, az = v1.z;
		const bx = v2.x, by = v2.y, bz = v2.z;
		out.x = ay * bz - az * by;
		out.y = az * bx - ax * bz;
		out.z = ax * by - ay * bx;
		return out;
	}

	/**
	 * Calculates the squared length of this vector
	 * @returns {number} The squared length
	 */
	public lengthSquared(): number {
		return this.x * this.x + this.y * this.y + this.z * this.z;
	}

	/**
	 * Calculates the length of this vector
	 * @returns {number} The length
	 */
	public length(): number {
		return Math.sqrt(this.lengthSquared());
	}

	/**
	 * Normalizes this vector (in-place)
	 * @returns {this} The current vector (for chaining)
	 */
	public normalize(): this {
		const len = this.length();
		if (len > 0) {
			this.x /= len;
			this.y /= len;
			this.z /= len;
		}
		return this;
	}

	/**
	 * Calculates the distance to another vector
	 * @param {Vec3} v - The other vector
	 * @returns {number} The distance
	 */
	public distance(v: Vec3): number {
		return Math.sqrt(this.distanceSquared(v));
	}

	/**
	 * Calculates the squared distance to another vector
	 * @param {Vec3} v - The other vector
	 * @returns {number} The squared distance
	 */
	public distanceSquared(v: Vec3): number {
		const dx = v.x - this.x;
		const dy = v.y - this.y;
		const dz = v.z - this.z;
		return dx * dx + dy * dy + dz * dz;
	}

	/**
	 * Checks for strict equality with another vector
	 * @param {Vec3} v - The vector to compare with
	 * @returns {boolean} True if the components are exactly equal
	 */
	public equals(v: Vec3): boolean {
		return this.x === v.x && this.y === v.y && this.z === v.z;
	}

	/**
	 * Linearly interpolate to a target vector (in-place)
	 * @param {Vec3} target - The target vector to interpolate towards
	 * @param {number} t - Interpolation factor
	 * @returns {this} The current vector (for chaining)
	 */
	public lerp(target: Vec3, t: number): this {
		this.x += (target.x - this.x) * t;
		this.y += (target.y - this.y) * t;
		this.z += (target.z - this.z) * t;
		return this;
	}

	/**
	 * Linearly interpolate between two vectors into a new vector
	 * @param {Vec3} v1 - Start vector
	 * @param {Vec3} v2 - End vector
	 * @param {number} t - Interpolation factor
	 * @param {Vec3} [out] - Optional vector to store the result
	 * @returns {Vec3} The interpolated vector
	 */
	public static lerp(
		v1: Vec3,
		v2: Vec3,
		t: number,
		out: Vec3 = new Vec3(),
	): Vec3 {
		out.x = v1.x + (v2.x - v1.x) * t;
		out.y = v1.y + (v2.y - v1.y) * t;
		out.z = v1.z + (v2.z - v1.z) * t;
		return out;
	}

	/**
	 * Get the vector as a Float32Array or fill an existing array
	 * @param {Float32Array} [out] - Optional Float32Array to fill
	 * @param {number} [offset=0] - Optional offset in the array
	 * @returns {Float32Array} The filled array
	 */
	public toFloat32Array(out?: Float32Array, offset: number = 0): Float32Array {
		if (out) {
			out[offset] = this.x;
			out[offset + 1] = this.y;
			out[offset + 2] = this.z;
			return out;
		}
		return new Float32Array([this.x, this.y, this.z]);
	}
}
