import { Input, InputManager, Scene } from "nano-webgpu";

const scene = await Scene.init("#canvas");
const canvasGetter = scene.canvas;
const canvasMethod = scene.getCanvas();

const camera = scene.setCamera({ position: [0, 2, 5] });

scene.defaultDir = "./assets";

scene.addPlane({
	position: [0, -0.94, -3],
	scale: 10,
	color: "green",
});

const shiba = await scene.loadMesh(`./shiba.glb`, {
	position: [-1, 0, 0],
	scale: 1,
	rotation: [-1.5, 0.5, 0],
});

scene.addInstance(shiba, {
	position: [1, 0, 0],
	rotation: [-1.5, -0.5, 0],
});

scene.addLight({
	type: "directional",
	rotationDegrees: [-45, 0, 0],
	color: "#ffffffff",
	intensity: 0.5,
	shadowBias: 0.0001,
});

scene.addLight({
	type: "point",
	position: [0, 3, 3],
	color: "#ffffff",
	intensity: 1,
});

scene.enableDebug({
	opacity: 0.5,
	position: "top-right",
});

camera.addController("orbit");

scene.render(() => {
	if (
		canvasGetter.width !== innerWidth ||
		canvasGetter.height !== innerHeight
	) {
		canvasGetter.width = innerWidth;
		canvasGetter.height = innerHeight;
	}
});
