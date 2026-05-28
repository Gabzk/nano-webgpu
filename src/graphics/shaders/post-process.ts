import { postProcessChunk } from "./chunks/post-process.chunk";

/**
 * WGSL source code driving fullscreen post processing pipeline passes.
 * Uses a single oversized triangle covering NDC space to draw screen quad areas,
 * samples intermediate frame buffer colors, runs optional FXAA filters, and applies
 * linear-to-sRGB gamma adjustments (2.2 correction exponent).
 */
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
    @group(0) @binding(3) var bloomTexture: texture_2d<f32>;

    struct RenderSettings {
        fxaa_enabled: u32,
        time_bits: u32,
        bloom_enabled: u32,
        _pad3: u32,
    }
    @group(0) @binding(2) var <uniform> settings: RenderSettings;

    ${postProcessChunk}

    fn aces_approx(v: vec3<f32>) -> vec3<f32> {
        let a = 2.51;
        let b = 0.03;
        let c = 2.43;
        let d = 0.59;
        let e = 0.14;
        return clamp((v * (a * v + b)) / (v * (c * v + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
    }

    @fragment
    fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
        let size = textureDimensions(screenTexture);
        let inverseScreenSize = vec2<f32>(1.0 / f32(size.x), 1.0 / f32(size.y));

        var finalColor: vec4<f32>;
        if (settings.fxaa_enabled > 0u) {
            finalColor = apply_fxaa(screenTexture, screenSampler, in.uv, inverseScreenSize);
        } else {
            finalColor = textureSample(screenTexture, screenSampler, in.uv);
        }

        // Additive bloom blend
        if (settings.bloom_enabled > 0u) {
            let bloomSample = textureSample(bloomTexture, screenSampler, in.uv).rgb;
            finalColor = vec4<f32>(finalColor.rgb + bloomSample, finalColor.a);
        }

        // ACES Filmic Tone Mapping to bring HDR values into standard displayable [0.0, 1.0] range
        let toneMapped = aces_approx(finalColor.rgb);

        // Linear to sRGB gamma correction (approx 2.2)
        // Since alpha is linear and we're writing to standard canvas, we only map RGB.
        let srgbColor = pow(max(toneMapped, vec3<f32>(0.0)), vec3<f32>(1.0 / 2.2));
        return vec4<f32>(srgbColor, finalColor.a);
    }
`;
