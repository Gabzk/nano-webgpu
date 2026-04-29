import { Context } from "../core/context";
import { Node } from "../core/node";
import type { Node3D } from "../core/node3d";
import { DebugPanel } from "../debug/debug-panel";
import { PerformanceTracker } from "../debug/performance-tracker";
import { Color } from "../math/color";
import { Vec3 } from "../math/vec3";
import { Camera, type CameraOptions } from "./camera";
import { Geometry } from "./geometry";
import {
	DirectionalLight,
	Light,
	type LightOptions,
	PointLight,
} from "./light";
import { Material, type MaterialOptions } from "./materials/material";
import {
	StandardMaterial,
	type StandardMaterialOptions,
} from "./materials/standard-material";
import { Mesh, type MeshOptions } from "./mesh";
import { Renderer } from "./renderer";

/**
 * Scene specific options for adding lights.
 */
export interface SceneLightOptions extends LightOptions {
	type?: "point" | "directional";
	radius?: number;
	castShadow?: boolean;
	shadowMapSize?: number;
	usePCF?: boolean;
}

/**
 * Scene specific options for geometry primitives.
 */
export interface SceneGeometryOptions extends StandardMaterialOptions {
	color?: Color | string;
	material?: Material | StandardMaterialOptions;
	position?: number[];
	rotation?: number[];
	rotationDegrees?: number[];
	scale?: number | number[];
	addToScene?: boolean;
}

export class Scene extends Node {
	public ctx: Context;
	public camera: Camera | null = null;
	public lights: Light[] = [];
	public meshes: Mesh[] = [];
	public backgroundColor: Color = Color.fromHex("#111122");
	public defaultDir: string = "";

	public renderer: Renderer;

	// --- Debug / Profiling ---
	private perfTracker: PerformanceTracker | null = null;
	private debugPanel: DebugPanel | null = null;

	constructor(ctx: Context) {
		super();
		this.ctx = ctx;
		this.renderer = new Renderer(ctx);
	}

	public static async init(
		selector: string | HTMLCanvasElement,
	): Promise<Scene> {
		const ctx = await Context.init(selector);
		return new Scene(ctx);
	}

	public setDefaultDir(dir: string): void {
		this.defaultDir = dir;
		if (this.defaultDir && !this.defaultDir.endsWith("/")) {
			this.defaultDir += "/";
		}
	}

	public setCamera(cameraOrOptions: Camera | CameraOptions): Camera {
		this.camera =
			cameraOrOptions instanceof Camera
				? cameraOrOptions
				: new Camera(cameraOrOptions);

		this.renderer.globalsBindGroupDirty = true;
		if (!this.children.includes(this.camera)) {
			this.add(this.camera);
		}
		return this.camera;
	}

	/**
	 * Adds a light to the scene.
	 * @param options - A Light instance or configuration options.
	 * @example
	 * ```ts
	 * scene.addLight({
	 *   type: "directional",
	 *   color: "#ffffff",
	 *   intensity: 1.0,
	 *   position: [0, 10, 0],
	 *   castShadow: true
	 * });
	 * ```
	 */
	public addLight(options: SceneLightOptions | Light): Light {
		let light: Light;
		if (options instanceof Light) {
			light = options;
		} else {
			if (options.type === "point") {
				light = new PointLight(options);
			} else {
				light = new DirectionalLight(options);
			}
			if (options.color) light.color = Color.from(options.color);
			if (options.intensity !== undefined) light.intensity = options.intensity;
			if (options.position) {
				const p = options.position as number[];
				light.position.set(p[0], p[1], p[2]);
			}
			if (options.rotation)
				light.rotation.copy(Vec3.from(options.rotation as number[]));
			if (options.rotationDegrees)
				light.rotationDegrees = options.rotationDegrees as any;
		}
		this.lights.push(light);
		this.add(light);
		return light;
	}

	// biome-ignore lint/suspicious/noExplicitAny: disable rule for now
	private parseMaterialOptions(options: any): any {
		if (!options) return options;

		const parsedOptions = { ...options };

		if (parsedOptions.color && !parsedOptions.material) {
			parsedOptions.material = { albedoColor: parsedOptions.color };
		}

		if (
			parsedOptions.material &&
			!(parsedOptions.material instanceof Material)
		) {
			const matProps = { ...parsedOptions.material };
			if (this.defaultDir) {
				if (typeof matProps.albedoTexture === "string")
					matProps.albedoTexture = this.defaultDir + matProps.albedoTexture;
				if (typeof matProps.normalTexture === "string")
					matProps.normalTexture = this.defaultDir + matProps.normalTexture;
				if (typeof matProps.roughnessTexture === "string")
					matProps.roughnessTexture =
						this.defaultDir + matProps.roughnessTexture;
				if (typeof matProps.metallicTexture === "string")
					matProps.metallicTexture = this.defaultDir + matProps.metallicTexture;
				if (typeof matProps.aoTexture === "string")
					matProps.aoTexture = this.defaultDir + matProps.aoTexture;
				if (typeof matProps.ormTexture === "string")
					matProps.ormTexture = this.defaultDir + matProps.ormTexture;
			}
			parsedOptions.material = new StandardMaterial(matProps);
		}

		return parsedOptions;
	}

