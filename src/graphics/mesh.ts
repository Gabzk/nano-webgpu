import { CollisionShape } from "../core/collision-shape";
import type { Context } from "../core/context";
import { Node3D } from "../core/node3d";
import { AABB } from "../math/aabb";
import { Vec3 } from "../math/vec3";
import type { CullMode } from "./cull-mode";
import { Geometry } from "./geometry";
import { Material } from "./materials/material";
import {
	StandardMaterial,
	type StandardMaterialOptions,
} from "./materials/standard-material";
import { Texture } from "./texture";

/**
 * Configuration options utilized during direct Mesh node instantiation.
 */
export interface MeshOptions {
	/** Underlying GPU vertex/index buffer geometry interface. */
	geometry: Geometry;
	/** Legacy shorthand option to load and assign a simple albedo texture. */
	texture?: string | Texture;
	/** Explicit Material instance or configuration properties for StandardMaterial. */
	material?: Material | StandardMaterialOptions;
	/** Initial spatial position coordinate vector. */
	position?: number[] | Vec3;
	/** Initial spatial Euler rotation vector in radians. */
	rotation?: number[] | Vec3;
	/** Initial spatial Euler rotation vector in degrees. */
	rotationDegrees?: number[] | Vec3;
	/** Initial spatial scale multiplier or component scale vector. */
	scale?: number | number[] | Vec3;
}

/**
 * Configuration options utilized during programmatic mesh construction via `Mesh.build()`.
 */
export interface BuildMeshOptions {
	/** Ordering layout identifying attributes (e.g. `['position', 'normal', 'uv']`). */
	vertexFormat: string[];
	/** Raw vertex array containing sequence of attributes defined by format. */
	vertexBuffer: number[];
	/** Index element buffer array. If omitted, sequential indices are auto-generated. */
	indices?: number[];
	/** GPU primitive assembly topology. Defaults to `"triangle-list"`. */
	topology?: GPUPrimitiveTopology;
	/** Custom culling specification. Defaults to normal back-face culling for triangles. */
	cullMode?: CullMode;
	/** Material instance or configuration parameters. */
	material?: Material | StandardMaterialOptions;
	/** Initial spatial position coordinate vector. */
	position?: number[] | Vec3;
	/** Initial spatial Euler rotation vector in radians. */
	rotation?: number[] | Vec3;
	/** Initial spatial Euler rotation vector in degrees. */
	rotationDegrees?: number[] | Vec3;
	/** Initial spatial scale multiplier or component scale vector. */
	scale?: number | number[] | Vec3;
	/** Automatically append the compiled mesh to the active scene graph. Defaults to `true`. */
	addToScene?: boolean;
}

/**
 * Mesh represents a physical, renderable 3D entity within the scene graph.
 * It couples geometric vertex/index buffers (Geometry) with shading parameter bindings (Material)
 * and maintains spatial Node3D transforms.
 */
export class Mesh extends Node3D {
	/** Type identifier used for fast polymorphic runtime checks. */
	public readonly isMesh = true;

	/** Parent Context reference. */
	public ctx: Context;

	/** Underlying geometry instance holding vertex and index buffers. */
	public geometry: Geometry;

	/** @internal Assigned Material shader instance. */
	private _material!: Material;

	/** Gets the active Material shader instance. */
	public override get material(): Material {
		return this._material;
	}

	/** Sets the active Material shader instance and marks the node transform as dirty. */
	public override set material(value: Material) {
		this._material = value;
		this.isDirty = true;
	}

	/** Mapping of standard vertex attributes to their component size (float count). */
	public static readonly FORMAT_SIZES: Record<string, number> = {
		position: 3,
		normal: 3,
		uv: 2,
		color: 3,
		tangent: 4,
	};

