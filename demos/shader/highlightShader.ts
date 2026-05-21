
export const highlightShader = /* wgsl */`

// ── Group 0: Globals ──────────────────────────────────────────────────────────
struct CameraUniform {
    viewProj: mat4x4<f32>,
    cameraPos: vec4<f32>,
}
@group(0) @binding(0) var<uniform> camera: CameraUniform;

struct RenderSettings {
    fxaa_enabled: u32,
    time_bits: u32,
    _pad2: u32,
    _pad3: u32,
}
@group(0) @binding(5) var<uniform> settings: RenderSettings;

// ── Group 1: Model matrices ────────────────────────────────────────────────────
@group(1) @binding(0) var<storage, read> models: array<mat4x4<f32>>;

// ── Group 2: Material (not used — declared to satisfy the fixed pipeline layout) ─
struct MaterialUniform { color: vec4<f32>, roughness: f32, metallic: f32, normalScale: f32, aoIntensity: f32, useNormalMap: f32, useRoughnessMap: f32, useMetallicMap: f32, useAOMap: f32, useORMMap: f32, cullMode: f32, _pad2: f32, _pad3: f32, }
@group(2) @binding(0) var<uniform> material: MaterialUniform;
@group(2) @binding(1) var mySampler: sampler;
@group(2) @binding(2) var albedoTex:    texture_2d<f32>;
@group(2) @binding(3) var normalTex:    texture_2d<f32>;
@group(2) @binding(4) var roughnessTex: texture_2d<f32>;
@group(2) @binding(5) var metallicTex:  texture_2d<f32>;
@group(2) @binding(6) var aoTex:        texture_2d<f32>;
@group(2) @binding(7) var ormTex:       texture_2d<f32>;

// ── Group 3: Configurable shader parameters ────────────────────────────────────
// Layout must match the 'uniforms' object passed to ShaderMaterial (in field order).
struct ShineParams {
    color:         vec4<f32>, // shimmer tint
    cycleInterval: f32,       // band density  (lower  = denser)
    speed:         f32,       // sweep speed   (higher = faster)
    width:         f32,       // band thickness (higher = wider)
    _pad:          f32,
}
@group(3) @binding(0) var<uniform> params: ShineParams;

// ── Vertex I/O ────────────────────────────────────────────────────────────────
struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal:   vec3<f32>,
    @location(2) uv:       vec2<f32>,
    @location(3) color:    vec3<f32>,
}
struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) frag_pos:   vec3<f32>,
    @location(1) normal:     vec3<f32>,
    @location(2) uv:         vec2<f32>,
    @location(3) shadow_pos: vec4<f32>,
    @location(4) color:      vec3<f32>,
}

@vertex
fn vs_main(@builtin(instance_index) instanceIdx: u32, in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    let model     = models[instanceIdx];
    let world_pos = model * vec4<f32>(in.position, 1.0);
    out.frag_pos      = world_pos.xyz;
    out.normal        = normalize((model * vec4<f32>(in.normal, 0.0)).xyz);
    out.uv            = in.uv;
    out.color         = in.color;
    out.clip_position = camera.viewProj * world_pos;
    out.shadow_pos    = vec4<f32>(0.0);
    return out;
}

// ── Highlight fragment ─────────────────────────────────────────────────────────
// Ported from a Godot spatial shader to WGSL.
// Produces a sweeping sine-wave shine band masked by the Fresnel/rim term.
@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let time     = bitcast<f32>(settings.time_bits);
    let view_dir = normalize(camera.cameraPos.xyz - in.frag_pos);

    // Build camera-forward from the view-projection Z column
    let cam_fwd = -normalize(vec3<f32>(
        camera.viewProj[0][2],
        camera.viewProj[1][2],
        camera.viewProj[2][2],
    ));
    let depth_axis = dot(in.frag_pos - camera.cameraPos.xyz, cam_fwd);

    let bandWidth = params.width * 0.001 * params.cycleInterval;
    let frequency = floor(
        sin(depth_axis * params.cycleInterval + time * params.speed * params.cycleInterval) + bandWidth
    );

    // Fresnel/rim mask: hides the shine on surfaces facing the camera directly
    let rim   = 1.0 - dot(in.normal, view_dir);
    let alpha = clamp(rim * frequency * params.color.a, 0.0, 1.0);

    return vec4<f32>(params.color.rgb, alpha);
}
    `
