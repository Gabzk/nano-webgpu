import { Context } from "../core/context";
import { Node } from "../core/node";
import { Node3D } from "../core/node3d";
import { DebugPanel, type DebugPanelOptions } from "../debug/debug-panel";
import { PerformanceTracker } from "../debug/performance-tracker";
import { VRAMTracker } from "../debug/vram-tracker";
import { Color } from "../math/color";
import { Vec3 } from "../math/vec3";
import { Camera } from "./camera";
import { DirectionalLight, Light, PointLight } from "./light";
import { Material } from "./materials/material";
import { StandardMaterial } from "./materials/standard-material";
import { Mesh } from "./mesh";
import { PipelineManager } from "./pipeline";

export class Scene extends Node {
	public ctx: Context;
	public camera: Camera | null = null;
	public lights: Light[] = [];
	public meshes: Mesh[] = [];
	public backgroundColor: Color = Color.fromHex("#111122");

	private depthTexture!: GPUTexture;
	private lightsBuffer!: GPUBuffer;

	private lightsDataFloat!: Float32Array;
	private lightsDataUint32!: Uint32Array;

	private globalsBindGroup!: GPUBindGroup;
	private globalsBindGroupDirty: boolean = true;
	public defaultDir: string = "";

	// --- Debug / Profiling ---
	private perfTracker: PerformanceTracker | null = null;
	private debugPanel: DebugPanel | null = null;

	constructor(ctx: Context) {
		super();
		this.ctx = ctx;
		this.resizeDepthTexture();
		this.ensureLightsBufferSize(); // Initialize buffer and arrays

		// We defer BindGroup creation until camera is attached and initialized
	}