	/**
	 * Programmatically compiles a new Mesh from raw floating-point arrays.
	 * Decodes arbitrary interleaved arrays, re-aligns them to standard 11-float vertices
	 * (pos:3, norm:3, uv:2, color:3), creates dedicated GPUBuffers, and resolves materials.
	 *
	 * @param ctx - Active framework context.
	 * @param config - Mesh assembly and transformation configurations.
	 * @returns The newly assembled Mesh instance.
	 */
	public static build(ctx: Context, config: BuildMeshOptions): Mesh {
		const {
			vertexFormat,
			vertexBuffer,
			indices,
			topology = "triangle-list",
			cullMode,
			material,
			addToScene = true,
			...transformOptions
		} = config;

		// Calculate stride from format
		let stride = 0;

		for (const attr of vertexFormat) {
			const size = Mesh.FORMAT_SIZES[attr];
			if (!size) {
				throw new Error(
					`buildMesh: Unknown vertex attribute "${attr}". Valid: ${Object.keys(Mesh.FORMAT_SIZES).join(", ")}`,
				);
			}
			stride += size;
		}

		const vertexCount = Math.floor(vertexBuffer.length / stride);
		if (vertexCount * stride !== vertexBuffer.length) {
			throw new Error(
				`buildMesh: vertexBuffer length (${vertexBuffer.length}) is not evenly divisible by stride (${stride}). Check your vertexFormat.`,
			);
		}

		// Our standard pipeline expects: position(3) + normal(3) + uv(2) + color(3) = 11 floats per vertex.
		// We need to remap whatever the user gave us into that format.
		const pipelineStride = 11; // pos(3) + normal(3) + uv(2) + color(3)
		const remappedVertices = new Float32Array(vertexCount * pipelineStride);
		let hasColors = false;

		for (let v = 0; v < vertexCount; v++) {
			const srcOffset = v * stride;
			const dstOffset = v * pipelineStride;

			let cursor = 0;
			let pos = [0, 0, 0];
			let norm = [0, 0, 1]; // Default normal: facing camera
			let uv = [0, 0];
			let col = [1.0, 1.0, 1.0]; // Default color: white

			for (const attr of vertexFormat) {
				const attrSize = Mesh.FORMAT_SIZES[attr];
				if (attr === "position") {
					pos = [
						vertexBuffer[srcOffset + cursor],
						vertexBuffer[srcOffset + cursor + 1],
						vertexBuffer[srcOffset + cursor + 2],
					];
				} else if (attr === "normal") {
					norm = [
						vertexBuffer[srcOffset + cursor],
						vertexBuffer[srcOffset + cursor + 1],
						vertexBuffer[srcOffset + cursor + 2],
					];
				} else if (attr === "uv") {
					uv = [
						vertexBuffer[srcOffset + cursor],
						vertexBuffer[srcOffset + cursor + 1],
					];
				} else if (attr === "color") {
					hasColors = true;
					col = [
						vertexBuffer[srcOffset + cursor],
						vertexBuffer[srcOffset + cursor + 1],
						vertexBuffer[srcOffset + cursor + 2],
					];
				}
				cursor += attrSize;
			}

			// Write in pipeline order: position, normal, uv, color
			remappedVertices[dstOffset + 0] = pos[0];
			remappedVertices[dstOffset + 1] = pos[1];
			remappedVertices[dstOffset + 2] = pos[2];
			remappedVertices[dstOffset + 3] = norm[0];
			remappedVertices[dstOffset + 4] = norm[1];
			remappedVertices[dstOffset + 5] = norm[2];
			remappedVertices[dstOffset + 6] = uv[0];
			remappedVertices[dstOffset + 7] = uv[1];
			remappedVertices[dstOffset + 8] = col[0];
			remappedVertices[dstOffset + 9] = col[1];
			remappedVertices[dstOffset + 10] = col[2];
		}

		// Generate indices if not provided
		let indexArray: Uint16Array | Uint32Array;
		if (indices) {
			indexArray =
				vertexCount > 65535
					? new Uint32Array(indices)
					: new Uint16Array(indices);
		} else {
			const autoIndices = Array.from({ length: vertexCount }, (_, i) => i);
			indexArray =
				vertexCount > 65535
					? new Uint32Array(autoIndices)
					: new Uint16Array(autoIndices);
		}

		// Create Geometry
		const geometry = new Geometry(ctx, remappedVertices, indexArray, {
			hasNormals: true,
			hasUVs: true,
			hasColors: hasColors,
			topology,
		});

		// Resolve material
		let finalMaterial: Material;
		if (material instanceof Material) {
			finalMaterial = material;
		} else if (material) {
			finalMaterial = new StandardMaterial(material as StandardMaterialOptions);
		} else {
			finalMaterial = new StandardMaterial();
		}

		// Apply cullMode or default to "none" (unless a custom material/option already specified cullMode)
		if (cullMode !== undefined) {
			finalMaterial.cullMode = cullMode;
		} else {
			const hasMaterialCull =
				material instanceof Material
					? material.cullMode !== undefined
					: material &&
						(material as StandardMaterialOptions).cullMode !== undefined;
			if (!hasMaterialCull) {
				finalMaterial.cullMode = "none";
			}
		}

		// Create Mesh
		const mesh = new Mesh(ctx, { geometry, material: finalMaterial });
		Mesh.applyTransformOptions(mesh, transformOptions);

		return mesh;
	}

