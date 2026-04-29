/// <reference types="@webgpu/types" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Context, VERSION } from "../src/index";

describe("Context", () => {
	it("should export correct version", () => {
		expect(VERSION).toBe("0.1.0");
	});

	describe("Context Initialization", () => {
		// biome-ignore lint/suspicious/noExplicitAny: disable rule for now
		let originalGpu: any;

		beforeEach(() => {
			// Save the original navigator.gpu before each test
			originalGpu = navigator.gpu;
		});

		afterEach(() => {
			// Restore the original navigator.gpu after each test
			if (originalGpu !== undefined) {
				Object.defineProperty(navigator, "gpu", {
					value: originalGpu,
					configurable: true,
				});
			} else {
				// If it wasn't there originally, remove our mock
				//@ts-expect-error
				delete navigator.gpu;
			}
		});

		it("should throw error if WebGPU is not supported", async () => {
			// Mock navigator.gpu to be undefined
			Object.defineProperty(navigator, "gpu", {
				value: undefined,
				configurable: true,
			});

			const context = new Context();
			const canvas = document.createElement("canvas");

			expect(Context.isSupported()).toBe(false);

			await expect(context.initCanvas(canvas)).rejects.toThrowError(
				"WebGPU is not supported on this browser.",
			);
		});

		it("should throw error if Adapter is not found", async () => {
			// Mock navigator.gpu with a requestAdapter that returns null
			Object.defineProperty(navigator, "gpu", {
				value: {
					requestAdapter: vi.fn().mockResolvedValue(null),
				},
				configurable: true,
			});

			const context = new Context();
			const canvas = document.createElement("canvas");

			expect(Context.isSupported()).toBe(true);

			await expect(context.initCanvas(canvas)).rejects.toThrowError(
				"Adapter not found",
			);
		});

		it("should initialize successfully if WebGPU is supported and Adapter is found", async () => {
			// Create mocks for the device, context, and format
			const mockDevice = {} as GPUDevice;
			const mockFormat = "bgra8unorm" as GPUTextureFormat;

			const mockAdapter = {
				requestDevice: vi.fn().mockResolvedValue(mockDevice),
			};

			const mockWebGpuContext = {
				configure: vi.fn(),
			};

			// Mock navigator.gpu
			Object.defineProperty(navigator, "gpu", {
				value: {
					requestAdapter: vi.fn().mockResolvedValue(mockAdapter),
					getPreferredCanvasFormat: vi.fn().mockReturnValue(mockFormat),
				},
				configurable: true,
			});

			const context = new Context();
			const canvas = document.createElement("canvas");

			// Mock the canvas getContext
			vi.spyOn(canvas, "getContext").mockReturnValue(
				mockWebGpuContext as unknown as GPUCanvasContext,
			);

			expect(Context.isSupported()).toBe(true);

			// Should resolve without errors
			await expect(context.initCanvas(canvas)).resolves.toBeUndefined();

			// Verify if the internal properties were set correctly
			expect(context.device).toBe(mockDevice);
			expect(context.context).toBe(mockWebGpuContext);
			expect(context.format).toBe(mockFormat);

			// Verify if configure was called with correct arguments
			expect(mockWebGpuContext.configure).toHaveBeenCalledWith({
				device: mockDevice,
				format: mockFormat,
				alphaMode: "premultiplied",
			});
		});
	});
});
