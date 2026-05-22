/// <reference types="@webgpu/types" />
import { describe, expect, it, vi } from "vitest";
import { Camera } from "../src/graphics/camera";
import { CameraController } from "../src/graphics/camera-controller";
import { OrbitCameraController } from "../src/graphics/controllers/orbit";
import { FirstPersonCameraController } from "../src/graphics/controllers/first-person";
import { ThirdPersonCameraController } from "../src/graphics/controllers/third-person";
import { InputManager } from "../src/core/input";
import { Node3D } from "../src/core/node3d";
import { Vec3 } from "../src/math/vec3";

// Mock WebGPU structures
(globalThis as any).GPUBufferUsage = {
	UNIFORM: 64,
	COPY_DST: 8,
};

function createMockCamera(): Camera {
	const cam = new Camera();
	const mockCanvas = document.createElement("canvas");
	const mockDevice = {
		createBuffer: vi.fn().mockReturnValue({}),
		queue: {
			writeBuffer: vi.fn(),
		},
	} as unknown as GPUDevice;

	cam.ctx = {
		device: mockDevice,
		context: {
			canvas: mockCanvas,
		},
		vramTracker: {
			register: vi.fn(),
			unregister: vi.fn(),
		},
		input: new InputManager(),
	} as any;

	cam.ctx!.input.init(mockCanvas);
	return cam;
}

