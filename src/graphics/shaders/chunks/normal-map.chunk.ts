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
    // Desempacota o mapa de normais [0, 1] para [-1, 1]
    var Nmap = normal_sample * 2.0 - 1.0;
    
    // Aplica a escala de intensidade do normal map e corrige a direção do canal Y (Green)
    // Nota: Se o relevo parecer invertido na sua engine, mude para: vec3<f32>(Nmap.x * scale, Nmap.y * scale, Nmap.z)
    let map_scaled = vec3<f32>(Nmap.x * scale, -Nmap.y * scale, Nmap.z);

    // Resolve o sistema para encontrar a direção dos eixos de textura no espaço do mundo
    let c1 = cross(dp2, N);
    let c2 = cross(N, dp1);

    var T = c1 * duv1.x + c2 * duv2.x;
    var B = c1 * duv1.y + c2 * duv2.y;

    // Gram-Schmidt: Garante que a Tangente seja 100% perpendicular à Normal geométrica
    T = normalize(T - N * dot(N, T));
    // A Bitangente é simplesmente o produto vetorial entre a Normal e a Tangente corrigida
    B = normalize(cross(N, T));

    // Monta a matriz TBN (agora perfeitamente ortogonal)
    let TBN = mat3x3<f32>(T, B, N);

    // Retorna a normal perturbada finalizada e normalizada
    return normalize(TBN * map_scaled);
}
`;