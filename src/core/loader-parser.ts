/**
 * @module LoaderParser
 *
 * Pluggable model parser interface that lets external code extend the Loader
 * with new 3D formats without modifying library internals (Open/Closed Principle).
 */

/**
 * Raw model data returned by any parser — format-agnostic geometry + material hints.
 */
export interface ModelData {
	/** Interleaved vertex data: pos(3) + normal(3) + uv(2) per vertex */
	vertices: number[];
	/** Triangle index list */
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
