import type { Context } from "../core/context";

/**
 * Texture is a high-level wrapper around the native WebGPU `GPUTexture`.
 * Handles asynchronous background texture fetching and allocation while immediately supplying
 * lightweight fallback pixel placeholders (solid white or flat normal vectors) to avoid
 * blocking rendering pipelines during network transfers.
 *
 * @group Graphics
 */
export class Texture {
	/** Active native WebGPU GPUTexture resource. */
	public gpuTexture!: GPUTexture;

	/** Flag indicating whether the real image asset has successfully finished loading. */
	public isLoaded: boolean = false;

	/** Source web address or file path of the image asset. */
	public url: string = "";

	/** @internal Collection of callback hooks triggered immediately upon resource completion. */
	private listeners: (() => void)[] = [];

	/**
	 * Registers a callback routine invoked when the asynchronous texture load successfully completes.
	 * Returns an unsubscribe function to safely detach the callback and prevent memory leaks.
	 *
	 * @param cb - The update callback function.
	 * @returns A function to unsubscribe this callback.
	 */
	public onUpdate(cb: () => void): () => void {
		this.listeners.push(cb);
		return () => {
			const idx = this.listeners.indexOf(cb);
			if (idx !== -1) {
				this.listeners.splice(idx, 1);
			}
		};
	}

	/**
	 * Spawns a Texture loading sequence in the background, immediately returning a container holding
	 * a 1x1 solid white pixel. Replaces the placeholder texture in-place once loading finishes,
	 * triggering all update listeners. Revokes Blob URLs automatically to prevent memory leaks.
	 *
	 * @param ctx - Active context.
	 * @param url - Source address of the texture image.
	 * @param options - Custom format configurations.
	 * @returns The newly allocated Texture instance.
	 */
	public static loadBackground(
		ctx: Context,
		url: string,
		options: { format?: GPUTextureFormat } = {},
	): Texture {
		const tex = new Texture();
		tex.url = url;

		// 1x1 White dummy texture while the real one loads
		tex.gpuTexture = ctx.device.createTexture({
			size: [1, 1, 1],
			format: options.format || "rgba8unorm",
			usage:
				GPUTextureUsage.TEXTURE_BINDING |
				GPUTextureUsage.COPY_DST |
				GPUTextureUsage.RENDER_ATTACHMENT,
		});
		ctx.vramTracker.register(
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

		// Use the per-context loader singleton (avoids allocating a new Loader per load)
		ctx.loader
			.loadTexture(url, { format: options.format })
			.then((gpuTex) => {
				ctx.vramTracker.unregister(tex.gpuTexture);
				tex.gpuTexture.destroy();
				tex.gpuTexture = gpuTex;
				const w = gpuTex.width || 1;
				const h = gpuTex.height || 1;
				ctx.vramTracker.register(
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
	 * Resolves a global, cached 1x1 solid white pixel placeholder texture.
	 * Reuses the same instance across the entire context lifetime to optimize memory.
	 *
	 * @param ctx - Active context.
	 * @returns The white placeholder Texture.
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
		ctx.vramTracker.register(
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
	 * Resolves a global, cached 1x1 neutral normal map texture.
	 * Returns a straight-up vector (128, 128, 255, 255) representing (0, 0, 1) tangent coordinates.
	 * Reuses the same instance across the entire context lifetime.
	 *
	 * @param ctx - Active context.
	 * @returns The flat normal map fallback Texture.
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
		ctx.vramTracker.register(
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

	/**
	 * Releases texture resources from GPU memory and unregisters entries from the VRAM tracker.
	 *
	 * @param ctx - Active context.
	 */
	public destroy(ctx: Context): void {
		if (this.gpuTexture) {
			ctx.vramTracker.unregister(this.gpuTexture);
			this.gpuTexture.destroy();
			// @ts-expect-error - allow cleanup reference assignment
			this.gpuTexture = null;
		}
	}
}
