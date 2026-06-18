import { Scene } from "nano-webgpu";

const scene = await Scene.init("#canvas");
const canvas = scene.canvas;
const camera = scene.setCamera({ position: [0, 3, 8] });
scene.backgroundColor = "#07070b";

scene.addPlane({
	position: [0, -2, 0],
	scale: 15,
	color: "#161622",
});

const shiba = await scene.loadMesh("./shiba.glb", {
	position: [0, 0, 0],
	scale: 1.6,
	rotationDegrees: [-90, 0, 0],
});
scene.addInstance(shiba, {
	position: [-2, -1, -1],
	scale: 1.0,
	rotationDegrees: [-90, 45, 0],
});
scene.addInstance(shiba, {
	position: [2, -1, 1],
	scale: 1.0,
	rotationDegrees: [-90, -45, 0],
});

const spotlight = scene.addLight({
	type: "spotlight",
	position: [0, 1, 5],
	rotationDegrees: [-45, 0, 0],
	color: "#00f0ff", // Vibrant neon cyan
	intensity: 3.5,
	innerAngle: 30,
	outerAngle: 50,
	range: 30.0,
});

scene.render(() => {
	if (canvas.width !== innerWidth || canvas.height !== innerHeight) {
		canvas.width = innerWidth;
		canvas.height = innerHeight;
	}
});