	/**
	 * Instantiates a copy of an existing Mesh template, sharing its Geometry for GPU batching.
	 * Use this to create hundreds of instances of the same mesh with minimal draw calls.
	 * @param template - The Mesh whose geometry (and optionally material) will be shared.
	 * @param options - Transform and optional material overrides.
	 * @example
	 * ```ts
	 * const cubeTemplate = scene.addCube({ addToScene: false });
	 * for (let i = 0; i < 500; i++) {
	 *   scene.instantiate(cubeTemplate, { position: [i, 0, 0] });
	 * }
	 * ```
	 */
	public instantiate(template: Mesh, options: SceneGeometryOptions = {}): Mesh {
		const { addToScene = true, ...rest } = options;
		const parsedOptions = this.parseMaterialOptions(rest);
		const clone = new Mesh(this.ctx, {
			geometry: template.geometry,
			material: parsedOptions.material || template.material,
		});
		Mesh.applyTransformOptions(clone, parsedOptions);
		if (addToScene) this.add(clone);
		return clone;
	}

	/**
	 * Loads a mesh from a GLB, GLTF, or OBJ file URL and adds it to the scene.
	 * @param url - The URL of the model file (relative URLs are prefixed with `setDefaultDir`).
	 * @param options - Transform and material options.
	 * @example
	 * ```ts
	 * const shiba = await scene.loadMesh('./assets/shiba.glb', { position: [0, 0, 0] });
	 * // Clone it without re-loading from disk:
	 * scene.instantiate(shiba, { position: [2, 0, 0] });
	 * ```
	 */
	public async loadMesh(
		url: string,
		options: SceneGeometryOptions = {},
	): Promise<Mesh> {
		const { addToScene = true, ...rest } = options;
		const parsedOptions = this.parseMaterialOptions(rest);
		const finalUrl = this.defaultDir ? this.defaultDir + url : url;
		const mesh = await Mesh.load(this.ctx, finalUrl, parsedOptions);
		if (addToScene) this.add(mesh);
		return mesh;
	}

	/**
	 * Adds a cube mesh to the scene.
	 * @param options - Transform and material options.
	 */
	public addCube(options: SceneGeometryOptions & { size?: number } = {}): Mesh {
		const { addToScene = true, ...rest } = options;
		const parsedOptions = this.parseMaterialOptions(rest);
		const mesh = Mesh.createCube(this.ctx, { ...parsedOptions, size: options.size } as any);
		if (addToScene) this.add(mesh);
		return mesh;
	}

	/**
	 * Adds a sphere mesh to the scene.
	 * @param options - Transform and material options.
	 */
	public addSphere(options: SceneGeometryOptions & { radius?: number, segments?: number } = {}): Mesh {
		const { addToScene = true, ...rest } = options;
		const parsedOptions = this.parseMaterialOptions(rest);
		const mesh = Mesh.createSphere(this.ctx, { ...parsedOptions, radius: options.radius, segments: options.segments } as any);
		if (addToScene) this.add(mesh);
		return mesh;
	}

	/**
	 * Adds a plane mesh to the scene.
	 * @param options - Transform and material options.
	 */
	public addPlane(options: SceneGeometryOptions & { width?: number, height?: number } = {}): Mesh {
		const { addToScene = true, ...rest } = options;
		const parsedOptions = this.parseMaterialOptions(rest);
		const mesh = Mesh.createPlane(this.ctx, { ...parsedOptions, width: options.width, height: options.height } as any);

		if (addToScene) this.add(mesh);
		return mesh;
	}

	/**
	 * Vertex format attribute sizes (in number of floats).
	 */
	private static readonly FORMAT_SIZES: Record<string, number> = {
		position: 3,
		normal: 3,
		uv: 2,
		color: 3,
		tangent: 4,
	};

