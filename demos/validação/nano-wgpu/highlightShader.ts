export const highlightShader = /* wgsl */`

struct ShineParams {
    color:         vec4<f32>, // shimmer tint
    cycleInterval: f32,       // band density  (lower  = denser)
    speed:         f32,       // sweep speed   (higher = faster)
    width:         f32,       // band thickness (higher = wider)
    _pad:          f32,
}
@group(3) @binding(0) var<uniform> params: ShineParams;

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let time     = bitcast<f32>(settings.time_bits);
    let view_dir = normalize(camera.cameraPos.xyz - in.frag_pos);

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

    let rim   = 1.0 - dot(in.normal, view_dir);
    let alpha = clamp(rim * frequency * params.color.a, 0.0, 1.0);

    return vec4<f32>(params.color.rgb, alpha);
}
`