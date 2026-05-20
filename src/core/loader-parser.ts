/**
 * @module LoaderParser
 *
 * Pluggable model parser interface that lets external code extend the Loader
 * with new 3D formats without modifying library internals (Open/Closed Principle).
 */

/**
 * A single part of a model — corresponds to one GLTF primitive.
 * Multi-material models (e.g. GLB with per-mesh colors) produce one part per primitive.
 */
export interface ModelPart {
	/** Interleaved vertex data: pos(3) + normal(3) + uv(2) per vertex */
	vertices: number[];
	/** Triangle index list */
	indices: number[];
	/**
	 * Parsed PBR material options compatible with StandardMaterialOptions.
	 * Keys match StandardMaterialOptions field names.
	 * `albedoColor` is set when the primitive has a `baseColorFactor` but no texture.
	 */
	// biome-ignore lint/suspicious/noExplicitAny: material option shapes are resolved by StandardMaterial
	materialOptions?: Record<string, any> | null;
}

/**
 * Raw model data returned by any parser — format-agnostic geometry + material hints.
 */
export interface ModelData {
	/**
	 * When the model has multiple primitives with independent materials,
	 * each is represented as a separate `ModelPart`.
	 * If present, `vertices` / `indices` / `materialOptions` at the root are ignored
	 * by `Mesh.load` — use `parts` instead.
	 */
	parts?: ModelPart[];

	/** Interleaved vertex data: pos(3) + normal(3) + uv(2) per vertex (single-part models) */
	vertices: number[];
	/** Triangle index list (single-part models) */
	indices: number[];
	/**
	 * Parsed PBR material options compatible with StandardMaterialOptions.
	 * Keys match StandardMaterialOptions field names.
	 */
	// biome-ignore lint/suspicious/noExplicitAny: material option shapes are resolved by StandardMaterial
	materialOptions?: Record<string, any> | null;
}

/**
 * Interface for a model format parser.
 * Register custom parsers via `ctx.loader.registerParser(myParser)`.
 */
export interface ModelParser {
	/**
	 * Return true if this parser handles the given URL (e.g. by extension).
	 */
	canParse(url: string): boolean;

	/**
	 * Parse the model from the already-fetched Response.
	 * The response body has NOT been consumed yet when this is called.
	 */
	parse(url: string, response: Response): Promise<ModelData>;
}
