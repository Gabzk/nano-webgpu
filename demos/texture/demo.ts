import { Scene, Mesh } from "nano-webgpu";

const scene = await Scene.init("#canvas");
const camera = scene.setCamera({ position: [0, 2, 7] });
const canvas = scene.getCanvas();

scene.backgroundColor = "#000000";
scene.bloom.enabled = true;
scene.bloom.threshold = 0.65; // Extrai somente o brilho HDR real das runas
scene.bloom.intensity = 0.5;  // Intensidade suave e cinematográfica
scene.bloom.passes = 3;       // Lindo halo de dispersão

scene.ambientGroundColor = "#101010";
scene.ambientSkyColor = "#323232";
scene.showHelpers = false;

const crt = await scene.loadMesh("crt-tv.glb", {
	scale: 0.5,
	rotationDegrees: [-90, 0, 0],
	
});

const spotlight = scene.addLight({
	type: "spotlight",
	position: [0, 0, 0.1],
	rotationDegrees: [0, 180, 0],
	color: "#ffffff",
	intensity: 1,
	innerAngle: 40,
	outerAngle: 80,
	castShadow: true,
});

const plane = scene.addPlane({
	scale: 10,
	position: [0, -0.9, 0],
	material: {
		albedoTexture: "./Brick_Wall_028_SD/Brick_Wall_028_basecolor.png",
		roughnessTexture: "./Brick_Wall_028_SD/Brick_Wall_028_roughness.png",
		normalTexture: "./Brick_Wall_028_SD/Brick_Wall_028_normal.png",
		aoTexture: "./Brick_Wall_028_SD/Brick_Wall_028_ambientOcclusion.png",
		normalScale: 5
	}
});

const ctrl = camera.addController("orbit", {
	center: crt.position,
	distance: 7,
});

const sun = scene.addLight({
	type: "directional",
	rotationDegrees: [-75, 0, 0],
	color: "#ffffff",
	intensity: 0,
});


scene.enableDebug();

scene.render(() => {
	// Redimensiona o canvas para preencher a tela
	if (
		canvas.width != window.innerWidth ||
		canvas.height != window.innerHeight
	) {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
	}
});
