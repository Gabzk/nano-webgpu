/**
 * Structural interface for Texture implementation to prevent circular imports between Context and Texture.
 * Both Context and high-level wrappers should reference ITexture instead of concrete Texture classes.
 *
 * @group Graphics
 */
export interface ITexture {
	/** Active native WebGPU GPUTexture resource. */
	gpuTexture: GPUTexture;

	/** Flag indicating whether the real image asset has successfully finished loading. */
	isLoaded: boolean;

	/** Source web address or file path of the image asset. */
	url: string;

	/**
	 * Releases texture resources from GPU memory and unregisters entries from the VRAM tracker.
	 *
	 * @param ctx - Active context.
	 */
	destroy(ctx: any): void;
}
