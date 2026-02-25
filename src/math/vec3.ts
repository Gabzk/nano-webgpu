export class Vec3 {
    public x: number;
    public y: number;
    public z: number;

    constructor(x: number = 0, y: number = 0, z: number = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    public lerp(target: Vec3, t: number): this {
        if (t < 0 || t > 1) {
            throw new Error('Invalid lerp values');
        }

        this.x += (target.x - this.x) * t;
        this.y += (target.y - this.y) * t;
        this.z += (target.z - this.z) * t;

        return this;
    }

    public static lerp(v1: Vec3, v2: Vec3, t: number, out: Vec3 = new Vec3()): Vec3 {
        if (t < 0 || t > 1) {
            throw new Error('Invalid lerp values');
        }

        out.x = v1.x + (v2.x - v1.x) * t;
        out.y = v1.y + (v2.y - v1.y) * t;
        out.z = v1.z + (v2.z - v1.z) * t;

        return out;
    }

    public toFloat32Array(): Float32Array {
        return new Float32Array([this.x, this.y, this.z]);
    }
}