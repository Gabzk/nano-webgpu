/**
 * Chunk: fragment shader entry point — PBR lighting loop.
 */
export const lightingChunk = /* wgsl */ `
@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Pre-compute screen-space derivatives outside any branch to satisfy
    // WGSL uniform control flow requirements for derivative builtins.
    let dp1  = dpdx(in.frag_pos);
    let dp2  = dpdy(in.frag_pos);
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
    var metallic  = material.metallic;
    var ao        = 1.0;

    if (material.useORMMap > 0.5) {
        let orm = textureSample(ormTex, mySampler, in.uv).rgb;
        ao        = orm.r;
        roughness *= orm.g;
        metallic  *= orm.b;
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

    ao = mix(1.0, ao, material.aoIntensity);

    let V = normalize(camera.viewProj[3].xyz - in.frag_pos);

    var finalColor = vec3<f32>(0.0);

    // Ambient contribution, attenuated by AO
    let ambient = vec3<f32>(0.1) * baseColor * ao;
    finalColor += ambient;

    let shininess    = exp2(10.0 * (1.0 - roughness) + 1.0);
    let specularColor = mix(vec3<f32>(0.04), baseColor, metallic);

    // Shadow is sampled unconditionally — WGSL requires textureSampleCompare to
    // be reachable by all fragment invocations (uniform control flow).
    let shadowLightDir = normalize(-scene.lights[0].position.xyz);
    let shadowBias     = max(0.005 * (1.0 - dot(N, shadowLightDir)), 0.0005);
    let shadowSample   = getShadow(in.shadow_pos, shadowBias, shadowCamera.texelSize);
    // Apply only when light[0] is a directional with castShadow (type == 1.0)
    let light0CastsShadow = scene.lights[0].position.w > 0.5 && scene.lights[0].position.w < 1.5;
    let shadowFactor = select(1.0, shadowSample, light0CastsShadow);

    for (var i: u32 = 0u; i < scene.count; i++) {
        let light     = scene.lights[i];
        let lightType = light.position.w;

        var L           = vec3<f32>(0.0);
        var attenuation = 1.0;

        // Directional: type 0 or 1 (< 1.5)
        if (lightType < 1.5) {
            L = normalize(-light.position.xyz);
        } else {
            let distance = length(light.position.xyz - in.frag_pos);
            L            = normalize(light.position.xyz - in.frag_pos);
            attenuation  = 1.0 / (1.0 + 0.09 * distance + 0.032 * (distance * distance));
        }

        let lightColor = light.color.rgb * light.color.a * attenuation;

        let NdotL  = max(dot(N, L), 0.0);
        let diffuse = baseColor * NdotL * (1.0 - metallic);

        let H        = normalize(L + V);
        let NdotH    = max(dot(N, H), 0.0);
        let specPower = pow(NdotH, shininess);
        let specular  = specularColor * specPower * NdotL;

        // Apply shadow only to the shadow-casting directional light (type == 1.0)
        let currentShadow = select(1.0, shadowFactor, lightType > 0.5 && lightType < 1.5);

        finalColor += (diffuse + specular) * lightColor * currentShadow;
    }

    return vec4<f32>(finalColor, alpha);
}
`;
