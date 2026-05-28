/**
 * @module Quaternion
 * This module provides a Quaternion representation for 3D rotations, avoiding gimbal lock.
 */

import { Mat4 } from "./mat4";
import { Vec3 } from "./vec3";

/**
 * Quaternion representation containing x, y, z, and w components.
 * Used for interpolation and smooth, gimbal-lock-free 3D rotations.
 *
 * @group Math
 */
export class Quaternion {
	public x: number;
	public y: number;
	public z: number;
	public w: number;

	/**
	 * Create a new Quaternion
	 * @param {number} [x=0] - X component
	 * @param {number} [y=0] - Y component
	 * @param {number} [z=0] - Z component
	 * @param {number} [w=1] - W component
	 */
	constructor(x: number = 0, y: number = 0, z: number = 0, w: number = 1) {
		this.x = x;
		this.y = y;
		this.z = z;
		this.w = w;
	}

	/**
	 * Sets the components of this Quaternion
	 * @param {number} x - X component
	 * @param {number} y - Y component
	 * @param {number} z - Z component
	 * @param {number} w - W component
	 * @returns {this} The current Quaternion (for chaining)
	 */
	public set(x: number, y: number, z: number, w: number): this {
		this.x = x;
		this.y = y;
		this.z = z;
		this.w = w;
		return this;
	}

	/**
	 * Set this Quaternion to the identity rotation (0, 0, 0, 1)
	 * @returns {this} The current Quaternion (for chaining)
	 */
	public identity(): this {
		this.x = 0;
		this.y = 0;
		this.z = 0;
		this.w = 1;
		return this;
	}

	/**
	 * Copy components from another Quaternion into this one
	 * @param {Quaternion} q - The Quaternion to copy from
	 * @returns {this} The current Quaternion (for chaining)
	 */
	public copy(q: Quaternion): this {
		this.x = q.x;
		this.y = q.y;
		this.z = q.z;
		this.w = q.w;
		return this;
	}

	/**
	 * Clone this Quaternion
	 * @returns {Quaternion} A new Quaternion with identical values
	 */
	public clone(): Quaternion {
		return new Quaternion(this.x, this.y, this.z, this.w);
	}

	/**
	 * Normalizes this Quaternion in-place
	 * @returns {this} The current Quaternion (for chaining)
	 */
	public normalize(): this {
		let len =
			this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
		if (len > 0) {
			len = 1 / Math.sqrt(len);
			this.x *= len;
			this.y *= len;
			this.z *= len;
			this.w *= len;
		}
		return this;
	}

	/**
	 * Multiplies this quaternion by another (in-place)
	 * @param {Quaternion} b - The other Quaternion
	 * @returns {this} The current Quaternion (for chaining)
	 */
	public multiply(b: Quaternion): this {
		const ax = this.x,
			ay = this.y,
			az = this.z,
			aw = this.w;
		const bx = b.x,
			by = b.y,
			bz = b.z,
			bw = b.w;

		this.x = ax * bw + aw * bx + ay * bz - az * by;
		this.y = ay * bw + aw * by + az * bx - ax * bz;
		this.z = az * bw + aw * bz + ax * by - ay * bx;
		this.w = aw * bw - ax * bx - ay * by - az * bz;

		return this;
	}

	/**
	 * Multiplies two Quaternions and outputs the result into another
	 * @param {Quaternion} a - First Quaternion
	 * @param {Quaternion} b - Second Quaternion
	 * @param {Quaternion} [out] - Optional Quaternion to store result
	 * @returns {Quaternion} The multiplied result
	 */
	public static multiply(
		a: Quaternion,
		b: Quaternion,
		out: Quaternion = new Quaternion(),
	): Quaternion {
		const ax = a.x,
			ay = a.y,
			az = a.z,
			aw = a.w;
		const bx = b.x,
			by = b.y,
			bz = b.z,
			bw = b.w;

		out.x = ax * bw + aw * bx + ay * bz - az * by;
		out.y = ay * bw + aw * by + az * bx - ax * bz;
		out.z = az * bw + aw * bz + ax * by - ay * bx;
		out.w = aw * bw - ax * bx - ay * by - az * bz;

		return out;
	}

