import { Context } from "../core/context";
import { Geometry } from "./geometry";

/**
 * Creates a Geometry representing a Cube.
 */
export function createCubeGeometry(ctx: Context, size: number = 1.0): Geometry {
    const s = size / 2;
    // Format: Position(XYZ), Normal(XYZ), UV(XY)
    const vertices = new Float32Array([
        // Front face
        -s,-s, s,  0, 0, 1,  0, 1,
         s,-s, s,  0, 0, 1,  1, 1,
         s, s, s,  0, 0, 1,  1, 0,
        -s, s, s,  0, 0, 1,  0, 0,
        // Back face
        -s,-s,-s,  0, 0,-1,  1, 1,
        -s, s,-s,  0, 0,-1,  1, 0,
         s, s,-s,  0, 0,-1,  0, 0,
         s,-s,-s,  0, 0,-1,  0, 1,
        // Top face
        -s, s,-s,  0, 1, 0,  0, 0,
        -s, s, s,  0, 1, 0,  0, 1,
         s, s, s,  0, 1, 0,  1, 1,
         s, s,-s,  0, 1, 0,  1, 0,
        // Bottom face
        -s,-s,-s,  0,-1, 0,  1, 0,
         s,-s,-s,  0,-1, 0,  0, 0,
         s,-s, s,  0,-1, 0,  0, 1,
        -s,-s, s,  0,-1, 0,  1, 1,
        // Right face
         s,-s,-s,  1, 0, 0,  1, 1,
         s, s,-s,  1, 0, 0,  1, 0,
         s, s, s,  1, 0, 0,  0, 0,
         s,-s, s,  1, 0, 0,  0, 1,
        // Left face
        -s,-s,-s, -1, 0, 0,  0, 1,
        -s,-s, s, -1, 0, 0,  1, 1,
        -s, s, s, -1, 0, 0,  1, 0,
        -s, s,-s, -1, 0, 0,  0, 0,
    ]);

    const indices = new Uint16Array([
        0,  1,  2,      0,  2,  3,    // front
        4,  5,  6,      4,  6,  7,    // back
        8,  9,  10,     8,  10, 11,   // top
        12, 13, 14,     12, 14, 15,   // bottom
        16, 17, 18,     16, 18, 19,   // right
        20, 21, 22,     20, 22, 23,   // left
    ]);

    return new Geometry(ctx, vertices, indices, { hasUVs: true, hasNormals: true });
}

/**
 * Creates a Geometry representing a Plane.
 */
export function createPlaneGeometry(ctx: Context, width: number = 1.0, height: number = 1.0): Geometry {
    const hw = width / 2;
    const hh = height / 2;

    const vertices = new Float32Array([
        // Pos             Normals        UVs
        -hw, 0,  hh,      0, 1, 0,       0, 0,
         hw, 0,  hh,      0, 1, 0,       1, 0,
         hw, 0, -hh,      0, 1, 0,       1, 1,
        -hw, 0, -hh,      0, 1, 0,       0, 1,
    ]);

    const indices = new Uint16Array([
        0, 1, 2,  
        0, 2, 3
    ]);

    return new Geometry(ctx, vertices, indices, { hasUVs: true, hasNormals: true });
}

/**
 * Creates a Geometry representing a Sphere.
 */
export function createSphereGeometry(ctx: Context, radius: number = 1.0, widthSegments: number = 16, heightSegments: number = 16): Geometry {
    const vertices: number[] = [];
    const indices: number[] = [];

    for (let y = 0; y <= heightSegments; y++) {
        const v = y / heightSegments;
        const phi = v * Math.PI;

        for (let x = 0; x <= widthSegments; x++) {
            const u = x / widthSegments;
            const theta = u * Math.PI * 2;

            const px = -radius * Math.cos(theta) * Math.sin(phi);
            const py = radius * Math.cos(phi);
            const pz = radius * Math.sin(theta) * Math.sin(phi);

            const nx = px / radius;
            const ny = py / radius;
            const nz = pz / radius;

            vertices.push(px, py, pz, nx, ny, nz, u, 1 - v);
        }
    }

    for (let y = 0; y < heightSegments; y++) {
        for (let x = 0; x < widthSegments; x++) {
            const first = (y * (widthSegments + 1)) + x;
            const second = first + widthSegments + 1;

            indices.push(first, second, first + 1);
            indices.push(second, second + 1, first + 1);
        }
    }

    return new Geometry(ctx, new Float32Array(vertices), new Uint16Array(indices), { hasUVs: true, hasNormals: true });
}
