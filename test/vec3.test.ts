/// <reference types="@webgpu/types" />
import { describe, expect, it } from "vitest";
import { Vec3 } from "../src/math/vec3";

describe("Vec3", () => {
	it("should create a vec3", () => {
		const vec3 = new Vec3(1.0, 2.0, 3.0);
		expect(vec3.x).toBe(1.0);
		expect(vec3.y).toBe(2.0);
		expect(vec3.z).toBe(3.0);
	});

	it("should static lerp between two vec3", () => {
		const vec3 = Vec3.lerp(
			new Vec3(1.0, 2.0, 3.0),
			new Vec3(4.0, 5.0, 6.0),
			0.5,
		);
		expect(vec3.x).toBe(2.5);
		expect(vec3.y).toBe(3.5);
		expect(vec3.z).toBe(4.5);
	});

	it("should static lerp using an out parameter to avoid GC", () => {
		const out = new Vec3();
		Vec3.lerp(new Vec3(1.0, 2.0, 3.0), new Vec3(4.0, 5.0, 6.0), 0.5, out);
		expect(out.x).toBe(2.5);
		expect(out.y).toBe(3.5);
		expect(out.z).toBe(4.5);
	});

	it("should instance lerp towards a target", () => {
		const vec3 = new Vec3(1.0, 2.0, 3.0);
		vec3.lerp(new Vec3(4.0, 5.0, 6.0), 0.5);
		expect(vec3.x).toBe(2.5);
		expect(vec3.y).toBe(3.5);
		expect(vec3.z).toBe(4.5);
	});

	it("should throw an error if the lerp values are invalid", () => {
		const vec3 = new Vec3(1.0, 2.0, 3.0);
		expect(() => Vec3.lerp(vec3, new Vec3(4.0, 5.0, 6.0), -1.0)).toThrow(
			"Invalid lerp values",
		);
		expect(() => vec3.lerp(new Vec3(4.0, 5.0, 6.0), 2.0)).toThrow(
			"Invalid lerp values",
		);
	});
});