	/**
	 * Sets this Quaternion from Euler angles (pitch, yaw, roll) in radians
	 * @param {number} x - Pitch (rotation around X in radians)
	 * @param {number} y - Yaw (rotation around Y in radians)
	 * @param {number} z - Roll (rotation around Z in radians)
	 * @returns {this} The current Quaternion (for chaining)
	 */
	public fromEuler(x: number, y: number, z: number): this {
		const halfX = x * 0.5;
		const halfY = y * 0.5;
		const halfZ = z * 0.5;

		const cx = Math.cos(halfX);
		const sx = Math.sin(halfX);
		const cy = Math.cos(halfY);
		const sy = Math.sin(halfY);
		const cz = Math.cos(halfZ);
		const sz = Math.sin(halfZ);

		this.x = sx * cy * cz - cx * sy * sz;
		this.y = cx * sy * cz + sx * cy * sz;
		this.z = cx * cy * sz - sx * sy * cz;
		this.w = cx * cy * cz + sx * sy * sz;

		return this;
	}

	/**
	 * Spherical Linear Interpolation (slerp) between this and a target quaternion in-place.
	 * @param {Quaternion} target - The destination rotation
	 * @param {number} t - Interpolation factor (0.0 to 1.0)
	 * @returns {this} The current Quaternion (for chaining)
	 */
	public slerp(target: Quaternion, t: number): this {
		const ax = this.x,
			ay = this.y,
			az = this.z,
			aw = this.w;
		let bx = target.x,
			by = target.y,
			bz = target.z,
			bw = target.w;

		let cosOmega = ax * bx + ay * by + az * bz + aw * bw;

		// If dot product is negative, reverse target components to take the shortest path
		if (cosOmega < 0) {
			cosOmega = -cosOmega;
			bx = -bx;
			by = -by;
			bz = -bz;
			bw = -bw;
		}

		if (cosOmega >= 1.0) {
			// Extremely close, do simple linear interpolation to avoid division by zero
			this.x = ax + (bx - ax) * t;
			this.y = ay + (by - ay) * t;
			this.z = az + (bz - az) * t;
			this.w = aw + (bw - aw) * t;
			return this.normalize();
		}

		const sinOmega = Math.sqrt(1.0 - cosOmega * cosOmega);
		const omega = Math.atan2(sinOmega, cosOmega);
		const oneOverSinOmega = 1.0 / sinOmega;

		const scale0 = Math.sin((1.0 - t) * omega) * oneOverSinOmega;
		const scale1 = Math.sin(t * omega) * oneOverSinOmega;

		this.x = ax * scale0 + bx * scale1;
		this.y = ay * scale0 + by * scale1;
		this.z = az * scale0 + bz * scale1;
		this.w = aw * scale0 + bw * scale1;

		return this;
	}

	/**
	 * Spherical Linear Interpolation (slerp) between two quaternions
	 * @param {Quaternion} a - Start rotation
	 * @param {Quaternion} b - Target rotation
	 * @param {number} t - Interpolation factor
	 * @param {Quaternion} [out] - Optional destination Quaternion
	 * @returns {Quaternion} The interpolated Quaternion
	 */
	public static slerp(
		a: Quaternion,
		b: Quaternion,
		t: number,
		out: Quaternion = new Quaternion(),
	): Quaternion {
		out.copy(a);
		return out.slerp(b, t);
	}

	/**
	 * Converts this Quaternion to a 4x4 rotation matrix
	 * @param {Mat4} [out] - Optional matrix to store result
	 * @returns {Mat4} The rotation matrix
	 */
	public toMat4(out: Mat4 = new Mat4()): Mat4 {
		const v = out.values;
		const x = this.x,
			y = this.y,
			z = this.z,
			w = this.w;

		const x2 = x + x;
		const y2 = y + y;
		const z2 = z + z;

		const xx = x * x2;
		const xy = x * y2;
		const xz = x * z2;
		const yy = y * y2;
		const yz = y * z2;
		const zz = z * z2;
		const wx = w * x2;
		const wy = w * y2;
		const wz = w * z2;

		v[0] = 1.0 - (yy + zz);
		v[1] = xy + wz;
		v[2] = xz - wy;
		v[3] = 0.0;

		v[4] = xy - wz;
		v[5] = 1.0 - (xx + zz);
		v[6] = yz + wx;
		v[7] = 0.0;

		v[8] = xz + wy;
		v[9] = yz - wx;
		v[10] = 1.0 - (xx + yy);
		v[11] = 0.0;

		v[12] = 0.0;
		v[13] = 0.0;
		v[14] = 0.0;
		v[15] = 1.0;

		return out;
	}
}
