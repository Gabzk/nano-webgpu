export function getVertexChunk(useCSM: boolean): string {
	return /* wgsl */ `
@vertex
fn vs_main(@builtin(instance_index) instanceIdx: u32, in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    let modelMatrix = models[instanceIdx];
    let world_pos = modelMatrix * vec4<f32>(in.position, 1.0);
    out.frag_pos = world_pos.xyz;

    // Normalize AFTER model transform — required when model has non-uniform scale.
    out.normal = normalize((modelMatrix * vec4<f32>(in.normal, 0.0)).xyz);
    out.uv = in.uv;
    out.color = in.color;

    out.clip_position = camera.viewProj * world_pos;

    ${
			useCSM
				? "out.shadow_pos = vec4<f32>(0.0);"
				: "out.shadow_pos = shadowCamera.viewProj * world_pos;"
		}
    return out;
}
`;
}

export const vertexChunk = getVertexChunk(false);
