import type { Context } from "../core/context";
import { Geometry } from "./geometry";

/**
 * Creates a Geometry representing a standardized Cube centered at the origin.
 * Generates 24 unique vertices (4 per face) with appropriate surface normal coordinates
 * and standard 0-to-1 texture coordinate mappings.
 *
 * @param ctx - Active context.
 * @param size - Sizing dimension representing full edge length of the cube. Defaults to `1.0`.
 * @returns An allocated Box Geometry instance.
 */
export function createCubeGeometry(ctx: Context, size: number = 1.0): Geometry {
	const s = size / 2;
	// Format per vertex: Position(XYZ), Normal(XYZ), UV(XY) — 8 floats per vertex
	// prettier-ignore
	const vertices = new Float32Array([
		// pos.x  pos.y  pos.z   nor.x  nor.y  nor.z   uv.u  uv.v
		// Front face (Z+)
		-s,
		-s,
		s,
		0,
		0,
		1,
		0,
		1,
		s,
		-s,
		s,
		0,
		0,
		1,
		1,
		1,
		s,
		s,
		s,
		0,
		0,
		1,
		1,
		0,
		-s,
		s,
		s,
		0,
		0,
		1,
		0,
		0,
		// Back face (Z-)
		-s,
		-s,
		-s,
		0,
		0,
		-1,
		1,
		1,
		-s,
		s,
		-s,
		0,
		0,
		-1,
		1,
		0,
		s,
		s,
		-s,
		0,
		0,
		-1,
		0,
		0,
		s,
		-s,
		-s,
		0,
		0,
		-1,
		0,
		1,
		// Top face (Y+)
		-s,
		s,
		-s,
		0,
		1,
		0,
		0,
		0,
		-s,
		s,
		s,
		0,
		1,
		0,
		0,
		1,
		s,
		s,
		s,
		0,
		1,
		0,
		1,
		1,
		s,
		s,
		-s,
		0,
		1,
		0,
		1,
		0,
		// Bottom face (Y-)
		-s,
		-s,
		-s,
		0,
		-1,
		0,
		1,
		0,
		s,
		-s,
		-s,
		0,
		-1,
		0,
		0,
		0,
		s,
		-s,
		s,
		0,
		-1,
		0,
		0,
		1,
		-s,
		-s,
		s,
		0,
		-1,
		0,
		1,
		1,
		// Right face (X+)
		s,
		-s,
		-s,
		1,
		0,
		0,
		1,
		1,
		s,
		s,
		-s,
		1,
		0,
		0,
		1,
		0,
		s,
		s,
		s,
		1,
		0,
		0,
		0,
		0,
		s,
		-s,
		s,
		1,
		0,
		0,
		0,
		1,
		// Left face (X-)
		-s,
		-s,
		-s,
		-1,
		0,
		0,
		0,
		1,
		-s,
		-s,
		s,
		-1,
		0,
		0,
		1,
		1,
		-s,
		s,
		s,
		-1,
		0,
		0,
		1,
		0,
		-s,
		s,
		-s,
		-1,
		0,
		0,
		0,
		0,
	]);

	// prettier-ignore
	const indices = new Uint16Array([
		0,
		1,
		2,
		0,
		2,
		3, // front
		4,
		5,
		6,
		4,
		6,
		7, // back
		8,
		9,
		10,
		8,
		10,
		11, // top
		12,
		13,
		14,
		12,
		14,
		15, // bottom
		16,
		17,
		18,
		16,
		18,
		19, // right
		20,
		21,
		22,
		20,
		22,
		23, // left
	]);

	return new Geometry(ctx, vertices, indices, {
		hasUVs: true,
		hasNormals: true,
	});
}

/**
 * Creates a Geometry representing a flat horizontal plane centered at the origin facing upward along the Y axis.
 *
 * @param ctx - Active context.
 * @param width - Span width of the plane along the X axis. Defaults to `1.0`.
 * @param height - Span depth of the plane along the Z axis. Defaults to `1.0`.
 * @returns An allocated Plane Geometry instance.
 */
