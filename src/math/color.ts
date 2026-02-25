export class Color {
    public r: number;
    public g: number;
    public b: number;
    public a: number;

    constructor(r: number = 0.0, g: number = 0.0, b: number = 0.0, a: number = 1.0) {
        if (r < 0 || r > 1 || g < 0 || g > 1 || b < 0 || b > 1 || a < 0 || a > 1) {
            throw new Error('Invalid floats');
        }
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    }

    public static fromBytes(r: number = 0, g: number = 0, b: number = 0, a: number = 255): Color {
        if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255 || a < 0 || a > 255) {
            throw new Error('Invalid bytes');
        }
        return new Color(r / 255.0, g / 255.0, b / 255.0, a / 255.0);
    }

    public static fromHex(hex: string): Color {
        if (hex.startsWith('#')) {
            hex = hex.substring(1);
        }
        if (hex.length !== 6) {
            throw new Error('Invalid hex color');
        }
        if (!/^[0-9a-fA-F]+$/.test(hex)) {
            throw new Error('Invalid hex color');
        }
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return new Color(r / 255.0, g / 255.0, b / 255.0, 1.0);
    }

    public static lerp(color1: Color, color2: Color, t: number): Color {
        if (t < 0 || t > 1) {
            throw new Error('Invalid lerp values');
        }
        return new Color(
            color1.r + (color2.r - color1.r) * t,
            color1.g + (color2.g - color1.g) * t,
            color1.b + (color2.b - color1.b) * t,
            color1.a + (color2.a - color1.a) * t
        );
    }

    public toFloat32Array(): Float32Array {
        return new Float32Array([this.r, this.g, this.b, this.a]);
    }

}