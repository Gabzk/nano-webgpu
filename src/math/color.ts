/**
 * @module Color
 
 * This module provides a Color representation for WebGPU (RGBA floats 0.0 - 1.0).
 */
/**
 * A type representing all standard W3C CSS color names for IDE autocomplete support.
 *
 * @group Math
 */
export type ColorName =
	| "aliceblue"
	| "antiquewhite"
	| "aqua"
	| "aquamarine"
	| "azure"
	| "beige"
	| "bisque"
	| "black"
	| "blanchedalmond"
	| "blue"
	| "blueviolet"
	| "brown"
	| "burlywood"
	| "cadetblue"
	| "chartreuse"
	| "chocolate"
	| "coral"
	| "cornflowerblue"
	| "cornsilk"
	| "crimson"
	| "cyan"
	| "darkblue"
	| "darkcyan"
	| "darkgoldenrod"
	| "darkgray"
	| "darkgrey"
	| "darkgreen"
	| "darkkhaki"
	| "darkmagenta"
	| "darkolivegreen"
	| "darkorange"
	| "darkorchid"
	| "darkred"
	| "darksalmon"
	| "darkseagreen"
	| "darkslate_blue"
	| "darkslategray"
	| "darkslategrey"
	| "darkturquoise"
	| "darkviolet"
	| "deeppink"
	| "deepskyblue"
	| "dimgray"
	| "dimgrey"
	| "dodgerblue"
	| "firebrick"
	| "floralwhite"
	| "forestgreen"
	| "fuchsia"
	| "gainsboro"
	| "ghostwhite"
	| "gold"
	| "goldenrod"
	| "gray"
	| "grey"
	| "green"
	| "greenyellow"
	| "honeydew"
	| "hotpink"
	| "indianred"
	| "indigo"
	| "ivory"
	| "khaki"
	| "lavender"
	| "lavenderblush"
	| "lawngreen"
	| "lemonchiffon"
	| "lightblue"
	| "lightcoral"
	| "lightcyan"
	| "lightgoldenrodyellow"
	| "lightgray"
	| "lightgrey"
	| "lightgreen"
	| "lightpink"
	| "lightsalmon"
	| "lightseagreen"
	| "lightskyblue"
	| "lightslategray"
	| "lightslategrey"
	| "lightsteelblue"
	| "lightyellow"
	| "lime"
	| "limegreen"
	| "linen"
	| "magenta"
	| "maroon"
	| "mediumaquamarine"
	| "mediumblue"
	| "mediumorchid"
	| "mediumpurple"
	| "mediumseagreen"
	| "mediumslateblue"
	| "mediumspringgreen"
	| "mediumturquoise"
	| "mediumvioletred"
	| "midnightblue"
	| "mintcream"
	| "mistyrose"
	| "moccasin"
	| "navajowhite"
	| "navy"
	| "oldlace"
	| "olive"
	| "olivedrab"
	| "orange"
	| "orangered"
	| "orchid"
	| "palegoldenrod"
	| "palegreen"
	| "paleturquoise"
	| "palevioletred"
	| "papayawhip"
	| "peachpuff"
	| "peru"
	| "pink"
	| "plum"
	| "powderblue"
	| "purple"
	| "rebeccapurple"
	| "red"
	| "rosybrown"
	| "royalblue"
	| "saddlebrown"
	| "salmon"
	| "sandybrown"
	| "seagreen"
	| "seashell"
	| "sienna"
	| "silver"
	| "skyblue"
	| "slateblue"
	| "slategray"
	| "slategrey"
	| "snow"
	| "springgreen"
	| "steelblue"
	| "tan"
	| "teal"
	| "thistle"
	| "tomato"
	| "turquoise"
	| "violet"
	| "wheat"
	| "white"
	| "whitesmoke"
	| "yellow"
	| "yellowgreen";

/**
 * A custom type that merges Color, ColorName CSS color literals, and arbitrary hex strings (preserving IDE autocomplete suggestions).
 *
 * @group Math
 */
