import { Context } from "../core/context";
import { Node } from "../core/node";
import { Node3D } from "../core/node3d";
import type { DebugPanel } from "../debug/debug-panel";
import { PerformanceTracker } from "../debug/performance-tracker";
import { Color, type ColorLike } from "../math/color";
import { Vec3 } from "../math/vec3";
import { Camera, type CameraOptions } from "./camera";
import {
	DirectionalLight,
	Light,
	type LightOptions,
	PointLight,
	SpotLight,
	type SpotLightOptions,
} from "./light";
import { Material } from "./materials/material";
import {
	StandardMaterial,
	type StandardMaterialOptions,
} from "./materials/standard-material";
import { Mesh } from "./mesh";
import { Renderer } from "./renderer";
import { Texture } from "./texture";

/**
 * Scene specific options for adding light sources.
 *
 * @group Graphics
 */
export interface SceneLightOptions extends LightOptions {
	/** Light emitting style choice. Defaults to `"directional"`. */
	type?: "point" | "directional" | "spotlight";
	/** Radial size limit for point light attenuation. */
	radius?: number;
	/** Enable shadow depth map generation. */
	castShadow?: boolean;
	/** Shadow depth map resolution. */
	shadowMapSize?: number;
	/** Enable PCF filtering. */
	usePCF?: boolean;
	/** Shadow depth bias. */
	shadowBias?: number;
	/** Spotlight inner cone angle in degrees. */
	innerAngle?: number;
	/** Spotlight outer cone angle in degrees. */
	outerAngle?: number;
	/** Spotlight physical distance range limit. */
	range?: number;
	/** Near clipping plane for perspective shadow projection. */
	shadowNear?: number;
}

/**
 * Configuration options utilized when programmatically creating primitive shapes in the scene.
 *
 * @group Graphics
 */
export interface SceneGeometryOptions extends StandardMaterialOptions {
	/** Solid base color value. */
	color?: ColorLike;
	/** Custom Material or standard options. */
	material?: Material | StandardMaterialOptions;
	/** Initial position coordinates. */
	position?: number[] | Vec3;
	/** Initial rotation coordinates in radians. */
	rotation?: number[] | Vec3;
	/** Initial rotation coordinates in degrees. */
	rotationDegrees?: number[] | Vec3;
	/** Initial scale coordinates. */
	scale?: number | number[] | Vec3;
	/** Automatically append the resulting node to the scene hierarchy. Defaults to `true`. */
	addToScene?: boolean;
	/** Texture applied to the mesh */
	texture?: Texture | string;
}

/**
 * Information describing rendering and profiling statistics computed for the active frame.
 *
 * @group Graphics
 */
export interface RenderInfo {
	/** Delta time in seconds since the last frame. */
	dt: number;
	/** Estimated frames per second. */
	fps: number;
	/** Total CPU frame calculation time in milliseconds. */
	frameTimeMs: number;
	/** Total registered mesh count in the scene graph. */
	meshCount: number;
	/** Count of active visible meshes sent to draw pipelines this frame. */
	visibleMeshCount: number;
	/** Count of registered light sources in the scene. */
	lightCount: number;
	/** Count of total hierarchical nodes in the scene graph. */
	nodeCount: number;
	/** Count of draw commands executed. */
	drawCalls: number;
	/** Count of processed polygon faces drawn this frame. */
	trianglesDrawn: number;
	/** Count of processed vertex coordinates drawn this frame. */
	verticesDrawn: number;
}

/**
 * Scene represents the root container of the engine's hierarchical scene graph.
 * It coordinates active camera properties, registered light sources, visible meshes,
 * background clear colors, and manages the high-performance requestAnimationFrame render loop,
 * integrating performance tracking and debugging panels.
 *
 * @group Graphics
 */
export class Scene extends Node {
	/** Active context reference. */
	public readonly ctx: Context;

	/** High-performance WebGPU forward renderer. */
	public readonly renderer: Renderer;

	/** Gets the active HTMLCanvasElement swapchain presentation surface. */
	public get canvas(): HTMLCanvasElement {
		return this.ctx.context.canvas as HTMLCanvasElement;
	}

	/** Gets the active HTMLCanvasElement presentation surface. */
	public getCanvas(): HTMLCanvasElement {
		return this.canvas;
	}

	/** @internal Active camera viewpoint driving rendering passes. */
	private _camera: Camera | null = null;

	/** Gets the active camera viewpoint. */
	public get camera(): Camera | null {
		return this._camera;
	}

	/** @internal List of all registered lights in the scene. */
	private _lights: Light[] = [];

	/** @internal List of all registered meshes in the scene. */
	private _meshes: Mesh[] = [];

	/** Gets a read-only list of registered light sources. */
	public get lights(): ReadonlyArray<Light> {
		return this._lights;
	}

	/** Gets a read-only list of registered meshes. */
	public get meshes(): ReadonlyArray<Mesh> {
		return this._meshes;
	}

	/** @internal Target clear color applied at the start of render passes. */
	private _backgroundColor: Color = Color.fromHex("#111122");