	/**
	 * Instantiates a renderable Mesh node coupling geometric buffers and material settings.
	 *
	 * @param ctx - Parent context.
	 * @param options - Instantiation options containing geometry, material details, and legacy texture fallbacks.
	 */
	constructor(ctx: Context, options: MeshOptions) {
		super();
		this.ctx = ctx;
		this.geometry = options.geometry;

		if (options.material) {
			if (options.material instanceof Material) {
				this.material = options.material;
			} else {
				this.material = new StandardMaterial(
					options.material as StandardMaterialOptions,
				);
			}
		} else if (options.texture) {
			// Legacy shorthand: convert texture automatically to StandardMaterial
			let tex: Texture;
			if (typeof options.texture === "string") {
				tex = Texture.loadBackground(ctx, options.texture);
			} else {
				tex = options.texture;
			}
			this.material = new StandardMaterial({ albedoTexture: tex });
		} else {
			this.material = new StandardMaterial();
		}
	}

	/**
	 * Detaches the Mesh from its hierarchy parent and optionally destroys associated GPUBuffers and Materials.
	 *
	 * @param destroyGeometry - If true, releases GPU vertex/index buffer allocations immediately.
	 *   Defaults to false to allow shared geometric allocations across instanced Mesh clones.
	 * @param destroyMaterial - If true, releases GPU uniform buffer allocations of the associated material immediately.
	 *   Defaults to false to allow shared material allocations.
	 */
	public destroy(
		destroyGeometry: boolean = false,
		destroyMaterial: boolean = false,
	): void {
		if (this.parent) {
			this.parent.remove(this);
		}
		if (destroyGeometry && this.geometry) {
			this.geometry.destroy(this.ctx);
		}
		if (destroyMaterial && this.material) {
			this.material.destroy(this.ctx);
		}
	}

	/**
	 * Extracts and copies translation, rotation, and scaling coordinates from an options block.
	 *
	 * @param mesh - Target Mesh node.
	 * @param options - Raw spatial option configurations.
	 */
	public static applyTransformOptions(
		mesh: Mesh,
		options: {
			position?: number[] | Vec3;
			scale?: number | number[] | Vec3;
			rotation?: number[] | Vec3;
			rotationDegrees?: number[] | Vec3;
		},
	) {
		if (options.position) {
			if (options.position instanceof Vec3) {
				mesh.position.copy(options.position);
			} else {
				mesh.position.copy(Vec3.from(options.position));
			}
		}
		if (options.scale !== undefined) {
			if (typeof options.scale === "number") {
				mesh.scale.set(options.scale, options.scale, options.scale);
			} else {
				mesh.scale.copy(Vec3.from(options.scale as number[]));
			}
		}
		if (options.rotation) {
			if (options.rotation instanceof Vec3) {
				mesh.rotation.copy(options.rotation);
			} else {
				mesh.rotation.copy(Vec3.from(options.rotation));
			}
		}
		if (options.rotationDegrees) {
			mesh.rotationDegrees = options.rotationDegrees;
		}
	}

	/**
	 * Factory method to instantiate a Cube mesh.
	 * Automatically generates and assigns box CollisionShapes.
	 *
	 * @param ctx - Parent context.
	 * @param options - Material parameters and sizing options.
	 * @returns The newly allocated Cube Mesh.
	 */
	public static createCube(
		ctx: Context,
		options: StandardMaterialOptions & {
			size?: number;
			position?: number[];
			rotation?: number[];
			rotationDegrees?: number[];
			scale?: number | number[];
		} = {},
	): Mesh {
		const geometry = ctx.primitives.getCube(ctx, options.size || 1.0);
		const mesh = new Mesh(ctx, { ...options, geometry } as MeshOptions);
		Mesh.applyTransformOptions(mesh, options);
		mesh.collisionShape = CollisionShape.box(options.size || 1.0);
		return mesh;
	}

	/**
	 * Factory method to instantiate a horizontal Plane mesh.
	 *
	 * @param ctx - Parent context.
	 * @param options - Material parameters and width/height dimensions.
	 * @returns The newly allocated Plane Mesh.
	 */
	public static createPlane(
		ctx: Context,
		options: StandardMaterialOptions & {
			width?: number;
			height?: number;
			position?: number[];
			rotation?: number[];
			rotationDegrees?: number[];
			scale?: number | number[];
		} = {},
	): Mesh {
		const geometry = ctx.primitives.getPlane(
			ctx,
			options.width || 1.0,
			options.height || 1.0,
		);
		const mesh = new Mesh(ctx, { ...options, geometry } as MeshOptions);
		Mesh.applyTransformOptions(mesh, options);
		return mesh;
	}

