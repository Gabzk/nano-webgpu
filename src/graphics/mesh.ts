import { Node3D } from "../core/node3d";
import { Context } from "../core/context";
import { Texture } from "./texture";
import { Geometry } from "./geometry";
import { PipelineManager } from "./pipeline";

export class Mesh extends Node3D {
    public ctx: Context;
    public geometry: Geometry;
    public texture?: Texture;
    
    public modelBuffer: GPUBuffer;
    public bindGroup!: GPUBindGroup;

    constructor(ctx: Context, options: { geometry: Geometry; texture?: string | Texture }) {
        super();
        this.ctx = ctx;
        this.geometry = options.geometry;

        if (options.texture) {
            if (typeof options.texture === "string") {
                this.texture = Texture.loadBackground(ctx, options.texture);
            } else {
                this.texture = options.texture;
            }
        } else {
            // Give it a dummy white texture if none provided
            this.texture = Texture.loadBackground(ctx, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=");
        }

        // 1. Create Model Uniform Buffer (mat4x4 = 16 floats * 4 bytes = 64 bytes)
        this.modelBuffer = ctx.device.createBuffer({
            label: `Mesh Model Buffer`,
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // 2. Create the Bind Group (Layout index 1)
        const layouts = PipelineManager.getPipeline(ctx).layouts;
        
        // Setup Sampler
        const sampler = ctx.device.createSampler({
            minFilter: "linear",
            magFilter: "linear",
        });

        const createBindGroup = () => {
             this.bindGroup = ctx.device.createBindGroup({
                layout: layouts[1],
                entries: [
                    { binding: 0, resource: { buffer: this.modelBuffer } },
                    { binding: 1, resource: sampler },
                    { binding: 2, resource: this.texture!.gpuTexture.createView() },
                ],
            });
        }
        
        createBindGroup();
        
        // If texture isn't fully loaded, recreate bind group when loaded
        if (this.texture && !this.texture.isLoaded) {
            this.texture.onUpdate(() => {
                createBindGroup();
            });
        }
    }

    public draw(pass: GPURenderPassEncoder): void {
        super.updateWorldMatrix();
        // Update the Model uniform buffer in GPU memory
        this.ctx.device.queue.writeBuffer(this.modelBuffer, 0, this.worldMatrix.values as any);

        // Bind resources and draw
        pass.setBindGroup(1, this.bindGroup);
        pass.setVertexBuffer(0, this.geometry.vertexBuffer);
        pass.setIndexBuffer(this.geometry.indexBuffer, "uint16");
        pass.drawIndexed(this.geometry.indexCount);
    }
}
