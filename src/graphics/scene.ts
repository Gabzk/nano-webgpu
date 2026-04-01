import { Node } from "../core/node";
import { Camera } from "./camera";
import { Light, DirectionalLight, PointLight } from "./light";
import { Mesh } from "./mesh";
import { Context } from "../core/context";
import { Color } from "../math/color";
import { PipelineManager } from "./pipeline";

export class Scene extends Node {
    public ctx: Context;
    public camera: Camera | null = null;
    public lights: Light[] = [];
    public meshes: Mesh[] = [];
    public backgroundColor: Color = Color.fromHex("#111122");

    private depthTexture!: GPUTexture;
    private lightsBuffer!: GPUBuffer;
    private maxLights: number = 10;
    
    private globalsBindGroup!: GPUBindGroup;
    private globalsBindGroupDirty: boolean = true;

    constructor(ctx: Context) {
        super();
        this.ctx = ctx;
        this.resizeDepthTexture();

        // Count + Pad1 + Pad2 + Pad3 = 4 * 4 bytes = 16 bytes
        // Each Light = vec4(Pos/Dir) + vec4(Color) = 32 bytes
        const lightsBufferSize = 16 + (32 * this.maxLights);
        this.lightsBuffer = ctx.device.createBuffer({
            label: "Scene Lights Storage Buffer",
            size: lightsBufferSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        // We defer BindGroup creation until camera is attached and initialized
    }

    private resizeDepthTexture() {
        if (this.depthTexture) this.depthTexture.destroy();
        this.depthTexture = this.ctx.device.createTexture({
            size: [this.ctx.context.canvas.width || 1, this.ctx.context.canvas.height || 1, 1],
            format: "depth24plus",
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
    }

    public setCamera(camera: Camera): void {
        this.camera = camera;
        this.globalsBindGroupDirty = true;
        if (!this.children.includes(camera)) {
            this.add(camera);
        }
    }

    public addLight(light: Light): void {
        this.lights.push(light);
        this.add(light);
    }

    public override add(node: Node): void {
        super.add(node);
        if (node instanceof Mesh) {
            this.meshes.push(node);
        }
    }

    private updateLightsBuffer(): void {
        const floatData = new Float32Array(4 + (this.lights.length * 8));
        const limit = Math.min(this.lights.length, this.maxLights);
        
        // Count
        new Uint32Array(floatData.buffer)[0] = limit;

        for (let i = 0; i < limit; i++) {
            const light = this.lights[i];
            const offset = 4 + (i * 8);
            
            if (light instanceof DirectionalLight) {
                floatData[offset + 0] = light.direction.x;
                floatData[offset + 1] = light.direction.y;
                floatData[offset + 2] = light.direction.z;
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

        this.ctx.device.queue.writeBuffer(this.lightsBuffer, 0, floatData);
    }

    public render(): void {
        if (!this.camera) return;

        // Ensure camera buffers exist before matrices are calculated
        if (!this.camera.uniformBuffer) this.camera.initWebGPU(this.ctx);

        // Auto-fix resizing aspect before updating matrices
        if (this.camera.aspect !== this.ctx.context.canvas.width / this.ctx.context.canvas.height) {
            this.camera.aspect = this.ctx.context.canvas.width / this.ctx.context.canvas.height;
            this.camera.updateProjection();
            this.resizeDepthTexture();
        }

        // Now calculate matrices so it will write to the initialized uniformBuffer
        this.updateWorldMatrix(true);
        this.updateLightsBuffer();

        const textureView = this.ctx.context.getCurrentTexture().createView();
        const renderPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [{
                view: textureView,
                clearValue: this.backgroundColor.toFloat32Array() as any,
                loadOp: "clear",
                storeOp: "store",
            }],
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
                ]
            });
            this.globalsBindGroupDirty = false;
        }

        if (this.globalsBindGroup) {
            passEncoder.setBindGroup(0, this.globalsBindGroup);
        }

        for (const mesh of this.meshes) {
            // By moving setPipeline here, Standard vs ShaderMaterials can toggle
            passEncoder.setPipeline(mesh.material.getPipeline(this.ctx));
            mesh.draw(passEncoder); 
        }

        passEncoder.end();
        this.ctx.device.queue.submit([commandEncoder.finish()]);
    }
}
