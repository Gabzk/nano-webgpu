/**
 * Chunk: tangent-space normal map perturbation (no explicit tangent attribute).
 */
export const normalMapChunk = /* wgsl */ `
// Derives perturbed normal from a normal-map sample without needing
// a pre-computed tangent vertex attribute. Uses screen-space derivatives.
fn getPerturbedNormal(
    N: vec3<f32>, p: vec3<f32>, uv: vec2<f32>,
    normal_sample: vec3<f32>, scale: f32,
    dp1: vec3<f32>, dp2: vec3<f32>,
    duv1: vec2<f32>, duv2: vec2<f32>
) -> vec3<f32> {
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
`;
