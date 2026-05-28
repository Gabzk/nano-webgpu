/**
 * Bloom shader chunks:
 *   - bright_pass: extracts luminance above a threshold
 *   - gaussian_blur_h / gaussian_blur_v: separable 9-tap Gaussian blur
 *   - apply_bloom: additive blend of bloom over scene color
 */
export const bloomChunk = /* wgsl */ `

// ── Helpers ──────────────────────────────────────────────────────────────────

fn luma(c: vec3<f32>) -> f32 {
    return dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
}

// ── Bright Pass ──────────────────────────────────────────────────────────────
// Isolates HDR pixels above a luma threshold with a soft knee to avoid
// harsh edges on bright regions.

fn bright_pass(color: vec3<f32>, threshold: f32, knee: f32) -> vec3<f32> {
    let l = max(luma(color), 0.0001);
    // Professional soft-knee highlight extraction:
    // Only the excess brightness above the threshold contributes to the bloom glow.
    let rq = clamp(l - threshold + knee, 0.0, 2.0 * knee);
    let rq_sq = (rq * rq) / (4.0 * max(knee, 0.0001));
    let contribution = max(rq_sq, l - threshold) / l;
    return color * contribution;
}

// ── Separable Gaussian Blur ───────────────────────────────────────────────────
// 9-tap kernel weights (sigma ≈ 2): [0.0625, 0.125, 0.25, 0.25, 0.125, 0.0625]
// Uses textureSampleLevel so it works in compute-free fragment passes.

fn gaussian_blur_h(
    tex: texture_2d<f32>,
    samp: sampler,
    uv: vec2<f32>,
    texelSize: vec2<f32>,
) -> vec3<f32> {
    var result = vec3<f32>(0.0);
    result += textureSampleLevel(tex, samp, uv + vec2<f32>(-4.0, 0.0) * texelSize, 0.0).rgb * 0.0162;
    result += textureSampleLevel(tex, samp, uv + vec2<f32>(-3.0, 0.0) * texelSize, 0.0).rgb * 0.0540;
    result += textureSampleLevel(tex, samp, uv + vec2<f32>(-2.0, 0.0) * texelSize, 0.0).rgb * 0.1216;
    result += textureSampleLevel(tex, samp, uv + vec2<f32>(-1.0, 0.0) * texelSize, 0.0).rgb * 0.1945;
    result += textureSampleLevel(tex, samp, uv                                     , 0.0).rgb * 0.2270;
    result += textureSampleLevel(tex, samp, uv + vec2<f32>( 1.0, 0.0) * texelSize, 0.0).rgb * 0.1945;
    result += textureSampleLevel(tex, samp, uv + vec2<f32>( 2.0, 0.0) * texelSize, 0.0).rgb * 0.1216;
    result += textureSampleLevel(tex, samp, uv + vec2<f32>( 3.0, 0.0) * texelSize, 0.0).rgb * 0.0540;
    result += textureSampleLevel(tex, samp, uv + vec2<f32>( 4.0, 0.0) * texelSize, 0.0).rgb * 0.0162;
    return result;
}

fn gaussian_blur_v(
    tex: texture_2d<f32>,
    samp: sampler,
    uv: vec2<f32>,
    texelSize: vec2<f32>,
) -> vec3<f32> {
    var result = vec3<f32>(0.0);
    result += textureSampleLevel(tex, samp, uv + vec2<f32>(0.0, -4.0) * texelSize, 0.0).rgb * 0.0162;
    result += textureSampleLevel(tex, samp, uv + vec2<f32>(0.0, -3.0) * texelSize, 0.0).rgb * 0.0540;
    result += textureSampleLevel(tex, samp, uv + vec2<f32>(0.0, -2.0) * texelSize, 0.0).rgb * 0.1216;
    result += textureSampleLevel(tex, samp, uv + vec2<f32>(0.0, -1.0) * texelSize, 0.0).rgb * 0.1945;
    result += textureSampleLevel(tex, samp, uv                                     , 0.0).rgb * 0.2270;
    result += textureSampleLevel(tex, samp, uv + vec2<f32>(0.0,  1.0) * texelSize, 0.0).rgb * 0.1945;
    result += textureSampleLevel(tex, samp, uv + vec2<f32>(0.0,  2.0) * texelSize, 0.0).rgb * 0.1216;
    result += textureSampleLevel(tex, samp, uv + vec2<f32>(0.0,  3.0) * texelSize, 0.0).rgb * 0.0540;
    result += textureSampleLevel(tex, samp, uv + vec2<f32>(0.0,  4.0) * texelSize, 0.0).rgb * 0.0162;
    return result;
}
`;

