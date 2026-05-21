import { lightingChunk } from "./chunks/lighting.chunk";
import { normalMapChunk } from "./chunks/normal-map.chunk";
import { getShadowChunk } from "./chunks/shadow.chunk";
import { structsChunk } from "./chunks/structs.chunk";
import { vertexChunk } from "./chunks/vertex.chunk";

/**
 * Options defining standard shading compilations.
 */
export interface DefaultShaderOptions {
	/** If true, compiles PCF soft shadow sampling operations (using 9 tap comparisons). Otherwise uses 1 tap comparison. */
	usePCF: boolean;
}

/**
 * Programmatically constructs the default metallic-roughness PBR shader by stitching WGSL source chunks.
 * Combines camera structures, instancing vertices, normal mapping routines, shadow calculation utilities,
 * and standard physically-based lighting shaders.
 *
 * @param opts - Shadow kernel configurations.
 * @returns The fully assembled WGSL shader source code.
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
