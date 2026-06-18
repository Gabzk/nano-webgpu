// WebGPU Nativa (Cenário de Controle)
// CÓDIGO 100% INDEPENDENTE - ZERO IMPORTAÇÕES DA NANO-WEBGPU
// Implementa todas as operações matemáticas e de renderização de baixo nível diretamente na API do navegador.

// --- 1. FUNÇÕES MATEMÁTICAS AUXILIARES (mat4 e vec3 puros de baixo nível) ---
type Mat4 = Float32Array;

function createMat4(): Mat4 {
    return new Float32Array(16);
}

function mat4Identity(out: Mat4) {
    out.fill(0);
    out[0] = 1;
    out[5] = 1;
    out[10] = 1;
    out[15] = 1;
}

function mat4Multiply(out: Mat4, a: Mat4, b: Mat4) {
    const a00 = a[0],  a01 = a[1],  a02 = a[2],  a03 = a[3];
    const a10 = a[4],  a11 = a[5],  a12 = a[6],  a13 = a[7];
    const a20 = a[8],  a21 = a[9],  a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    let b0  = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
    out[0]  = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[1]  = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[2]  = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[3]  = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
    out[4]  = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[5]  = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[6]  = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[7]  = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
    out[8]  = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[9]  = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[10] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[11] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
    out[12] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[13] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[14] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[15] = b0*a03 + b1*a13 + b2*a23 + b3*a33;
}

function mat4Translate(out: Mat4, a: Mat4, v: number[]) {
    const x = v[0], y = v[1], z = v[2];
    let a00, a01, a02, a03;
    let a10, a11, a12, a13;
    let a20, a21, a22, a23;

    if (a === out) {
        out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
        out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
        out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
        out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
    } else {
        a00 = a[0]; a01 = a[1]; a02 = a[2]; a03 = a[3];
        a10 = a[4]; a11 = a[5]; a12 = a[6]; a13 = a[7];
        a20 = a[8]; a21 = a[9]; a22 = a[10]; a23 = a[11];

        out[0] = a00; out[1] = a01; out[2] = a02; out[3] = a03;
        out[4] = a10; out[5] = a11; out[6] = a12; out[7] = a13;
        out[8] = a20; out[9] = a21; out[10] = a22; out[11] = a23;

        out[12] = a00 * x + a10 * y + a20 * z + a[12];
        out[13] = a01 * x + a11 * y + a21 * z + a[13];
        out[14] = a02 * x + a12 * y + a22 * z + a[14];
        out[15] = a03 * x + a13 * y + a23 * z + a[15];
    }
}

function mat4Scale(out: Mat4, a: Mat4, v: number[]) {
    const x = v[0], y = v[1], z = v[2];
    out[0] = a[0] * x;   out[1] = a[1] * x;   out[2] = a[2] * x;   out[3] = a[3] * x;
    out[4] = a[4] * y;   out[5] = a[5] * y;   out[6] = a[6] * y;   out[7] = a[7] * y;
    out[8] = a[8] * z;   out[9] = a[9] * z;   out[10] = a[10] * z; out[11] = a[11] * z;
    out[12] = a[12];     out[13] = a[13];     out[14] = a[14];     out[15] = a[15];
}

function mat4RotateX(out: Mat4, a: Mat4, rad: number) {
    const s = Math.sin(rad);
    const c = Math.cos(rad);
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];

    if (a !== out) {
        out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; out[3] = a[3];
        out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15];
    }
    out[4] = a10 * c + a20 * s;
    out[5] = a11 * c + a21 * s;
    out[6] = a12 * c + a22 * s;
    out[7] = a13 * c + a23 * s;
    out[8] = a20 * c - a10 * s;
    out[9] = a21 * c - a11 * s;
    out[10] = a22 * c - a12 * s;
    out[11] = a23 * c - a13 * s;
}

function mat4RotateZ(out: Mat4, a: Mat4, rad: number) {
    const s = Math.sin(rad);
    const c = Math.cos(rad);
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];

    if (a !== out) {
        out[8] = a[8]; out[9] = a[9]; out[10] = a[10]; out[11] = a[11];
        out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15];
    }
    out[0] = a00 * c + a10 * s;
    out[1] = a01 * c + a11 * s;
    out[2] = a02 * c + a12 * s;
    out[3] = a03 * c + a13 * s;
    out[4] = a10 * c - a00 * s;
    out[5] = a11 * c - a01 * s;
    out[6] = a12 * c - a02 * s;
    out[7] = a13 * c - a03 * s;
}

function mat4Perspective(out: Mat4, fovy: number, aspect: number, near: number, far: number) {
    const f = 1.0 / Math.tan(fovy / 2), nf = 1 / (near - far);
    out[0] = f / aspect;
    out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0;
    out[5] = f;
    out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[12] = 0; out[13] = 0;
    out[14] = 2 * far * near * nf;
    out[15] = 0;
}

