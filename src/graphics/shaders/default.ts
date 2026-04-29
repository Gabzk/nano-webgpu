import { lightingChunk } from "./chunks/lighting.chunk";
import { normalMapChunk } from "./chunks/normal-map.chunk";
import { getShadowChunk } from "./chunks/shadow.chunk";
import { structsChunk } from "./chunks/structs.chunk";
import { vertexChunk } from "./chunks/vertex.chunk";

export interface DefaultShaderOptions {
	/** When true, uses a 3×3 PCF kernel (9 samples) for soft shadow edges.
	 *  When false, uses a single sample — ~9× cheaper on shadow-map bandwidth. */
	usePCF: boolean;
}

/**
 * Assembles the default PBR shader from composable chunks.
 * The result is a complete, valid WGSL string ready for createShaderModule().
 *
 * Each call with the same options produces an identical string, so the
 * PipelineManager can use it as a cache key with no extra bookkeeping.
 */
export function buildDefaultShader(opts: DefaultShaderOptions): string {
	return [
		structsChunk,
		vertexChunk,
		normalMapChunk,
		getShadowChunk(opts.usePCF),
		lightingChunk,
	].join("\n");
}
