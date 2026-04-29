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

	/**
	 * Called when the texture finishes loading.
	 */
	public onUpdate(cb: () => void): void {
		this.listeners.push(cb);
	}

	/**
	 * Loads a texture synchronously, substituting a white pixel until finished.
	 * If `url` is a Blob URL (created by the GLTF loader for embedded textures),
	 * it will be automatically revoked after the GPU upload completes.
	 * @param ctx The Context
	 * @param url The image URL (or a blob: URL for embedded GLTF images)
	 */
	public static loadBackground(ctx: Context, url: string): Texture {
		const tex = new Texture();
		tex.url = url;

		// 1x1 White dummy texture while the real one loads
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

		// Async loader
		const loader = new Loader(ctx.device);
		loader
			.loadTexture(url)
			.then((gpuTex) => {
				VRAMTracker.unregister(tex.gpuTexture);
				tex.gpuTexture.destroy();
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
				// Revoke blob URLs created by the GLTF loader for embedded images
				if (url.startsWith("blob:")) {
					URL.revokeObjectURL(url);
				}
				for (const cb of tex.listeners) cb();
			})
			.catch((err) => {
				console.error(`Error loading texture ${url}`, err);
			});

		return tex;
	}

	/**
	 * Returns a cached 1×1 white dummy texture for the given context.
	 * Created once per context and reused — safe across multiple Scene instances.
	 */
	public static getDummyWhite(ctx: Context): Texture {
		if (ctx.defaultTextures.white) return ctx.defaultTextures.white as Texture;

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
		ctx.defaultTextures.white = tex;
		return tex;
	}

	/**
	 * Returns a cached 1×1 flat normal dummy texture for the given context.
	 * (128, 128, 255) → straight-Z normal. Created once per context and reused.
	 */
	public static getDummyNormal(ctx: Context): Texture {
		if (ctx.defaultTextures.normal)
			return ctx.defaultTextures.normal as Texture;

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
		ctx.defaultTextures.normal = tex;
		return tex;
	}
}
