import { Input, InputManager, Scene } from "nano-webgpu";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const scene = await Scene.init("#canvas");

scene.setCamera({ position: [0, 2, 5] });

scene.addPlane({
	position: [0, -0.94, -3],
	scale: 10,
	color: "#339933",
});

const shiba = await scene.loadMesh(`./assets/shiba.glb`, {
	position: [-1, 0, 0],
	scale: 1,
	rotation: [-1.5, 0.5, 0],
});

scene.instantiate(shiba, {
	position: [1, 0, 0],
	rotation: [-1.5, -0.5, 0],
});

// sun
scene.addLight({
	type: "directional",
	rotationDegrees: [-135, 0, 0],
	color: "#ffffff",
	intensity: 0.5,
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

scene.render((_dt) => {
	if (canvas.width !== innerWidth || canvas.height !== innerHeight) {
		canvas.width = innerWidth;
		canvas.height = innerHeight;
	}
});