	private resizeDepthTexture() {
		if (this.depthTexture) {
			VRAMTracker.unregister(this.depthTexture);
			this.depthTexture.destroy();
		}
		const w = this.ctx.context.canvas.width || 1;
		const h = this.ctx.context.canvas.height || 1;
		this.depthTexture = this.ctx.device.createTexture({
			size: [w, h, 1],
			format: "depth24plus",
			usage: GPUTextureUsage.RENDER_ATTACHMENT,
		});
		// depth24plus = 4 bytes per pixel (padded)
		VRAMTracker.register(this.depthTexture, "texture", "Scene Depth Texture", w * h * 4, "Scene");
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

	public setCamera(cameraOrOptions: Camera | any): Camera {
		if (cameraOrOptions instanceof Camera) {
			this.camera = cameraOrOptions;
		} else {
			this.camera = new Camera(cameraOrOptions);
			if (cameraOrOptions.position)
				this.camera.position.set(
					cameraOrOptions.position[0],
					cameraOrOptions.position[1],
					cameraOrOptions.position[2],
				);
		}

		this.globalsBindGroupDirty = true;
		if (!this.children.includes(this.camera)) {
			this.add(this.camera);
		}
		return this.camera;
	}

	public addLight(options: any | Light): Light {
		let light: Light;
		if (options instanceof Light) {
			light = options;
		} else {
			if (options.type === "point") {
				light = new PointLight();
			} else {
				light = new DirectionalLight();
			}
			if (options.color) light.color = Color.fromHex(options.color);
			if (options.intensity !== undefined) light.intensity = options.intensity;
			if (options.position)
				light.position.set(
					options.position[0],
					options.position[1],
					options.position[2],
				);
			if (options.rotation) light.rotation.copy(Vec3.from(options.rotation));
			if (options.rotationDegrees)
				light.rotationDegrees = options.rotationDegrees;
		}
		this.lights.push(light);
		this.add(light);
		return light;
	}

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

	public async addMesh(url: string, options: any = {}): Promise<Mesh> {
		const finalUrl = this.defaultDir ? this.defaultDir + url : url;
		const parsedOptions = this.parseMaterialOptions(options);

		const mesh = await this.ctx.loadMesh(finalUrl, parsedOptions);
		this.add(mesh);
		return mesh;
	}

	public addCube(options: any = {}): Mesh {
		const parsedOptions = this.parseMaterialOptions(options);
		const mesh = this.ctx.createCube(parsedOptions);
		this.add(mesh);
		return mesh;
	}

	public addSphere(options: any = {}): Mesh {
		const parsedOptions = this.parseMaterialOptions(options);
		const mesh = this.ctx.createSphere(parsedOptions);
		this.add(mesh);
		return mesh;
	}

	public addPlane(options: any = {}): Mesh {
		const parsedOptions = this.parseMaterialOptions(options);
		const mesh = this.ctx.createPlane(parsedOptions);
		this.add(mesh);
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

	private ensureLightsBufferSize(): void {
		// Count(16 bytes) + 32 bytes per light
		const requiredSize = 16 + 32 * this.lights.length;
		
		if (!this.lightsBuffer || this.lightsBuffer.size < requiredSize) {
			if (this.lightsBuffer) {
				VRAMTracker.unregister(this.lightsBuffer);
				this.lightsBuffer.destroy();
			}
			
			// Allocate in chunks of 50 to avoid frequent reallocation
			const capacity = Math.max(50, this.lights.length + 20);
			const newSize = 16 + 32 * capacity;

			this.lightsBuffer = this.ctx.device.createBuffer({
				label: "Scene Lights Storage Buffer",
				size: newSize,
				usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
			});
			VRAMTracker.register(this.lightsBuffer, "buffer", "Scene Lights Storage Buffer", newSize, "Scene");

			this.globalsBindGroupDirty = true;

			this.lightsDataFloat = new Float32Array(newSize / 4);
			this.lightsDataUint32 = new Uint32Array(this.lightsDataFloat.buffer);
		}
	}

	private updateLightsBuffer(): void {
		this.ensureLightsBufferSize();

		const limit = this.lights.length;
		const floatData = this.lightsDataFloat;

		// Count
		this.lightsDataUint32[0] = limit;

		for (let i = 0; i < limit; i++) {
			const light = this.lights[i];
			const offset = 4 + i * 8; // Float 32 indices

			if (light instanceof DirectionalLight) {
				// Na Godot, luzes direcionais projetam sombra para trás de sua "frente" (Eixo local -Z)
				const baseLocalAxis = new Vec3(0, 0, -1);
				const finalDirection =
					light.worldMatrix.transformDirection(baseLocalAxis);

				floatData[offset + 0] = finalDirection.x;
				floatData[offset + 1] = finalDirection.y;
				floatData[offset + 2] = finalDirection.z;
				floatData[offset + 3] = 0.0; // 0.0 = Directional
			} else if (light instanceof PointLight) {
				const pos = light.worldMatrix.values; // Translation is at 12, 13, 14
				floatData[offset + 0] = pos[12];
				floatData[offset + 1] = pos[13];
				floatData[offset + 2] = pos[14];
				floatData[offset + 3] = 1.0; // 1.0 = Point
			}

			// color (rgba = rgb, intensity)
			floatData[offset + 4] = light.color.r;
			floatData[offset + 5] = light.color.g;
			floatData[offset + 6] = light.color.b;
			floatData[offset + 7] = light.intensity;
		}

		// Only write the bytes we actually populated + the padded count container. 
		// Length in bytes = 16 for count block + (limit * 32 bytes for lights).
		this.ctx.device.queue.writeBuffer(
			this.lightsBuffer, 
			0, 
			this.lightsDataFloat.buffer,
			0,
			16 + 32 * limit
		);
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

	/**
	 * Enable the debug overlay panel (inspired by Godot's Debugger).
	 * Shows real-time performance metrics, VRAM allocations, and scene stats.
	 * Toggle visibility with F3.
	 */
	public enableDebug(options: DebugPanelOptions = {}): DebugPanel {
		if (this.debugPanel) return this.debugPanel;

		this.perfTracker = new PerformanceTracker();

		const canvas = this.ctx.context.canvas as HTMLCanvasElement;
		this.debugPanel = new DebugPanel(canvas, this.perfTracker, options);

		// Provide live scene stats
		this.debugPanel.setSceneStatsProvider(() => ({
			totalMeshes: this.meshes.length,
			totalNodes: this.countNodes(),
			lightCount: this.lights.length,
		}));

		return this.debugPanel;
	}

	/**
	 * Recursively count all nodes in the scene graph.
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

	private _renderFrame(dt: number): void {
		if (!this.camera) return;

		// --- Debug: begin frame timing ---
		if (this.perfTracker) this.perfTracker.beginFrame();

		// Ensure camera buffers exist before matrices are calculated
		if (!this.camera.uniformBuffer) this.camera.initWebGPU(this.ctx);

		// Update camera controller (third-person, first-person, orbit) before matrices
		if (this.camera.controller) {
			this.camera.controller.update(dt);
		}

		// Auto-fix resizing aspect before updating matrices
		if (
			this.camera.aspect !==
			this.ctx.context.canvas.width / this.ctx.context.canvas.height
		) {
			this.camera.aspect =
				this.ctx.context.canvas.width / this.ctx.context.canvas.height;
			this.camera.updateProjection();
			this.resizeDepthTexture();
		}

		// Now calculate matrices so it will write to the initialized uniformBuffer
		this.updateWorldMatrix(false); // Only update nodes that are explicitly marked as isDirty
		this.updateLightsBuffer();

		const textureView = this.ctx.context.getCurrentTexture().createView();
		const renderPassDescriptor: GPURenderPassDescriptor = {
			colorAttachments: [
				{
					view: textureView,
					clearValue: this.backgroundColor.toFloat32Array() as any,
					loadOp: "clear",
					storeOp: "store",
				},
			],
			depthStencilAttachment: {
				view: this.depthTexture.createView(),
				depthClearValue: 1.0,
				depthLoadOp: "clear",
				depthStoreOp: "store",
			},
		};

		const commandEncoder = this.ctx.device.createCommandEncoder();
		const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

		if (this.globalsBindGroupDirty && this.camera.uniformBuffer) {
			this.globalsBindGroup = this.ctx.device.createBindGroup({
				label: "Scene_Globals_BindGroup",
				layout: PipelineManager.getGlobalsBindGroupLayout(this.ctx),
				entries: [
					{ binding: 0, resource: { buffer: this.camera.uniformBuffer } },
					{ binding: 1, resource: { buffer: this.lightsBuffer } },
				],
			});
			this.globalsBindGroupDirty = false;
		}

		if (this.globalsBindGroup) {
			passEncoder.setBindGroup(0, this.globalsBindGroup);
		}

		let lastPipeline: GPURenderPipeline | null = null;
		for (const mesh of this.meshes) {
			if (!mesh.visible) continue;
			// By moving setPipeline here, Standard vs ShaderMaterials can toggle
			const pipeline = mesh.material.getPipeline(this.ctx);
			if (pipeline !== lastPipeline) {
				passEncoder.setPipeline(pipeline);
				lastPipeline = pipeline;
				if (this.perfTracker) this.perfTracker.recordMaterialChange();
			}
			mesh.draw(passEncoder);

			// --- Debug: record draw stats ---
			if (this.perfTracker) {
				this.perfTracker.recordDraw(
					mesh.geometry.vertexCount,
					mesh.geometry.indexCount,
				);
			}
		}

		passEncoder.end();
		this.ctx.device.queue.submit([commandEncoder.finish()]);

		// --- Debug: end frame + update panel ---
		if (this.perfTracker) {
			this.perfTracker.totalMeshes = this.meshes.length;
			this.perfTracker.lightCount = this.lights.length;
			this.perfTracker.endFrame();
		}
		if (this.debugPanel) this.debugPanel.update();
	}
}
