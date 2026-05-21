/**
 * Defines the culling behaviors supported by the renderer.
 * Extends the native WebGPU `GPUCullMode` (`"none" | "front" | "back"`) with an additional `"disabled"` keyword.
 */
export type CullMode = GPUCullMode | "disabled";

/**
 * Normalizes custom CullMode parameters into standardized WebGPU `GPUCullMode` options.
 * Maps `"disabled"` directly to `"none"` to conform with the WebGPU specification.
 *
 * @param mode - The current CullMode option or undefined.
 * @returns Standard GPUCullMode value or undefined.
 */
export function normalizeCullMode(mode?: CullMode): GPUCullMode | undefined {
	if (!mode) return undefined;
	return mode === "disabled" ? "none" : mode;
}

/**
 * Checks if face culling is disabled under the given culling mode.
 *
 * @param mode - The current CullMode option or undefined.
 * @returns True if culling is disabled or none, false otherwise.
 */
export function isCullDisabled(mode?: CullMode): boolean {
	return mode === "disabled" || mode === "none";
}

/**
 * Resolves the final culling mode based on the material configuration and primitive topology.
 * If no culling mode is explicitly provided, standard triangle-lists default to back-face culling,
 * whereas non-triangular primitive lists (lines, points) default to no culling.
 *
 * @param mode - The requested culling mode.
 * @param topology - The primitive rendering topology.
 * @returns The resolved WebGPU-compliant GPUCullMode.
 */
export function resolveCullMode(
	mode: GPUCullMode | undefined,
	topology: GPUPrimitiveTopology,
): GPUCullMode {
	if (mode) return mode;
	return topology === "triangle-list" ? "back" : "none";
}
