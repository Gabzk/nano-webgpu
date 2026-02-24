import { Context, Loader, VERSION } from "nano-webgpu";

console.log(`Loading Nano WebGPU v${VERSION}`);

const statusEl = document.getElementById("status");

async function main() {
	if (!Context.isSupported()) {
		if (statusEl) {
			statusEl.textContent = "WebGPU is NOT supported by your browser.";
			statusEl.className = "status error";
		}
		return;
	}

	if (statusEl) {
		statusEl.textContent = "WebGPU is supported!";
		statusEl.className = "status success";
	}

	const canvas = document.getElementById("canvas") as HTMLCanvasElement;
	const context = new Context();
	await context.init(canvas);

	console.log("WebGPU initialized successfully!");
	console.log("Device:", context.device);
	console.log("Context:", context.context);
	console.log("Format:", context.format);

	const loader = new Loader(context.device);
	const texture = await loader.loadTexture("./grass.jpg");
	console.log("Texture loaded:", texture);

	const shaderModule = await loader.loadShader("./shader.wgsl");

	const pipelineLayout = context.device.createPipelineLayout({
		bindGroupLayouts: [
			context.device.createBindGroupLayout({
				entries: [
					{ binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
					{ binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
					{
						binding: 2,
						visibility: GPUShaderStage.VERTEX,
						buffer: { type: "uniform" },
					},
				],
			}),
		],
	});

	const pipeline = context.device.createRenderPipeline({
		layout: pipelineLayout,
		vertex: {
			module: shaderModule,
			entryPoint: "vs_main",
		},
		fragment: {
			module: shaderModule,
			entryPoint: "fs_main",
			targets: [{ format: context.format }],
		},
		primitive: { topology: "triangle-list" },
	});

	const sampler = context.device.createSampler({
		magFilter: "linear",
		minFilter: "linear",
	});

	// Create uniform buffer for time and aspect ratio
	const uniformBuffer = context.device.createBuffer({
		size: 16, // 16 bytes (multiple of 16 required for uniforms)
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	});

	const uniformData = new Float32Array(4); // 4 floats = 16 bytes
	uniformData[1] = canvas.width / canvas.height; // aspect ratio
	context.device.queue.writeBuffer(uniformBuffer, 0, uniformData);

	const bindGroup = context.device.createBindGroup({
		layout: pipeline.getBindGroupLayout(0),
		entries: [
			{ binding: 0, resource: sampler },
			{ binding: 1, resource: texture.createView() },
			{ binding: 2, resource: { buffer: uniformBuffer } },
		],
	});

	const startTime = performance.now();

	function render() {
		const now = performance.now();
		const time = (now - startTime) / 1000.0;

		// Update time uniform
		uniformData[0] = time;
		context.device.queue.writeBuffer(uniformBuffer, 0, uniformData);

		const commandEncoder = context.device.createCommandEncoder();
		const textureView = context.context.getCurrentTexture().createView();

		const renderPass = commandEncoder.beginRenderPass({
			colorAttachments: [
				{
					view: textureView,
					clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
					loadOp: "clear",
					storeOp: "store",
				},
			],
		});

		renderPass.setPipeline(pipeline);
		renderPass.setBindGroup(0, bindGroup);
		renderPass.draw(6);
		renderPass.end();

		context.device.queue.submit([commandEncoder.finish()]);
		requestAnimationFrame(render);
	}

	render();
}

main();