function mat4LookAt(out: Mat4, eye: number[], center: number[], up: number[]) {
    const eyex = eye[0], eyey = eye[1], eyez = eye[2];
    const upx = up[0], upy = up[1], upz = up[2];
    const centerx = center[0], centery = center[1], centerz = center[2];

    let z0 = eyex - centerx, z1 = eyey - centery, z2 = eyez - centerz;
    let len = Math.hypot(z0, z1, z2);
    if (len === 0) { z0 = 0; z1 = 0; z2 = 0; } else { len = 1 / len; z0 *= len; z1 *= len; z2 *= len; }

    let x0 = upy * z2 - upz * z1, x1 = upz * z0 - upx * z2, x2 = upx * z1 - upy * z0;
    len = Math.hypot(x0, x1, x2);
    if (len === 0) { x0 = 0; x1 = 0; x2 = 0; } else { len = 1 / len; x0 *= len; x1 *= len; x2 *= len; }

    let y0 = z1 * x2 - z2 * x1, y1 = z2 * x0 - z0 * x2, y2 = z0 * x1 - z1 * x0;
    len = Math.hypot(y0, y1, y2);
    if (len === 0) { y0 = 0; y1 = 0; y2 = 0; } else { len = 1 / len; y0 *= len; y1 *= len; y2 *= len; }

    out[0] = x0;  out[1] = y0;  out[2] = z0;  out[3] = 0;
    out[4] = x1;  out[5] = y1;  out[6] = z1;  out[7] = 0;
    out[8] = x2;  out[9] = y2;  out[10] = z2; out[11] = 0;
    out[12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
    out[13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
    out[14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
    out[15] = 1;
}

function orthoWebGPU(
    out: Mat4,
    left: number,
    right: number,
    bottom: number,
    top: number,
    zNear: number,
    zFar: number,
) {
    const depthRange = zFar - zNear;
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);

    out.fill(0);
    out[0] = -2 * lr;
    out[5] = -2 * bt;
    out[10] = 1 / depthRange;
    out[12] = (left + right) * lr;
    out[13] = (top + bottom) * bt;
    out[14] = -zNear / depthRange;
    out[15] = 1;
}

// --- 2. WGSL SHADERS NATIVOS (PBR E HIGHLIGHT) ---
const baseShaderWGSL = `
    struct CameraUniforms {
        viewProj: mat4x4<f32>,
        cameraPos: vec4<f32>,
    }
    @group(0) @binding(0) var<uniform> camera: CameraUniforms;

    struct Light {
        position: vec4<f32>, // w = typeFlag
        color: vec4<f32>,    // w = intensity
        direction: vec4<f32>,// w = range
        angles: vec4<f32>,   // x = innerCos, y = outerCos
    }
    struct LightsData {
        lightCount: u32,
        lights: array<Light, 1>,
    }
    @group(0) @binding(1) var<storage, read> lightsData: LightsData;

    @group(0) @binding(2) var shadowMap: texture_depth_2d;
    @group(0) @binding(3) var shadowSampler: sampler_comparison;

    struct ShadowCameraUniform {
        viewProj: mat4x4<f32>,
        params: vec4<f32>, // x = texelSize, y = shadowBias
    }
    @group(0) @binding(4) var<uniform> shadowCamera: ShadowCameraUniform;

    struct ModelUniforms {
        modelMatrix: mat4x4<f32>,
    }
    @group(1) @binding(0) var<uniform> model: ModelUniforms;

    // Material Uniform estruturado idêntico ao StandardMaterial da biblioteca (80 bytes = 20 floats)
    struct MaterialUniforms {
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
        cullMode: f32, 
        emissiveStrength: f32,
        _pad3: f32,

        emissive: vec3<f32>,
        useEmissiveMap: f32,
    }
    @group(2) @binding(0) var<uniform> material: MaterialUniforms;
    @group(2) @binding(1) var mySampler: sampler;
    @group(2) @binding(2) var albedoTex: texture_2d<f32>;
    @group(2) @binding(3) var normalTex: texture_2d<f32>;
    @group(2) @binding(4) var ormTex: texture_2d<f32>;
    @group(2) @binding(5) var emissiveTex: texture_2d<f32>;

    struct VertexInput {
        @location(0) position: vec3<f32>,
        @location(1) normal: vec3<f32>,
        @location(2) uv: vec2<f32>,
    }

    struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) frag_pos: vec3<f32>,
        @location(1) normal: vec3<f32>,
        @location(2) uv: vec2<f32>,
    }

    @vertex
    fn vs_main(in: VertexInput) -> VertexOutput {
        var out: VertexOutput;
        let worldPos = model.modelMatrix * vec4<f32>(in.position, 1.0);
        out.position = camera.viewProj * worldPos;
        out.frag_pos = worldPos.xyz;
        out.normal = normalize((model.modelMatrix * vec4<f32>(in.normal, 0.0)).xyz);
        out.uv = in.uv;
        return out;
    }

    // Derivação de Normal Perturbada de Espaço de Tangente em Tela Pura (sem atributo tangent explícito)
    fn getPerturbedNormal(
        N: vec3<f32>, p: vec3<f32>, uv: vec2<f32>,
        normal_sample: vec3<f32>, scale: f32,
        dp1: vec3<f32>, dp2: vec3<f32>,
        duv1: vec2<f32>, duv2: vec2<f32>
    ) -> vec3<f32> {
        var Nmap = normal_sample * 2.0 - 1.0;
        let map_scaled = vec3<f32>(Nmap.x * scale, -Nmap.y * scale, Nmap.z);

        let c1 = cross(dp2, N);
        let c2 = cross(N, dp1);

        var T = c1 * duv1.x + c2 * duv2.x;
        var B = c1 * duv1.y + c2 * duv2.y;

        T = normalize(T - N * dot(N, T));
        B = normalize(cross(N, T));

        let TBN = mat3x3<f32>(T, B, N);
        return normalize(TBN * map_scaled);
    }

    fn schlick5(u: f32) -> f32 {
        let m = 1.0 - u;
        let m2 = m * m;
        return m2 * m2 * m;
    }

    fn getShadow(worldPos: vec3<f32>, bias: f32, texelSize: f32) -> f32 {
        let shadowPos = shadowCamera.viewProj * vec4<f32>(worldPos, 1.0);
        let projCoords = shadowPos.xyz / shadowPos.w;
        let uv = vec2<f32>(projCoords.x * 0.5 + 0.5, 1.0 - (projCoords.y * 0.5 + 0.5));
        let currentDepth = projCoords.z;
        let clampedUV = clamp(uv, vec2<f32>(0.0), vec2<f32>(1.0));

        var visibility = 0.0;
        for (var x: i32 = -1; x <= 1; x++) {
            for (var y: i32 = -1; y <= 1; y++) {
                let offset = vec2<f32>(f32(x), f32(y)) * texelSize;
                visibility += textureSampleCompare(shadowMap, shadowSampler, clampedUV + offset, currentDepth - bias);
            }
        }
        let shadow = visibility / 9.0;

        // Fora do frustum da sombra = completamente iluminado
        let inBounds = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0) * step(currentDepth, 1.0);
        return mix(1.0, shadow, inBounds);
    }

    @fragment
    fn fs_main(in: VertexOutput, @builtin(front_facing) isFrontFace: bool) -> @location(0) vec4<f32> {
        let dp1  = dpdx(in.frag_pos);
        let dp2  = dpdy(in.frag_pos);
        let duv1 = dpdx(in.uv);
        let duv2 = dpdy(in.uv);

        let texColor = textureSample(albedoTex, mySampler, in.uv);
        let baseColor = texColor.rgb * material.color.rgb;
        let alpha = texColor.a * material.color.a;

        // Resolve normal com normal mapping
        var N = normalize(in.normal);
        if (material.useNormalMap > 0.5) {
            let nSample = textureSample(normalTex, mySampler, in.uv).rgb;
            N = getPerturbedNormal(N, in.frag_pos, in.uv, nSample, material.normalScale,
                                   dp1, dp2, duv1, duv2);
        }
        if (material.cullMode > 0.5 && !isFrontFace) {
            N = -N;
        }

        // Extrai parâmetros do ORM PBR
        var roughness = material.roughness;
        var metallic  = material.metallic;
        var ao        = 1.0;

        if (material.useORMMap > 0.5) {
            let orm = textureSample(ormTex, mySampler, in.uv).rgb;
            ao        = orm.r;
            roughness *= orm.g;
            metallic  *= orm.b;
        }
        ao = mix(1.0, ao, material.aoIntensity);

        let V = normalize(camera.cameraPos.xyz - in.frag_pos);

        // --- Iluminação Ambiente (Hemisfério: Céu / Terra da biblioteca) ---
        const skyColor = vec3<f32>(0.45098, 0.47058, 0.5490);
        const groundColor = vec3<f32>(0.12156, 0.10196, 0.07843);
        let upFactor = clamp(N.y * 0.5 + 0.5, 0.0, 1.0);
        let ambient = mix(groundColor, skyColor, upFactor) * baseColor * ao;

        let f0 = mix(vec3<f32>(0.04), baseColor, metallic);

        // Fator de sombras PCF
        let shadow = getShadow(in.frag_pos, shadowCamera.params.y, shadowCamera.params.x);

        var direct = vec3<f32>(0.0);

        for (var i: u32 = 0u; i < lightsData.lightCount; i = i + 1u) {
            let light = lightsData.lights[i];
            let lightType = light.position.w;

            var L = vec3<f32>(0.0);
            var attenuation = 1.0;
            var lightShadow = 1.0;

            if (lightType < 1.5) {
                // Direcional
                L = normalize(-light.direction.xyz);
                lightShadow = shadow;
            } else {
                // Ponto
                let d = light.position.xyz - in.frag_pos;
                let dist = length(d);
                L = normalize(d);
                attenuation = 1.0 / (1.0 + 0.09 * dist + 0.032 * dist * dist);
            }

            let lightColor = light.color.rgb * light.color.w * attenuation;

            let NdotL = max(dot(N, L), 0.0);
            let NdotV = max(dot(N, V), 0.0001);
            let H     = normalize(L + V);
            let LdotH = max(dot(L, H), 0.0);
            let NdotH = max(dot(N, H), 0.0);

            // Disney Burley diffuse
            let FD90        = 2.0 * LdotH * LdotH * roughness - 0.5;
            let FdV         = 1.0 + FD90 * schlick5(NdotV);
            let FdL         = 1.0 + FD90 * schlick5(NdotL);
            let burley      = FdV * FdL * NdotL;
            let diffuse     = baseColor * burley * (1.0 - metallic);

            // GGX specular (Hammon D)
            let a     = roughness * roughness;
            let a2    = a * a;
            let denom = NdotH * NdotH * (a2 - 1.0) + 1.0;
            let D     = a2 / max(denom * denom, 0.0001);

            // Smith GGX Height-correlated V
            let G = clamp(0.5 / mix(2.0 * NdotL * NdotV, NdotL + NdotV, a), 0.0, 1.0);

            // Schlick Fresnel F
            let F = f0 + (vec3<f32>(1.0) - f0) * schlick5(LdotH);
            let specular = NdotL * D * G * F;

            direct = direct + (diffuse + specular) * lightColor * lightShadow;
        }

        // Iluminação Emissiva (HDR)
        var emissiveColor = material.emissive.rgb * material.emissiveStrength;
        if (material.useEmissiveMap > 0.5) {
            emissiveColor = emissiveColor * textureSample(emissiveTex, mySampler, in.uv).rgb;
        }

        let finalColor = ambient + direct + emissiveColor;
        return vec4<f32>(finalColor, alpha);
    }
`;

const highlightShaderWGSL = `
    struct CameraUniforms {
        viewProj: mat4x4<f32>,
        cameraPos: vec4<f32>,
    }
    @group(0) @binding(0) var<uniform> camera: CameraUniforms;

    struct ModelUniforms {
        modelMatrix: mat4x4<f32>,
    }
    @group(1) @binding(0) var<uniform> model: ModelUniforms;

    // Alinhado exatamente com o layout de materialLayout de 6 slots
    struct MaterialUniforms {
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
        cullMode: f32, 
        emissiveStrength: f32,
        _pad3: f32,

        emissive: vec3<f32>,
        useEmissiveMap: f32,
    }
    @group(2) @binding(0) var<uniform> material: MaterialUniforms;
    @group(2) @binding(1) var mySampler: sampler;
    @group(2) @binding(2) var albedoTex: texture_2d<f32>;
    @group(2) @binding(3) var normalTex: texture_2d<f32>;
    @group(2) @binding(4) var ormTex: texture_2d<f32>;
    @group(2) @binding(5) var emissiveTex: texture_2d<f32>;

    struct ShineParams {
        color: vec4<f32>,
        cycleInterval: f32,
        speed: f32,
        width: f32,
        time: f32,
    }
    @group(3) @binding(0) var<uniform> params: ShineParams;

    struct VertexInput {
        @location(0) position: vec3<f32>,
        @location(1) normal: vec3<f32>,
        @location(2) uv: vec2<f32>,
    }

    struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) frag_pos: vec3<f32>,
        @location(1) normal: vec3<f32>,
        @location(2) uv: vec2<f32>,
    }

    @vertex
    fn vs_main(in: VertexInput) -> VertexOutput {
        var out: VertexOutput;
        let worldPos = model.modelMatrix * vec4<f32>(in.position, 1.0);
        out.position = camera.viewProj * worldPos;
        out.frag_pos = worldPos.xyz;
        out.normal = normalize((model.modelMatrix * vec4<f32>(in.normal, 0.0)).xyz);
        out.uv = in.uv;
        return out;
    }

    @fragment
    fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
        let view_dir = normalize(camera.cameraPos.xyz - in.frag_pos);
        let cam_fwd = -normalize(vec3<f32>(
            camera.viewProj[0][2],
            camera.viewProj[1][2],
            camera.viewProj[2][2],
        ));
        let depth_axis = dot(in.frag_pos - camera.cameraPos.xyz, cam_fwd);

        let bandWidth = params.width * 0.001 * params.cycleInterval;
        let frequency = floor(
            sin(depth_axis * params.cycleInterval + params.time * params.speed * params.cycleInterval) + bandWidth
        );

        let rim = 1.0 - dot(normalize(in.normal), view_dir);
        let alpha = clamp(rim * frequency * params.color.a, 0.0, 1.0);

        return vec4<f32>(params.color.rgb, alpha);
    }
`;

// --- 2B. SHADERS NATIVOS DE PÓS-PROCESSAMENTO E BLOOM (GLOW HDR) ---
const postProcessVS = `
    struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) uv: vec2<f32>,
    }
    @vertex
    fn vs_main(@builtin(vertex_index) vi: u32) -> VertexOutput {
        let x = f32(vi & 1u) * 4.0 - 1.0;
        let y = f32((vi >> 1u) & 1u) * 4.0 - 1.0;
        return VertexOutput(vec4<f32>(x, y, 0.0, 1.0), vec2<f32>((x + 1.0) * 0.5, (1.0 - y) * 0.5));
    }
`;

const brightPassFS = `
    @group(0) @binding(0) var mySampler: sampler;
    @group(0) @binding(1) var sceneTex: texture_2d<f32>;

    fn luma(c: vec3<f32>) -> f32 {
        return dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
    }

    @fragment
    fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
        let color = textureSampleLevel(sceneTex, mySampler, uv, 0.0).rgb;
        let l = max(luma(color), 0.0001);
        let threshold = 0.65;
        let knee = 0.1;
        let intensity = 0.5;
        let rq = clamp(l - threshold + knee, 0.0, 2.0 * knee);
        let rq_sq = (rq * rq) / (4.0 * max(knee, 0.0001));
        let contribution = max(rq_sq, l - threshold) / l;
        return vec4<f32>(color * contribution * intensity, 1.0);
    }
`;

const blurHFS = `
    @group(0) @binding(0) var mySampler: sampler;
    @group(0) @binding(1) var inputTex: texture_2d<f32>;

    @fragment
    fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
        let size = textureDimensions(inputTex);
        let texelSize = vec2<f32>(1.0 / f32(size.x), 1.0 / f32(size.y));
        var result = vec3<f32>(0.0);
        result += textureSampleLevel(inputTex, mySampler, uv + vec2<f32>(-4.0, 0.0) * texelSize, 0.0).rgb * 0.0162;
        result += textureSampleLevel(inputTex, mySampler, uv + vec2<f32>(-3.0, 0.0) * texelSize, 0.0).rgb * 0.0540;
        result += textureSampleLevel(inputTex, mySampler, uv + vec2<f32>(-2.0, 0.0) * texelSize, 0.0).rgb * 0.1216;
        result += textureSampleLevel(inputTex, mySampler, uv + vec2<f32>(-1.0, 0.0) * texelSize, 0.0).rgb * 0.1945;
        result += textureSampleLevel(inputTex, mySampler, uv                                     , 0.0).rgb * 0.2270;
        result += textureSampleLevel(inputTex, mySampler, uv + vec2<f32>( 1.0, 0.0) * texelSize, 0.0).rgb * 0.1945;
        result += textureSampleLevel(inputTex, mySampler, uv + vec2<f32>( 2.0, 0.0) * texelSize, 0.0).rgb * 0.1216;
        result += textureSampleLevel(inputTex, mySampler, uv + vec2<f32>( 3.0, 0.0) * texelSize, 0.0).rgb * 0.0540;
        result += textureSampleLevel(inputTex, mySampler, uv + vec2<f32>( 4.0, 0.0) * texelSize, 0.0).rgb * 0.0162;
        return vec4<f32>(result, 1.0);
    }
`;

const blurVFS = `
    @group(0) @binding(0) var mySampler: sampler;
    @group(0) @binding(1) var inputTex: texture_2d<f32>;

    @fragment
    fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
        let size = textureDimensions(inputTex);
        let texelSize = vec2<f32>(1.0 / f32(size.x), 1.0 / f32(size.y));
        var result = vec3<f32>(0.0);
        result += textureSampleLevel(inputTex, mySampler, uv + vec2<f32>(0.0, -4.0) * texelSize, 0.0).rgb * 0.0162;
        result += textureSampleLevel(inputTex, mySampler, uv + vec2<f32>(0.0, -3.0) * texelSize, 0.0).rgb * 0.0540;
        result += textureSampleLevel(inputTex, mySampler, uv + vec2<f32>(0.0, -2.0) * texelSize, 0.0).rgb * 0.1216;
        result += textureSampleLevel(inputTex, mySampler, uv + vec2<f32>(0.0, -1.0) * texelSize, 0.0).rgb * 0.1945;
        result += textureSampleLevel(inputTex, mySampler, uv                                     , 0.0).rgb * 0.2270;
        result += textureSampleLevel(inputTex, mySampler, uv + vec2<f32>(0.0,  1.0) * texelSize, 0.0).rgb * 0.1945;
        result += textureSampleLevel(inputTex, mySampler, uv + vec2<f32>(0.0,  2.0) * texelSize, 0.0).rgb * 0.1216;
        result += textureSampleLevel(inputTex, mySampler, uv + vec2<f32>(0.0,  3.0) * texelSize, 0.0).rgb * 0.0540;
        result += textureSampleLevel(inputTex, mySampler, uv + vec2<f32>(0.0,  4.0) * texelSize, 0.0).rgb * 0.0162;
        return vec4<f32>(result, 1.0);
    }
`;

const compositeFS = `
    @group(0) @binding(0) var mySampler: sampler;
    @group(0) @binding(1) var sceneTex: texture_2d<f32>;
    @group(0) @binding(2) var bloomTex: texture_2d<f32>;

    fn aces_approx(v: vec3<f32>) -> vec3<f32> {
        let a = 2.51;
        let b = 0.03;
        let c = 2.43;
        let d = 0.59;
        let e = 0.14;
        return clamp((v * (a * v + b)) / (v * (c * v + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
    }

    @fragment
    fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
        let sceneColor = textureSampleLevel(sceneTex, mySampler, uv, 0.0);
        let bloomColor = textureSampleLevel(bloomTex, mySampler, uv, 0.0).rgb;
        let combined = sceneColor.rgb + bloomColor;
        let toneMapped = aces_approx(combined);
        let srgbColor = pow(max(toneMapped, vec3<f32>(0.0)), vec3<f32>(1.0 / 2.2));
        return vec4<f32>(srgbColor, sceneColor.a);
    }
`;

// --- 3. PARSER GLB LEVE EM JAVASCRIPT/TYPESCRIPT COM SUPORTE COMPLETO A TEXTURAS E PARÂMETROS PBR ---
interface ModelPart {
    vertices: Float32Array;
    indices: Uint16Array | Uint32Array;
    indexCount: number;
    indexFormat: GPUIndexFormat;
}

interface GLTFModel {
    parts: ModelPart[];
    albedoImageBitmap: ImageBitmap | null;
    ormImageBitmap: ImageBitmap | null;
    normalImageBitmap: ImageBitmap | null;
    emissiveImageBitmap: ImageBitmap | null;

    // PBR Properties parsed directly from GLTF JSON
    albedoColor: number[];
    roughness: number;
    metallic: number;
    normalScale: number;
    emissiveColor: number[];
    emissiveStrength: number;
}

async function loadGLB(url: string): Promise<GLTFModel> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const dataView = new DataView(arrayBuffer);
    const magic = dataView.getUint32(0, true);
    if (magic !== 0x46546c67) throw new Error("GLB Magic Inválido");

    const jsonChunkLength = dataView.getUint32(12, true);
    const jsonBytes = new Uint8Array(arrayBuffer, 20, jsonChunkLength);
    const jsonStr = new TextDecoder().decode(jsonBytes);

    const jsonChunkPaddedLength = Math.ceil(jsonChunkLength / 4) * 4;
    const binOffset = 20 + jsonChunkPaddedLength;
    let binBuffer: ArrayBuffer = new ArrayBuffer(0);
    if (arrayBuffer.byteLength > binOffset + 8) {
        const binChunkLength = dataView.getUint32(binOffset, true);
        binBuffer = arrayBuffer.slice(binOffset + 8, binOffset + 8 + binChunkLength);
    }

    const gltf = JSON.parse(jsonStr);
    const parts: ModelPart[] = [];

    const getAccessorData = (accessorIdx: number) => {
        const accessor = gltf.accessors[accessorIdx];
        const bufferView = gltf.bufferViews[accessor.bufferView];
        const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
        const stride = bufferView.byteStride || 0;

        let numComponents = 1;
        if (accessor.type === "VEC2") numComponents = 2;
        else if (accessor.type === "VEC3") numComponents = 3;
        else if (accessor.type === "VEC4") numComponents = 4;

        const dv = new DataView(binBuffer);
        const count = accessor.count;
        const output = new Float32Array(count * numComponents);

        let elementSize = 4; // float32
        if (accessor.componentType === 5123) elementSize = 2; // uint16

        const effectiveStride = stride > 0 ? stride : numComponents * elementSize;

        for (let i = 0; i < count; i++) {
            for (let c = 0; c < numComponents; c++) {
                const offset = byteOffset + i * effectiveStride + c * elementSize;
                if (accessor.componentType === 5126) {
                    output[i * numComponents + c] = dv.getFloat32(offset, true);
                } else if (accessor.componentType === 5123) {
                    output[i * numComponents + c] = dv.getUint16(offset, true);
                } else if (accessor.componentType === 5125) {
                    output[i * numComponents + c] = dv.getUint32(offset, true);
                }
            }
        }
        return { array: output, count };
    };

    const getImageBitmap = async (texRef: any): Promise<ImageBitmap | null> => {
        if (texRef === undefined || texRef === null) return null;
        const texture = gltf.textures?.[texRef.index];
        if (!texture) return null;
        const image = gltf.images?.[texture.source];
        if (!image) return null;

        if (image.bufferView !== undefined) {
            const bv = gltf.bufferViews[image.bufferView];
            const byteOffset = bv.byteOffset || 0;
            const byteLength = bv.byteLength;
            const slice = binBuffer.slice(byteOffset, byteOffset + byteLength);
            const blob = new Blob([slice], {
                type: image.mimeType || "image/png",
            });
            return await createImageBitmap(blob);
        }
        return null;
    };

    // Parâmetros PBR default
    let albedoImageBitmap: ImageBitmap | null = null;
    let ormImageBitmap: ImageBitmap | null = null;
    let normalImageBitmap: ImageBitmap | null = null;
    let emissiveImageBitmap: ImageBitmap | null = null;

    let albedoColor = [1.0, 1.0, 1.0, 1.0];
    let roughness = 1.0;
    let metallic = 1.0;
    let normalScale = 1.0;
    let emissiveColor = [0.0, 0.0, 0.0];
    let emissiveStrength = 1.0;

    // Extrai propriedades e texturas do material GLB
    if (gltf.materials && gltf.materials.length > 0) {
        const mat = gltf.materials[0]; // stylized_fantasy_key só tem um material
        if (mat.pbrMetallicRoughness) {
            const pbr = mat.pbrMetallicRoughness;
            if (pbr.baseColorTexture) {
                albedoImageBitmap = await getImageBitmap(pbr.baseColorTexture);
            }
            if (pbr.baseColorFactor) {
                albedoColor = pbr.baseColorFactor;
            }
            if (pbr.metallicRoughnessTexture) {
                ormImageBitmap = await getImageBitmap(pbr.metallicRoughnessTexture);
            }
            roughness = pbr.roughnessFactor ?? 1.0;
            metallic = pbr.metallicFactor ?? 1.0;
        }

        if (mat.normalTexture) {
            normalImageBitmap = await getImageBitmap(mat.normalTexture);
            normalScale = mat.normalTexture.scale ?? 1.0;
        }

        if (mat.emissiveTexture) {
            emissiveImageBitmap = await getImageBitmap(mat.emissiveTexture);
        }
        if (mat.emissiveFactor) {
            emissiveColor = mat.emissiveFactor;
        }
        emissiveStrength = mat.extensions?.KHR_materials_emissive_strength?.emissiveStrength ?? 1.0;
    }

    for (const mesh of gltf.meshes || []) {
        for (const prim of mesh.primitives) {
            if (prim.attributes.POSITION === undefined) continue;

            const posData = getAccessorData(prim.attributes.POSITION);
            const normData = prim.attributes.NORMAL !== undefined ? getAccessorData(prim.attributes.NORMAL) : null;
            const uvData = prim.attributes.TEXCOORD_0 !== undefined ? getAccessorData(prim.attributes.TEXCOORD_0) : null;

            const partVertices: number[] = [];
            for (let i = 0; i < posData.count; i++) {
                // Pos
                partVertices.push(posData.array[i * 3], posData.array[i * 3 + 1], posData.array[i * 3 + 2]);
                // Norm
                if (normData) {
                    partVertices.push(normData.array[i * 3], normData.array[i * 3 + 1], normData.array[i * 3 + 2]);
                } else {
                    partVertices.push(0, 1, 0);
                }
                // UV
                if (uvData) {
                    partVertices.push(uvData.array[i * 2], uvData.array[i * 2 + 1]);
                } else {
                    partVertices.push(0, 0);
                }
            }

            const partIndices: number[] = [];
            if (prim.indices !== undefined) {
                const indData = getAccessorData(prim.indices);
                for (let i = 0; i < indData.count; i++) {
                    partIndices.push(indData.array[i]);
                }
            } else {
                for (let i = 0; i < posData.count; i++) {
                    partIndices.push(i);
                }
            }

            parts.push({
                vertices: new Float32Array(partVertices),
                indices: posData.count > 65535 ? new Uint32Array(partIndices) : new Uint16Array(partIndices),
                indexCount: partIndices.length,
                indexFormat: posData.count > 65535 ? "uint32" : "uint16"
            });
        }
    }
    return {
        parts,
        albedoImageBitmap,
        ormImageBitmap,
        normalImageBitmap,
        emissiveImageBitmap,
        albedoColor,
        roughness,
        metallic,
        normalScale,
        emissiveColor,
        emissiveStrength
    };
}

// --- 4. EXECUÇÃO DO PIPELINE DE RENDERIZAÇÃO WEBGPU ---
interface GLBGPUInstance {
    vertexBuffer: GPUBuffer;
    indexBuffer: GPUBuffer;
    indexCount: number;
    indexFormat: GPUIndexFormat;
}

async function run() {
    const canvas = document.getElementById("canvas") as HTMLCanvasElement;
    
    // Configura canvas inicial com device pixel ratio para nitidez e proporção correctas
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;

    const adapter = await navigator.gpu?.requestAdapter();
    const device = await adapter?.requestDevice();

    if (!device) {
        console.error("WebGPU não suportada neste browser!");
        return;
    }

    const context = canvas.getContext("webgpu");
    const format = navigator.gpu.getPreferredCanvasFormat();
    context?.configure({ device, format, alphaMode: "premultiplied" });

    // --- CARREGAMENTO DO MODELO GLB DA CHAVE E CRIAÇÃO DOS BUFFERS ---
    const gltfModel = await loadGLB("../nano-wgpu/stylized_fantasy_key.glb");
    const keyParts: GLBGPUInstance[] = gltfModel.parts.map(part => {
        const vBuffer = device.createBuffer({
            size: part.vertices.byteLength,
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true
        });
        new Float32Array(vBuffer.getMappedRange()).set(part.vertices);
        vBuffer.unmap();

        const iBuffer = device.createBuffer({
            size: part.indices.byteLength,
            usage: GPUBufferUsage.INDEX,
            mappedAtCreation: true
        });
        if (part.indexFormat === "uint32") {
            new Uint32Array(iBuffer.getMappedRange()).set(part.indices as Uint32Array);
        } else {
            new Uint16Array(iBuffer.getMappedRange()).set(part.indices as Uint16Array);
        }
        iBuffer.unmap();

        return {
            vertexBuffer: vBuffer,
            indexBuffer: iBuffer,
            indexCount: part.indexCount,
            indexFormat: part.indexFormat
        };
    });

    // --- CRIAÇÃO DA GEOMETRIA DO PLANO DE CHÃO ---
    const planeVertices = new Float32Array([
        // pos (x,y,z), normal (x,y,z), uv (u,v)
        -1, 0, -1,  0, 1, 0,  0, 0,
         1, 0, -1,  0, 1, 0,  1, 0,
         1, 0,  1,  0, 1, 0,  1, 1,
        -1, 0,  1,  0, 1, 0,  0, 1
    ]);
    const planeIndices = new Uint16Array([
        0, 2, 1,
        0, 3, 2
    ]);

    const planeVBuffer = device.createBuffer({
        size: planeVertices.byteLength,
        usage: GPUBufferUsage.VERTEX,
        mappedAtCreation: true
    });
    new Float32Array(planeVBuffer.getMappedRange()).set(planeVertices);
    planeVBuffer.unmap();

    const planeIBuffer = device.createBuffer({
        size: planeIndices.byteLength,
        usage: GPUBufferUsage.INDEX,
        mappedAtCreation: true
    });
    new Uint16Array(planeIBuffer.getMappedRange()).set(planeIndices);
    planeIBuffer.unmap();

    // --- TEXTURAS PADRÃO E SAMPLERS ---
    // Textura branca 1x1
    const defaultTexture = device.createTexture({
        size: [1, 1, 1],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });
    device.queue.writeTexture(
        { texture: defaultTexture },
        new Uint8Array([255, 255, 255, 255]),
        { bytesPerRow: 4 },
        [1, 1, 1]
    );

    // Textura normal padrão 1x1 [128, 128, 255, 255]
    const defaultNormalTexture = device.createTexture({
        size: [1, 1, 1],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });
    device.queue.writeTexture(
        { texture: defaultNormalTexture },
        new Uint8Array([128, 128, 255, 255]),
        { bytesPerRow: 4 },
        [1, 1, 1]
    );

    // Textura preta padrão 1x1 [0, 0, 0, 255]
    const defaultBlackTexture = device.createTexture({
        size: [1, 1, 1],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });
    device.queue.writeTexture(
        { texture: defaultBlackTexture },
        new Uint8Array([0, 0, 0, 255]),
        { bytesPerRow: 4 },
        [1, 1, 1]
    );

    // Carrega texturas extraídas do GLB
    let albedoTexture = defaultTexture;
    if (gltfModel.albedoImageBitmap) {
        const imgBitmap = gltfModel.albedoImageBitmap;
        albedoTexture = device.createTexture({
            label: "GLB Albedo Texture",
            size: [imgBitmap.width, imgBitmap.height, 1],
            format: "rgba8unorm-srgb", // Correção de Espaço de Cores (sRGB -> Linear automático na amostragem)
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
        });
        device.queue.copyExternalImageToTexture(
            { source: imgBitmap },
            { texture: albedoTexture },
            [imgBitmap.width, imgBitmap.height]
        );
    }

    let normalTexture = defaultNormalTexture;
    if (gltfModel.normalImageBitmap) {
        const imgBitmap = gltfModel.normalImageBitmap;
        normalTexture = device.createTexture({
            label: "GLB Normal Texture",
            size: [imgBitmap.width, imgBitmap.height, 1],
            format: "rgba8unorm", // Mapas de Normal usam espaço Linear
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
        });
        device.queue.copyExternalImageToTexture(
            { source: imgBitmap },
            { texture: normalTexture },
            [imgBitmap.width, imgBitmap.height]
        );
    }

    let ormTexture = defaultTexture;
    if (gltfModel.ormImageBitmap) {
        const imgBitmap = gltfModel.ormImageBitmap;
        ormTexture = device.createTexture({
            label: "GLB ORM Texture",
            size: [imgBitmap.width, imgBitmap.height, 1],
            format: "rgba8unorm", // Mapas ORM (PBR) usam espaço Linear
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
        });
        device.queue.copyExternalImageToTexture(
            { source: imgBitmap },
            { texture: ormTexture },
            [imgBitmap.width, imgBitmap.height]
        );
    }

    let emissiveTexture = defaultBlackTexture;
    if (gltfModel.emissiveImageBitmap) {
        const imgBitmap = gltfModel.emissiveImageBitmap;
        emissiveTexture = device.createTexture({
            label: "GLB Emissive Texture",
            size: [imgBitmap.width, imgBitmap.height, 1],
            format: "rgba8unorm-srgb", // Correção de Espaço de Cores (sRGB -> Linear automático na amostragem)
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
        });
        device.queue.copyExternalImageToTexture(
            { source: imgBitmap },
            { texture: emissiveTexture },
            [imgBitmap.width, imgBitmap.height]
        );
    }

    const textureSampler = device.createSampler({
        magFilter: "linear",
        minFilter: "linear",
        mipmapFilter: "linear",
        addressModeU: "repeat",
        addressModeV: "repeat"
    });

    // --- CONFIGURAÇÃO DE SOMBRAS (SHADOW DEPTH MAP) ---
    const shadowMapSize = 2048;
    const shadowDepthTexture = device.createTexture({
        label: "Shadow Depth Map Texture",
        size: [shadowMapSize, shadowMapSize, 1],
        format: "depth32float",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
    });
    const shadowDepthTextureView = shadowDepthTexture.createView();

    const shadowSampler = device.createSampler({
        label: "Shadow Comparison Sampler",
        compare: "less",
        magFilter: "linear",
        minFilter: "linear"
    });

    // --- CRIAÇÃO DOS UNIFORMS BUFFERS ---
    const cameraBuffer = device.createBuffer({
        size: 16 * 4 + 4 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    const lightsBuffer = device.createBuffer({
        size: 16 + 80 * 1,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    const shadowCameraBuffer = device.createBuffer({
        size: 64 + 16, // viewProj + params (texelSize, bias)
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    const modelBuffer = device.createBuffer({
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    const planeModelBuffer = device.createBuffer({
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // Buffers de materiais individuais para chave e plano (80 bytes = 20 floats)
    const keyMaterialBuffer = device.createBuffer({
        size: 80,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    const planeMaterialBuffer = device.createBuffer({
        size: 80,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    const highlightBuffer = device.createBuffer({
        size: 32,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // --- BIND GROUP LAYOUTS ---
    const globalLayout = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
            { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } },
            { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "depth", viewDimension: "2d" } },
            { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "comparison" } },
            { binding: 4, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } }
        ]
    });

    const modelLayout = device.createBindGroupLayout({
        entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" } }]
    });

    // Novo Material Layout com 6 slots para mapeamentos PBR completo
    const materialLayout = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
            { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
            { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: {} }, // albedo
            { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: {} }, // normal
            { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: {} }, // ORM
            { binding: 5, visibility: GPUShaderStage.FRAGMENT, texture: {} }  // emissive
        ]
    });

    const highlightLayout = device.createBindGroupLayout({
        entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } }]
    });

    // --- BIND GROUPS ---
    const globalBindGroup = device.createBindGroup({
        layout: globalLayout,
        entries: [
            { binding: 0, resource: { buffer: cameraBuffer } },
            { binding: 1, resource: { buffer: lightsBuffer } },
            { binding: 2, resource: shadowDepthTextureView },
            { binding: 3, resource: shadowSampler },
            { binding: 4, resource: { buffer: shadowCameraBuffer } }
        ]
    });

    const modelBindGroup = device.createBindGroup({
        layout: modelLayout,
        entries: [{ binding: 0, resource: { buffer: modelBuffer } }]
    });

    const planeModelBindGroup = device.createBindGroup({
        layout: modelLayout,
        entries: [{ binding: 0, resource: { buffer: planeModelBuffer } }]
    });

    // Bindings de PBR para a chave
    const keyMaterialBindGroup = device.createBindGroup({
        layout: materialLayout,
        entries: [
            { binding: 0, resource: { buffer: keyMaterialBuffer } },
            { binding: 1, resource: textureSampler },
            { binding: 2, resource: albedoTexture.createView() },
            { binding: 3, resource: normalTexture.createView() },
            { binding: 4, resource: ormTexture.createView() },
            { binding: 5, resource: emissiveTexture.createView() }
        ]
    });

    // Bindings de PBR para o plano
    const planeMaterialBindGroup = device.createBindGroup({
        layout: materialLayout,
        entries: [
            { binding: 0, resource: { buffer: planeMaterialBuffer } },
            { binding: 1, resource: textureSampler },
            { binding: 2, resource: defaultTexture.createView() },
            { binding: 3, resource: defaultNormalTexture.createView() },
            { binding: 4, resource: defaultTexture.createView() },
            { binding: 5, resource: defaultBlackTexture.createView() }
        ]
    });

    const highlightBindGroup = device.createBindGroup({
        layout: highlightLayout,
        entries: [{ binding: 0, resource: { buffer: highlightBuffer } }]
    });

    // --- PIPELINES DE RENDERIZAÇÃO ---
    const baseShaderModule = device.createShaderModule({ code: baseShaderWGSL });
    const highlightShaderModule = device.createShaderModule({ code: highlightShaderWGSL });

    const basePipeline = device.createRenderPipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [globalLayout, modelLayout, materialLayout] }),
        vertex: {
            module: baseShaderModule,
            entryPoint: "vs_main",
            buffers: [{
                arrayStride: 32,
                attributes: [
                    { shaderLocation: 0, offset: 0, format: "float32x3" },
                    { shaderLocation: 1, offset: 12, format: "float32x3" },
                    { shaderLocation: 2, offset: 24, format: "float32x2" }
                ]
            }]
        },
        fragment: {
            module: baseShaderModule,
            entryPoint: "fs_main",
            targets: [{ format: "rgba16float" }]
        },
        primitive: { topology: "triangle-list", cullMode: "back" },
        depthStencil: { depthWriteEnabled: true, depthCompare: "less", format: "depth24plus" }
    });

    const highlightPipeline = device.createRenderPipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [globalLayout, modelLayout, materialLayout, highlightLayout] }),
        vertex: {
            module: highlightShaderModule,
            entryPoint: "vs_main",
            buffers: [{
                arrayStride: 32,
                attributes: [
                    { shaderLocation: 0, offset: 0, format: "float32x3" },
                    { shaderLocation: 1, offset: 12, format: "float32x3" },
                    { shaderLocation: 2, offset: 24, format: "float32x2" }
                ]
            }]
        },
        fragment: {
            module: highlightShaderModule,
            entryPoint: "fs_main",
            targets: [{
                format: "rgba16float",
                blend: {
                    color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
                    alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" }
                }
            }]
        },
        primitive: { topology: "triangle-list", cullMode: "none" },
        depthStencil: { depthWriteEnabled: false, depthCompare: "less-equal", format: "depth24plus" }
    });

    // --- PIPELINE DE SOMBRAS (SHADOW MAP RENDER PIPELINE) ---
    const shadowShaderWGSL = `
        struct ShadowCameraUniform {
            viewProj: mat4x4<f32>,
        }
        @group(0) @binding(0) var<uniform> shadowCamera: ShadowCameraUniform;

        struct ModelUniforms {
            modelMatrix: mat4x4<f32>,
        }
        @group(1) @binding(0) var<uniform> model: ModelUniforms;

        @vertex
        fn vs_main(@location(0) position: vec3<f32>) -> @builtin(position) vec4<f32> {
            return shadowCamera.viewProj * model.modelMatrix * vec4<f32>(position, 1.0);
        }
    `;

    const shadowShaderModule = device.createShaderModule({ code: shadowShaderWGSL });
    const shadowPipeline = device.createRenderPipeline({
        layout: device.createPipelineLayout({
            bindGroupLayouts: [
                device.createBindGroupLayout({
                    entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" } }]
                }),
                modelLayout
            ]
        }),
        vertex: {
            module: shadowShaderModule,
            entryPoint: "vs_main",
            buffers: [{
                arrayStride: 32,
                attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }]
            }]
        },
        primitive: {
            topology: "triangle-list",
            cullMode: "front" // Evita shadow acne
        },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: "less",
            format: "depth32float"
        }
    });

    const shadowCameraViewProjBuffer = device.createBuffer({
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    const shadowGlobalBindGroup = device.createBindGroup({
        layout: shadowPipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: shadowCameraViewProjBuffer } }]
    });

    // depth buffer inicial
    let depthTexture = device.createTexture({
        size: [canvas.width, canvas.height, 1],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
    let depthTextureView = depthTexture.createView();

    // --- TEXTURAS E RECURSOS DE PÓS-PROCESSAMENTO E BLOOM NATIVOS ---
    let sceneTexture = device.createTexture({
        size: [canvas.width, canvas.height, 1],
        format: "rgba16float",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
    });
    let sceneTextureView = sceneTexture.createView();

    let bloomWidth = Math.max(1, Math.floor(canvas.width / 4));
    let bloomHeight = Math.max(1, Math.floor(canvas.height / 4));

    let bloomTexA = device.createTexture({
        size: [bloomWidth, bloomHeight, 1],
        format: "rgba16float",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
    });
    let bloomTexAView = bloomTexA.createView();

    let bloomTexB = device.createTexture({
        size: [bloomWidth, bloomHeight, 1],
        format: "rgba16float",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
    });
    let bloomTexBView = bloomTexB.createView();

    const postProcessSampler = device.createSampler({
        minFilter: "linear",
        magFilter: "linear"
    });

    const post2Layout = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
            { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } }
        ]
    });

    const compositeLayout = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
            { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
            { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } }
        ]
    });

    const postProcessVSModule = device.createShaderModule({ code: postProcessVS });
    const brightPassFSModule = device.createShaderModule({ code: brightPassFS });
    const blurHFSModule = device.createShaderModule({ code: blurHFS });
    const blurVFSModule = device.createShaderModule({ code: blurVFS });
    const compositeFSModule = device.createShaderModule({ code: compositeFS });

    const brightPipeline = device.createRenderPipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [post2Layout] }),
        vertex: { module: postProcessVSModule, entryPoint: "vs_main" },
        fragment: { module: brightPassFSModule, entryPoint: "fs_main", targets: [{ format: "rgba16float" }] },
        primitive: { topology: "triangle-list" }
    });

    const blurHPipeline = device.createRenderPipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [post2Layout] }),
        vertex: { module: postProcessVSModule, entryPoint: "vs_main" },
        fragment: { module: blurHFSModule, entryPoint: "fs_main", targets: [{ format: "rgba16float" }] },
        primitive: { topology: "triangle-list" }
    });

    const blurVPipeline = device.createRenderPipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [post2Layout] }),
        vertex: { module: postProcessVSModule, entryPoint: "vs_main" },
        fragment: { module: blurVFSModule, entryPoint: "fs_main", targets: [{ format: "rgba16float" }] },
        primitive: { topology: "triangle-list" }
    });

    const compositePipeline = device.createRenderPipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [compositeLayout] }),
        vertex: { module: postProcessVSModule, entryPoint: "vs_main" },
        fragment: { module: compositeFSModule, entryPoint: "fs_main", targets: [{ format }] },
        primitive: { topology: "triangle-list" }
    });

    let brightBindGroup = device.createBindGroup({
        layout: post2Layout,
        entries: [
            { binding: 0, resource: postProcessSampler },
            { binding: 1, resource: sceneTextureView }
        ]
    });

    let blurHBindGroupA = device.createBindGroup({
        layout: post2Layout,
        entries: [
            { binding: 0, resource: postProcessSampler },
            { binding: 1, resource: bloomTexAView }
        ]
    });

    let blurVBindGroupB = device.createBindGroup({
        layout: post2Layout,
        entries: [
            { binding: 0, resource: postProcessSampler },
            { binding: 1, resource: bloomTexBView }
        ]
    });

    let compositeBindGroup = device.createBindGroup({
        layout: compositeLayout,
        entries: [
            { binding: 0, resource: postProcessSampler },
            { binding: 1, resource: sceneTextureView },
            { binding: 2, resource: bloomTexAView }
        ]
    });

    // --- ESCREVE BUFFERS DE MATERIAIS ---
    // Buffer da Chave com propriedades PBR extraídas do GLB
    const keyMaterialData = new Float32Array(20);
    keyMaterialData.set(gltfModel.albedoColor, 0); // 0, 1, 2, 3 (color factor)
    keyMaterialData[4] = gltfModel.roughness;      // 4
    keyMaterialData[5] = gltfModel.metallic;       // 5
    keyMaterialData[6] = gltfModel.normalScale;     // 6
    keyMaterialData[7] = 1.0;                      // 7 (aoIntensity)
    keyMaterialData[8] = gltfModel.normalImageBitmap ? 1.0 : 0.0;  // 8 (useNormalMap)
    keyMaterialData[9] = 0.0;                      // 9 (useRoughnessMap - roughness na ORM)
    keyMaterialData[10] = 0.0;                     // 10 (useMetallicMap - metallic na ORM)
    keyMaterialData[11] = 0.0;                     // 11 (useAOMap - AO na ORM)
    keyMaterialData[12] = gltfModel.ormImageBitmap ? 1.0 : 0.0;   // 12 (useORMMap)
    keyMaterialData[13] = 2.0;                     // 13 (cullMode: 2.0 = none)
    keyMaterialData[14] = gltfModel.emissiveStrength; // 14 (emissiveStrength)
    keyMaterialData[15] = 0.0;                     // 15
    keyMaterialData.set(gltfModel.emissiveColor, 16); // 16, 17, 18 (emissive factor)
    keyMaterialData[19] = gltfModel.emissiveImageBitmap ? 1.0 : 0.0; // 19 (useEmissiveMap)
    device.queue.writeBuffer(keyMaterialBuffer, 0, keyMaterialData);

    // Buffer do Plano (Material Branco Fosco Padrão)
    const planeMaterialData = new Float32Array(20);
    planeMaterialData.set([1.0, 1.0, 1.0, 1.0], 0); // albedo factor
    planeMaterialData[4] = 1.0; // roughness
    planeMaterialData[5] = 0.0; // metallic
    planeMaterialData[6] = 1.0; // normalScale
    planeMaterialData[7] = 1.0; // aoIntensity
    planeMaterialData[8] = 0.0; // useNormalMap
    planeMaterialData[9] = 0.0;
    planeMaterialData[10] = 0.0;
    planeMaterialData[11] = 0.0;
    planeMaterialData[12] = 0.0; // useORMMap
    planeMaterialData[13] = 0.0; // cullMode: back
    planeMaterialData[14] = 1.0;
    planeMaterialData[15] = 0.0;
    planeMaterialData.set([0.0, 0.0, 0.0], 16); // emissive black
    planeMaterialData[19] = 0.0; // useEmissiveMap
    device.queue.writeBuffer(planeMaterialBuffer, 0, planeMaterialData);

    // --- CONFIGURA BUFFER DE LUZ ---
    const lightsData = new Uint32Array(4 + 20 * 1);
    lightsData[0] = 1; // 1 Light
    const lightsFloats = new Float32Array(lightsData.buffer);
    lightsFloats[4] = 0.0; lightsFloats[5] = 10.0; lightsFloats[6] = 0.0; lightsFloats[7] = 1.0; // position, typeFlag = 1.0 (directional + shadow casting)
    lightsFloats[8] = 1.0; lightsFloats[9] = 1.0; lightsFloats[10] = 1.0; lightsFloats[11] = 0.5; // color, intensity = 0.5
    const dir = [-0.5, -0.70710678, -0.5]; // Alinhado com rotação [-45, 45, 0] da biblioteca!
    lightsFloats[12] = dir[0]; lightsFloats[13] = dir[1]; lightsFloats[14] = dir[2]; lightsFloats[15] = 100.0; // dir, range
    device.queue.writeBuffer(lightsBuffer, 0, lightsData);

    // Escreve matriz do modelo do plano (chão)
    const planeModelMatrix = createMat4();
    mat4Identity(planeModelMatrix);
    mat4Translate(planeModelMatrix, planeModelMatrix, [0, -1.5, 0]);
    mat4Scale(planeModelMatrix, planeModelMatrix, [10, 10, 10]);
    device.queue.writeBuffer(planeModelBuffer, 0, planeModelMatrix as Float32Array);

    // Câmera e visualizações
    const cameraProj = createMat4();
    const cameraView = createMat4();
    const cameraViewProj = createMat4();

    mat4Perspective(cameraProj, (45 * Math.PI) / 180, canvas.width / canvas.height, 0.1, 100);
    mat4LookAt(cameraView, [0, 2, 5], [0, 0, 0], [0, 1, 0]);
    mat4Multiply(cameraViewProj, cameraProj, cameraView);

    const cameraData = new Float32Array(20);
    cameraData.set(cameraViewProj, 0);
    cameraData[16] = 0; cameraData[17] = 2; cameraData[18] = 5; cameraData[19] = 1;
    device.queue.writeBuffer(cameraBuffer, 0, cameraData);

    // --- CALCULA MATRIZ DE VISUALIZAÇÃO/PROJEÇÃO DA LUZ PARA SOMBRAS ---
    const shadowRadius = 10.0;
    const shadowDepthRange = 200.0;
    const shadowEye = [
        -dir[0] * shadowDepthRange * 0.5,
        -dir[1] * shadowDepthRange * 0.5,
        -dir[2] * shadowDepthRange * 0.5
    ]; // Olhando a partir de [50, 70.71, 50] para o centro [0, 0, 0]

    const lightViewMatrix = createMat4();
    mat4LookAt(lightViewMatrix, shadowEye, [0, 0, 0], [0, 1, 0]);

    const lightProjMatrix = createMat4();
    orthoWebGPU(lightProjMatrix, -shadowRadius, shadowRadius, -shadowRadius, shadowRadius, -0.1, -shadowDepthRange);

    const lightViewProjMatrix = createMat4();
    mat4Multiply(lightViewProjMatrix, lightProjMatrix, lightViewMatrix);

    // Escreve uniform da câmera de sombras
    const shadowCameraData = new Float32Array(20);
    shadowCameraData.set(lightViewProjMatrix, 0);
    shadowCameraData[16] = 1.0 / shadowMapSize; // texelSize
    shadowCameraData[17] = 0.0005;              // shadowBias
    shadowCameraData[18] = 0.0;
    shadowCameraData[19] = 0.0;
    device.queue.writeBuffer(shadowCameraBuffer, 0, shadowCameraData);
    device.queue.writeBuffer(shadowCameraViewProjBuffer, 0, lightViewProjMatrix as Float32Array);

    // Animação
    const originalY = -1.0;
    const modelMatrix = createMat4();
    let xRotation = 0;
    let lastTime = performance.now();

    function frame() {
        const now = performance.now();
        const dt = (now - lastTime) / 1000;
        const time = now / 1000;
        lastTime = now;

        // --- SISTEMA DE REDIMENSIONAMENTO ROBUSTO ---
        const w = window.innerWidth * dpr;
        const h = window.innerHeight * dpr;
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
            
            // Destrói e recria textura de profundidade para evitar travamento da WebGPU
            depthTexture.destroy();
            depthTexture = device.createTexture({
                size: [w, h, 1],
                format: "depth24plus",
                usage: GPUTextureUsage.RENDER_ATTACHMENT
            });
            depthTextureView = depthTexture.createView();

            // Destrói e recria texturas de pós-processamento e bloom
            sceneTexture.destroy();
            sceneTexture = device.createTexture({
                size: [w, h, 1],
                format: "rgba16float",
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
            });
            sceneTextureView = sceneTexture.createView();

            const bw = Math.max(1, Math.floor(w / 4));
            const bh = Math.max(1, Math.floor(h / 4));

            bloomTexA.destroy();
            bloomTexA = device.createTexture({
                size: [bw, bh, 1],
                format: "rgba16float",
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
            });
            bloomTexAView = bloomTexA.createView();

            bloomTexB.destroy();
            bloomTexB = device.createTexture({
                size: [bw, bh, 1],
                format: "rgba16float",
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
            });
            bloomTexBView = bloomTexB.createView();

            // Re-cria os bind groups com as novas texturas
            brightBindGroup = device.createBindGroup({
                layout: post2Layout,
                entries: [
                    { binding: 0, resource: postProcessSampler },
                    { binding: 1, resource: sceneTextureView }
                ]
            });

            blurHBindGroupA = device.createBindGroup({
                layout: post2Layout,
                entries: [
                    { binding: 0, resource: postProcessSampler },
                    { binding: 1, resource: bloomTexAView }
                ]
            });

            blurVBindGroupB = device.createBindGroup({
                layout: post2Layout,
                entries: [
                    { binding: 0, resource: postProcessSampler },
                    { binding: 1, resource: bloomTexBView }
                ]
            });

            compositeBindGroup = device.createBindGroup({
                layout: compositeLayout,
                entries: [
                    { binding: 0, resource: postProcessSampler },
                    { binding: 1, resource: sceneTextureView },
                    { binding: 2, resource: bloomTexAView }
                ]
            });

            // Atualiza Câmera
            mat4Perspective(cameraProj, (45 * Math.PI) / 180, w / h, 0.1, 100);
            mat4Multiply(cameraViewProj, cameraProj, cameraView);
            cameraData.set(cameraViewProj, 0);
            device.queue.writeBuffer(cameraBuffer, 0, cameraData);
        }

        // flutuação e rotação
        const currentY = originalY + Math.sin(time * 2.0) * 0.1;
        xRotation += 90 * dt * (Math.PI / 180);

        mat4Identity(modelMatrix);
        mat4Translate(modelMatrix, modelMatrix, [0, currentY, 0]);
        mat4Scale(modelMatrix, modelMatrix, [0.01, 0.01, 0.01]);
        mat4RotateZ(modelMatrix, modelMatrix, -90 * (Math.PI / 180));
        mat4RotateX(modelMatrix, modelMatrix, xRotation);
        device.queue.writeBuffer(modelBuffer, 0, modelMatrix as Float32Array);

        // Atualiza parâmetros do Shader de brilho
        const shineParams = new Float32Array(8);
        shineParams[0] = 1.0; shineParams[1] = 1.0; shineParams[2] = 1.0; shineParams[3] = 1.0; // color
        shineParams[4] = 1.5; // cycleInterval
        shineParams[5] = 1.5; // speed
        shineParams[6] = 8.0; // width
        shineParams[7] = time; // time
        device.queue.writeBuffer(highlightBuffer, 0, shineParams);

        // buffer de comandos
        const commandEncoder = device.createCommandEncoder();

        // --- 1. SHADOW PASS (RENDERIZA MAPA DE PROFUNDIDADE DE SOMBRA) ---
        const shadowPassDesc: GPURenderPassDescriptor = {
            colorAttachments: [],
            depthStencilAttachment: {
                view: shadowDepthTextureView,
                depthClearValue: 1.0,
                depthLoadOp: "clear",
                depthStoreOp: "store"
            }
        };

        const shadowPass = commandEncoder.beginRenderPass(shadowPassDesc);
        shadowPass.setPipeline(shadowPipeline);
        shadowPass.setBindGroup(0, shadowGlobalBindGroup);
        shadowPass.setBindGroup(1, modelBindGroup);
        for (const part of keyParts) {
            shadowPass.setVertexBuffer(0, part.vertexBuffer);
            shadowPass.setIndexBuffer(part.indexBuffer, part.indexFormat);
            shadowPass.drawIndexed(part.indexCount);
        }
        shadowPass.end();

        // --- 2. MAIN PASS (RENDERIZA A CENA DO CANVAS EM TEXTURA HDR DE CENA) ---
        const renderPassDesc: GPURenderPassDescriptor = {
            colorAttachments: [{
                view: sceneTextureView,
                clearValue: { r: 0.05, g: 0.05, b: 0.05, a: 1.0 },
                loadOp: "clear",
                storeOp: "store"
            }],
            depthStencilAttachment: {
                view: depthTextureView,
                depthClearValue: 1.0,
                depthLoadOp: "clear",
                depthStoreOp: "store"
            }
        };

        const pass = commandEncoder.beginRenderPass(renderPassDesc);
        
        // --- 2.1. RENDER DO PLANO DE CHÃO (COM TEXTURA DEFAULT WHITE) ---
        pass.setPipeline(basePipeline);
        pass.setBindGroup(0, globalBindGroup);
        pass.setBindGroup(1, planeModelBindGroup);
        pass.setBindGroup(2, planeMaterialBindGroup);
        pass.setVertexBuffer(0, planeVBuffer);
        pass.setIndexBuffer(planeIBuffer, "uint16");
        pass.drawIndexed(6);

        // --- 2.2. RENDER DA CHAVE GLB (BASE PASS COM TEXTURAS PBR EXTRAÍDAS) ---
        pass.setBindGroup(1, modelBindGroup);
        pass.setBindGroup(2, keyMaterialBindGroup);
        for (const part of keyParts) {
            pass.setVertexBuffer(0, part.vertexBuffer);
            pass.setIndexBuffer(part.indexBuffer, part.indexFormat);
            pass.drawIndexed(part.indexCount);
        }

        // --- 2.3. RENDER DA CHAVE GLB (HIGHLIGHT/SHINE OVERLAY PASS) ---
        pass.setPipeline(highlightPipeline);
        pass.setBindGroup(3, highlightBindGroup);
        for (const part of keyParts) {
            pass.setVertexBuffer(0, part.vertexBuffer);
            pass.setIndexBuffer(part.indexBuffer, part.indexFormat);
            pass.drawIndexed(part.indexCount);
        }

        pass.end();

        // --- 3. EXTRAÇÃO DE BRILHO (BRIGHT PASS) ---
        const brightPassDesc: GPURenderPassDescriptor = {
            colorAttachments: [{
                view: bloomTexAView,
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                loadOp: "clear",
                storeOp: "store"
            }]
        };
        const brightPass = commandEncoder.beginRenderPass(brightPassDesc);
        brightPass.setPipeline(brightPipeline);
        brightPass.setBindGroup(0, brightBindGroup);
        brightPass.draw(3);
        brightPass.end();

        // --- 4. FILTRO DE DESFOCAMENTO GAUSSIANO 1D SEPARÁVEL (3 ITERAÇÕES PING-PONG) ---
        for (let i = 0; i < 3; i++) {
            // Passe Horizontal: bloomTexA (input) -> bloomTexB (output)
            const blurHDesc: GPURenderPassDescriptor = {
                colorAttachments: [{
                    view: bloomTexBView,
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    loadOp: "clear",
                    storeOp: "store"
                }]
            };
            const blurHPass = commandEncoder.beginRenderPass(blurHDesc);
            blurHPass.setPipeline(blurHPipeline);
            blurHPass.setBindGroup(0, blurHBindGroupA);
            blurHPass.draw(3);
            blurHPass.end();

            // Passe Vertical: bloomTexB (input) -> bloomTexA (output)
            const blurVDesc: GPURenderPassDescriptor = {
                colorAttachments: [{
                    view: bloomTexAView,
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    loadOp: "clear",
                    storeOp: "store"
                }]
            };
            const blurVPass = commandEncoder.beginRenderPass(blurVDesc);
            blurVPass.setPipeline(blurVPipeline);
            blurVPass.setBindGroup(0, blurVBindGroupB);
            blurVPass.draw(3);
            blurVPass.end();
        }

        // --- 5. COMPOSIÇÃO FINAL + TONE MAPPING + SRGB (DESENHA NO TAMPÃO DO CANVAS) ---
        const compositeDesc: GPURenderPassDescriptor = {
            colorAttachments: [{
                view: context!.getCurrentTexture().createView(),
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                loadOp: "clear",
                storeOp: "store"
            }]
        };
        const compositePass = commandEncoder.beginRenderPass(compositeDesc);
        compositePass.setPipeline(compositePipeline);
        compositePass.setBindGroup(0, compositeBindGroup);
        compositePass.draw(3);
        compositePass.end();

        device.queue.submit([commandEncoder.finish()]);

        requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
}

run();
