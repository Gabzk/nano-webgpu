export function getStructsChunk(useCSM: boolean): string {
	return /* wgsl */ `
// --- GLOBALS (@group(0)) ---
struct CameraUniform {
    viewProj: mat4x4<f32>,
    cameraPos: vec4<f32>,  // xyz = world position, w = unused
}
@group(0) @binding(0) var<uniform> camera: CameraUniform;


struct RenderSettings {
    fxaa_enabled: u32,
    time_bits: u32,  // f32 bit-cast: use bitcast<f32>(settings.time_bits)
    _pad2: u32,
    _pad3: u32,
    ambientSkyColor: vec4<f32>,
    ambientGroundColor: vec4<f32>,
}

@group(0) @binding(5) var <uniform> settings: RenderSettings;

struct Light {
    position: vec4<f32>,   // xyz = position, w = typeFlag (0=dir, 1=dir_shadow, 2=point, 3=point_shadow, 4=spot, 5=spot_shadow)
    color: vec4<f32>,      // rgb = color, a = intensity
    direction: vec4<f32>,  // xyz = direction, w = range/radius
    params: vec4<f32>,     // x = innerAngleCos, y = outerAngleCos, zw = padding
}

struct SceneLights {
    count: u32,
    _pad1: u32,
    _pad2: u32,
    _pad3: u32,
    lights: array<Light>,
}
@group(0) @binding(1) var<storage, read> scene: SceneLights;
@group(0) @binding(2) var shadowMap: ${useCSM ? "texture_depth_2d_array" : "texture_depth_2d"};
@group(0) @binding(3) var shadowSampler: sampler_comparison;

struct ShadowCameraUniform {
    ${
			useCSM
				? `viewProjs: array<mat4x4<f32>, 4>,
    splits: vec4<f32>,
    cameraForward: vec4<f32>,
    texelSize: f32,
    hasShadow: f32,
    lightDirX: f32,
    lightDirY: f32,
    lightDirZ: f32,
    bias: f32,
    cascadeCount: f32,
    _pad2: f32,`
				: `viewProj: mat4x4<f32>,
    texelSize: f32,
    hasShadow: f32,
    lightDirX: f32,
    lightDirY: f32,
    lightDirZ: f32,
    bias: f32,
    _pad2: f32,
    _pad3: f32,`
		}
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
    cullMode: f32, // 0=back/default, 1=front, 2=disabled (none)
    _pad2: f32,
    _pad3: f32,

    emissive: vec3<f32>,
    useEmissiveMap: f32,
}
@group(2) @binding(0) var<uniform> material: MaterialUniform;
@group(2) @binding(1) var mySampler: sampler;
@group(2) @binding(2) var albedoTex: texture_2d<f32>;
@group(2) @binding(3) var normalTex: texture_2d<f32>;
@group(2) @binding(4) var roughnessTex: texture_2d<f32>;
@group(2) @binding(5) var metallicTex: texture_2d<f32>;
@group(2) @binding(6) var aoTex: texture_2d<f32>;
@group(2) @binding(7) var ormTex: texture_2d<f32>;
@group(2) @binding(8) var emissiveTex: texture_2d<f32>;

// --- IO FORMATS ---
struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) uv: vec2<f32>,
    @location(3) color: vec3<f32>,
}

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) frag_pos: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) uv: vec2<f32>,
    @location(3) shadow_pos: vec4<f32>,
    @location(4) color: vec3<f32>,
}
`;
}

export const structsChunk = getStructsChunk(false);
