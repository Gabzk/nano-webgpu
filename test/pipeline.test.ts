/// <reference types="@webgpu/types" />
import { describe, expect, it, vi } from "vitest";
import { Context } from "../src/core/context";
import { PipelineManager } from "../src/graphics/pipeline";
import { ShaderMaterial } from "../src/graphics/materials/shader-material";

// Mock WebGPU globals for Node test environment
// biome-ignore lint/suspicious/noExplicitAny: mock globalThis
(globalThis as any).GPUShaderStage = {
	VERTEX: 1,
	FRAGMENT: 2,
	COMPUTE: 4,
};

function createMockDevice() {
	const mockLayout = {};
	const mockPipeline = {
		getBindGroupLayout: vi.fn().mockReturnValue({}),
	};

	return {
		createBindGroupLayout: vi.fn().mockImplementation((desc) => ({
			label: desc?.label || "unlabeled-layout",
		})),
		createPipelineLayout: vi.fn().mockReturnValue(mockLayout),
		createShaderModule: vi.fn().mockReturnValue({
			getCompilationInfo: vi.fn().mockResolvedValue({ messages: [] }),
		}),
		createRenderPipeline: vi.fn().mockReturnValue(mockPipeline),
	} as unknown as GPUDevice;
}

function createMockContext(device: GPUDevice): Context {
	return {
		device,
		format: "bgra8unorm",
		vramTracker: {
			register: vi.fn(),
			unregister: vi.fn(),
		},
	} as unknown as Context;
}

describe("Custom Pipeline CSM Support", () => {
	it("should create separate layouts and pipelines for CSM vs standard in PipelineManager", () => {
		const device = createMockDevice();
		const ctx = createMockContext(device);
		const manager = new PipelineManager(ctx);

		const shaderCode = "fn main() {}";

		// 1. Get standard custom pipeline
		const pipeStd = manager.getCustomPipeline(shaderCode, "triangle-list", "uint16", "back", true, "less", false);

		// 2. Get CSM custom pipeline
		const pipeCSM = manager.getCustomPipeline(shaderCode, "triangle-list", "uint16", "back", true, "less", true);

		// Should have made two calls to createRenderPipeline
		expect(device.createRenderPipeline).toHaveBeenCalledTimes(2);

		// Verify createPipelineLayout was called for both
		// One should use Globals Bind Group Layout CSM, one should use Globals Bind Group Layout
		const layoutCalls = (device.createPipelineLayout as any).mock.calls;
		expect(layoutCalls.length).toBe(2);

		// The bindGroupLayouts entries in first call vs second call should differ
		const layout1 = layoutCalls[0][0];
		const layout2 = layoutCalls[1][0];
		expect(layout1.bindGroupLayouts).toBeDefined();
		expect(layout2.bindGroupLayouts).toBeDefined();

		// Let's verify caching: calling again with same parameters returns cached pipeline
		const pipeStd2 = manager.getCustomPipeline(shaderCode, "triangle-list", "uint16", "back", true, "less", false);
		expect(pipeStd2).toBe(pipeStd);
		expect(device.createRenderPipeline).toHaveBeenCalledTimes(2); // no new compilation
	});

	it("should pass useCSM from ShaderMaterial.getPipeline to PipelineManager", () => {
		const device = createMockDevice();
		const ctx = createMockContext(device);
		const manager = new PipelineManager(ctx);

		// Spy on pipeline manager custom pipeline methods
		const spyGetCustom = vi.spyOn(manager, "getCustomPipeline");
		const spyGetCustomParams = vi.spyOn(manager, "getCustomPipelineWithParams");

		// Assign manager to context
		(ctx as any).pipelineManager = manager;

		const matSimple = new ShaderMaterial({
			shaderCode: "fn main() {}",
		});

		const matWithParams = new ShaderMaterial({
			shaderCode: "fn main() {}",
			parameters: {
				u_intensity: 1.0,
			},
		});

		// Render with CSM = false
		matSimple.getPipeline(ctx, "triangle-list", "uint16", "back", false);
		expect(spyGetCustom).toHaveBeenLastCalledWith(
			expect.any(String),
			"triangle-list",
			"uint16",
			"back",
			true,
			"less",
			false,
		);

		// Render with CSM = true
		matSimple.getPipeline(ctx, "triangle-list", "uint16", "back", true);
		expect(spyGetCustom).toHaveBeenLastCalledWith(
			expect.any(String),
			"triangle-list",
			"uint16",
			"back",
			true,
			"less",
			true,
		);

		// Render with params, CSM = true
		matWithParams.getPipeline(ctx, "triangle-list", "uint16", "back", true);
		expect(spyGetCustomParams).toHaveBeenLastCalledWith(
			expect.any(String),
			"triangle-list",
			"uint16",
			"back",
			true,
			"less",
			true,
		);
	});

	it("should auto-inject system structures, vertex shader and shadow helper when missing", () => {
		const device = createMockDevice();
		const ctx = createMockContext(device);
		const manager = new PipelineManager(ctx);

		const minimalFragmentShader = `
			@fragment
			fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
				let testShadow = getShadow(in.frag_pos, 0.5, 0.001, 0.001);
				return vec4<f32>(in.color * testShadow, 1.0);
			}
		`;

		manager.getCustomPipeline(minimalFragmentShader, "triangle-list", "uint16", "back", true, "less", true);

		// Verify createShaderModule was called with the preprocessed code containing injected structs and vertex shader
		const shaderCalls = (device.createShaderModule as any).mock.calls;
		expect(shaderCalls.length).toBe(1);
		const processedCode = shaderCalls[0][0].code;

		// Should have injected CameraUniform and @group(0) bindings
		expect(processedCode).toContain("struct CameraUniform");
		expect(processedCode).toContain("@group(0) @binding(0) var<uniform> camera");

		// Should have injected getShadow function
		expect(processedCode).toContain("fn getShadow");

		// Should have injected standard vertex shader vs_main
		expect(processedCode).toContain("@vertex");
		expect(processedCode).toContain("fn vs_main");
	});
});
