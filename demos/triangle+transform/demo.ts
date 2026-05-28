import { Scene, StandardMaterial } from "nano-webgpu";

const scene = await Scene.init("#canvas");
scene.setCamera({ position: [0, 2, 7] });
scene.backgroundColor = "#c6c6c6";

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
let time = 0;
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

	// Tempoa acumulado para animação do seno
	time += scene.getRenderInfo().dt;
	// Rotação
	tri.rotationDegrees.y += 60 * scene.getRenderInfo().dt;
	// Posição oscilando com animação de seno
	tri.position.y = Math.sin(time * 2) * 0.5;
});
