import { describe, expect, it } from "vitest";
import { Mat4 } from "../src/math/mat4";

describe("Mat4", () => {
    it("should create an identity matrix", () => {
        const mat4 = new Mat4();
        expect(mat4.values).toEqual(
            new Float32Array([
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1,
            ]),
        );
    });

    it("should translate a matrix", () => {
        const mat4 = new Mat4();
        const translated = mat4.translate(1, 2, 3);
        expect(translated.values).toEqual(
            new Float32Array([
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                1, 2, 3, 1,
            ]),
        );
    });

    it("should rotate a matrix", () => {
        const mat4 = new Mat4();
        const rotated = mat4.rotate(0, 0, Math.PI / 2);

        expect(rotated.values[0]).toBeCloseTo(0);
        expect(rotated.values[1]).toBeCloseTo(1);
        expect(rotated.values[4]).toBeCloseTo(-1);
        expect(rotated.values[5]).toBeCloseTo(0);

        expect(rotated.values[10]).toBe(1);
        expect(rotated.values[15]).toBe(1);
    });

    it("should scale a matrix", () => {
        const mat4 = new Mat4();
        const scaled = mat4.scale(2, 3, 4);
        expect(scaled.values).toEqual(
            new Float32Array([
                2, 0, 0, 0,
                0, 3, 0, 0,
                0, 0, 4, 0,
                0, 0, 0, 1,
            ]),
        );
    });

    it("should multiply matrices correctly", () => {
        const mat1 = new Mat4().translate(10, 0, 0);
        const mat2 = new Mat4().translate(0, 5, 0);
        const result = mat1.multiply(mat2);

        expect(result.values[12]).toBe(10);
        expect(result.values[13]).toBe(5);~
        expect(result.values[14]).toBe(0);
    });
});