import { Context } from "../core/context";
import { Loader } from "../core/loader";

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
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        });
        const whitePixel = new Uint8Array([255, 255, 255, 255]);
        ctx.device.queue.writeTexture(
            { texture: tex.gpuTexture },
            whitePixel,
            { bytesPerRow: 4, rowsPerImage: 1 },
            [1, 1, 1]
        );

        // Async Loader
        const loader = new Loader(ctx.device);
        loader.loadTexture(url).then(gpuTex => {
            tex.gpuTexture.destroy(); // Remove dummy
            tex.gpuTexture = gpuTex;
            tex.isLoaded = true;
            for (const cb of tex.listeners) cb();
        }).catch(err => {
            console.error(`Error loading texture ${url}`, err);
        });

        return tex;
    }

    public static getDummyWhite(ctx: Context): Texture {
        const tex = new Texture();
        tex.url = "dummy_white";
        tex.gpuTexture = ctx.device.createTexture({
            size: [1, 1, 1],
            format: "rgba8unorm",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        });
        const whitePixel = new Uint8Array([255, 255, 255, 255]);
        ctx.device.queue.writeTexture(
            { texture: tex.gpuTexture },
            whitePixel,
            { bytesPerRow: 4, rowsPerImage: 1 },
            [1, 1, 1]
        );
        tex.isLoaded = true;
        return tex;
    }

    // Normal maps treat RGB as XYZ vector mapping. (128, 128, 255) means straight Z.
    public static getDummyNormal(ctx: Context): Texture {
        const tex = new Texture();
        tex.url = "dummy_normal";
        tex.gpuTexture = ctx.device.createTexture({
            size: [1, 1, 1],
            format: "rgba8unorm",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        });
        const normalPixel = new Uint8Array([128, 128, 255, 255]);
        ctx.device.queue.writeTexture(
            { texture: tex.gpuTexture },
            normalPixel,
            { bytesPerRow: 4, rowsPerImage: 1 },
            [1, 1, 1]
        );
        tex.isLoaded = true;
        return tex;
    }
}
