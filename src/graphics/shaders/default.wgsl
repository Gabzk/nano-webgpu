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
struct ShadowCameraUniform {
    viewProj: mat4x4<f32>,
    texelSize: f32,
    usePCF: f32,
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

@vertex
fn vs_main(@builtin(instance_index) instanceIdx: u32, in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    let modelMatrix = models[instanceIdx];
    let world_pos = modelMatrix * vec4<f32>(in.position, 1.0);
    out.frag_pos = world_pos.xyz;
    
    out.normal = (modelMatrix * vec4<f32>(in.normal, 0.0)).xyz;
    out.uv = in.uv;
    
    out.clip_position = camera.viewProj * world_pos;
    
    // Bias matrix inside WGSL (NDC is -1..1, texture is 0..1)
    out.shadow_pos = shadowCamera.viewProj * world_pos;
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

// Uniform-control-flow-safe shadow: ALWAYS samples the shadow map unconditionally.
// Clamps UVs and uses a mask to neutralize out-of-bounds samples without any early return.
fn getShadow(shadowPos: vec4<f32>, bias: f32, texelSize: f32) -> f32 {
    let projCoords = shadowPos.xyz / shadowPos.w;
    let uv = vec2<f32>(projCoords.x * 0.5 + 0.5, 1.0 - (projCoords.y * 0.5 + 0.5));
    let currentDepth = projCoords.z;
    let clampedUV = clamp(uv, vec2<f32>(0.0), vec2<f32>(1.0));

    var visibility = 0.0;
    // usePCF multiplier: 0.0 = hard shadows, 1.0 = soft shadows (9 samples)
    let pcfMultiplier = shadowCamera.usePCF;
    for (var x: i32 = -1; x <= 1; x++) {
        for (var y: i32 = -1; y <= 1; y++) {
            let offset = vec2<f32>(f32(x), f32(y)) * texelSize * pcfMultiplier;
            visibility += textureSampleCompare(shadowMap, shadowSampler, clampedUV + offset, currentDepth - bias);
        }
    }
    let shadow = visibility / 9.0;

    // Outside shadow frustum = fully lit
    let inBounds = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
    return mix(1.0, shadow, inBounds);
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
            metallic *= textureSample(metallicTex, mySampler, in.uv).b;
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

    // Always compute shadow unconditionally — WGSL requires textureSampleCompare
    // to be reachable by all fragment invocations (uniform control flow).
    // light type 1.0 = directional with castShadow=true
    let shadowLightDir = normalize(-scene.lights[0].position.xyz);
    let shadowBias = max(0.005 * (1.0 - dot(N, shadowLightDir)), 0.0005);
    let shadowSample = getShadow(in.shadow_pos, shadowBias, shadowCamera.texelSize);
    // Apply sample only if light[0] has castShadow (type == 1.0)
    let light0CastsShadow = scene.lights[0].position.w > 0.5 && scene.lights[0].position.w < 1.5;
    let shadowFactor = select(1.0, shadowSample, light0CastsShadow);

    for (var i: u32 = 0u; i < scene.count; i++) {
        let light = scene.lights[i];
        let lightType = light.position.w;
        
        var L = vec3<f32>(0.0);
        var attenuation = 1.0;
        
        // isDirectional: type 0 or 1 (< 1.5)
        if (lightType < 1.5) {
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

        // Apply shadow only to directional lights with castShadow=true (type == 1.0)
        let currentShadow = select(1.0, shadowFactor, lightType > 0.5 && lightType < 1.5);

        finalColor += (diffuse + specular) * lightColor * currentShadow;
    }
    
    return vec4<f32>(finalColor, alpha);
}
