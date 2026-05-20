import { Context } from "../core/context";
import { Node } from "../core/node";
import type { Node3D } from "../core/node3d";
import type { DebugPanel } from "../debug/debug-panel";
import { PerformanceTracker } from "../debug/performance-tracker";
import { Color } from "../math/color";
import { Vec3 } from "../math/vec3";
import { Camera, type CameraOptions } from "./camera";
import {
	DirectionalLight,
	Light,
	type LightOptions,
	PointLight,
} from "./light";
import { Material } from "./materials/material";
import {
	StandardMaterial,
	type StandardMaterialOptions,
} from "./materials/standard-material";
import { Mesh } from "./mesh";
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

/**
 * Information about the current render frame.
 * Retrieve via scene.getRenderInfo() inside the render loop.
 */
export interface RenderInfo {
	/** Delta time in seconds since the last frame. */
	dt: number;
	/** Frames per second, calculated from delta time. */
	fps: number;
	/** Total frame time in milliseconds. */
	frameTimeMs: number;
	/** Total number of meshes currently in the scene. */
	meshCount: number;
	/** Total number of visible meshes drawn this frame. */
	visibleMeshCount: number;
	/** Total number of lights currently in the scene. */
	lightCount: number;
	/** Total number of nodes in the scene graph. */
	nodeCount: number;
	/** Total number of draw calls in this frame. */
	drawCalls: number;
	/** Total number of triangles drawn in this frame. */
	trianglesDrawn: number;
	/** Total number of vertices drawn in this frame. */
	verticesDrawn: number;
}

export class Scene extends Node {
	public readonly ctx: Context;
	public readonly renderer: Renderer;

	public get canvas(): HTMLCanvasElement {
		return this.ctx.context.canvas as HTMLCanvasElement;
	}

	public getCanvas(): HTMLCanvasElement {
		return this.canvas;
	}

	private _camera: Camera | null = null;

	public get camera(): Camera | null {
		return this._camera;
	}

	private _lights: Light[] = [];
	private _meshes: Mesh[] = [];

	public get lights(): ReadonlyArray<Light> {
		return this._lights;
	}

	public get meshes(): ReadonlyArray<Mesh> {
		return this._meshes;
	}

	private _backgroundColor: Color = Color.fromHex("#111122");

	public get backgroundColor(): Color {
		return this._backgroundColor;
	}

	public set backgroundColor(color: Color | string) {
		if (!color) {
			console.warn("nano-webgpu: backgroundColor cannot be null. Ignoring");
			return;
		}

		if (typeof color === "string") {
			this._backgroundColor = Color.fromHex(color);
		} else {
			this._backgroundColor = color;
		}
	}

	private _defaultDir: string = "";

	public get defaultDir(): string {
		return this._defaultDir;
	}

	private _renderInfo: RenderInfo = {
		dt: 0,
		fps: 0,
		frameTimeMs: 0,
		meshCount: 0,
		visibleMeshCount: 0,
		lightCount: 0,
		nodeCount: 0,
		drawCalls: 0,
		trianglesDrawn: 0,
		verticesDrawn: 0,
	};

	/**
	 * Returns live render frame information (delta time, FPS, mesh/light counts).
	 * Call this inside the render loop callback to access per-frame data.
	 */
	public getRenderInfo(): Readonly<RenderInfo> {
		return { ...this._renderInfo };
	}

	public set defaultDir(dir: string) {
		this._defaultDir = dir;
		if (this._defaultDir && !this._defaultDir.endsWith("/")) {
			this._defaultDir += "/";
		}
	}

	// --- Debug / Profiling ---
	public readonly perfTracker: PerformanceTracker;
	private debugPanel: DebugPanel | null = null;

	constructor(ctx: Context) {
		super();
		this.ctx = ctx;
		this.renderer = new Renderer(ctx);
		this.perfTracker = new PerformanceTracker();
	}

	public static async init(
		selector: string | HTMLCanvasElement,
	): Promise<Scene> {
		const ctx = await Context.init(selector);
		return new Scene(ctx);
	}

	public get enableFXAA(): boolean {
		return this.renderer.renderSettingsData[0] === 1;
	}

	public set enableFXAA(value: boolean) {
		this.renderer.renderSettingsData[0] = value ? 1 : 0;
		this.ctx.device.queue.writeBuffer(
			this.renderer.renderSettingsBuffer,
			0,
			this.renderer.renderSettingsData.buffer,
		);
	}

