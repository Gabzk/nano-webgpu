/**
 * Pluggable model parser interface that allows extending the `Loader`
 * to support novel 3D geometry formats without altering engine internals.
 */

/**
 * Represents a single logical partition or primitive segment of a 3D model.
 * In complex multi-material models, each primitive mesh is stored as a distinct ModelPart
 * to allow different material configurations, vertex structures, or drawing commands.
 *
 * @group Core
 */
export interface ModelPart {
	/**
	 * Interleaved floating-point vertex buffer components.
	 * Typically ordered sequentially as: Position (X, Y, Z), Normal (X, Y, Z), and UV (U, V).
	 */
	vertices: number[];

	/**
	 * Triangle index element buffer list.
	 * Identifies the indices of vertices composing the triangular face primitives.
	 */
	indices: number[];

	/**
	 * Configuration attributes representing physical PBR material options
	 * matching StandardMaterialOptions parameters.
	 */
	// biome-ignore lint/suspicious/noExplicitAny: material option shapes are resolved by StandardMaterial
	materialOptions?: Record<string, any> | null;
}

/**
 * Container holding the aggregate geometry data and material configurations parsed from a 3D asset file.
 *
 * @group Core
 */
export interface ModelData {
	/**
	 * Collection of distinct geometric partitions that form this model.
	 * When defined, these parts represent multiple material/mesh subsets.
	 */
	parts?: ModelPart[];

	/**
	 * Interleaved vertex data for single-part or legacy geometric representations.
	 * Typically contains Position (X, Y, Z), Normal (X, Y, Z), and Texture Coordinate (U, V) components.
	 */
	vertices: number[];

	/**
	 * Triangle element index buffer for single-part models.
	 */
	indices: number[];

	/**
	 * Base material parameters and configuration mapping for single-part models.
	 */
	// biome-ignore lint/suspicious/noExplicitAny: material option shapes are resolved by StandardMaterial
	materialOptions?: Record<string, any> | null;
}

/**
 * ModelParser defines the interface for standardizing third-party 3D file formats
 * (e.g. GLTF, OBJ, FBX) into a format-agnostic `ModelData` hierarchy.
 *
 * @group Core
 */
export interface ModelParser {
	/**
	 * Evaluates whether this parser is capable of reading and interpreting the target file asset,
	 * typically by inspecting the path extension or resource query strings.
	 *
	 * @param url - The source web address or file path.
	 * @returns True if parsing can be attempted, false otherwise.
	 */
	canParse(url: string): boolean;

	/**
	 * Asynchronously parses a raw network response into the standardized engine `ModelData` model.
	 *
	 * @param url - The source web address or file path of the asset.
	 * @param response - The raw, unconsumed network Response object.
	 * @returns A promise resolving to a parsed ModelData structure.
	 */
	parse(url: string, response: Response): Promise<ModelData>;
}
