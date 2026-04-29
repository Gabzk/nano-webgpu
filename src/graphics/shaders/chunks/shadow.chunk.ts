/**
 * Chunk: shadow sampling — two compile-time variants.
 *
 * PCF variant   (usePCF=true)  → 3×3 kernel, 9 textureSampleCompare calls → soft edges.
 * Hard variant  (usePCF=false) → 1 textureSampleCompare call               → hard edges, cheaper.
 *
 * WGSL requires textureSampleCompare to execute in uniform control flow, so
 * the hard variant still calls it unconditionally — it just does it once instead
 * of nine times, giving a real ~9× reduction in shadow-map bandwidth.
 */
export function getShadowChunk(usePCF: boolean): string {
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
    let inBounds = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
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
    let inBounds = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
    return mix(1.0, shadow, inBounds);
}
`;
}