export type ColorLike =
	| Color
	| ColorName
	| [number, number, number, number?]
	| (string & {});

/**
 * Color representation utilizing RGBA float values ranging from 0.0 to 1.0.
 * Includes helpers to parse hex strings, CSS color names, interpolate colors,
 * and convert to Linear space.
 *
 * @group Math
 */
export class Color {
	private _r: number;
	private _g: number;
	private _b: number;
	private _a: number;

	/** @public Callback triggered when any component changes */
	public onChange?: () => void;

	get r(): number {
		return this._r;
	}
	set r(val: number) {
		if (this._r === val) return;
		this._r = val;
		if (this.onChange) this.onChange();
	}

	get g(): number {
		return this._g;
	}
	set g(val: number) {
		if (this._g === val) return;
		this._g = val;
		if (this.onChange) this.onChange();
	}

	get b(): number {
		return this._b;
	}
	set b(val: number) {
		if (this._b === val) return;
		this._b = val;
		if (this.onChange) this.onChange();
	}

	get a(): number {
		return this._a;
	}
	set a(val: number) {
		if (this._a === val) return;
		this._a = val;
		if (this.onChange) this.onChange();
	}

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
		if (r < 0 || g < 0 || b < 0 || a < 0 || a > 1) {
			throw new Error("Invalid floats");
		}
		this._r = r;
		this._g = g;
		this._b = b;
		this._a = a;
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
	 * Create a Color from a hex string (e.g. "#FF0000" or "FF0000") or a CSS color name
	 * @param {string} hex Hex color string or CSS color name
	 * @returns {Color} A new Color instance
	 */
	public static fromHex(hex: string): Color {
		const trimmed = hex.trim().toLowerCase();

		// 1. Resolve standard CSS color names
		if (Color.CSS_NAMES[trimmed]) {
			return Color.fromHex(Color.CSS_NAMES[trimmed]);
		}

		let cleanHex = trimmed;
		if (cleanHex.startsWith("#")) {
			cleanHex = cleanHex.substring(1);
		}

		if (!/^[0-9a-fA-F]+$/.test(cleanHex)) {
			throw new Error(`Invalid hex color: "${hex}"`);
		}

		let r = 0;
		let g = 0;
		let b = 0;
		let a = 255;

		if (cleanHex.length === 3) {
			r = parseInt(cleanHex[0] + cleanHex[0], 16);
			g = parseInt(cleanHex[1] + cleanHex[1], 16);
			b = parseInt(cleanHex[2] + cleanHex[2], 16);
		} else if (cleanHex.length === 4) {
			r = parseInt(cleanHex[0] + cleanHex[0], 16);
			g = parseInt(cleanHex[1] + cleanHex[1], 16);
			b = parseInt(cleanHex[2] + cleanHex[2], 16);
			a = parseInt(cleanHex[3] + cleanHex[3], 16);
		} else if (cleanHex.length === 6) {
			r = parseInt(cleanHex.substring(0, 2), 16);
			g = parseInt(cleanHex.substring(2, 4), 16);
			b = parseInt(cleanHex.substring(4, 6), 16);
		} else if (cleanHex.length === 8) {
			r = parseInt(cleanHex.substring(0, 2), 16);
			g = parseInt(cleanHex.substring(2, 4), 16);
			b = parseInt(cleanHex.substring(4, 6), 16);
			a = parseInt(cleanHex.substring(6, 8), 16);
		} else {
			throw new Error(`Invalid hex color length: "${hex}"`);
		}

		return new Color(r / 255.0, g / 255.0, b / 255.0, a / 255.0);
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
		return new Float32Array([this._r, this._g, this._b, this._a]);
	}

	/**
	 * Returns a new Color converted from sRGB to Linear space.
	 * Often used when passing uniform colors to PBR shaders.
	 */
	public toLinear(): Color {
		const srgbToLinear = (c: number) => {
			return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
		};
		return new Color(
			srgbToLinear(this._r),
			srgbToLinear(this._g),
			srgbToLinear(this._b),
			this._a,
		);
	}