/**
 * WGSL for the bright-pass fragment shader.
 * Samples the scene texture and outputs only HDR pixels above the threshold.
 */
export const bloomBrightPassShader = /* wgsl */ `
    struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) uv: vec2<f32>,
    }

    @vertex
    fn vs_main(@builtin(vertex_index) vi: u32) -> VertexOutput {
        let x = f32(vi & 1u) * 4.0 - 1.0;
        let y = f32((vi >> 1u) & 1u) * 4.0 - 1.0;
        return VertexOutput(vec4<f32>(x, y, 0.0, 1.0), vec2<f32>((x + 1.0) * 0.5, (1.0 - y) * 0.5));
    }

    @group(0) @binding(0) var bloomSampler: sampler;
    @group(0) @binding(1) var sceneTex: texture_2d<f32>;

    struct BloomParams {
        threshold: f32,
        knee: f32,
        intensity: f32,
        _pad: f32,
    }
    @group(0) @binding(2) var<uniform> bloom: BloomParams;

    ${bloomChunk}

    @fragment
    fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
        let color = textureSampleLevel(sceneTex, bloomSampler, in.uv, 0.0).rgb;
        // Multiply by intensity here so the blurred result is pre-weighted
        return vec4<f32>(bright_pass(color, bloom.threshold, bloom.knee) * bloom.intensity, 1.0);
    }
`;

/**
 * WGSL for the horizontal Gaussian blur pass.
 */
export const bloomBlurHShader = /* wgsl */ `
    struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) uv: vec2<f32>,
    }

    @vertex
    fn vs_main(@builtin(vertex_index) vi: u32) -> VertexOutput {
        let x = f32(vi & 1u) * 4.0 - 1.0;
        let y = f32((vi >> 1u) & 1u) * 4.0 - 1.0;
        return VertexOutput(vec4<f32>(x, y, 0.0, 1.0), vec2<f32>((x + 1.0) * 0.5, (1.0 - y) * 0.5));
    }

    @group(0) @binding(0) var bloomSampler: sampler;
    @group(0) @binding(1) var inputTex: texture_2d<f32>;

    ${bloomChunk}

    @fragment
    fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
        let size = textureDimensions(inputTex);
        let texelSize = vec2<f32>(1.0 / f32(size.x), 1.0 / f32(size.y));
        return vec4<f32>(gaussian_blur_h(inputTex, bloomSampler, in.uv, texelSize), 1.0);
    }
`;

/**
 * WGSL for the vertical Gaussian blur pass.
 */
export const bloomBlurVShader = /* wgsl */ `
    struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) uv: vec2<f32>,
    }

    @vertex
    fn vs_main(@builtin(vertex_index) vi: u32) -> VertexOutput {
        let x = f32(vi & 1u) * 4.0 - 1.0;
        let y = f32((vi >> 1u) & 1u) * 4.0 - 1.0;
        return VertexOutput(vec4<f32>(x, y, 0.0, 1.0), vec2<f32>((x + 1.0) * 0.5, (1.0 - y) * 0.5));
    }

    @group(0) @binding(0) var bloomSampler: sampler;
    @group(0) @binding(1) var inputTex: texture_2d<f32>;

    ${bloomChunk}

    @fragment
    fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
        let size = textureDimensions(inputTex);
        let texelSize = vec2<f32>(1.0 / f32(size.x), 1.0 / f32(size.y));
        return vec4<f32>(gaussian_blur_v(inputTex, bloomSampler, in.uv, texelSize), 1.0);
    }
`;
