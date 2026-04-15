import type { Context } from "../core/context";
import { Loader } from "../core/loader";
import { VRAMTracker } from "../debug/vram-tracker";

/**
 * A wrapper for GPUTexture that handles asynchronous loading.
 */
export class Texture {
	public gpuTexture!: GPUTexture;
	public isLoaded: boolean = false;
	public url: string = "";
	private listeners: (() => void)[] = [];

	// --- Static caches for dummy textures (prevents memory leak) ---
	private static _dummyWhite: Texture | null = null;
	private static _dummyNormal: Texture | null = null;

	/**
	 * Called when the texture finishes loading.
	 */
	public onUpdate(cb: () => void): void {
		this.listeners.push(cb);
	}

	/**
	 * Loads a texture synchronously, substituting a white pixel until finished.
	 * @param ctx The Context
	 * @param url The image URL
	 */
	public static loadBackground(ctx: Context, url: string): Texture {
		const tex = new Texture();
		tex.url = url;

		// 1x1 White dummy texture
		tex.gpuTexture = ctx.device.createTexture({
			size: [1, 1, 1],
			format: "rgba8unorm",
			usage:
				GPUTextureUsage.TEXTURE_BINDING |
				GPUTextureUsage.COPY_DST |
				GPUTextureUsage.RENDER_ATTACHMENT,
		});
		VRAMTracker.register(
			tex.gpuTexture,
			"texture",
			`Tex dummy: ${url}`,
			4,
			"Texture",
		);
		const whitePixel = new Uint8Array([255, 255, 255, 255]);
		ctx.device.queue.writeTexture(
			{ texture: tex.gpuTexture },
			whitePixel,
			{ bytesPerRow: 4, rowsPerImage: 1 },
			[1, 1, 1],
		);

		// Async Loader
		const loader = new Loader(ctx.device);
		loader
			.loadTexture(url)
			.then((gpuTex) => {
				VRAMTracker.unregister(tex.gpuTexture); // Remove dummy
				tex.gpuTexture.destroy(); // Remove dummy
				tex.gpuTexture = gpuTex;
				const w = gpuTex.width || 1;
				const h = gpuTex.height || 1;
				VRAMTracker.register(
					gpuTex,
					"texture",
					`Tex: ${url}`,
					w * h * 4,
					"Texture",
				);
				tex.isLoaded = true;
				for (const cb of tex.listeners) cb();
			})
			.catch((err) => {
				console.error(`Error loading texture ${url}`, err);
			});

		return tex;
	}

	/**
	 * Returns a cached 1x1 white dummy texture. Created once, reused forever.
	 */
	public static getDummyWhite(ctx: Context): Texture {
		if (Texture._dummyWhite) return Texture._dummyWhite;

		const tex = new Texture();
		tex.url = "dummy_white";
		tex.gpuTexture = ctx.device.createTexture({
			size: [1, 1, 1],
			format: "rgba8unorm",
			usage:
				GPUTextureUsage.TEXTURE_BINDING |
				GPUTextureUsage.COPY_DST |
				GPUTextureUsage.RENDER_ATTACHMENT,
		});
		VRAMTracker.register(
			tex.gpuTexture,
			"texture",
			"Dummy White",
			4,
			"Texture",
		);
		const whitePixel = new Uint8Array([255, 255, 255, 255]);
		ctx.device.queue.writeTexture(
			{ texture: tex.gpuTexture },
			whitePixel,
			{ bytesPerRow: 4, rowsPerImage: 1 },
			[1, 1, 1],
		);
		tex.isLoaded = true;
		Texture._dummyWhite = tex;
		return tex;
	}

	/**
	 * Returns a cached 1x1 flat normal dummy texture. Created once, reused forever.
	 * Normal maps treat RGB as XYZ vector mapping. (128, 128, 255) means straight Z.
	 */
	public static getDummyNormal(ctx: Context): Texture {
		if (Texture._dummyNormal) return Texture._dummyNormal;

		const tex = new Texture();
		tex.url = "dummy_normal";
		tex.gpuTexture = ctx.device.createTexture({
			size: [1, 1, 1],
			format: "rgba8unorm",
			usage:
				GPUTextureUsage.TEXTURE_BINDING |
				GPUTextureUsage.COPY_DST |
				GPUTextureUsage.RENDER_ATTACHMENT,
		});
		VRAMTracker.register(
			tex.gpuTexture,
			"texture",
			"Dummy Normal",
			4,
			"Texture",
		);
		const normalPixel = new Uint8Array([128, 128, 255, 255]);
		ctx.device.queue.writeTexture(
			{ texture: tex.gpuTexture },
			normalPixel,
			{ bytesPerRow: 4, rowsPerImage: 1 },
			[1, 1, 1],
		);
		tex.isLoaded = true;
		Texture._dummyNormal = tex;
		return tex;
	}
}
