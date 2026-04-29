import { postProcessChunk } from "./chunks/post-process.chunk";

export const postProcessShader = /* wgsl */ `
    struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) uv: vec2<f32>,
    }

    @vertex
    fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
        // Full-screen triangle (3 vertices cover the [-1,1] NDC square)
        // vertex 0: (-1, -1), uv (0, 1)   bottom-left
        // vertex 1: ( 3, -1), uv (2, 1)   far right
        // vertex 2: (-1,  3), uv (0,-1)   far bottom -> clipped, gives top coverage
        let x = f32(vertexIndex & 1u) * 4.0 - 1.0;
        let y = f32((vertexIndex >> 1u) & 1u) * 4.0 - 1.0;
        // UV: top-left=(0,0), bottom-right=(1,1) in texture space
        // NDC y goes up, texture v goes down — flip v
        let u = (x + 1.0) * 0.5;
        let v = (1.0 - y) * 0.5;
        return VertexOutput(vec4<f32>(x, y, 0.0, 1.0), vec2<f32>(u, v));
    }

    @group(0) @binding(0) var screenSampler: sampler;
    @group(0) @binding(1) var screenTexture: texture_2d<f32>;

    struct RenderSettings {
        fxaa_enabled: u32,
        _pad1: u32,
        _pad2: u32,
        _pad3: u32,
    }
    @group(0) @binding(2) var <uniform> settings: RenderSettings;

    ${postProcessChunk}

    @fragment
    fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
        let size = textureDimensions(screenTexture);
        let inverseScreenSize = vec2<f32>(1.0 / f32(size.x), 1.0 / f32(size.y));

        if (settings.fxaa_enabled > 0u) {
            return apply_fxaa(screenTexture, screenSampler, in.uv, inverseScreenSize);
        } else {
            return textureSample(screenTexture, screenSampler, in.uv);
        }
    }
`;
