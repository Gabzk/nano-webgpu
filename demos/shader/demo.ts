import { Scene, ShaderMaterial } from "../../dist";

const scene = await Scene.init("#canvas")
const canvas = scene.getCanvas()

scene.backgroundColor = "#1a1a2e"
scene.setCamera({ position: [0, 1.5, 2.5] })
scene.addLight({ type: "directional", rotationDegrees: [45, 45, 0], intensity: 1.2, castShadow: true })

scene.addPlane({ scale: 4 })

// ─── Highlight Shader ─────────────────────────────────────────────────────────
// Ported from a Godot spatial shader (GLSL-like) to WGSL.
//
// Godot original concept:
//   • Transforms vertex into view/camera space
//   • Computes a sweeping "shine" band along the Z axis
//   • Masks with the Fresnel / rim term (1 - dot(N, V)) to hide flat surfaces
//
// WGSL mapping:
//   • VERTEX  → frag_pos  (world-space position, vs_main outputs it)
//   • CAMERA_MATRIX · VERTEX  → view_pos (manual view transform = inv(view) · world)
//     We approximate this as: view_pos.z ≈ dot(frag_pos - cameraPos, viewDir)
//     For the sine-band we only need the depth-ish axis, so we use
//     (frag_pos - cameraPos) projected onto the camera forward direction.
//   • NORMAL  → in.normal (world-space, already normalised by vs_main)
//   • VIEW    → normalize(cameraPos - frag_pos)  (view direction from fragment)
//   • TIME    → bitcast<f32>(settings.time_bits)  (elapsed seconds, see renderer.ts)
//
// Uniforms (tweakable):
//   shine_color    – tint of the shimmer  (default: hot gold)
//   cycle_interval – period scale         (lower = wider bands)
//   shine_speed    – animation speed      (higher = faster sweep)
//   shine_width    – band thickness       (higher = wider band)
// ──────────────────────────────────────────────────────────────────────────────
const highlight = new ShaderMaterial({
    cullMode: "none",
    shaderCode: /* wgsl */`
// ── Group 0: Globals ──────────────────────────────────────────────────────────
struct CameraUniform {
    viewProj: mat4x4<f32>,
    cameraPos: vec4<f32>,
}
@group(0) @binding(0) var<uniform> camera: CameraUniform;

struct RenderSettings {
    fxaa_enabled: u32,
    time_bits: u32,   // bitcast to f32 → elapsed seconds
    _pad2: u32,
    _pad3: u32,
}
@group(0) @binding(5) var<uniform> settings: RenderSettings;

// ── Group 1: Model matrices ────────────────────────────────────────────────────
@group(1) @binding(0) var<storage, read> models: array<mat4x4<f32>>;

// ── Group 2: Material (empty – we don't use standard PBR here) ────────────────
struct MaterialUniform { color: vec4<f32>, roughness: f32, metallic: f32, normalScale: f32, aoIntensity: f32, useNormalMap: f32, useRoughnessMap: f32, useMetallicMap: f32, useAOMap: f32, useORMMap: f32, cullMode: f32, _pad2: f32, _pad3: f32, }
@group(2) @binding(0) var<uniform> material: MaterialUniform;
@group(2) @binding(1) var mySampler: sampler;
@group(2) @binding(2) var albedoTex:    texture_2d<f32>;
@group(2) @binding(3) var normalTex:    texture_2d<f32>;
@group(2) @binding(4) var roughnessTex: texture_2d<f32>;
@group(2) @binding(5) var metallicTex:  texture_2d<f32>;
@group(2) @binding(6) var aoTex:        texture_2d<f32>;
@group(2) @binding(7) var ormTex:       texture_2d<f32>;

// ── Group 3: Custom (empty) ────────────────────────────────────────────────────

// ── Vertex I/O ────────────────────────────────────────────────────────────────
struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal:   vec3<f32>,
    @location(2) uv:       vec2<f32>,
    @location(3) color:    vec3<f32>,
}
struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) frag_pos: vec3<f32>,
    @location(1) normal:   vec3<f32>,
    @location(2) uv:       vec2<f32>,
    @location(3) shadow_pos: vec4<f32>,
    @location(4) color:    vec3<f32>,
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
    out.shadow_pos    = vec4<f32>(0.0); // unused
    return out;
}

// ── Highlight fragment ─────────────────────────────────────────────────────────
// Tweak these to change the look:
const SHINE_COLOR    = vec4<f32>(1.0, 0.85, 0.2, 1.0); // gold shimmer
const CYCLE_INTERVAL = 1.5;   // lower  → denser bands
const SHINE_SPEED    = 2.5;   // higher → faster sweep
const SHINE_WIDTH    = 8.0;   // higher → wider bright band

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let time  = bitcast<f32>(settings.time_bits);

    // Direction from fragment to camera (≈ Godot VIEW)
    let view_dir = normalize(camera.cameraPos.xyz - in.frag_pos);

    // Approximate the "camera-space Z" of the fragment.
    // We build a rough camera-forward from the viewProj row 2 (z column).
    // This gives us a scalar depth-like value that changes as the mesh rotates.
    let cam_fwd = -normalize(vec3<f32>(
        camera.viewProj[0][2],
        camera.viewProj[1][2],
        camera.viewProj[2][2],
    ));
    let depth_axis = dot(in.frag_pos - camera.cameraPos.xyz, cam_fwd);

    // Godot: floor(sin(vertex.z * cycle_interval + TIME * shine_speed * cycle_interval) + width)
    let width     = SHINE_WIDTH * 0.001 * CYCLE_INTERVAL;
    let frequency = floor(
        sin(depth_axis * CYCLE_INTERVAL + time * SHINE_SPEED * CYCLE_INTERVAL) + width
    );

    // Godot: ALPHA = clamp((1 - dot(NORMAL, VIEW)) * frequency * shine_color.a, 0, 1)
    let rim   = 1.0 - dot(in.normal, view_dir);
    let alpha = clamp(rim * frequency * SHINE_COLOR.a, 0.0, 1.0);

    return vec4<f32>(SHINE_COLOR.rgb, alpha);
}
`
})

const key = await scene.loadMesh("./key.glb", {
    rotationDegrees: [0, 0, 0],
    position: [0, 0.5, 0],
})

// Add a second mesh that uses the highlight material overlaid
const keyHighlight = await scene.loadMesh("./key.glb", {
    rotationDegrees: [0, 0, 0],
    position: [0, 0.5, 0],
    material: highlight,
})

console.log(key, keyHighlight)

scene.render(() => {
    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
    }

    const dt = scene.getRenderInfo().dt
    // Sync both meshes rotation
    for (const node of [key, keyHighlight]) {
        for (const child of node.children.length ? node.children : [node]) {
            // @ts-ignore
            if (child.rotationDegrees) child.rotationDegrees.y += 40 * dt
        }
    }
})