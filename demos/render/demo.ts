import { Scene } from "nano-webgpu";

// Inicializando o WebGPU e a Scene de uma vez só (mantive o await para evitar engasgos no runtime)
const scene = await Scene.init("#canvas");

// Configurando a câmera com atributos simples
const _camera = scene.setCamera({ position: [0, 2, 5] });

// scene.setDefaultDir("./assets/shiba");

scene.addPlane({
	position: [0, -0.94, -3],
	scale: 10,
	color: "#4f7c55",
});

// Adicionando Mesh do GLTF nativamente (Materiais serão auto-inferidos visualmente)
const shiba = await scene.addMesh(`./assets/shiba.glb`, {
	position: [-1, 0, 0],
	scale: 1,
	rotation: [-1.5, 0.5, 0], // em radianos
});

scene.addMesh(shiba, {
	position: [1, 0, 0],
	rotation: [-1.5, -0.5, 0],
});

// Adicionando luzes via opções fáceis
const sun = scene.addLight({
	type: "directional",
	rotationDegrees: [-45, 45, 0],
	color: "#ffffff",
	intensity: 1,
	castShadow: true,
	shadowMapSize: 256,
	usePCF: 1,
});

scene.addLight({
	type: "point",
	position: [2, 1, 0],
	color: "#ffffff",
	intensity: 1,
});

scene.enableDebug({
	opacity: 0.5,
	position: "top-right",
});

// Loop de renderização totalmente gerenciado pela Scene
scene.render((_dt) => {
	// sun.rotationDegrees.y += 90 * dt;
});
