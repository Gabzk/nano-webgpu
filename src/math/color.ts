/**
 * @module Color
 * @description
 * This module provides a Color representation for WebGPU (RGBA floats 0.0 - 1.0).
 */
export class Color {
	/** @public Red channel (0.0 - 1.0) */
	public r: number;
	/** @public Green channel (0.0 - 1.0) */
	public g: number;
	/** @public Blue channel (0.0 - 1.0) */
	public b: number;
	/** @public Alpha channel (0.0 - 1.0) */
	public a: number;

	/**
	 * Create a new Color
	 * @param {number} r Red channel (0.0 - 1.0)
	 * @param {number} g Green channel (0.0 - 1.0)
	 * @param {number} b Blue channel (0.0 - 1.0)
	 * @param {number} a Alpha channel (0.0 - 1.0)
	 */
	constructor(
		r: number = 0.0,
		g: number = 0.0,
		b: number = 0.0,
		a: number = 1.0,
	) {
		if (r < 0 || r > 1 || g < 0 || g > 1 || b < 0 || b > 1 || a < 0 || a > 1) {
			throw new Error("Invalid floats");
		}
		this.r = r;
		this.g = g;
		this.b = b;
		this.a = a;
	}

	/**
	 * Create a Color from byte values (0 - 255)
	 * @param {number} r Red channel (0 - 255)
	 * @param {number} g Green channel (0 - 255)
	 * @param {number} b Blue channel (0 - 255)
	 * @param {number} a Alpha channel (0 - 255)
	 * @returns {Color} A new Color instance
	 */
	public static fromBytes(
		r: number = 0,
		g: number = 0,
		b: number = 0,
		a: number = 255,
	): Color {
		if (
			r < 0 ||
			r > 255 ||
			g < 0 ||
			g > 255 ||
			b < 0 ||
			b > 255 ||
			a < 0 ||
			a > 255
		) {
			throw new Error("Invalid bytes");
		}
		return new Color(r / 255.0, g / 255.0, b / 255.0, a / 255.0);
	}

	/**
	 * Create a Color from a hex string (e.g. "#FF0000" or "FF0000")
	 * @param {string} hex Hex color string
	 * @returns {Color} A new Color instance
	 */
	public static fromHex(hex: string): Color {
		if (hex.startsWith("#")) {
			hex = hex.substring(1);
		}
		if (hex.length !== 6) {
			throw new Error("Invalid hex color");
		}
		if (!/^[0-9a-fA-F]+$/.test(hex)) {
			throw new Error("Invalid hex color");
		}
		const r = parseInt(hex.substring(0, 2), 16);
		const g = parseInt(hex.substring(2, 4), 16);
		const b = parseInt(hex.substring(4, 6), 16);
		return new Color(r / 255.0, g / 255.0, b / 255.0, 1.0);
	}

	/**
	 * Linearly interpolate between two colors
	 * @param {Color} color1 Start color
	 * @param {Color} color2 End color
	 * @param {number} t Interpolation factor (0.0 - 1.0)
	 * @returns {Color} A new interpolated Color
	 */
	public static lerp(color1: Color, color2: Color, t: number): Color {
		if (t < 0 || t > 1) {
			throw new Error("Invalid lerp values");
		}
		return new Color(
			color1.r + (color2.r - color1.r) * t,
			color1.g + (color2.g - color1.g) * t,
			color1.b + (color2.b - color1.b) * t,
			color1.a + (color2.a - color1.a) * t,
		);
	}

	/**
	 * Get the color as a Float32Array
	 * @returns {Float32Array} The color as an array of floats
	 */
	public toFloat32Array(): Float32Array {
		return new Float32Array([this.r, this.g, this.b, this.a]);
	}

	/**
	 * Creates a Color from varying inputs.
	 * @param {Color | string | number[]} val - The input value.
	 * @returns {Color} A new Color instance.
	 */
	public static from(
		val: Color | string | number[] | [number, number, number, number?],
	): Color {
		if (val instanceof Color) {
			return new Color(val.r, val.g, val.b, val.a);
		} else if (typeof val === "string") {
			return Color.fromHex(val);
		} else if (Array.isArray(val)) {
			// Assume 0.0 - 1.0 floats if all <= 1.0, else treat as bytes?
			// Better to assume normalized 0.0-1.0 floats for consistency with WebGPU.
			const r = val[0] !== undefined ? val[0] : 0;
			const g = val[1] !== undefined ? val[1] : 0;
			const b = val[2] !== undefined ? val[2] : 0;
			const a = val[3] !== undefined ? val[3] : 1.0;
			return new Color(r, g, b, a);
		}
		return new Color();
	}
}
