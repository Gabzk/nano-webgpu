export const postProcessChunk = /* wgsl */ `
    const EDGE_THRESHOLD_MIN = 0.0312; // 0.0312 is standard, lower = detects softer edges
    const EDGE_THRESHOLD_MAX = 0.125; // 0.125 is standard, lower = more aggressive
    const SUBPIXEL_QUALITY = 0.75;      // 0.75 is standard, 1.0 = softer, more blurred
    const ITERATIONS = 12;

    // Helper: compute luma from RGB
    fn rgb2luma(rgb: vec3<f32>) -> f32 {
        return dot(rgb, vec3<f32>(0.299, 0.587, 0.114));
    }

    fn apply_fxaa(
        screenTexture: texture_2d<f32>, 
        screenSampler: sampler, 
        uv: vec2<f32>, 
        inverseScreenSize: vec2<f32>
    ) -> vec4<f32> {
        let colorCenter = textureSampleLevel(screenTexture, screenSampler, uv, 0.0).rgb;
        
        let lumaCenter = rgb2luma(colorCenter);
        let lumaDown  = rgb2luma(textureSampleLevel(screenTexture, screenSampler, uv + vec2<f32>(0.0, -1.0) * inverseScreenSize, 0.0).rgb);
        let lumaUp    = rgb2luma(textureSampleLevel(screenTexture, screenSampler, uv + vec2<f32>(0.0, 1.0) * inverseScreenSize, 0.0).rgb);
        let lumaLeft  = rgb2luma(textureSampleLevel(screenTexture, screenSampler, uv + vec2<f32>(-1.0, 0.0) * inverseScreenSize, 0.0).rgb);
        let lumaRight = rgb2luma(textureSampleLevel(screenTexture, screenSampler, uv + vec2<f32>(1.0, 0.0) * inverseScreenSize, 0.0).rgb);

        let lumaMin = min(lumaCenter, min(min(lumaDown, lumaUp), min(lumaLeft, lumaRight)));
        let lumaMax = max(lumaCenter, max(max(lumaDown, lumaUp), max(lumaLeft, lumaRight)));
        let lumaRange = lumaMax - lumaMin;

        // If the contrast is lower than a maximum threshold, don't do AA
        if (lumaRange < max(EDGE_THRESHOLD_MIN, lumaMax * EDGE_THRESHOLD_MAX)) {
            return vec4<f32>(colorCenter, 1.0);
        }

        // --- FXAA logic ---
        let lumaDownLeft  = rgb2luma(textureSampleLevel(screenTexture, screenSampler, uv + vec2<f32>(-1.0, -1.0) * inverseScreenSize, 0.0).rgb);
        let lumaUpRight   = rgb2luma(textureSampleLevel(screenTexture, screenSampler, uv + vec2<f32>(1.0, 1.0) * inverseScreenSize, 0.0).rgb);
        let lumaUpLeft    = rgb2luma(textureSampleLevel(screenTexture, screenSampler, uv + vec2<f32>(-1.0, 1.0) * inverseScreenSize, 0.0).rgb);
        let lumaDownRight = rgb2luma(textureSampleLevel(screenTexture, screenSampler, uv + vec2<f32>(1.0, -1.0) * inverseScreenSize, 0.0).rgb);

        let lumaDownUp = lumaDown + lumaUp;
        let lumaLeftRight = lumaLeft + lumaRight;

        let lumaLeftCorners = lumaDownLeft + lumaUpLeft;
        let lumaDownCorners = lumaDownLeft + lumaDownRight;
        let lumaRightCorners = lumaDownRight + lumaUpRight;
        let lumaUpCorners = lumaUpRight + lumaUpLeft;

        let edgeHorizontal = abs(-2.0 * lumaLeft + lumaLeftCorners) + 
                             abs(-2.0 * lumaCenter + lumaDownUp) * 2.0 + 
                             abs(-2.0 * lumaRight + lumaRightCorners);
        let edgeVertical   = abs(-2.0 * lumaUp + lumaUpCorners) + 
                             abs(-2.0 * lumaCenter + lumaLeftRight) * 2.0 + 
                             abs(-2.0 * lumaDown + lumaDownCorners);

        let isHorizontal = (edgeHorizontal >= edgeVertical);

        let stepLength = select(inverseScreenSize.x, inverseScreenSize.y, isHorizontal);
        var luma1 = select(lumaLeft, lumaDown, isHorizontal);
        var luma2 = select(lumaRight, lumaUp, isHorizontal);

        let gradient1 = abs(luma1 - lumaCenter);
        let gradient2 = abs(luma2 - lumaCenter);

        let is1Steepest = gradient1 >= gradient2;
        let gradientScaled = 0.25 * max(gradient1, gradient2);

        var stepDir = 0.0;
        var lumaLocalAverage = 0.0;

        if (is1Steepest) {
            stepDir = -stepLength;
            lumaLocalAverage = 0.5 * (luma1 + lumaCenter);
        } else {
            stepDir = stepLength;
            lumaLocalAverage = 0.5 * (luma2 + lumaCenter);
        }

        var currentUv = uv;
        if (isHorizontal) {
            currentUv.y += stepDir * 0.5;
        } else {
            currentUv.x += stepDir * 0.5;
        }

        let offset = select(vec2<f32>(0.0, inverseScreenSize.y), vec2<f32>(inverseScreenSize.x, 0.0), isHorizontal);
        
        var uv1 = currentUv - offset;
        var uv2 = currentUv + offset;

        var lumaEnd1 = rgb2luma(textureSampleLevel(screenTexture, screenSampler, uv1, 0.0).rgb) - lumaLocalAverage;
        var lumaEnd2 = rgb2luma(textureSampleLevel(screenTexture, screenSampler, uv2, 0.0).rgb) - lumaLocalAverage;
        
        var reached1 = abs(lumaEnd1) >= gradientScaled;
        var reached2 = abs(lumaEnd2) >= gradientScaled;

        var reachedBoth = reached1 && reached2;

        if (!reached1) { uv1 -= offset; }
        if (!reached2) { uv2 += offset; }

        if (!reachedBoth) {
            for (var i = 2; i < ITERATIONS; i++) {
                if (!reached1) {
                    lumaEnd1 = rgb2luma(textureSampleLevel(screenTexture, screenSampler, uv1, 0.0).rgb) - lumaLocalAverage;
                    reached1 = abs(lumaEnd1) >= gradientScaled;
                    if (!reached1) { uv1 -= offset; }
                }
                if (!reached2) {
                    lumaEnd2 = rgb2luma(textureSampleLevel(screenTexture, screenSampler, uv2, 0.0).rgb) - lumaLocalAverage;
                    reached2 = abs(lumaEnd2) >= gradientScaled;
                    if (!reached2) { uv2 += offset; }
                }
                if (reached1 && reached2) { break; }
            }
        }

        let distance1 = select(abs(uv.x - uv1.x), abs(uv.y - uv1.y), isHorizontal);
        let distance2 = select(abs(uv2.x - uv.x), abs(uv2.y - uv.y), isHorizontal);

        let isDirection1 = distance1 < distance2;
        let distanceFinal = min(distance1, distance2);
        let edgeThickness = distance1 + distance2;
        let pixelOffset = -distanceFinal / edgeThickness + 0.5;

        let isLumaCenterSmaller = lumaCenter < lumaLocalAverage;
        let correctVariation = ((select(lumaEnd2, lumaEnd1, isDirection1)) < 0.0) != isLumaCenterSmaller;
        let finalOffset = select(0.0, pixelOffset, correctVariation);

        // Sub-pixel shifting
        let lumaAverage = (1.0/12.0) * (2.0 * (lumaDownUp + lumaLeftRight) + lumaLeftCorners + lumaRightCorners);
        let subPixelOffset1 = clamp(abs(lumaAverage - lumaCenter) / lumaRange, 0.0, 1.0);
        let subPixelOffset2 = (-2.0 * subPixelOffset1 + 3.0) * subPixelOffset1 * subPixelOffset1;
        let subPixelOffsetFinal = subPixelOffset2 * subPixelOffset2 * SUBPIXEL_QUALITY;

        let finalPixelOffset = max(finalOffset, subPixelOffsetFinal);

        var finalUv = uv;
        if (isHorizontal) {
            finalUv.y += finalPixelOffset * stepLength;
        } else {
            finalUv.x += finalPixelOffset * stepLength;
        }

        let finalColor = textureSampleLevel(screenTexture, screenSampler, finalUv, 0.0).rgb;
        return vec4<f32>(finalColor, 1.0);
    }
`;