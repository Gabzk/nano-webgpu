/**
 * Chunk: shadow sampling — two compile-time variants.
 *
 * PCF variant   (usePCF=true)  → 3×3 kernel, 9 textureSampleCompare calls → soft edges.
 * Hard variant  (usePCF=false) → 1 textureSampleCompare call               → hard edges, cheaper.
 *
 * WGSL requires textureSampleCompare to execute in uniform control flow, so
 * the hard variant still calls it unconditionally — it just does it once instead
 * of nine times, giving a real ~9× reduction in shadow-map bandwidth.
 *
 * For Cascaded Shadow Maps (CSM), to guarantee 100% compliance with WGSL uniform control flow
 * rules, all 4 layers are sampled unconditionally and the result is dynamically selected afterwards.
 *
 * NOTE: Layer indexes must be explicitly typed as '0i', '1i', etc. (i32) to resolve overload
 * resolution ambiguity of abstract integer literals in some WebGPU compilers.
 */
export function getShadowChunk(usePCF: boolean, useCSM = false): string {
	if (useCSM) {
		if (usePCF) {
			return /* wgsl */ `  
// PCF + CSM variant: 3×3 kernel across dynamic cascades with uniform control flow
fn getShadow(fragPos: vec3<f32>, depth: f32, bias: f32, texelSize: f32) -> f32 {
    var cascadeIdx = 0u;
    if (depth > shadowCamera.splits.x) { cascadeIdx = 1u; }
    if (depth > shadowCamera.splits.y) { cascadeIdx = 2u; }
    if (depth > shadowCamera.splits.z) { cascadeIdx = 3u; }
    
    let clampedCascadeIdx = min(cascadeIdx, 3u);

    let shadowPos = shadowCamera.viewProjs[clampedCascadeIdx] * vec4<f32>(fragPos, 1.0);
    let projCoords = shadowPos.xyz / shadowPos.w;
    let uv = vec2<f32>(projCoords.x * 0.5 + 0.5, 1.0 - (projCoords.y * 0.5 + 0.5));
    let currentDepth = projCoords.z;
    let clampedUV = clamp(uv, vec2<f32>(0.0), vec2<f32>(1.0));

    var visibility = 0.0;
    for (var x: i32 = -1; x <= 1; x++) {
        for (var y: i32 = -1; y <= 1; y++) {
            let offset = vec2<f32>(f32(x), f32(y)) * texelSize;
            let uvOffset = clampedUV + offset;
            
            // Sample all 4 layers unconditionally (uniform control flow)
            let s0 = textureSampleCompare(shadowMap, shadowSampler, uvOffset, 0i, currentDepth - bias);
            let s1 = textureSampleCompare(shadowMap, shadowSampler, uvOffset, 1i, currentDepth - bias);
            let s2 = textureSampleCompare(shadowMap, shadowSampler, uvOffset, 2i, currentDepth - bias);
            let s3 = textureSampleCompare(shadowMap, shadowSampler, uvOffset, 3i, currentDepth - bias);
            
            var s = s0;
            if (cascadeIdx == 1u) { s = s1; }
            else if (cascadeIdx == 2u) { s = s2; }
            else if (cascadeIdx == 3u) { s = s3; }
            
            visibility += s;
        }
    }
    let shadow = visibility / 9.0;

    let inBounds = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0) * step(currentDepth, 1.0);
    let inCascadeRange = step(f32(cascadeIdx), shadowCamera.cascadeCount - 0.5);
    return mix(1.0, shadow, inBounds * inCascadeRange);
}
`;
		}

		return /* wgsl */ `
// Hard + CSM variant: single tap across dynamic cascades with uniform control flow
fn getShadow(fragPos: vec3<f32>, depth: f32, bias: f32, _texelSize: f32) -> f32 {
    var cascadeIdx = 0u;
    if (depth > shadowCamera.splits.x) { cascadeIdx = 1u; }
    if (depth > shadowCamera.splits.y) { cascadeIdx = 2u; }
    if (depth > shadowCamera.splits.z) { cascadeIdx = 3u; }
    
    let clampedCascadeIdx = min(cascadeIdx, 3u);

    let shadowPos = shadowCamera.viewProjs[clampedCascadeIdx] * vec4<f32>(fragPos, 1.0);
    let projCoords = shadowPos.xyz / shadowPos.w;
    let uv = vec2<f32>(projCoords.x * 0.5 + 0.5, 1.0 - (projCoords.y * 0.5 + 0.5));
    let currentDepth = projCoords.z;
    let clampedUV = clamp(uv, vec2<f32>(0.0), vec2<f32>(1.0));

    // Sample all 4 layers unconditionally (uniform control flow)
    let s0 = textureSampleCompare(shadowMap, shadowSampler, clampedUV, 0i, currentDepth - bias);
    let s1 = textureSampleCompare(shadowMap, shadowSampler, clampedUV, 1i, currentDepth - bias);
    let s2 = textureSampleCompare(shadowMap, shadowSampler, clampedUV, 2i, currentDepth - bias);
    let s3 = textureSampleCompare(shadowMap, shadowSampler, clampedUV, 3i, currentDepth - bias);

    var shadow = s0;
    if (cascadeIdx == 1u) { shadow = s1; }
    else if (cascadeIdx == 2u) { shadow = s2; }
    else if (cascadeIdx == 3u) { shadow = s3; }

    let inBounds = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0) * step(currentDepth, 1.0);
    let inCascadeRange = step(f32(cascadeIdx), shadowCamera.cascadeCount - 0.5);
    return mix(1.0, shadow, inBounds * inCascadeRange);
}
`;
	}

	if (usePCF) {
		return /* wgsl */ `
// PCF variant: 3×3 kernel — 9 samples, soft shadow edges.
// Uniform-control-flow-safe: loop always executes, UVs are clamped so
// out-of-bounds samples are masked via the inBounds multiplier.
fn getShadow(shadowPos: vec4<f32>, bias: f32, texelSize: f32) -> f32 {
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

    // Outside shadow frustum = fully lit
    let inBounds = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0) * step(currentDepth, 1.0);
    return mix(1.0, shadow, inBounds);
}
`;
	}

	return /* wgsl */ `
// Hard shadow variant: single textureSampleCompare — ~9× cheaper than PCF.
// Still called unconditionally to satisfy WGSL uniform control flow rules.
fn getShadow(shadowPos: vec4<f32>, bias: f32, _texelSize: f32) -> f32 {
    let projCoords = shadowPos.xyz / shadowPos.w;
    let uv = vec2<f32>(projCoords.x * 0.5 + 0.5, 1.0 - (projCoords.y * 0.5 + 0.5));
    let currentDepth = projCoords.z;
    let clampedUV = clamp(uv, vec2<f32>(0.0), vec2<f32>(1.0));

    let shadow = textureSampleCompare(shadowMap, shadowSampler, clampedUV, currentDepth - bias);

    // Outside shadow frustum = fully lit
    let inBounds = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0) * step(currentDepth, 1.0);
    return mix(1.0, shadow, inBounds);
}
`;
}