describe("CameraController Modular System", () => {
	it("should instantiate specialized subclass instances using the factory pattern", () => {
		const camera = createMockCamera();

		const orbitCtrl = new CameraController(camera, "orbit");
		expect(orbitCtrl.impl).toBeInstanceOf(OrbitCameraController);
		expect(orbitCtrl.mode).toBe("orbit");

		const fpsCtrl = new CameraController(camera, "first-person", { target: new Node3D() });
		expect(fpsCtrl.impl).toBeInstanceOf(FirstPersonCameraController);
		expect(fpsCtrl.mode).toBe("first-person");

		const tpCtrl = new CameraController(camera, "third-person", { target: new Node3D() });
		expect(tpCtrl.impl).toBeInstanceOf(ThirdPersonCameraController);
		expect(tpCtrl.mode).toBe("third-person");
	});

	it("should correctly forward getter and setter calls to the underlying specialized controller implementation", () => {
		const camera = createMockCamera();
		const controller = new CameraController(camera, "orbit");

		expect(controller.distance).toBe(8);
		controller.distance = 15;
		expect(controller.impl.distance).toBe(15);
		expect(controller.distance).toBe(15);

		expect(controller.yaw).toBe(0);
		controller.yaw = Math.PI / 4;
		expect(controller.impl.yaw).toBe(Math.PI / 4);
		expect(controller.yaw).toBe(Math.PI / 4);

		expect(controller.pitch).toBe(0);
		controller.pitch = Math.PI / 6;
		expect(controller.impl.pitch).toBe(Math.PI / 6);
		expect(controller.pitch).toBe(Math.PI / 6);

		const targetNode = new Node3D();
		controller.target = targetNode;
		expect(controller.impl.target).toBe(targetNode);
		expect(controller.target).toBe(targetNode);

		const newCenter = new Vec3(1, 2, 3);
		controller.center = newCenter;
		expect(controller.impl.center).toBe(newCenter);
		expect(controller.center).toBe(newCenter);
	});

	it("should support FirstPersonCameraController look re-projections on update", () => {
		const camera = createMockCamera();
		const target = new Node3D();
		target.position.set(10, 20, 30);

		const controller = new CameraController(camera, "first-person", {
			target,
			eyeHeight: 2.0,
		});

		// Trigger update
		controller.update(0.016);

		// Position should align with target position + eyeHeight
		expect(camera.position.x).toBe(10);
		expect(camera.position.y).toBe(22); // 20 + 2.0
		expect(camera.position.z).toBe(30);

		// Target should project forward
		expect(camera.target.x).toBeCloseTo(10);
		expect(camera.target.y).toBeCloseTo(22);
		expect(camera.target.z).toBeCloseTo(29); // pointing along -Z initially
	});

	it("should support ThirdPersonCameraController follow tracking on update", () => {
		const camera = createMockCamera();
		const target = new Node3D();
		target.position.set(5, 5, 5);

		const controller = new CameraController(camera, "third-person", {
			target,
			distance: 10,
			height: 4,
		});

		controller.update(0.016);

		// Should orbit exactly at a distance of 10 from target coordinates
		// Looking target should be character position + height
		expect(camera.target.x).toBe(5);
		expect(camera.target.y).toBe(9); // 5 + 4
		expect(camera.target.z).toBe(5);

		// Spherical coordinate position check
		expect(camera.position.x).toBeCloseTo(5);
		expect(camera.position.y).toBeCloseTo(9);
		expect(camera.position.z).toBeCloseTo(15); // 5 + cos(0)*10 = 15
	});

	it("should strictly ignore hover movement for OrbitCameraController rotation", () => {
		const camera = createMockCamera();
		const controller = new CameraController(camera, "orbit", {
			center: [0, 0, 0],
			distance: 5,
		});

		const input = camera.ctx!.input;
		input.mouseMovement = { x: 10, y: 5 };

		// Update without mouse click
		controller.update(0.016);

		// Yaw and pitch must remain unchanged
		expect(controller.yaw).toBe(0);
		expect(controller.pitch).toBe(0);
	});

	it("should rotate OrbitCameraController when left mouse button is pressed and dragged", () => {
		const camera = createMockCamera();
		const controller = new CameraController(camera, "orbit", {
			center: [0, 0, 0],
			distance: 5,
		});

		const input = camera.ctx!.input;
		// Mock Left mouse button down (button 0)
		(input as any).mouseButtons.add(0);
		input.mouseMovement = { x: 10, y: 5 };

		controller.update(0.016);

		// Yaw and pitch must change based on movement and sensitivity
		expect(controller.yaw).not.toBe(0);
		expect(controller.pitch).not.toBe(0);
	});

	it("should support OrbitCameraController pan offsets when secondary click is pressed and dragged", () => {
		const camera = createMockCamera();
		const controller = new CameraController(camera, "orbit", {
			center: [0, 0, 0],
			distance: 5,
		});

		// Set yaw to an angle so panning shifts along both world X and Z dimensions
		controller.yaw = Math.PI / 4;

		const input = camera.ctx!.input;
		// Mock Right mouse button down (button 2)
		(input as any).mouseButtons.add(2);
		input.mouseMovement = { x: 20, y: -10 };

		controller.update(0.016);

		// The center focal point should pan/translate
		expect(controller.center.x).not.toBe(0);
		expect(controller.center.z).not.toBe(0);
	});

	it("should support OrbitCameraController zoom via scroll wheel events", () => {
		const camera = createMockCamera();
		const controller = new CameraController(camera, "orbit", {
			center: [0, 0, 0],
			distance: 10,
		});

		// Trigger an update to attach canvas listeners
		controller.update(0.016);

		const canvas = camera.ctx!.context.canvas as HTMLCanvasElement;
		const wheelEvent = new WheelEvent("wheel", { deltaY: 100 } as any);

		canvas.dispatchEvent(wheelEvent);

		// Distance should change due to wheel event
		expect(controller.distance).not.toBe(10);
	});

	it("should detach canvas listeners clean upon destroy()", () => {
		const camera = createMockCamera();
		const controller = new CameraController(camera, "orbit", {
			center: [0, 0, 0],
			distance: 10,
		});

		controller.update(0.016);
		expect((controller.impl as any)._canvasListenersAttached).toBe(true);

		controller.destroy();
		expect((controller.impl as any)._canvasListenersAttached).toBe(false);
	});
});
