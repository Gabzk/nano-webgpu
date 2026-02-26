/// <reference types="@webgpu/types" />
import { describe, expect, it } from "vitest";
import { Color } from "../src/math/color";

describe("Color", () => {
	it("should create a color from bytes", () => {
		const color = Color.fromBytes(255, 255, 255);
		expect(color.r).toBe(1.0);
		expect(color.g).toBe(1.0);
		expect(color.b).toBe(1.0);
		expect(color.a).toBe(1.0);
	});

	it("should create a color from bytes with alpha", () => {
		const color = Color.fromBytes(255, 0, 0, 128);
		expect(color.r).toBe(1.0);
		expect(color.g).toBe(0.0);
		expect(color.b).toBe(0.0);
		expect(color.a).toBeCloseTo(0.5);
	});

	it("should throw an error if the bytes are invalid", () => {
		expect(() => Color.fromBytes(-1, 0, 0)).toThrow("Invalid bytes");
		expect(() => Color.fromBytes(0, 256, 0)).toThrow("Invalid bytes");
		expect(() => Color.fromBytes(0, 0, 256)).toThrow("Invalid bytes");
		expect(() => Color.fromBytes(0, 0, 0, 256)).toThrow("Invalid bytes");
	});

	it("should create a color from floats", () => {
		const color = new Color(1.0, 0.0, 0.0);
		expect(color.r).toBe(1.0);
		expect(color.g).toBe(0.0);
		expect(color.b).toBe(0.0);
		expect(color.a).toBe(1.0);
	});

	it("should create a color from floats with alpha", () => {
		const color = new Color(1.0, 0.0, 0.0, 0.5);
		expect(color.r).toBe(1.0);
		expect(color.g).toBe(0.0);
		expect(color.b).toBe(0.0);
		expect(color.a).toBe(0.5);
	});

	it("should throw an error if the floats are invalid", () => {
		expect(() => new Color(-1.0, 0.0, 0.0)).toThrow("Invalid floats");
		expect(() => new Color(0.0, 2.0, 0.0)).toThrow("Invalid floats");
		expect(() => new Color(0.0, 0.0, 2.0)).toThrow("Invalid floats");
		expect(() => new Color(0.0, 0.0, 0.0, 2.0)).toThrow("Invalid floats");
	});

	it("should create a color from hex", () => {
		const color = Color.fromHex("#FF0000");
		expect(color.r).toBe(1.0);
		expect(color.g).toBe(0.0);
		expect(color.b).toBe(0.0);
		expect(color.a).toBe(1.0);
	});

	it("should create a color from hex without #", () => {
		const color = Color.fromHex("FF0000");
		expect(color.r).toBe(1.0);
		expect(color.g).toBe(0.0);
		expect(color.b).toBe(0.0);
		expect(color.a).toBe(1.0);
	});

	it("should throw an error if the hex color is invalid", () => {
		expect(() => Color.fromHex("FF000000")).toThrow("Invalid hex color");
		expect(() => Color.fromHex("FF000")).toThrow("Invalid hex color");
		expect(() => Color.fromHex("FF000G")).toThrow("Invalid hex color");
	});

	it("should create a linear interpolated color", () => {
		const color1 = new Color(1.0, 0.0, 0.0);
		const color2 = new Color(0.0, 1.0, 0.0);
		const color = Color.lerp(color1, color2, 0.5);
		expect(color.r).toBe(0.5);
		expect(color.g).toBe(0.5);
		expect(color.b).toBe(0.0);
		expect(color.a).toBe(1.0);
	});

	it("should create a linear interpolated color with alpha", () => {
		const color1 = new Color(1.0, 0.0, 0.0, 0.0);
		const color2 = new Color(0.0, 1.0, 0.0, 1.0);
		const color = Color.lerp(color1, color2, 0.5);
		expect(color.r).toBe(0.5);
		expect(color.g).toBe(0.5);
		expect(color.b).toBe(0.0);
		expect(color.a).toBe(0.5);
	});

	it("should throw an error if the lerp values are invalid", () => {
		const color1 = new Color(1.0, 0.0, 0.0);
		const color2 = new Color(0.0, 1.0, 0.0);
		expect(() => Color.lerp(color1, color2, -1.0)).toThrow(
			"Invalid lerp values",
		);
		expect(() => Color.lerp(color1, color2, 2.0)).toThrow(
			"Invalid lerp values",
		);
	});
});
