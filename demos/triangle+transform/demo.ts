import { Scene } from "nano-webgpu";

const scene = await Scene.init("#canvas");
scene.setCamera({ position: [0, 2, 7] });

const tri = scene.buildMesh({
	vertexFormat: ["position", "color"],
	vertexBuffer: [
		// V1    R,G,B
		-1, 0, 0, 1, 0, 0,
		// V2    R,G,B
		1, 0, 0, 0, 1, 0,
		// V3    R,G,B
		0, 1, 0, 0, 0, 1,
	],
	topology: "triangle-list",
});

const sun = scene.addLight({
	type: "directional",
	rotationDegrees: [0, 0, 0],
	color: "#ffffff",
	intensity: 1,
	shadowBias: 0.001
});

const canvas = scene.getCanvas();

scene.render(() => {
	if (canvas.width != window.innerWidth || canvas.height != window.innerHeight) {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
	}
});