export function createPlaneGeometry(
	ctx: Context,
	width: number = 1.0,
	height: number = 1.0,
): Geometry {
	const hw = width / 2;
	const hh = height / 2;

	// Format per vertex: Position(XYZ), Normal(XYZ), UV(XY) — 8 floats per vertex
	// prettier-ignore
	const vertices = new Float32Array([
		// pos.x  pos.y  pos.z   nor.x  nor.y  nor.z   uv.u  uv.v
		-hw,
		0,
		hh,
		0,
		1,
		0,
		0,
		0,
		hw,
		0,
		hh,
		0,
		1,
		0,
		1,
		0,
		hw,
		0,
		-hh,
		0,
		1,
		0,
		1,
		1,
		-hw,
		0,
		-hh,
		0,
		1,
		0,
		0,
		1,
	]);

	const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

	return new Geometry(ctx, vertices, indices, {
		hasUVs: true,
		hasNormals: true,
	});
}

/**
 * Programmatically generates a UV sphere Geometry using standard spherical parameter equations.
 * Calculates positions, normal components, and texture coordinate projections.
 *
 * @param ctx - Active context.
 * @param radius - Radial size of the sphere. Defaults to `1.0`.
 * @param widthSegments - Horizontal subdivision segments. Defaults to `16`.
 * @param heightSegments - Vertical subdivision segments. Defaults to `16`.
 * @returns An allocated Sphere Geometry instance.
 */
export function createSphereGeometry(
	ctx: Context,
	radius: number = 1.0,
	widthSegments: number = 16,
	heightSegments: number = 16,
): Geometry {
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
			const first = y * (widthSegments + 1) + x;
			const second = first + widthSegments + 1;

			indices.push(first, second, first + 1);
			indices.push(second, second + 1, first + 1);
		}
	}

	return new Geometry(
		ctx,
		new Float32Array(vertices),
		new Uint16Array(indices),
		{ hasUVs: true, hasNormals: true },
	);
}

/**
 * Creates a Geometry representing a cone pointing along the -Z axis.
 * Tip of the cone is at the origin (0, 0, 0), and the base is at (0, 0, -1) with radius 1.0.
 *
 * @param ctx - Active context.
 * @param radialSegments - Subdivision segments around the cone base. Defaults to `16`.
 * @returns An allocated Cone Geometry instance.
 */
export function createConeGeometry(
	ctx: Context,
	radialSegments: number = 16,
): Geometry {
	const vertices: number[] = [];
	const indices: number[] = [];

	// Vertex 0: Tip of the cone
	vertices.push(0, 0, 0, 0, 0, 1, 0.5, 0.5);

	// Vertex 1: Base center of the cone
	vertices.push(0, 0, -1, 0, 0, -1, 0.5, 0.5);

	const baseIdx = 2;

	// Base ring vertices
	for (let i = 0; i <= radialSegments; i++) {
		const theta = (i / radialSegments) * Math.PI * 2;
		const x = Math.cos(theta);
		const y = Math.sin(theta);

		// Surface normal approximation
		vertices.push(x, y, -1, x, y, 0, i / radialSegments, 1);
	}

	// Build cone triangles
	for (let i = 0; i < radialSegments; i++) {
		const vCurrent = baseIdx + i;
		const vNext = baseIdx + i + 1;

		// Outer surface (Tip to ring)
		indices.push(0, vNext, vCurrent);

		// Base cap (Center to ring)
		indices.push(1, vCurrent, vNext);
	}

	return new Geometry(
		ctx,
		new Float32Array(vertices),
		new Uint16Array(indices),
		{ hasUVs: true, hasNormals: true },
	);
}

