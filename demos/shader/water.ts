export const waterShader = /* wgsl */`

// ── Group 3: Configurable shader parameters ────────────────────────────────────
struct WaterParams {
    water_color: vec4<f32>,
    water_color2: vec4<f32>,
    foam_color: vec4<f32>,
    tile: vec2<f32>,
    wave_size: vec2<f32>,
    distortion_speed: f32,
    height: f32,
    wave_speed: f32,
    _pad: f32,
}
@group(3) @binding(0) var<uniform> params: WaterParams;

// ── Constants & Helpers ───────────────────────────────────────────────────────
const M_2PI: f32 = 6.283185307;
const M_6PI: f32 = 18.84955592;

fn my_mod(x: f32, y: f32) -> f32 {
    return x - y * floor(x / y);
}

fn random(uv: vec2<f32>) -> f32 {
    return fract(sin(dot(uv, vec2<f32>(12.9898, 78.233))) * 43758.5453123);
}

fn noise(uv: vec2<f32>) -> f32 {
    let uv_index = floor(uv);
    let uv_fract = fract(uv);

    // Four corners in 2D of a tile
    let a = random(uv_index);
    let b = random(uv_index + vec2<f32>(1.0, 0.0));
    let c = random(uv_index + vec2<f32>(0.0, 1.0));
    let d = random(uv_index + vec2<f32>(1.0, 1.0));

    let blur = smoothstep(vec2<f32>(0.0), vec2<f32>(1.0), uv_fract);

    return mix(a, b, blur.x) +
            (c - a) * blur.y * (1.0 - blur.x) +
            (d - b) * blur.x * blur.y;
}

fn fbm(uv: vec2<f32>) -> f32 {
    var amplitude = 0.5;
    var frequency = 3.0;
    var value = 0.0;
    
    for (var i = 0; i < 6; i = i + 1) {
        value += amplitude * noise(frequency * uv);
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    return value;
}

fn circ(pos: vec2<f32>, c_in: vec2<f32>, s: f32) -> f32 {
    var c = abs(pos - c_in);
    c = min(c, vec2<f32>(1.0) - c);

    return smoothstep(0.0, 0.002, sqrt(s) - sqrt(dot(c, c))) * -1.0;
}

// Foam pattern for the water constructed out of a series of circles
fn waterlayer(uv_in: vec2<f32>) -> f32 {
    let uv = fract(uv_in); // Clamp to [0..1]
    
    var ret = 1.0;
    ret += circ(uv, vec2<f32>(0.37378, 0.277169), 0.0268181);
    ret += circ(uv, vec2<f32>(0.0317477, 0.540372), 0.0193742);
    ret += circ(uv, vec2<f32>(0.430044, 0.882218), 0.0232337);
    ret += circ(uv, vec2<f32>(0.641033, 0.695106), 0.0117864);
    ret += circ(uv, vec2<f32>(0.0146398, 0.0791346), 0.0299458);
    ret += circ(uv, vec2<f32>(0.43871, 0.394445), 0.0289087);
    ret += circ(uv, vec2<f32>(0.909446, 0.878141), 0.028466);
    ret += circ(uv, vec2<f32>(0.310149, 0.686637), 0.0128496);
    ret += circ(uv, vec2<f32>(0.928617, 0.195986), 0.0152041);
    ret += circ(uv, vec2<f32>(0.0438506, 0.868153), 0.0268601);
    ret += circ(uv, vec2<f32>(0.308619, 0.194937), 0.00806102);
    ret += circ(uv, vec2<f32>(0.349922, 0.449714), 0.00928667);
    ret += circ(uv, vec2<f32>(0.0449556, 0.953415), 0.023126);
    ret += circ(uv, vec2<f32>(0.117761, 0.503309), 0.0151272);
    ret += circ(uv, vec2<f32>(0.563517, 0.244991), 0.0292322);
    ret += circ(uv, vec2<f32>(0.566936, 0.954457), 0.00981141);
    ret += circ(uv, vec2<f32>(0.0489944, 0.200931), 0.0178746);
    ret += circ(uv, vec2<f32>(0.569297, 0.624893), 0.0132408);
    ret += circ(uv, vec2<f32>(0.298347, 0.710972), 0.0114426);
    ret += circ(uv, vec2<f32>(0.878141, 0.771279), 0.00322719);
    ret += circ(uv, vec2<f32>(0.150995, 0.376221), 0.00216157);
    ret += circ(uv, vec2<f32>(0.119673, 0.541984), 0.0124621);
    ret += circ(uv, vec2<f32>(0.629598, 0.295629), 0.0198736);
    ret += circ(uv, vec2<f32>(0.334357, 0.266278), 0.0187145);
    ret += circ(uv, vec2<f32>(0.918044, 0.968163), 0.0182928);
    ret += circ(uv, vec2<f32>(0.965445, 0.505026), 0.006348);
    ret += circ(uv, vec2<f32>(0.514847, 0.865444), 0.00623523);
    ret += circ(uv, vec2<f32>(0.710575, 0.0415131), 0.00322689);
    ret += circ(uv, vec2<f32>(0.71403, 0.576945), 0.0215641);
    ret += circ(uv, vec2<f32>(0.748873, 0.413325), 0.0110795);
    ret += circ(uv, vec2<f32>(0.0623365, 0.896713), 0.0236203);
    ret += circ(uv, vec2<f32>(0.980482, 0.473849), 0.00573439);
    ret += circ(uv, vec2<f32>(0.647463, 0.654349), 0.0188713);
    ret += circ(uv, vec2<f32>(0.651406, 0.981297), 0.00710875);
    ret += circ(uv, vec2<f32>(0.428928, 0.382426), 0.0298806);
    ret += circ(uv, vec2<f32>(0.811545, 0.62568), 0.00265539);
    ret += circ(uv, vec2<f32>(0.400787, 0.74162), 0.00486609);
    ret += circ(uv, vec2<f32>(0.331283, 0.418536), 0.00598028);
    ret += circ(uv, vec2<f32>(0.894762, 0.0657997), 0.00760375);
    ret += circ(uv, vec2<f32>(0.525104, 0.572233), 0.0141796);
    ret += circ(uv, vec2<f32>(0.431526, 0.911372), 0.0213234);
    ret += circ(uv, vec2<f32>(0.658212, 0.910553), 0.000741023);
    ret += circ(uv, vec2<f32>(0.514523, 0.243263), 0.0270685);
    ret += circ(uv, vec2<f32>(0.0249494, 0.252872), 0.00876653);
    ret += circ(uv, vec2<f32>(0.502214, 0.47269), 0.0234534);
    ret += circ(uv, vec2<f32>(0.693271, 0.431469), 0.0246533);
    ret += circ(uv, vec2<f32>(0.415, 0.884418), 0.0271696);
    ret += circ(uv, vec2<f32>(0.149073, 0.41204), 0.00497198);
    ret += circ(uv, vec2<f32>(0.533816, 0.897634), 0.00650833);
    ret += circ(uv, vec2<f32>(0.0409132, 0.83406), 0.0191398);
    ret += circ(uv, vec2<f32>(0.638585, 0.646019), 0.0206129);
    ret += circ(uv, vec2<f32>(0.660342, 0.966541), 0.0053511);
    ret += circ(uv, vec2<f32>(0.513783, 0.142233), 0.00471653);
    ret += circ(uv, vec2<f32>(0.124305, 0.644263), 0.00116724);
    ret += circ(uv, vec2<f32>(0.99871, 0.583864), 0.0107329);
    ret += circ(uv, vec2<f32>(0.894879, 0.233289), 0.00667092);
    ret += circ(uv, vec2<f32>(0.246286, 0.682766), 0.00411623);
    ret += circ(uv, vec2<f32>(0.0761895, 0.16327), 0.0145935);
    ret += circ(uv, vec2<f32>(0.949386, 0.802936), 0.0100873);
    ret += circ(uv, vec2<f32>(0.480122, 0.196554), 0.0110185);
    ret += circ(uv, vec2<f32>(0.896854, 0.803707), 0.013969);
    ret += circ(uv, vec2<f32>(0.292865, 0.762973), 0.00566413);
    ret += circ(uv, vec2<f32>(0.0995585, 0.117457), 0.00869407);
    ret += circ(uv, vec2<f32>(0.377713, 0.00335442), 0.0063147);
    ret += circ(uv, vec2<f32>(0.506365, 0.531118), 0.0144016);
    ret += circ(uv, vec2<f32>(0.408806, 0.894771), 0.0243923);
    ret += circ(uv, vec2<f32>(0.143579, 0.85138), 0.00418529);
    ret += circ(uv, vec2<f32>(0.0902811, 0.181775), 0.0108896);
    ret += circ(uv, vec2<f32>(0.780695, 0.394644), 0.00475475);
    ret += circ(uv, vec2<f32>(0.298036, 0.625531), 0.00325285);
    ret += circ(uv, vec2<f32>(0.218423, 0.714537), 0.00157212);
    ret += circ(uv, vec2<f32>(0.658836, 0.159556), 0.00225897);
    ret += circ(uv, vec2<f32>(0.987324, 0.146545), 0.0288391);
    ret += circ(uv, vec2<f32>(0.222646, 0.251694), 0.00092276);
    ret += circ(uv, vec2<f32>(0.159826, 0.528063), 0.00605293);
    return max(ret, 0.0);
}

// Procedural texture generation for the water
fn water(uv_in: vec2<f32>, cdir: vec3<f32>, iTime: f32) -> vec3<f32> {
    var uv = uv_in * vec2<f32>(0.25);
    uv = uv + fbm(uv) * 0.2;

    // Parallax height distortion with two directional waves at
    // slightly different angles.
    let a = 0.025 * cdir.xz / cdir.y; // Parallax offset
    var h = sin(uv.x + iTime); // Height at UV
    uv = uv + a * h;
    h = sin(0.841471 * uv.x - 0.540302 * uv.y + iTime);
    uv = uv + a * h;
    
    // Texture distortion
    var d1 = my_mod(uv.x + uv.y, M_2PI);
    var d2 = my_mod((uv.x + uv.y + 0.25) * 1.3, M_6PI);
    d1 = iTime * 0.07 + d1;
    d2 = iTime * 0.5 + d2;
    let dist = vec2<f32>(
        sin(d1) * 0.15 + sin(d2) * 0.05,
        cos(d1) * 0.15 + cos(d2) * 0.05
    );
    
    var ret = mix(params.water_color.rgb, params.water_color2.rgb, waterlayer(uv + dist.xy));
    ret = mix(ret, params.foam_color.rgb, waterlayer(vec2<f32>(1.0) - uv - dist.yx));
    return ret;
}

@vertex
fn vs_main(@builtin(instance_index) instanceIdx: u32, in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    let model     = models[instanceIdx];
    
    // Time and vertex displacement
    let time = bitcast<f32>(settings.time_bits) * params.wave_speed;
    let uv = in.uv * params.wave_size;
    var d1 = my_mod(uv.x + uv.y, M_2PI);
    var d2 = my_mod((uv.x + uv.y + 0.25) * 1.3, M_6PI);
    d1 = time * 0.07 + d1;
    d2 = time * 0.5 + d2;
    let dist = vec2<f32>(
        sin(d1) * 0.15 + sin(d2) * 0.05,
        cos(d1) * 0.15 + cos(d2) * 0.05
    );
    
    var displaced_pos = in.position;
    displaced_pos.y += dist.y * params.height;

    let world_pos = model * vec4<f32>(displaced_pos, 1.0);
    out.frag_pos      = world_pos.xyz;
    out.normal        = normalize((model * vec4<f32>(in.normal, 0.0)).xyz);
    out.uv            = in.uv;
    out.color         = in.color;
    out.clip_position = camera.viewProj * world_pos;
    out.shadow_pos    = vec4<f32>(0.0);
    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let time = bitcast<f32>(settings.time_bits);
    var color = water(in.uv * params.tile, vec3<f32>(0.0, 1.0, 0.0), time * params.distortion_speed);
    
    if (shadowCamera.hasShadow > 0.5) {
        let shadowDir = normalize(vec3<f32>(shadowCamera.lightDirX, shadowCamera.lightDirY, shadowCamera.lightDirZ));
        let shadowBias = max(shadowCamera.bias * (1.0 - dot(normalize(in.normal), shadowDir)), shadowCamera.bias * 0.1);
        let depth = dot(in.frag_pos - camera.cameraPos.xyz, shadowCamera.cameraForward.xyz);
        let shadowSample = getShadow(in.frag_pos, depth, shadowBias, shadowCamera.texelSize);
        let shadowFactor = mix(0.4, 1.0, shadowSample); // 0.4 ambient shadow floor so it's not pitch black
        color = color * shadowFactor;
    }
    
    return vec4<f32>(color, 1.0);
}
`
