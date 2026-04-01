export const defaultShaderWGSL = `
// --- GLOBALS (@group(0)) ---
struct CameraUniform {
    viewProj: mat4x4<f32>,
}
@group(0) @binding(0) var<uniform> camera: CameraUniform;

struct Light {
    position: vec4<f32>, // xyz = pos or dir, w = type (0.0 = Dir, 1.0 = Point)
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


// --- MODEL (@group(1)) ---
struct ModelUniform {
    modelMatrix: mat4x4<f32>,
}
@group(1) @binding(0) var<uniform> modelInfo: ModelUniform;


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
}

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    let world_pos = modelInfo.modelMatrix * vec4<f32>(in.position, 1.0);
    out.frag_pos = world_pos.xyz;
    
    out.normal = (modelInfo.modelMatrix * vec4<f32>(in.normal, 0.0)).xyz;
    out.uv = in.uv;
    
    out.clip_position = camera.viewProj * world_pos;
    return out;
}

// Normal Map Perturbation without explicit Tangents
fn getPerturbedNormal(N: vec3<f32>, p: vec3<f32>, uv: vec2<f32>, normal_sample: vec3<f32>, scale: f32, dp1: vec3<f32>, dp2: vec3<f32>, duv1: vec2<f32>, duv2: vec2<f32>) -> vec3<f32> {
    let Nmap = normal_sample * 2.0 - 1.0;
    
    let c1 = cross(dp2, N);
    let c2 = cross(N, dp1);
    
    let T = c1 * duv1.x + c2 * duv2.x;
    let B = c1 * duv1.y + c2 * duv2.y;
    
    let maxsqr = max(dot(T, T), dot(B, B));
    let invmax = inverseSqrt(maxsqr + 0.00001); // Epsilon to prevent NaN
    
    let TBN = mat3x3<f32>(T * invmax, B * invmax, N);
    
    return normalize(TBN * vec3<f32>(Nmap.x * scale, Nmap.y * scale, Nmap.z));
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Avoid uniform control flow issues with dpdx inside if
    let dp1 = dpdx(in.frag_pos);
    let dp2 = dpdy(in.frag_pos);
    let duv1 = dpdx(in.uv);
    let duv2 = dpdy(in.uv);
    
    let texColor = textureSample(albedoTex, mySampler, in.uv);
    let baseColor = texColor.rgb * material.color.rgb;
    let alpha = texColor.a * material.color.a;
    
    var N = normalize(in.normal);
    if (material.useNormalMap > 0.5) {
        let nSample = textureSample(normalTex, mySampler, in.uv).rgb;
        N = getPerturbedNormal(N, in.frag_pos, in.uv, nSample, material.normalScale, dp1, dp2, duv1, duv2);
    }
    
    var roughness = material.roughness;
    var metallic = material.metallic;
    var ao = 1.0;

    if (material.useORMMap > 0.5) {
        let orm = textureSample(ormTex, mySampler, in.uv).rgb;
        ao = orm.r;
        roughness *= orm.g;
        metallic *= orm.b;
    } else {
        if (material.useRoughnessMap > 0.5) {
            roughness *= textureSample(roughnessTex, mySampler, in.uv).r; 
        }
        if (material.useMetallicMap > 0.5) {
            metallic *= textureSample(metallicTex, mySampler, in.uv).b; // often in B or R
        }
        if (material.useAOMap > 0.5) {
            ao = textureSample(aoTex, mySampler, in.uv).r;
        }
    }
    
    // Mix AO with intensity
    ao = mix(1.0, ao, material.aoIntensity);

    let V = normalize(camera.viewProj[3].xyz - in.frag_pos); 
    
    var finalColor = vec3<f32>(0.0);
    
    // Ambient light affected by AO
    let ambient = vec3<f32>(0.1) * baseColor * ao;
    finalColor += ambient;

    let shininess = exp2(10.0 * (1.0 - roughness) + 1.0);
    let specularColor = mix(vec3<f32>(0.04), baseColor, metallic);

    for (var i: u32 = 0u; i < scene.count; i++) {
        let light = scene.lights[i];
        let lightType = light.position.w; 
        
        var L = vec3<f32>(0.0);
        var attenuation = 1.0;
        
        if (lightType < 0.5) {
            L = normalize(-light.position.xyz);
        } else {
            let distance = length(light.position.xyz - in.frag_pos);
            L = normalize(light.position.xyz - in.frag_pos);
            attenuation = 1.0 / (1.0 + 0.09 * distance + 0.032 * (distance * distance));
        }
        
        let lightColor = light.color.rgb * light.color.a * attenuation;
        
        let NdotL = max(dot(N, L), 0.0);
        let diffuse = baseColor * NdotL * (1.0 - metallic);
        
        let H = normalize(L + V);
        let NdotH = max(dot(N, H), 0.0);
        let specPower = pow(NdotH, shininess);
        let specular = specularColor * specPower * NdotL;

        finalColor += (diffuse + specular) * lightColor;
    }
    
    return vec4<f32>(finalColor, alpha);
}
`;