/**
 * Creates a Geometry representing a 3D arrow pointing along the -Z axis.
 * Uses a cylinder for the shaft and a cone for the head.
 *
 * @param ctx - Active context.
 * @param radialSegments - Subdivision segments around the arrow body. Defaults to `8`.
 * @returns An allocated Arrow Geometry instance.
 */
export function createArrowGeometry(
	ctx: Context,
	radialSegments: number = 8,
): Geometry {
	const vertices: number[] = [];
	const indices: number[] = [];

	// Vertex 0: Tip of the arrow head at (0, 0, -1.2)
	vertices.push(0, 0, -1.2, 0, 0, -1, 0.5, 0.5);

	// Vertex 1: Base center of the shaft at (0, 0, 0)
	vertices.push(0, 0, 0, 0, 0, 1, 0.5, 0.5);

	const baseIdx = 2;

	// 1. Shaft base ring at z = 0, radius = 0.03
	for (let i = 0; i <= radialSegments; i++) {
		const theta = (i / radialSegments) * Math.PI * 2;
		const x = Math.cos(theta) * 0.03;
		const y = Math.sin(theta) * 0.03;
		vertices.push(
			x,
			y,
			0,
			Math.cos(theta),
			Math.sin(theta),
			0,
			i / radialSegments,
			0,
		);
	}

	// 2. Shaft top ring at z = -0.7, radius = 0.03
	const shaftTopStart = baseIdx + radialSegments + 1;
	for (let i = 0; i <= radialSegments; i++) {
		const theta = (i / radialSegments) * Math.PI * 2;
		const x = Math.cos(theta) * 0.03;
		const y = Math.sin(theta) * 0.03;
		vertices.push(
			x,
			y,
			-0.7,
			Math.cos(theta),
			Math.sin(theta),
			0,
			i / radialSegments,
			0.5,
		);
	}

	// 3. Arrow head base ring at z = -0.7, radius = 0.1
	const headBaseStart = shaftTopStart + radialSegments + 1;
	for (let i = 0; i <= radialSegments; i++) {
		const theta = (i / radialSegments) * Math.PI * 2;
		const x = Math.cos(theta) * 0.1;
		const y = Math.sin(theta) * 0.1;
		vertices.push(
			x,
			y,
			-0.7,
			Math.cos(theta),
			Math.sin(theta),
			0,
			i / radialSegments,
			0.5,
		);
	}

	// Indices for Shaft Base Cap (Vertex 1 connected to Shaft base ring)
	for (let i = 0; i < radialSegments; i++) {
		const vCurrent = baseIdx + i;
		const vNext = baseIdx + i + 1;
		indices.push(1, vCurrent, vNext);
	}

	// Indices for Shaft Cylinder (Shaft base ring to Shaft top ring)
	for (let i = 0; i < radialSegments; i++) {
		const bCurrent = baseIdx + i;
		const bNext = baseIdx + i + 1;
		const tCurrent = shaftTopStart + i;
		const tNext = shaftTopStart + i + 1;

		indices.push(bCurrent, tNext, tCurrent);
		indices.push(bCurrent, bNext, tNext);
	}

	// Indices for Arrow Head Base Cap (Collar connecting Shaft top ring to Head base ring)
	for (let i = 0; i < radialSegments; i++) {
		const tCurrent = shaftTopStart + i;
		const tNext = shaftTopStart + i + 1;
		const hCurrent = headBaseStart + i;
		const hNext = headBaseStart + i + 1;

		indices.push(tCurrent, hCurrent, hNext);
		indices.push(tCurrent, hNext, tNext);
	}

	// Indices for Arrow Head Cone (Tip to Head base ring)
	for (let i = 0; i < radialSegments; i++) {
		const hCurrent = headBaseStart + i;
		const hNext = headBaseStart + i + 1;
		indices.push(0, hNext, hCurrent);
	}

	return new Geometry(
		ctx,
		new Float32Array(vertices),
		new Uint16Array(indices),
		{ hasUVs: true, hasNormals: true },
	);
}