	public setCamera(cameraOrOptions: Camera | CameraOptions): Camera {
		this._camera =
			cameraOrOptions instanceof Camera
				? cameraOrOptions
				: new Camera(cameraOrOptions);

		this.renderer.globalsBindGroupDirty = true;
		if (!this.children.includes(this._camera)) {
			this.add(this._camera);
		}
		return this._camera;
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
				light.rotationDegrees = options.rotationDegrees as Vec3 | number[];
		}
		this._lights.push(light);
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
	public addInstance(template: Mesh, options: SceneGeometryOptions = {}): Mesh {
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
		const parsedOptions = this.parseMaterialOptions(
			rest,
		) as StandardMaterialOptions;
		const mesh = Mesh.createCube(this.ctx, {
			...parsedOptions,
			size: options.size,
		});
		if (addToScene) this.add(mesh);
		return mesh;
	}

	/**
	 * Adds a sphere mesh to the scene.
	 * @param options - Transform and material options.
	 */
	public addSphere(
		options: SceneGeometryOptions & { radius?: number; segments?: number } = {},
	): Mesh {
		const { addToScene = true, ...rest } = options;
		const parsedOptions = this.parseMaterialOptions(
			rest,
		) as StandardMaterialOptions;
		const mesh = Mesh.createSphere(this.ctx, {
			...parsedOptions,
			radius: options.radius,
			segments: options.segments,
		});
		if (addToScene) this.add(mesh);
		return mesh;
	}

	/**
	 * Adds a plane mesh to the scene.
	 * @param options - Transform and material options.
	 */
	public addPlane(
		options: SceneGeometryOptions & { width?: number; height?: number } = {},
	): Mesh {
		const { addToScene = true, ...rest } = options;
		const parsedOptions = this.parseMaterialOptions(
			rest,
		) as StandardMaterialOptions;
		const mesh = Mesh.createPlane(this.ctx, {
			...parsedOptions,
			width: options.width,
			height: options.height,
		});

		if (addToScene) this.add(mesh);
		return mesh;
	}

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
	public buildMesh(config: Parameters<typeof Mesh.build>[1]): Mesh {
		const mesh = Mesh.build(this.ctx, config);
		if (config.addToScene !== false) {
			this.add(mesh);
		}
		return mesh;
	}

	public override add(node: Node): void {
		super.add(node);
		if (node instanceof Mesh) {
			this._meshes.push(node);
		}
	}

	public override remove(node: Node): void {
		super.remove(node);
		if (node instanceof Mesh) {
			const index = this._meshes.indexOf(node);
			if (index !== -1) {
				this._meshes.splice(index, 1);
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

	/**
	 * Starts the render loop.
	 * @param loopCallback - Optional callback called every frame. Use scene.getRenderInfo() inside it to access dt and fps.
	 */
	public render(loopCallback?: () => void): void {
		this.ctx.run((dt) => {
			this._renderFrame(dt);
			this._renderInfo = {
				dt,
				fps: this.perfTracker.fps,
				frameTimeMs: this.perfTracker.frameTimeMs,
				meshCount: this._meshes.length,
				visibleMeshCount: this.perfTracker.visibleMeshes,
				lightCount: this._lights.length,
				nodeCount: this.countNodes(),
				drawCalls: this.perfTracker.drawCalls,
				trianglesDrawn: this.perfTracker.trianglesDrawn,
				verticesDrawn: this.perfTracker.verticesDrawn,
			};
			loopCallback?.();
		});
	}

	// biome-ignore lint/suspicious/noExplicitAny: disable rule for now
	public async enableDebug(options: any = {}): Promise<DebugPanel> {
		if (this.debugPanel) return this.debugPanel;

		const { DebugPanel } = await import("../debug/debug-panel");

		const canvas = this.ctx.context.canvas as HTMLCanvasElement;
		this.debugPanel = new DebugPanel(
			canvas,
			this.perfTracker,
			this.ctx.vramTracker,
			options,
		);

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

		this.perfTracker.beginFrame();

		if (!this.camera.uniformBuffer) this.camera.initWebGPU(this.ctx);

		if (this.camera.controller) {
			this.camera.controller.update(dt);
		}

		this.updateWorldMatrix(false);

		this.renderer.updateLightsBuffer(this.lights);
		this.renderer.render(this, this.camera, this.perfTracker);

		this.perfTracker.totalMeshes = this.meshes.length;
		this.perfTracker.lightCount = this.lights.length;
		this.perfTracker.nodeCount = this.countNodes();
		this.perfTracker.endFrame();

		if (this.debugPanel) this.debugPanel.update();
	}
}
