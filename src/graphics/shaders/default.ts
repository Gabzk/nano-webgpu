export const defaultShaderWGSL = `
struct CameraUniform {
    viewProj: mat4x4<f32>,
}
@group(0) @binding(0) var<uniform> camera: CameraUniform;

struct ModelUniform {
    modelMatrix: mat4x4<f32>,
}
@group(1) @binding(0) var<uniform> modelInfo: ModelUniform;
@group(1) @binding(1) var mySampler: sampler;
@group(1) @binding(2) var myTexture: texture_2d<f32>;

// Flexible Light System
struct Light {
    position: vec4<f32>, // xyz = pos or dir, w = type (0.0 = Dir, 1.0 = Point)
    color: vec4<f32>,    // rgb = color, a = intensity
}

struct SceneLights {
    count: u32,
    _pad1: u32,
    _pad2: u32,
    _pad3: u32,
    lights: array<Light>, // Storage Buffer array of dynamic lights
}
@group(2) @binding(0) var<storage, read> scene: SceneLights;

// Format: Position(XYZ), Normal(XYZ), UV(XY)
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
    
    // Normal transform (assuming uniform scaling for simplicity)
    out.normal = (modelInfo.modelMatrix * vec4<f32>(in.normal, 0.0)).xyz;
    out.uv = in.uv;
    
    out.clip_position = camera.viewProj * world_pos;
    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let albedo = textureSample(myTexture, mySampler, in.uv);
    let N = normalize(in.normal);
    
    var finalColor = vec3<f32>(0.0);
    
    // Ambient light
    let ambient = vec3<f32>(0.2) * albedo.rgb;
    finalColor += ambient;

    for (var i: u32 = 0u; i < scene.count; i++) {
        let light = scene.lights[i];
        let lightType = light.position.w; 
        
        var L = vec3<f32>(0.0);
        var attenuation = 1.0;
        
        if (lightType < 0.5) {
            // Directional Light
            L = normalize(-light.position.xyz);
        } else {
            // Point Light
            let distance = length(light.position.xyz - in.frag_pos);
            L = normalize(light.position.xyz - in.frag_pos);
            attenuation = 1.0 / (1.0 + 0.09 * distance + 0.032 * (distance * distance));
        }
        
        // Diffuse
        let diff = max(dot(N, L), 0.0);
        let lightColor = light.color.rgb * light.color.a * attenuation;
        
        finalColor += albedo.rgb * diff * lightColor;
    }
    
    return vec4<f32>(finalColor, albedo.a);
}
`;
