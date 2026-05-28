/// <reference types="@webgpu/types" />
import { describe, expect, it } from "vitest";
import { Quaternion } from "../src/math/quaternion";
import { Mat4 } from "../src/math/mat4";
import { Vec3 } from "../src/math/vec3";

describe("Quaternion", () => {
	it("should create an identity quaternion by default", () => {
		const q = new Quaternion();
		expect(q.x).toBe(0);
		expect(q.y).toBe(0);
		expect(q.z).toBe(0);
		expect(q.w).toBe(1);
	});

	it("should clone and copy correctly", () => {
		const q1 = new Quaternion(1, 2, 3, 4);
		const q2 = q1.clone();
		expect(q2.x).toBe(1);
		expect(q2.y).toBe(2);
		expect(q2.z).toBe(3);
		expect(q2.w).toBe(4);

		const q3 = new Quaternion();
		q3.copy(q1);
		expect(q3.x).toBe(1);
		expect(q3.y).toBe(2);
		expect(q3.z).toBe(3);
		expect(q3.w).toBe(4);
	});

	it("should convert from Euler angles correctly", () => {
		const q = new Quaternion();
		q.fromEuler(Math.PI / 2, 0, 0); // 90 deg pitch around X
		// expected rotation around X: x = sin(pi/4) = 0.7071, w = cos(pi/4) = 0.7071
		expect(q.x).toBeCloseTo(Math.sin(Math.PI / 4));
		expect(q.y).toBeCloseTo(0);
		expect(q.z).toBeCloseTo(0);
		expect(q.w).toBeCloseTo(Math.cos(Math.PI / 4));
	});

	it("should convert to Mat4 correctly", () => {
		const q = new Quaternion();
		q.fromEuler(0, Math.PI / 2, 0); // 90 deg yaw around Y
		const mat = q.toMat4();
		const v = mat.values;

		// 90 deg around Y: cos(90) = 0, sin(90) = 1
		// R = [cos  0  sin]
		//     [ 0   1   0 ]
		//     [-sin 0  cos]
		// v[0] = cos = 0, v[2] = -sin = -1, v[8] = sin = 1, v[10] = cos = 0
		expect(v[0]).toBeCloseTo(0);
		expect(v[5]).toBeCloseTo(1);
		expect(v[10]).toBeCloseTo(0);
		expect(v[8]).toBeCloseTo(1);
		expect(v[2]).toBeCloseTo(-1);
	});

	it("should slerp correctly", () => {
		const q1 = new Quaternion(); // identity
		const q2 = new Quaternion();
		q2.fromEuler(0, Math.PI / 2, 0); // 90 deg around Y

		const interpolated = Quaternion.slerp(q1, q2, 0.5);
		// expected: 45 deg around Y
		expect(interpolated.x).toBeCloseTo(0);
		expect(interpolated.y).toBeCloseTo(Math.sin(Math.PI / 8));
		expect(interpolated.z).toBeCloseTo(0);
		expect(interpolated.w).toBeCloseTo(Math.cos(Math.PI / 8));
	});
});

describe("Mat4 and AABB Optimizations", () => {
	it("should scale uniformly when called with a single argument", () => {
		const mat = new Mat4();
		mat.scale(2.5);
		const v = mat.values;
		expect(v[0]).toBe(2.5);
		expect(v[5]).toBe(2.5);
		expect(v[10]).toBe(2.5);
	});

	it("should create a Reversed-Z perspective projection correctly", () => {
		const mat = new Mat4();
		const near = 1.0;
		const far = 100.0;
		const aspect = 1.0;
		const fovy = Math.PI / 2; // 90 deg
		
		mat.perspective(fovy, aspect, near, far, true); // true = reversedZ
		const v = mat.values;
		
		// Reversed-Z:
		// near maps to 1, far maps to 0
		// v[10] = -near / (near - far) = -1.0 / -99.0 = 1 / 99
		// v[14] = -far * near / (near - far) = -100.0 * 1.0 / -99.0 = 100 / 99
		expect(v[10]).toBeCloseTo(-1.0 / (near - far));
		expect(v[14]).toBeCloseTo(-far * near / (near - far));
	});
});