	/**
	 * Factory method to instantiate a Sphere mesh.
	 * Automatically generates and assigns spherical CollisionShapes.
	 *
	 * @param ctx - Parent context.
	 * @param options - Material parameters, radius dimension, and segment resolution.
	 * @returns The newly allocated Sphere Mesh.
	 */
	public static createSphere(
		ctx: Context,
		options: StandardMaterialOptions & {
			radius?: number;
			segments?: number;
			position?: number[];
			rotation?: number[];
			rotationDegrees?: number[];
			scale?: number | number[];
		} = {},
	): Mesh {
		const geometry = ctx.primitives.getSphere(
			ctx,
			options.radius || 1.0,
			options.segments || 16,
			options.segments || 16,
		);
		const mesh = new Mesh(ctx, { ...options, geometry } as MeshOptions);
		Mesh.applyTransformOptions(mesh, options);
		mesh.collisionShape = CollisionShape.sphere(options.radius || 1.0);
		return mesh;
	}

	/**
	 * Asynchronously fetches a 3D model asset from a URL, decodes it using a compatible ModelParser,
	 * allocates GPU vertex and index buffers, resolves standard physical materials, and generates
	 * appropriate CollisionShapes. Handles single-part OBJ geometries and hierarchical multi-part GLTF structures.
	 *
	 * @param ctx - Parent context.
	 * @param url - Web address or file path pointing to the 3D model.
	 * @param options - Material options or physical configurations.
	 * @returns A promise resolving to a container Node3D holding the loaded mesh segment nodes.
	 */
	public static async load(
		ctx: Context,
		url: string,
		// biome-ignore lint/suspicious/noExplicitAny: options are passed directly to sub-components
		options: any,
	): Promise<Node3D> {
		const modelData = await ctx.loader.loadModel(url);

		// ── Multi-part path (GLTF with per-primitive materials) ─────────────────
		if (modelData.parts && modelData.parts.length > 0) {
			const container = new Node3D();
			Mesh.applyTransformOptions(container as unknown as Mesh, options);

			for (const part of modelData.parts) {
				const vertexCount = part.vertices.length / 8;
				const optimalIndicesArray =
					vertexCount > 65535
						? new Uint32Array(part.indices)
						: new Uint16Array(part.indices);
				const geometry = new Geometry(
					ctx,
					new Float32Array(part.vertices),
					optimalIndicesArray,
					{ hasUVs: true, hasNormals: true },
				);

				// Per-part material: options override takes priority, then part material, then default
				const partFinalOptions = { ...options };
				if (!partFinalOptions.material && part.materialOptions) {
					partFinalOptions.material = part.materialOptions;
				}

				const mesh = new Mesh(ctx, { geometry, ...partFinalOptions });

				const localAABB = AABB.fromVertices(part.vertices, 8);
				const halfExtents = localAABB.getHalfExtents();
				mesh.collisionShape = CollisionShape.box(
					new Vec3(halfExtents.x * 2, halfExtents.y * 2, halfExtents.z * 2),
				);

				container.add(mesh);
			}

			return container;
		}

		// ── Single-part path (OBJ and legacy single-mesh GLTF) ─────────────────
		const vertexCount = modelData.vertices.length / 8;
		const optimalIndicesArray =
			vertexCount > 65535
				? new Uint32Array(modelData.indices)
				: new Uint16Array(modelData.indices);
		const geometry = new Geometry(
			ctx,
			new Float32Array(modelData.vertices),
			optimalIndicesArray,
			{ hasUVs: true, hasNormals: true },
		);

		const finalOptions = { ...options };
		if (!finalOptions.material && modelData.materialOptions) {
			finalOptions.material = modelData.materialOptions;
		}

		const mesh = new Mesh(ctx, { geometry, ...finalOptions });
		Mesh.applyTransformOptions(mesh, finalOptions);

		const localAABB = AABB.fromVertices(modelData.vertices, 8);
		const halfExtents = localAABB.getHalfExtents();
		mesh.collisionShape = CollisionShape.box(
			new Vec3(halfExtents.x * 2, halfExtents.y * 2, halfExtents.z * 2),
		);
		return mesh;
	}
}