	/**
	 * Returns a new Color converted from Linear space to sRGB space.
	 */
	public toSRGB(): Color {
		const linearToSRGB = (c: number) => {
			return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1.0 / 2.4) - 0.055;
		};
		// Clamp to [0, 1] range during conversion to LDR sRGB space
		return new Color(
			Math.max(0, Math.min(1, linearToSRGB(this._r))),
			Math.max(0, Math.min(1, linearToSRGB(this._g))),
			Math.max(0, Math.min(1, linearToSRGB(this._b))),
			this._a,
		);
	}

	/**
	 * Applies Reinhard tone mapping to this color and returns a new LDR Color instance.
	 * Formulated as: C_out = (C_in * exposure) / (1 + C_in * exposure)
	 * @param {number} [exposure=1.0] - The exposure value
	 * @returns {Color} A new tone-mapped Color
	 */
	public toneMapReinhard(exposure: number = 1.0): Color {
		const r = (this._r * exposure) / (1.0 + this._r * exposure);
		const g = (this._g * exposure) / (1.0 + this._g * exposure);
		const b = (this._b * exposure) / (1.0 + this._b * exposure);
		return new Color(r, g, b, this._a);
	}

	/**
	 * Applies Narkowicz ACES filmic tone mapping approximation to this color and returns a new LDR Color instance.
	 * This curves the highlights and shadows to mimic physical film stock.
	 * @returns {Color} A new tone-mapped Color
	 */
	public toneMapACES(): Color {
		const aces = (c: number) => {
			const a = 2.51;
			const b = 0.03;
			const cc = 2.43;
			const d = 0.59;
			const e = 0.14;
			const val = (c * (a * c + b)) / (c * (cc * c + d) + e);
			return Math.max(0, Math.min(1, val));
		};
		return new Color(aces(this._r), aces(this._g), aces(this._b), this._a);
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
			const r = val[0] !== undefined ? val[0] : 0;
			const g = val[1] !== undefined ? val[1] : 0;
			const b = val[2] !== undefined ? val[2] : 0;
			const a = val[3] !== undefined ? val[3] : 1.0;
			return new Color(r, g, b, a);
		}
		return new Color();
	}

	/** Standard CSS/HTML W3C color name mapping. */
	public static readonly CSS_NAMES: Record<string, string> = {
		aliceblue: "#f0f8ff",
		antiquewhite: "#faebd7",
		aqua: "#00ffff",
		aquamarine: "#7fffd4",
		azure: "#f0ffff",
		beige: "#f5f5dc",
		bisque: "#ffe4c4",
		black: "#000000",
		blanchedalmond: "#ffebcd",
		blue: "#0000ff",
		blueviolet: "#8a2be2",
		brown: "#a52a2a",
		burlywood: "#deb887",
		cadetblue: "#5f9ea0",
		chartreuse: "#7fff00",
		chocolate: "#d2691e",
		coral: "#ff7f50",
		cornflowerblue: "#6495ed",
		cornsilk: "#fff8dc",
		crimson: "#dc143c",
		cyan: "#00ffff",
		darkblue: "#00008b",
		darkcyan: "#008b8b",
		darkgoldenrod: "#b8860b",
		darkgray: "#a9a9a9",
		darkgrey: "#a9a9a9",
		darkgreen: "#006400",
		darkkhaki: "#bdb76b",
		darkmagenta: "#8b008b",
		darkolivegreen: "#556b2f",
		darkorange: "#ff8c00",
		darkorchid: "#9932cc",
		darkred: "#8b0000",
		darksalmon: "#e9967a",
		darkseagreen: "#8fbc8f",
		darkslateblue: "#483d8b",
		darkslategray: "#2f4f4f",
		darkslategrey: "#2f4f4f",
		darkturquoise: "#00ced1",
		darkviolet: "#9400d3",
		deeppink: "#ff1493",
		deepskyblue: "#00bfff",
		dimgray: "#696969",
		dimgrey: "#696969",
		dodgerblue: "#1e90ff",
		firebrick: "#b22222",
		floralwhite: "#fffaf0",
		forestgreen: "#228b22",
		fuchsia: "#ff00ff",
		gainsboro: "#dcdcdc",
		ghostwhite: "#f8f8ff",
		gold: "#ffd700",
		goldenrod: "#daa520",
		gray: "#808080",
		grey: "#808080",
		green: "#008000",
		greenyellow: "#adff2f",
		honeydew: "#f0fff0",
		hotpink: "#ff69b4",
		indianred: "#cd5c5c",
		indigo: "#4b0082",
		ivory: "#fffff0",
		khaki: "#f0e68c",
		lavender: "#e6e6fa",
		lavenderblush: "#fff0f5",
		lawngreen: "#7cfc00",
		lemonchiffon: "#fffacd",
		lightblue: "#add8e6",
		lightcoral: "#f08080",
		lightcyan: "#e0ffff",
		lightgoldenrodyellow: "#fafad2",
		lightgray: "#d3d3d3",
		lightgrey: "#d3d3d3",
		lightgreen: "#90ee90",
		lightpink: "#ffb6c1",
		lightsalmon: "#ffa07a",
		lightseagreen: "#20b2aa",
		lightskyblue: "#87cefa",
		lightslategray: "#778899",
		lightslategrey: "#778899",
		lightsteelblue: "#b0c4de",
		lightyellow: "#ffffe0",
		lime: "#00ff00",
		limegreen: "#32cd32",
		linen: "#faf0e6",
		magenta: "#ff00ff",
		maroon: "#800000",
		mediumaquamarine: "#66cdaa",
		mediumblue: "#0000cd",
		mediumorchid: "#ba55d3",
		mediumpurple: "#9370db",
		mediumseagreen: "#3cb371",
		mediumslateblue: "#7b68ee",
		mediumspringgreen: "#00fa9a",
		mediumturquoise: "#48d1cc",
		mediumvioletred: "#c71585",
		midnightblue: "#191970",
		mintcream: "#f5fffa",
		mistyrose: "#ffe4e1",
		moccasin: "#ffe4b5",
		navajowhite: "#ffdead",
		navy: "#000080",
		oldlace: "#fdf5e6",
		olive: "#808000",
		olivedrab: "#6b8e23",
		orange: "#ffa500",
		orangered: "#ff4500",
		orchid: "#da70d6",
		palegoldenrod: "#eee8aa",
		palegreen: "#98fb98",
		paleturquoise: "#afeeee",
		palevioletred: "#db7093",
		papayawhip: "#ffefd5",
		peachpuff: "#ffdab9",
		peru: "#cd853f",
		pink: "#ffc0cb",
		plum: "#dda0dd",
		powderblue: "#b0e0e6",
		purple: "#800080",
		rebeccapurple: "#663399",
		red: "#ff0000",
		rosybrown: "#bc8f8f",
		royalblue: "#4169e1",
		saddlebrown: "#8b4513",
		salmon: "#fa8072",
		sandybrown: "#f4a460",
		seagreen: "#2e8b57",
		seashell: "#fff5ee",
		sienna: "#a0522d",
		silver: "#c0c0c0",
		skyblue: "#87ceeb",
		slateblue: "#6a5acd",
		slategray: "#708090",
		slategrey: "#708090",
		snow: "#fffafa",
		springgreen: "#00ff7f",
		steelblue: "#4682b4",
		tan: "#d2b48c",
		teal: "#008080",
		thistle: "#d8bfd8",
		tomato: "#ff6347",
		turquoise: "#40e0d0",
		violet: "#ee82ee",
		wheat: "#f5deb3",
		white: "#ffffff",
		whitesmoke: "#f5f5f5",
		yellow: "#ffff00",
		yellowgreen: "#9acd32",
	};
}
