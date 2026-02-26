/**
 * @module Vec2
 * @description
 * This module provides a 2D vector representation.
 */
export class Vec2 {
    /** @public X component */
    public x: number;
    /** @public Y component */
    public y: number;

    /**
     * Create a new Vec2
     * @param {number} [x=0] - X component
     * @param {number} [y=0] - Y component
     */
    constructor(x: number = 0, y: number = 0) {
        this.x = x;
        this.y = y;
    }

    /**
     * Set the x and y components of this vector
     * @param {number} x - The new x value
     * @param {number} y - The new y value
     * @returns {this} The current vector (for chaining)
     */
    public set(x: number, y: number): this {
        this.x = x;
        this.y = y;
        return this;
    }

    /**
     * Copy the values of another vector into this vector
     * @param {Vec2} v - The vector to copy from
     * @returns {this} The current vector (for chaining)
     */
    public copy(v: Vec2): this {
        this.x = v.x;
        this.y = v.y;
        return this;
    }

    /**
     * Clone this vector into a new Vec2
     * @returns {Vec2} A new vector with the same x and y values
     */
    public clone(): Vec2 {
        return new Vec2(this.x, this.y);
    }

    /**
     * Adds another vector to this one (in-place)
     * @param {Vec2} v - The vector to add
     * @returns {this} The current vector (for chaining)
     */
    public add(v: Vec2): this {
        this.x += v.x;
        this.y += v.y;
        return this;
    }

    /**
     * Subtracts another vector from this one (in-place)
     * @param {Vec2} v - The vector to subtract
     * @returns {this} The current vector (for chaining)
     */
    public sub(v: Vec2): this {
        this.x -= v.x;
        this.y -= v.y;
        return this;
    }

    /**
     * Multiplies this vector by another vector (in-place)
     * @param {Vec2} v - The vector to multiply by
     * @returns {this} The current vector (for chaining)
     */
    public multiply(v: Vec2): this {
        this.x *= v.x;
        this.y *= v.y;
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
        return this;
    }

    /**
     * Calculates the dot product of this vector and another
     * @param {Vec2} v - The other vector
     * @returns {number} The dot product
     */
    public dot(v: Vec2): number {
        return this.x * v.x + this.y * v.y;
    }

    /**
     * Calculates the squared length of this vector
     * @returns {number} The squared length
     */
    public lengthSquared(): number {
        return this.x * this.x + this.y * this.y;
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
        }
        return this;
    }

    /**
     * Calculates the distance to another vector
     * @param {Vec2} v - The other vector
     * @returns {number} The distance
     */
    public distance(v: Vec2): number {
        return Math.sqrt(this.distanceSquared(v));
    }

    /**
     * Calculates the squared distance to another vector
     * @param {Vec2} v - The other vector
     * @returns {number} The squared distance
     */
    public distanceSquared(v: Vec2): number {
        const dx = v.x - this.x;
        const dy = v.y - this.y;
        return dx * dx + dy * dy;
    }

    /**
     * Checks for strict equality with another vector
     * @param {Vec2} v - The vector to compare with
     * @returns {boolean} True if the components are exactly equal
     */
    public equals(v: Vec2): boolean {
        return this.x === v.x && this.y === v.y;
    }

    /**
     * Linearly interpolate to a target vector (in-place)
     * @param {Vec2} target - The target vector to interpolate towards
     * @param {number} t - Interpolation factor
     * @returns {this} The current vector (for chaining)
     */
    public lerp(target: Vec2, t: number): this {
        this.x += (target.x - this.x) * t;
        this.y += (target.y - this.y) * t;
        return this;
    }

    /**
     * Linearly interpolate between two vectors into a new vector
     * @param {Vec2} v1 - Start vector
     * @param {Vec2} v2 - End vector
     * @param {number} t - Interpolation factor
     * @param {Vec2} [out] - Optional vector to store the result
     * @returns {Vec2} The interpolated vector
     */
    public static lerp(
        v1: Vec2,
        v2: Vec2,
        t: number,
        out: Vec2 = new Vec2(),
    ): Vec2 {
        out.x = v1.x + (v2.x - v1.x) * t;
        out.y = v1.y + (v2.y - v1.y) * t;
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
            return out;
        }
        return new Float32Array([this.x, this.y]);
    }
}
