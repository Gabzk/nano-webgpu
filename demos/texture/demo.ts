import { Scene } from "nano-webgpu";

const scene = await Scene.init("#canvas");
scene.backgroundColor = "lightblue";
const camera = scene.setCamera({ position: [0, 2, 7] });
const canvas = scene.getCanvas();

const cube = scene.addCube({ scale: 1.5, position: [0, 0, 0] });

cube.loadTexture("./Brick_Wall_028_SD/Brick_Wall_028_basecolor.png"); // Isso é um proxy para facilitar texturização para iniciantes
// também é possível usar o material para configurar texturas de forma mais detalhada
// é redundante aqui, mas mostra como acessar o material para configurar texturas individualmente: 
cube.material.albedoTexture = "./Brick_Wall_028_SD/Brick_Wall_028_basecolor.png"; // 
cube.material.roughnessTexture = "./Brick_Wall_028_SD/Brick_Wall_028_roughness.png";
cube.material.normalTexture = "./Brick_Wall_028_SD/Brick_Wall_028_normal.png";
cube.material.aoTexture = "./Brick_Wall_028_SD/Brick_Wall_028_ambientOcclusion.png";


const sun = scene.addLight({
	type: "directional",
	rotationDegrees: [-75, 0, 0],
	color: "#ffffff",
	intensity: 0.5,
});

scene.render(() => {
	if (canvas.width != window.innerWidth || canvas.height != window.innerHeight) {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
	}
});