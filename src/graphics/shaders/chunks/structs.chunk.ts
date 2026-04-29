/**
 * Chunk: global bindings (group 0, 1, 2) struct declarations.
 * ShadowCameraUniform no longer carries usePCF — it is baked into the shader
 * variant at pipeline-creation time, saving a runtime uniform read.
 */
export const structsChunk = /* wgsl */ `
// --- GLOBALS (@group(0)) ---
struct CameraUniform {
    viewProj: mat4x4<f32>,
}
@group(0) @binding(0) var<uniform> camera: CameraUniform;

struct Light {
    position: vec4<f32>, // xyz = pos or dir, w = type:
                         // 0=directional no shadow, 1=directional with shadow
                         // 2=point no shadow,       3=point with shadow
    color: vec4<f32>,    // rgb = color, a = intensity
}

struct SceneLights {
    count: u32,
    _pad1: u32,
    _pad2: u32,
    _pad3: u32,
    lights: array<Light>,
}
@group(0) @binding(1) var<storage, read> scene: SceneLights;
@group(0) @binding(2) var shadowMap: texture_depth_2d;
@group(0) @binding(3) var shadowSampler: sampler_comparison;

// usePCF is no longer a runtime uniform field — it is selected at compile time
// via shader variants. The two padding slots now go back to being explicit pads.
struct ShadowCameraUniform {
    viewProj: mat4x4<f32>,
    texelSize: f32,
    _pad1: f32,
    _pad2: f32,
    _pad3: f32,
}
@group(0) @binding(4) var<uniform> shadowCamera: ShadowCameraUniform;


// --- MODEL (@group(1)) ---
@group(1) @binding(0) var<storage, read> models: array<mat4x4<f32>>;


// --- MATERIAL (@group(2)) ---
struct MaterialUniform {
    color: vec4<f32>,
    roughness: f32,
    metallic: f32,
    normalScale: f32,
    aoIntensity: f32,

    useNormalMap: f32,
    useRoughnessMap: f32,
    useMetallicMap: f32,
    useAOMap: f32,

    useORMMap: f32,
    _pad1: f32,
    _pad2: f32,
    _pad3: f32,
}
@group(2) @binding(0) var<uniform> material: MaterialUniform;
@group(2) @binding(1) var mySampler: sampler;
@group(2) @binding(2) var albedoTex: texture_2d<f32>;
@group(2) @binding(3) var normalTex: texture_2d<f32>;
@group(2) @binding(4) var roughnessTex: texture_2d<f32>;
@group(2) @binding(5) var metallicTex: texture_2d<f32>;
@group(2) @binding(6) var aoTex: texture_2d<f32>;
@group(2) @binding(7) var ormTex: texture_2d<f32>;

// --- IO FORMATS ---
struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) uv: vec2<f32>,
}

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) frag_pos: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) uv: vec2<f32>,
    @location(3) shadow_pos: vec4<f32>,
}
`;
