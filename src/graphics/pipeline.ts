import { Context } from "../core/context";
import { defaultShaderWGSL } from "./shaders/default";

export class PipelineManager {
    private static basePipeline: GPURenderPipeline | null = null;
    private static bindGroupLayout0: GPUBindGroupLayout | null = null;
    private static bindGroupLayout1: GPUBindGroupLayout | null = null;
    private static bindGroupLayout2: GPUBindGroupLayout | null = null;

    public static getPipeline(ctx: Context): {
        pipeline: GPURenderPipeline;
        layouts: [GPUBindGroupLayout, GPUBindGroupLayout, GPUBindGroupLayout];
    } {
        if (!this.basePipeline) {
            this.buildPipeline(ctx);
        }
        return {
            pipeline: this.basePipeline!,
            layouts: [this.bindGroupLayout0!, this.bindGroupLayout1!, this.bindGroupLayout2!],
        };
    }

    private static buildPipeline(ctx: Context): void {
        const shaderModule = ctx.device.createShaderModule({
            label: "Default Shader",
            code: defaultShaderWGSL,
        });

        // Group 0: Camera (View/Proj)
        this.bindGroupLayout0 = ctx.device.createBindGroupLayout({
            label: "Camera Bind Group Layout",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: "uniform" },
                },
            ],
        });

        // Group 1: Model transforms and Texture
        this.bindGroupLayout1 = ctx.device.createBindGroupLayout({
            label: "Model Bind Group Layout",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: "uniform" },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: { type: "filtering" },
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: "float", viewDimension: "2d" },
                },
            ],
        });

        // Group 2: Scene Lights Storage Buffer
        this.bindGroupLayout2 = ctx.device.createBindGroupLayout({
            label: "Lights Storage Bind Group Layout",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: "read-only-storage" }, // Storage Buffer for array<Light>
                },
            ],
        });

        const pipelineLayout = ctx.device.createPipelineLayout({
            bindGroupLayouts: [this.bindGroupLayout0, this.bindGroupLayout1, this.bindGroupLayout2],
        });

        // The Vertex Layout mapping exactly to our Primitives/Geometry format
        // 3 floats Position, 3 floats Normal, 2 floats UV = stride of 32 bytes
        const vertexBuffers: GPUVertexBufferLayout[] = [
            {
                attributes: [
                    { shaderLocation: 0, offset: 0, format: "float32x3" },  // Position
                    { shaderLocation: 1, offset: 12, format: "float32x3" }, // Normal
                    { shaderLocation: 2, offset: 24, format: "float32x2" }, // UV
                ],
                arrayStride: 32, 
                stepMode: "vertex",
            },
        ];

        this.basePipeline = ctx.device.createRenderPipeline({
            label: "Default Render Pipeline",
            layout: pipelineLayout,
            vertex: {
                module: shaderModule,
                entryPoint: "vs_main",
                buffers: vertexBuffers,
            },
            fragment: {
                module: shaderModule,
                entryPoint: "fs_main",
                targets: [
                    {
                        format: ctx.format,
                        blend: {
                            color: {
                                srcFactor: "src-alpha",
                                dstFactor: "one-minus-src-alpha",
                                operation: "add",
                            },
                            alpha: {
                                srcFactor: "one",
                                dstFactor: "one-minus-src-alpha",
                                operation: "add",
                            },
                        },
                    },
                ],
            },
            primitive: {
                topology: "triangle-list",
                cullMode: "back",
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: "less",
                format: "depth24plus",
            },
        });
    }
}