	/**
	 * Build a mesh from raw vertex data and add it to the scene.
	 * Inspired by OpenGL's immediate mode but using modern buffer-based approach.
	 *
	 * @example
	 * ```typescript
	 * const tri = scene.buildMesh({
	 *   vertexFormat: ["position", "color"],
	 *   vertexBuffer: [
	 *     -1, 0, 0,  1, 0, 0,
	 *      1, 0, 0,  0, 1, 0,
	 *      0, 1, 0,  0, 0, 1,
	 *   ],
	 *   topology: "triangles",
	 *   material: new StandardMaterial({ albedoColor: "#ff0000" }),
	 * });
	 * ```
	 */
	public buildMesh(config: {
		vertexFormat: string[];
		vertexBuffer: number[];
		indices?: number[];
		topology?: string;
		material?: Material;
		position?: number[];
		rotation?: number[];
		// biome-ignore lint/suspicious/noExplicitAny: disable rule for now
		rotationDegrees?: number[] | any;
		scale?: number | number[];
		addToScene?: boolean;
	}): Mesh {
		const {
			vertexFormat,
			vertexBuffer,
			indices,
			topology = "triangles",
			material,
			addToScene = true,
			...transformOptions
		} = config;

		// Calculate stride from format
		let stride = 0;

		for (const attr of vertexFormat) {
			const size = Scene.FORMAT_SIZES[attr];
			if (!size) {
				throw new Error(
					`buildMesh: Unknown vertex attribute "${attr}". Valid: ${Object.keys(Scene.FORMAT_SIZES).join(", ")}`,
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

		// Our standard pipeline expects: position(3) + normal(3) + uv(2) = 8 floats per vertex.
		// We need to remap whatever the user gave us into that format.
		const pipelineStride = 8; // pos(3) + normal(3) + uv(2)
		const remappedVertices = new Float32Array(vertexCount * pipelineStride);

		for (let v = 0; v < vertexCount; v++) {
			const srcOffset = v * stride;
			const dstOffset = v * pipelineStride;

			let cursor = 0;
			let pos = [0, 0, 0];
			let norm = [0, 0, 1]; // Default normal: facing camera
			let uv = [0, 0];

			for (const attr of vertexFormat) {
				const attrSize = Scene.FORMAT_SIZES[attr];
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
				}
				// color, tangent, etc are read but not mapped to standard pipeline (user can use ShaderMaterial for those)
				cursor += attrSize;
			}

			// Write in pipeline order: position, normal, uv
			remappedVertices[dstOffset + 0] = pos[0];
			remappedVertices[dstOffset + 1] = pos[1];
			remappedVertices[dstOffset + 2] = pos[2];
			remappedVertices[dstOffset + 3] = norm[0];
			remappedVertices[dstOffset + 4] = norm[1];
			remappedVertices[dstOffset + 5] = norm[2];
			remappedVertices[dstOffset + 6] = uv[0];
			remappedVertices[dstOffset + 7] = uv[1];
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
		const geometry = new Geometry(this.ctx, remappedVertices, indexArray, {
			hasNormals: true,
			hasUVs: true,
		});

		// Resolve material
		const finalMaterial =
			material instanceof Material ? material : new StandardMaterial();

		// Create Mesh
		const mesh = new Mesh(this.ctx, { geometry, material: finalMaterial });
		Mesh.applyTransformOptions(mesh, transformOptions);
		if (addToScene) this.add(mesh);

		return mesh;
	}

	public override add(node: Node): void {
		super.add(node);
		if (node instanceof Mesh) {
			this.meshes.push(node);
		}
	}

	public override remove(node: Node): void {
		super.remove(node);
		if (node instanceof Mesh) {
			const index = this.meshes.indexOf(node);
			if (index !== -1) {
				this.meshes.splice(index, 1);
			}
		}
	}

	/**
	 * Returns all visible meshes in the scene whose AABB overlaps with the given node's AABB.
	 * Inspired by Godot's Area3D.get_overlapping_bodies().
	 * O(n) brute-force — sufficient for scenes with < 200 dynamic objects.
	 * @param node - The node to test against all meshes.
	 */
	public getOverlappingBodies(node: Node3D): Mesh[] {
		const aabb = node.getWorldAABB();
		if (!aabb) return [];
		const result: Mesh[] = [];
		for (const mesh of this.meshes) {
			if ((mesh as unknown) === node) continue;
			if (!mesh.visible) continue;
			const other = mesh.getWorldAABB();
			if (other && aabb.intersects(other)) {
				result.push(mesh);
			}
		}
		return result;
	}

	public render(loopCallback?: (dt: number) => void): void {
		if (loopCallback) {
			this.ctx.run((dt) => {
				loopCallback(dt);
				this._renderFrame(dt);
			});
		} else {
			this._renderFrame(0);
		}
	}

	// biome-ignore lint/suspicious/noExplicitAny: disable rule for now
	public enableDebug(options: any = {}): DebugPanel {
		if (this.debugPanel) return this.debugPanel;

		this.perfTracker = new PerformanceTracker();

		const canvas = this.ctx.context.canvas as HTMLCanvasElement;
		this.debugPanel = new DebugPanel(canvas, this.perfTracker, options);

		this.debugPanel.setSceneStatsProvider(() => ({
			totalMeshes: this.meshes.length,
			totalNodes: this.countNodes(),
			lightCount: this.lights.length,
		}));

		return this.debugPanel;
	}

	private countNodes(): number {
		let count = 0;
		const walk = (node: Node) => {
			count++;
			for (const child of node.children) {
				walk(child);
			}
		};
		walk(this);
		return count;
	}

	private _renderFrame(dt: number): void {
		if (!this.camera) return;

		if (this.perfTracker) this.perfTracker.beginFrame();

		if (!this.camera.uniformBuffer) this.camera.initWebGPU(this.ctx);

		if (this.camera.controller) {
			this.camera.controller.update(dt);
		}

		this.updateWorldMatrix(false);

		this.renderer.updateLightsBuffer(this.lights);
		this.renderer.render(this, this.camera, this.perfTracker);

		if (this.perfTracker) {
			this.perfTracker.totalMeshes = this.meshes.length;
			this.perfTracker.lightCount = this.lights.length;
			this.perfTracker.endFrame();
		}
		if (this.debugPanel) this.debugPanel.update();
	}
}
