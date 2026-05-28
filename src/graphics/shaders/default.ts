import { getLightingChunk } from "./chunks/lighting.chunk";
import { normalMapChunk } from "./chunks/normal-map.chunk";
import { getShadowChunk } from "./chunks/shadow.chunk";
import { getStructsChunk } from "./chunks/structs.chunk";
import { getVertexChunk } from "./chunks/vertex.chunk";

/**
 * Options defining standard shading compilations.
 */
export interface DefaultShaderOptions {
	/** If true, compiles PCF soft shadow sampling operations (using 9 tap comparisons). Otherwise uses 1 tap comparison. */
	usePCF: boolean;
	/** If true, compiles Cascaded Shadow Maps (CSM) sampling operations. */
	useCSM?: boolean;
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
	const useCSM = opts.useCSM ?? false;
	return [
		getStructsChunk(useCSM),
		getVertexChunk(useCSM),
		normalMapChunk,
		getShadowChunk(opts.usePCF, useCSM),
		getLightingChunk(useCSM),
	].join("\n");
}
