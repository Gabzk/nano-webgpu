import { Node3D } from "../core/node3d";
import { Context } from "../core/context";
import { Texture } from "./texture";
import { Geometry } from "./geometry";
import { PipelineManager } from "./pipeline";
import { Material } from "./materials/material";
import { StandardMaterial } from "./materials/standard-material";

export class Mesh extends Node3D {
    public ctx: Context;
    public geometry: Geometry;
    public material: Material;
    
    public modelBuffer: GPUBuffer;
    public bindGroup!: GPUBindGroup;

    constructor(ctx: Context, options: { geometry: Geometry; texture?: string | Texture; material?: Material }) {
        super();
        this.ctx = ctx;
        this.geometry = options.geometry;

        if (options.material) {
            this.material = options.material;
        } else if (options.texture) {
            // Legacy shorthand approach: convert texture automatically to Standard Material
            let tex: Texture;
            if (typeof options.texture === "string") {
                tex = Texture.loadBackground(ctx, options.texture);
            } else {
                tex = options.texture;
            }
            this.material = new StandardMaterial({ albedoTexture: tex });
        } else {
            // Default material
            this.material = new StandardMaterial();
        }

        // 1. Create Model Uniform Buffer (mat4x4 = 16 floats * 4 bytes = 64 bytes)
        this.modelBuffer = ctx.device.createBuffer({
            label: `Mesh Model Buffer`,
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // 2. Create the Bind Group strictly for Model Info (Layout index 1)
        this.bindGroup = ctx.device.createBindGroup({
            label: "Mesh_Model_BindGroup",
            layout: PipelineManager.getModelBindGroupLayout(ctx),
            entries: [
                { binding: 0, resource: { buffer: this.modelBuffer } },
            ],
        });
    }

    public draw(pass: GPURenderPassEncoder): void {
        super.updateWorldMatrix();
        // Update the Model uniform buffer in GPU memory
        this.ctx.device.queue.writeBuffer(this.modelBuffer, 0, this.worldMatrix.values as any);

        // Bind Model
        pass.setBindGroup(1, this.bindGroup);
        // Bind Material
        pass.setBindGroup(2, this.material.getBindGroup(this.ctx));
        
        pass.setVertexBuffer(0, this.geometry.vertexBuffer);
        pass.setIndexBuffer(this.geometry.indexBuffer, "uint16");
        pass.drawIndexed(this.geometry.indexCount);
    }
}
