/**
 * Chunk: fragment shader entry point — PBR lighting.
 *
 * Diffuse:  Disney Burley PBR formulation.
 *           Rougher surfaces create a wider, flatter lobe — more natural than Lambert.
 *
 *           Formula (artistic units, PI omitted so intensity=1 is visually normal):
 *             FD90 = 2 * LdotH² * roughness - 0.5
 *             FdV  = 1 + FD90 * (1-NdotV)^5
 *             FdL  = 1 + FD90 * (1-NdotL)^5
 *             diffuse = albedo * FdV * FdL * NdotL * (1 - metallic)
 *
 * Specular: GGX + Smith V (Hammon) + Schlick Fresnel approximation.
 *
 * Ambient:  Hemisphere sky/ground gradient, so surfaces NEVER go fully black even
 *           when the direct light faces away. Provides a robust fill light.
 */
export const lightingChunk = /* wgsl */ `

// Schlick Fresnel power: (1 - u)^5
fn schlick5(u: f32) -> f32 {
    let m  = 1.0 - u;
    let m2 = m * m;
    return m2 * m2 * m;
}

@fragment
fn fs_main(in: VertexOutput, @builtin(front_facing) isFrontFace: bool) -> @location(0) vec4<f32> {
    // Derivatives must be outside branches for WGSL uniform control flow.
    let dp1  = dpdx(in.frag_pos);
    let dp2  = dpdy(in.frag_pos);
    let duv1 = dpdx(in.uv);
    let duv2 = dpdy(in.uv);

    let texColor  = textureSample(albedoTex, mySampler, in.uv);
    let baseColor = texColor.rgb * material.color.rgb * in.color;
    let alpha     = texColor.a * material.color.a;

    var N = normalize(in.normal);
    if (material.useNormalMap > 0.5) {
        let nSample = textureSample(normalTex, mySampler, in.uv).rgb;
        N = getPerturbedNormal(N, in.frag_pos, in.uv, nSample, material.normalScale,
                               dp1, dp2, duv1, duv2);
    }
    if (material.cullMode > 0.5 && !isFrontFace) {
        N = -N;
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

    // V = view direction from fragment toward camera (correct world position from uniform)
    let V = normalize(camera.cameraPos.xyz - in.frag_pos);

    var finalColor = vec3<f32>(0.0);

    // ------------------------------------------------------------------
    // Ambient light — hemisphere sky/ground gradient.
    // Ensures surfaces facing AWAY from the sun are never pitch-black.
    // Provides a robust fill contribution when no environment map is bound.
    //
    //   upFactor=1  (N points up)   → receives full sky color
    //   upFactor=0  (N points down) → receives only dim ground bounce
    // ------------------------------------------------------------------
    let skyColor    = vec3<f32>(0.45, 0.47, 0.55); // cool blue-grey sky (strong fill)
    let groundColor = vec3<f32>(0.12, 0.10, 0.08); // warm ground bounce
    let upFactor    = clamp(N.y * 0.5 + 0.5, 0.0, 1.0);
    let ambient     = mix(groundColor, skyColor, upFactor) * baseColor * ao;
    finalColor     += ambient;

    // f0: dialectric = 0.04, metallic = albedo
    let f0 = mix(vec3<f32>(0.04), baseColor, metallic);

    // ------------------------------------------------------------------
    // Shadow — must be reached by ALL fragment invocations (WGSL rule).
    // ------------------------------------------------------------------
    var shadowDir = vec3<f32>(0.0, 1.0, 0.0);
    if (shadowCamera.hasShadow > 0.5) {
        shadowDir = normalize(vec3<f32>(shadowCamera.lightDirX, shadowCamera.lightDirY, shadowCamera.lightDirZ));
    }
    let shadowBias        = max(shadowCamera.bias * (1.0 - dot(N, shadowDir)), shadowCamera.bias * 0.1);
    let shadowSample      = getShadow(in.shadow_pos, shadowBias, shadowCamera.texelSize);
    let shadowFactor      = select(1.0, shadowSample, shadowCamera.hasShadow > 0.5);

    // ------------------------------------------------------------------
    // Direct lighting loop
    // ------------------------------------------------------------------
    for (var i: u32 = 0u; i < scene.count; i++) {
        let light     = scene.lights[i];
        let lightType = light.position.w;

        var L           = vec3<f32>(0.0);
        var attenuation = 1.0;

        if (lightType < 1.5) {
            // Directional light
            L = normalize(-light.position.xyz);
        } else {
            // Point light — inverse-square with smooth cutoff
            let d    = light.position.xyz - in.frag_pos;
            let dist = length(d);
            L            = normalize(d);
            attenuation  = 1.0 / (1.0 + 0.09 * dist + 0.032 * dist * dist);
        }

        let lightColor = light.color.rgb * light.color.a * attenuation;

        let NdotL = max(dot(N, L), 0.0);
        let NdotV = max(dot(N, V), 0.0001);
        let H     = normalize(L + V);
        let LdotH = max(dot(L, H), 0.0);
        let NdotH = max(dot(N, H), 0.0);

        // ---- Disney Burley diffuse --------------------------------------
        // Rougher surfaces scatter light more uniformly → flatter lobe.
        // Back-lit faces still receive some diffuse via FD90 softening.
        // PI normalization is omitted → artistic light units where intensity=1
        // gives the same visual scale as a standard Lambert model.
        let FD90        = 2.0 * LdotH * LdotH * roughness - 0.5;
        let FdV         = 1.0 + FD90 * schlick5(NdotV);
        let FdL         = 1.0 + FD90 * schlick5(NdotL);
        let burley      = FdV * FdL * NdotL;
        let diffuse     = baseColor * burley * (1.0 - metallic);

        // ---- GGX specular -----------------------------------------------
        // D: Trowbridge-Reitz (GGX) — Hammon formulation
        let a     = roughness * roughness;
        let a2    = a * a;
        let denom = NdotH * NdotH * (a2 - 1.0) + 1.0;
        let D     = a2 / max(denom * denom, 0.0001);

        // V: Smith GGX height-correlated (Hammon approximation)
        let G = clamp(0.5 / mix(2.0 * NdotL * NdotV, NdotL + NdotV, a), 0.0, 1.0);

        // F: Schlick Fresnel
        let F        = f0 + (vec3<f32>(1.0) - f0) * schlick5(LdotH);
        let specular = NdotL * D * G * F;

        // Shadow only on the directional shadow-casting light (type == 1.0)
        let shadow = select(1.0, shadowFactor, lightType > 0.5 && lightType < 1.5);

        finalColor += (diffuse + specular) * lightColor * shadow;
    }

    return vec4<f32>(finalColor, alpha);
}
`;
