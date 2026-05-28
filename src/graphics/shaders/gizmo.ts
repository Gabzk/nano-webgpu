/**
 * WGSL Shader for rendering unlit debug gizmos/helpers with a solid constant color.
 */
export const gizmoShader = /* wgsl */ `
struct CameraUniform {
    viewProj: mat4x4<f32>,
    cameraPos: vec4<f32>,
}
@group(0) @binding(0) var<uniform> camera: CameraUniform;

struct ModelUniform {
    matrix: mat4x4<f32>,
    color: vec4<f32>,
}
@group(1) @binding(0) var<uniform> model: ModelUniform;

struct VertexInput {
    @location(0) position: vec3<f32>,
}

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
}

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    out.clip_position = camera.viewProj * model.matrix * vec4<f32>(in.position, 1.0);
    return out;
}

@fragment
fn fs_main() -> @location(0) vec4<f32> {
    return model.color;
}
`;
