export type CullMode = GPUCullMode | "disabled";

export function normalizeCullMode(mode?: CullMode): GPUCullMode | undefined {
	if (!mode) return undefined;
	return mode === "disabled" ? "none" : mode;
}

export function isCullDisabled(mode?: CullMode): boolean {
	return mode === "disabled" || mode === "none";
}

export function resolveCullMode(
	mode: GPUCullMode | undefined,
	topology: GPUPrimitiveTopology,
): GPUCullMode {
	if (mode) return mode;
	return topology === "triangle-list" ? "back" : "none";
}
