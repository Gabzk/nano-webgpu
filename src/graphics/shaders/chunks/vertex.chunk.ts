/**
 * Chunk: vertex shader entry point.
 */
export const vertexChunk = /* wgsl */ `
@vertex
fn vs_main(@builtin(instance_index) instanceIdx: u32, in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    let modelMatrix = models[instanceIdx];
    let world_pos = modelMatrix * vec4<f32>(in.position, 1.0);
    out.frag_pos = world_pos.xyz;

    out.normal = (modelMatrix * vec4<f32>(in.normal, 0.0)).xyz;
    out.uv = in.uv;

    out.clip_position = camera.viewProj * world_pos;

    // Transform world position into shadow clip space
    out.shadow_pos = shadowCamera.viewProj * world_pos;
    return out;
}
`;
