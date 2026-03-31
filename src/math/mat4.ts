import { Vec3 } from "./vec3";

/**
 * @module Mat4
 * @description
 * This module provides a 4x4 matrix representation, commonly used for
 * 3D transformations, camera rotations, and projections.
 */
export class Mat4 {
    /** @public The 16 internal matrix values */
    public values: Float32Array;

    /**
     * Create a new identity Mat4
     */
    constructor() {
        this.values = new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ]);
    }

    /**
     * Resets this matrix to the identity matrix
     * @returns {this} The current matrix (for chaining)
     */
    public identity(): this {
        const v = this.values;
        v[0] = 1; v[1] = 0; v[2] = 0; v[3] = 0;
        v[4] = 0; v[5] = 1; v[6] = 0; v[7] = 0;
        v[8] = 0; v[9] = 0; v[10] = 1; v[11] = 0;
        v[12] = 0; v[13] = 0; v[14] = 0; v[15] = 1;
        return this;
    }

    /**
     * Clone this matrix into a new Mat4
     * @returns {Mat4} A new matrix with the same values
     */
    public clone(): Mat4 {
        const out = new Mat4();
        out.values.set(this.values);
        return out;
    }

    /**
     * Copy the values of another matrix into this matrix
     * @param {Mat4} other - The matrix to copy from
     * @returns {this} The current matrix (for chaining)
     */
    public copy(other: Mat4): this {
        this.values.set(other.values);
        return this;
    }

    /**
     * Translates this matrix by the given vector or x, y, z values
     * @param {number | Vec3} x - X translation or Vec3 vector
     * @param {number} [y=0] - Y translation
     * @param {number} [z=0] - Z translation
     * @returns {this} The current matrix (for chaining)
     */
    public translate(x: number | Vec3, y?: number, z?: number): this {
        let tx = 0, ty = 0, tz = 0;
        if (x instanceof Vec3) {
            tx = x.x; ty = x.y; tz = x.z;
        } else {
            tx = x; ty = y || 0; tz = z || 0;
        }

        const v = this.values;
        v[12] = v[0] * tx + v[4] * ty + v[8] * tz + v[12];
        v[13] = v[1] * tx + v[5] * ty + v[9] * tz + v[13];
        v[14] = v[2] * tx + v[6] * ty + v[10] * tz + v[14];
        v[15] = v[3] * tx + v[7] * ty + v[11] * tz + v[15];

        return this;
    }

    /**
     * Scales this matrix by the given vector or x, y, z values
     * @param {number | Vec3} x - X scale or Vec3 vector
     * @param {number} [y=0] - Y scale
     * @param {number} [z=0] - Z scale
     * @returns {this} The current matrix (for chaining)
     */
    public scale(x: number | Vec3, y?: number, z?: number): this {
        let sx = 0, sy = 0, sz = 0;
        if (x instanceof Vec3) {
            sx = x.x; sy = x.y; sz = x.z;
        } else {
            sx = x; sy = y || 0; sz = z || 0;
        }

        const v = this.values;
        v[0] *= sx; v[1] *= sx; v[2] *= sx; v[3] *= sx;
        v[4] *= sy; v[5] *= sy; v[6] *= sy; v[7] *= sy;
        v[8] *= sz; v[9] *= sz; v[10] *= sz; v[11] *= sz;

        return this;
    }

    /**
     * Rotates this matrix around the X, Y, and Z axes (Euler angles)
     * @param {number} x - Rotation around X axis in radians
     * @param {number} y - Rotation around Y axis in radians
     * @param {number} z - Rotation around Z axis in radians
     * @returns {this} The current matrix (for chaining)
     */
    public rotate(x: number, y: number, z: number): this {
        const cx = Math.cos(x), sx = Math.sin(x);
        const cy = Math.cos(y), sy = Math.sin(y);
        const cz = Math.cos(z), sz = Math.sin(z);

        // Rotation matrix elements for Euler XYZ
        const r00 = cy * cz, r01 = cy * sz, r02 = -sy;
        const r10 = sx * sy * cz - cx * sz, r11 = sx * sy * sz + cx * cz, r12 = sx * cy;
        const r20 = cx * sy * cz + sx * sz, r21 = cx * sy * sz - sx * cz, r22 = cx * cy;

        const v = this.values;
        const b00 = v[0], b01 = v[1], b02 = v[2], b03 = v[3];
        const b10 = v[4], b11 = v[5], b12 = v[6], b13 = v[7];
        const b20 = v[8], b21 = v[9], b22 = v[10], b23 = v[11];

        v[0] = b00 * r00 + b10 * r01 + b20 * r02;
        v[1] = b01 * r00 + b11 * r01 + b21 * r02;
        v[2] = b02 * r00 + b12 * r01 + b22 * r02;
        v[3] = b03 * r00 + b13 * r01 + b23 * r02;

        v[4] = b00 * r10 + b10 * r11 + b20 * r12;
        v[5] = b01 * r10 + b11 * r11 + b21 * r12;
        v[6] = b02 * r10 + b12 * r11 + b22 * r12;
        v[7] = b03 * r10 + b13 * r11 + b23 * r12;

        v[8] = b00 * r20 + b10 * r21 + b20 * r22;
        v[9] = b01 * r20 + b11 * r21 + b21 * r22;
        v[10] = b02 * r20 + b12 * r21 + b22 * r22;
        v[11] = b03 * r20 + b13 * r21 + b23 * r22;

        return this;
    }

    /**
     * Multiplies this matrix by another matrix (in-place)
     * @param {Mat4} other - The matrix to multiply by
     * @returns {this} The current matrix (for chaining)
     */
    public multiply(other: Mat4): this {
        const v = this.values;
        const o = other.values;

        const a00 = v[0], a01 = v[1], a02 = v[2], a03 = v[3];
        const a10 = v[4], a11 = v[5], a12 = v[6], a13 = v[7];
        const a20 = v[8], a21 = v[9], a22 = v[10], a23 = v[11];
        const a30 = v[12], a31 = v[13], a32 = v[14], a33 = v[15];

        let b0 = o[0], b1 = o[1], b2 = o[2], b3 = o[3];
        v[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
        v[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
        v[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
        v[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

        b0 = o[4]; b1 = o[5]; b2 = o[6]; b3 = o[7];
        v[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
        v[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
        v[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
        v[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

        b0 = o[8]; b1 = o[9]; b2 = o[10]; b3 = o[11];
        v[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
        v[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
        v[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
        v[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

        b0 = o[12]; b1 = o[13]; b2 = o[14]; b3 = o[15];
        v[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
        v[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
        v[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
        v[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

        return this;
    }

    /**
     * Inverts this matrix (in-place)
     * @returns {this} The current matrix (for chaining)
     */
    public invert(): this {
        const v = this.values;
        const a00 = v[0], a01 = v[1], a02 = v[2], a03 = v[3],
            a10 = v[4], a11 = v[5], a12 = v[6], a13 = v[7],
            a20 = v[8], a21 = v[9], a22 = v[10], a23 = v[11],
            a30 = v[12], a31 = v[13], a32 = v[14], a33 = v[15];

        const b00 = a00 * a11 - a01 * a10;
        const b01 = a00 * a12 - a02 * a10;
        const b02 = a00 * a13 - a03 * a10;
        const b03 = a01 * a12 - a02 * a11;
        const b04 = a01 * a13 - a03 * a11;
        const b05 = a02 * a13 - a03 * a12;
        const b06 = a20 * a31 - a21 * a30;
        const b07 = a20 * a32 - a22 * a30;
        const b08 = a20 * a33 - a23 * a30;
        const b09 = a21 * a32 - a22 * a31;
        const b10 = a21 * a33 - a23 * a31;
        const b11 = a22 * a33 - a23 * a32;

        let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

        if (!det) {
            return this;
        }

        det = 1.0 / det;

        v[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
        v[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
        v[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
        v[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
        v[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
        v[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
        v[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
        v[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
        v[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
        v[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
        v[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
        v[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
        v[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
        v[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
        v[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
        v[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

        return this;
    }

    /**
     * Transposes this matrix (in-place)
     * @returns {this} The current matrix (for chaining)
     */
    public transpose(): this {
        const v = this.values;
        let p;

        p = v[1]; v[1] = v[4]; v[4] = p;
        p = v[2]; v[2] = v[8]; v[8] = p;
        p = v[3]; v[3] = v[12]; v[12] = p;
        p = v[6]; v[6] = v[9]; v[9] = p;
        p = v[7]; v[7] = v[13]; v[13] = p;
        p = v[11]; v[11] = v[14]; v[14] = p;

        return this;
    }

    /**
     * Generates a perspective projection matrix
     * @param {number} fovy - Field of view in radians
     * @param {number} aspect - Aspect ratio (width / height)
     * @param {number} near - Near clipping plane
     * @param {number} far - Far clipping plane
     * @returns {this} The current matrix (for chaining)
     */
    public perspective(fovy: number, aspect: number, near: number, far: number): this {
        const f = 1.0 / Math.tan(fovy / 2);
        const nf = 1 / (near - far);
        const v = this.values;

        // WebGPU NDC Z is [0, 1]
        v[0] = f / aspect;
        v[1] = 0;
        v[2] = 0;
        v[3] = 0;
        v[4] = 0;
        v[5] = f;
        v[6] = 0;
        v[7] = 0;
        v[8] = 0;
        v[9] = 0;
        v[10] = far * nf;
        v[11] = -1;
        v[12] = 0;
        v[13] = 0;
        v[14] = far * near * nf;
        v[15] = 0;

        return this;
    }

    /**
     * Generates an orthogonal projection matrix
     * @param {number} left - Left bound of the frustum
     * @param {number} right - Right bound of the frustum
     * @param {number} bottom - Bottom bound of the frustum
     * @param {number} top - Top bound of the frustum
     * @param {number} near - Near clipping plane
     * @param {number} far - Far clipping plane
     * @returns {this} The current matrix (for chaining)
     */
    public ortho(left: number, right: number, bottom: number, top: number, near: number, far: number): this {
        const lr = 1 / (left - right);
        const bt = 1 / (bottom - top);
        const nf = 1 / (near - far);
        const v = this.values;

        v[0] = -2 * lr;
        v[1] = 0;
        v[2] = 0;
        v[3] = 0;
        v[4] = 0;
        v[5] = -2 * bt;
        v[6] = 0;
        v[7] = 0;
        v[8] = 0;
        v[9] = 0;
        v[10] = 2 * nf;
        v[11] = 0;
        v[12] = (left + right) * lr;
        v[13] = (top + bottom) * bt;
        v[14] = (far + near) * nf;
        v[15] = 1;

        return this;
    }

    /**
     * Generates a Look-At view matrix
     * @param {Vec3} eye - The position of the camera
     * @param {Vec3} center - The point the camera is looking at
     * @param {Vec3} up - The up vector of the camera
     * @returns {this} The current matrix (for chaining)
     */
    public lookAt(eye: Vec3, center: Vec3, up: Vec3): this {
        let eyex = eye.x, eyey = eye.y, eyez = eye.z;
        let upx = up.x, upy = up.y, upz = up.z;
        let cx = center.x, cy = center.y, cz = center.z;

        let z0 = eyex - cx, z1 = eyey - cy, z2 = eyez - cz;

        let len = z0 * z0 + z1 * z1 + z2 * z2;
        if (len > 0) {
            len = 1 / Math.sqrt(len);
            z0 *= len;
            z1 *= len;
            z2 *= len;
        }

        let x0 = upy * z2 - upz * z1;
        let x1 = upz * z0 - upx * z2;
        let x2 = upx * z1 - upy * z0;

        len = x0 * x0 + x1 * x1 + x2 * x2;
        if (len > 0) {
            len = 1 / Math.sqrt(len);
            x0 *= len;
            x1 *= len;
            x2 *= len;
        }

        let y0 = z1 * x2 - z2 * x1;
        let y1 = z2 * x0 - z0 * x2;
        let y2 = z0 * x1 - z1 * x0;

        len = y0 * y0 + y1 * y1 + y2 * y2;
        if (len > 0) {
            len = 1 / Math.sqrt(len);
            y0 *= len;
            y1 *= len;
            y2 *= len;
        }

        const v = this.values;
        v[0] = x0; v[1] = y0; v[2] = z0; v[3] = 0;
        v[4] = x1; v[5] = y1; v[6] = z1; v[7] = 0;
        v[8] = x2; v[9] = y2; v[10] = z2; v[11] = 0;
        v[12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
        v[13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
        v[14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
        v[15] = 1;

        return this;
    }
}