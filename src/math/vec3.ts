/**
 * @module Vec3
 * @description
 * This module provides a 3D vector representation.
 */
export class Vec3 {
	private _x: number;
	private _y: number;
	private _z: number;

	/** @public Callback triggered when any component changes */
	public onChange?: () => void;

	get x(): number {
		return this._x;
	}
	set x(val: number) {
		if (this._x === val) return;
		this._x = val;
		if (this.onChange) this.onChange();
	}

	get y(): number {
		return this._y;
	}
	set y(val: number) {
		if (this._y === val) return;
		this._y = val;
		if (this.onChange) this.onChange();
	}

	get z(): number {
		return this._z;
	}
	set z(val: number) {
		if (this._z === val) return;
		this._z = val;
		if (this.onChange) this.onChange();
	}

	/**
	 * Create a new Vec3
	 * @param {number} [x=0] - X component
	 * @param {number} [y=0] - Y component
	 * @param {number} [z=0] - Z component
	 */
	constructor(x: number = 0, y: number = 0, z: number = 0) {
		this._x = x;
		this._y = y;
		this._z = z;
	}

	/**
	 * Set the x, y and z components of this vector
	 * @param {number} x - The new x value
	 * @param {number} y - The new y value
	 * @param {number} z - The new z value
	 * @returns {this} The current vector (for chaining)
	 */
	public set(x: number, y: number, z: number): this {
		if (this._x !== x || this._y !== y || this._z !== z) {
			this._x = x;
			this._y = y;
			this._z = z;
			if (this.onChange) this.onChange();
		}
		return this;
	}

	/**
	 * Copy the values of another vector into this vector
	 * @param {Vec3} v - The vector to copy from
	 * @returns {this} The current vector (for chaining)
	 */
	public copy(v: Vec3): this {
		if (this._x !== v.x || this._y !== v.y || this._z !== v.z) {
			this._x = v.x;
			this._y = v.y;
			this._z = v.z;
			if (this.onChange) this.onChange();
		}
		return this;
	}

	/**
	 * Clone this vector into a new Vec3
	 * @returns {Vec3} A new vector with the same x, y, and z values
	 */
	public clone(): Vec3 {
		return new Vec3(this._x, this._y, this._z);
	}

	/**
	 * Adds another vector to this one (in-place)
	 * @param {Vec3} v - The vector to add
	 * @returns {this} The current vector (for chaining)
	 */
	public add(v: Vec3): this {
		this._x += v.x;
		this._y += v.y;
		this._z += v.z;
		if (this.onChange) this.onChange();
		return this;
	}

	/**
	 * Subtracts another vector from this one (in-place)
	 * @param {Vec3} v - The vector to subtract
	 * @returns {this} The current vector (for chaining)
	 */
	public sub(v: Vec3): this {
		this._x -= v.x;
		this._y -= v.y;
		this._z -= v.z;
		if (this.onChange) this.onChange();
		return this;
	}

	/**
	 * Multiplies this vector by another vector (in-place)
	 * @param {Vec3} v - The vector to multiply by
	 * @returns {this} The current vector (for chaining)
	 */
	public multiply(v: Vec3): this {
		this._x *= v.x;
		this._y *= v.y;
		this._z *= v.z;
		if (this.onChange) this.onChange();
		return this;
	}

	/**
	 * Scales this vector by a scalar value (in-place)
	 * @param {number} n - The scalar value
	 * @returns {this} The current vector (for chaining)
	 */
	public scale(n: number): this {
		this._x *= n;
		this._y *= n;
		this._z *= n;
		if (this.onChange) this.onChange();
		return this;
	}

	/**
	 * Returns a new Vec3 scaled by a scalar value (non-mutating).
	 * Use this instead of scale() when you don't want to modify the original vector.
	 * @param {number} n - The scalar value
	 * @returns {Vec3} A new scaled vector
	 */
	public scaled(n: number): Vec3 {
		return new Vec3(this._x * n, this._y * n, this._z * n);
	}

	/**
	 * Calculates the dot product of this vector and another
	 * @param {Vec3} v - The other vector
	 * @returns {number} The dot product
	 */
	public dot(v: Vec3): number {
		return this._x * v.x + this._y * v.y + this._z * v.z;
	}

	/**
	 * Computes the cross product of this vector and another (in-place)
	 * @param {Vec3} v - The vector to cross with
	 * @returns {this} The current vector (for chaining)
	 */
	public cross(v: Vec3): this {
		const ax = this._x,
			ay = this._y,
			az = this._z;
		const bx = v.x,
			by = v.y,
			bz = v.z;
		this._x = ay * bz - az * by;
		this._y = az * bx - ax * bz;
		this._z = ax * by - ay * bx;
		if (this.onChange) this.onChange();
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
		const ax = v1.x,
			ay = v1.y,
			az = v1.z;
		const bx = v2.x,
			by = v2.y,
			bz = v2.z;
		out.set(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx);
		return out;
	}

	/**
	 * Calculates the squared length of this vector
	 * @returns {number} The squared length
	 */
	public lengthSquared(): number {
		return this._x * this._x + this._y * this._y + this._z * this._z;
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
			this._x /= len;
			this._y /= len;
			this._z /= len;
			if (this.onChange) this.onChange();
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
		const dx = v.x - this._x;
		const dy = v.y - this._y;
		const dz = v.z - this._z;
		return dx * dx + dy * dy + dz * dz;
	}

	/**
	 * Checks for strict equality with another vector
	 * @param {Vec3} v - The vector to compare with
	 * @returns {boolean} True if the components are exactly equal
	 */
	public equals(v: Vec3): boolean {
		return this._x === v.x && this._y === v.y && this._z === v.z;
	}

	/**
	 * Linearly interpolate to a target vector (in-place)
	 * @param {Vec3} target - The target vector to interpolate towards
	 * @param {number} t - Interpolation factor
	 * @returns {this} The current vector (for chaining)
	 */
	public lerp(target: Vec3, t: number): this {
		this._x += (target.x - this._x) * t;
		this._y += (target.y - this._y) * t;
		this._z += (target.z - this._z) * t;
		if (this.onChange) this.onChange();
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
		out.set(
			v1.x + (v2.x - v1.x) * t,
			v1.y + (v2.y - v1.y) * t,
			v1.z + (v2.z - v1.z) * t,
		);
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
			out[offset] = this._x;
			out[offset + 1] = this._y;
			out[offset + 2] = this._z;
			return out;
		}
		return new Float32Array([this._x, this._y, this._z]);
	}

	/**
	 * Creates a Vec3 from varying inputs.
	 * @param {Vec3 | number[] | number} val - The input value.
	 * @returns {Vec3} A new Vec3 instance.
	 */
	public static from(
		val: Vec3 | [number, number, number] | number[] | number,
	): Vec3 {
		if (val instanceof Vec3) {
			return val.clone();
		} else if (Array.isArray(val)) {
			return new Vec3(val[0] || 0, val[1] || 0, val[2] || 0);
		} else if (typeof val === "number") {
			return new Vec3(val, val, val);
		}
		return new Vec3();
	}
}