	/** Gets the background clear color. */
	public get backgroundColor(): Color {
		return this._backgroundColor;
	}

	/** Sets the background clear color, parsing hex strings automatically. */
	public set backgroundColor(color: ColorLike) {
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

	/** @internal Default directory path prepended to asset relative file paths. */
	private _defaultDir: string = "";

	/** Gets the default asset base directory. */
	public get defaultDir(): string {
		return this._defaultDir;
	}

	/** Sets the default asset base directory, ensuring trailing slashes are appended. */
	public set defaultDir(dir: string) {
		this._defaultDir = dir;
		if (this._defaultDir && !this._defaultDir.endsWith("/")) {
			this._defaultDir += "/";
		}
	}

	/** @internal Frame profiling render statistics. */
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
	 * Returns live render statistics computed for the active frame.
	 *
	 * @returns Read-only RenderInfo.
	 */
	public getRenderInfo(): Readonly<RenderInfo> {
		return { ...this._renderInfo };
	}

	/** High-performance CPU profiling metrics recorder. */
	public readonly perfTracker: PerformanceTracker;

	/** @internal Debug overlay UI panel. */
	private debugPanel: DebugPanel | null = null;

	/**
	 * Instantiates a new Scene root node.
	 *
	 * @param ctx - Active context.
	 */
	constructor(ctx: Context) {
		super();
		this.ctx = ctx;
		this.renderer = new Renderer(ctx);
		this.perfTracker = new PerformanceTracker();
	}

	/**
	 * High-level initialization routine that resolves a canvas element, requests WebGPU adapters,
	 * boots GPUDevice services, and returns a new Scene container.
	 *
	 * @param selector - Target CSS selector string or direct HTMLCanvasElement reference.
	 * @returns A promise resolving to an initialized Scene.
	 */
	public static async init(
		selector: string | HTMLCanvasElement,
	): Promise<Scene> {
		const ctx = await Context.init(selector);
		return new Scene(ctx);
	}

	/** Gets the FXAA post-processing status. */
	public get enableFXAA(): boolean {
		return this.renderer.renderSettingsUint32[0] === 1;
	}

	/** Sets the FXAA post-processing status, writing parameters to logical GPU uniform buffers. */
	public set enableFXAA(value: boolean) {
		this.renderer.renderSettingsUint32[0] = value ? 1 : 0;
		this.ctx.device.queue.writeBuffer(
			this.renderer.renderSettingsBuffer,
			0,
			this.renderer.renderSettingsFloat.buffer,
			0,
			4,
		);
	}

	/**
	 * Registers and configures the active Camera viewpoints driving render passes.
	 * Automatically appends the Camera to the scene tree if it is not already present.
	 *
	 * @param cameraOrOptions - Camera instance or constructor configurations.
	 * @returns The resolved Camera node.
	 */
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
	 * Appends a new Light node to the scene hierarchy.
	 * Programmatically resolves point or directional light sub-classes from configuration options.
	 *
	 * @param options - Light instance or configuration options.
	 * @returns The resolved Light node.
	 */
	public addLight(options: SceneLightOptions | Light): Light {
		let light: Light;
		if (options instanceof Light) {
			light = options;
		} else {
			if (options.type === "point") {
				light = new PointLight(options);
			} else if (options.type === "spotlight") {
				light = new SpotLight(options);
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

	/**
	 * @internal Internal helper parsing StandardMaterial options and resolving relative asset directories.
	 */
	// biome-ignore lint/suspicious/noExplicitAny: generic configuration structures
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
	 * Instantiates a copy of an existing Mesh template or hierarchy tree, sharing underlying Geometry buffers
	 * to optimize GPU draw calls via instancing.
	 *
	 * @param template - Source Mesh template to clone.
	 * @param options - Spatial transform overrides.
	 * @returns The newly allocated instantiated root Mesh or Node3D.
	 */
	public addInstance(
		template: Mesh | Node3D,
		options: SceneGeometryOptions = {},
	): Mesh | Node3D {
		const { addToScene = true, ...rest } = options;
		const parsedOptions = this.parseMaterialOptions(rest);

		const cloneNode = (source: Node3D | Mesh): Node3D | Mesh => {
			let clonedNode: Node3D | Mesh;

			if (source instanceof Mesh) {
				clonedNode = new Mesh(this.ctx, {
					geometry: source.geometry,
					material: parsedOptions.material || source.material,
				});
			} else {
				clonedNode = new Node3D();
			}

			clonedNode.position.copy(source.position);
			clonedNode.rotation.copy(source.rotation);
			clonedNode.scale.copy(source.scale);

			for (const child of source.children) {
				if (child instanceof Node3D || child instanceof Mesh) {
					const clonedChild = cloneNode(child);
					clonedNode.add(clonedChild);
				}
			}

			return clonedNode;
		};

		const finalClone = cloneNode(template) as Mesh;
		Mesh.applyTransformOptions(finalClone, parsedOptions);

		if (addToScene) {
			this.add(finalClone);
		}

		return finalClone;
	}

	/**
	 * Asynchronously fetches a 3D model asset (GLB, GLTF, or OBJ), compiles GPU resources,
	 * and appends the resulting nodes to the scene hierarchy.
	 *
	 * @param url - Relative or absolute address of the 3D model file.
	 * @param options - Material parameters and spatial transformations.
	 * @returns A promise resolving to a container Node3D holding the loaded mesh segment nodes.
	 */
	public async loadMesh(
		url: string,
		options: SceneGeometryOptions = {},
	): Promise<Node3D> {
		const { addToScene = true, ...rest } = options;
		const parsedOptions = this.parseMaterialOptions(rest);
		const finalUrl = this.defaultDir ? this.defaultDir + url : url;
		const node = await Mesh.load(this.ctx, finalUrl, parsedOptions);
		if (addToScene) this.add(node);
		return node;
	}

	/**
	 * Instantiates a Cube mesh and appends it to the scene tree.
	 *
	 * @param options - Material parameters and sizing options.
	 * @returns The newly allocated Cube Mesh.
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
	 * Instantiates a Sphere mesh and appends it to the scene tree.
	 *
	 * @param options - Material parameters and radius subdivisions options.
	 * @returns The newly allocated Sphere Mesh.
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
	 * Instantiates a Plane mesh and appends it to the scene tree.
	 *
	 * @param options - Material parameters and width/depth dimensions.
	 * @returns The newly allocated Plane Mesh.
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
	 * Compiles a Mesh from raw vertex component arrays and appends it to the scene tree.
	 *
	 * @param config - Mesh assembly configurations.
	 * @returns The newly programmatically assembled Mesh.
	 */
	public buildMesh(config: Parameters<typeof Mesh.build>[1]): Mesh {
		const mesh = Mesh.build(this.ctx, config);
		if (config.addToScene !== false) {
			this.add(mesh);
		}
		return mesh;
	}

	/**
	 * Overrides polymorphic hierarchy insertion to register Mesh children within the scene graph mesh arrays.
	 *
	 * @param node - The node to add.
	 */
	public override add(node: Node): void {
		super.add(node);
		if (node instanceof Mesh) {
			this._meshes.push(node);
		} else {
			const registerMeshes = (n: Node) => {
				for (const child of n.children) {
					if (child instanceof Mesh) {
						this._meshes.push(child);
					} else {
						registerMeshes(child);
					}
				}
			};
			registerMeshes(node);
		}
	}

	/**
	 * Overrides polymorphic hierarchy removals.
	 *
	 * @param node - The node to remove.
	 */
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
	 * Queries and returns all visible meshes whose world-space AABB bounding volumes intersect
	 * with the specified Node3D's world-space AABB. Utilized for broad-phase collision queries.
	 *
	 * @param node - Target Node3D to test.
	 * @returns Meshes currently overlapping the query node.
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
	 * Initiates the standard requestAnimationFrame render loop.
	 * Calls the provided update routine every frame while updating render statistics.
	 *
	 * @param loopCallback - Update callback hook.
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

	/**
	 * Asynchronously imports and displays an interactive, hardware-monitored performance debug panel.
	 *
	 * @param options - Styling and anchor options.
	 * @returns A promise resolving to the debug panel.
	 */
	// biome-ignore lint/suspicious/noExplicitAny: debug panel config options
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

	/**
	 * @internal Counts total nodes in the scene hierarchy.
	 */
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

	/**
	 * @internal Main internal frame calculation routines.
	 * Drives camera controllers, recomputes world transformations, aggregates point and directional light buffers,
	 * and commits rendering passes.
	 */
	private _renderFrame(dt: number): void {
		if (!this.camera) return;

		this.perfTracker.beginFrame();

		if (!this.camera.uniformBuffer) this.camera.initWebGPU(this.ctx);

		if (this.camera.controller) {
			this.camera.controller.update(dt);
		}

		this.updateWorldMatrix(false);

		this.renderer.updateLightsBuffer(this.lights);
		this.renderer.render(this, this.camera, this.perfTracker, dt);

		this.perfTracker.totalMeshes = this.meshes.length;
		this.perfTracker.lightCount = this.lights.length;
		this.perfTracker.nodeCount = this.countNodes();
		this.perfTracker.endFrame();

		if (this.debugPanel) this.debugPanel.update();
	}

	/**
	 * Releases scene resources, stops the render loop, disables debug panels,
	 * and cascades destruction to the renderer and context.
	 */
	public destroy(): void {
		// Stop render loop
		if (this.ctx) {
			this.ctx.stop();
		}

		// Destroy camera controller to release local canvas event listeners
		if (this.camera?.controller) {
			this.camera.controller.destroy();
		}

		// Disable debug overlay UI panel
		if (this.debugPanel) {
			this.debugPanel.destroy();
			this.debugPanel = null;
		}

		// Cascade destruction to renderer
		if (this.renderer) {
			this.renderer.destroy();
		}

		// Cascade destruction to context
		if (this.ctx) {
			this.ctx.destroy();
		}
	}
}
