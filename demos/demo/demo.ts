import { Scene } from "nano-webgpu";

// Inicializando o WebGPU e a Scene de uma vez só (mantive o await para evitar engasgos no runtime)
const scene = await Scene.init("#canvas");

// Configurando a câmera com atributos simples
const camera = scene.setCamera({ position: [0, 2, 5] });

// scene.setDefaultDir("./assets/shiba");

scene.addPlane({
	position: [0, -1.5, -3],
	scale: 10,
	color: "#453232",
});

// Adicionando Mesh do GLTF nativamente (Materiais serão auto-inferidos visualmente)
const shiba = await scene.addMesh(`./assets/shiba.glb`, {
	position: [0, 0, 0],
	scale: 1,
	rotation: [-1.5, 0.5, 0], // em radianos
});

// Adicionando luzes via opções fáceis
const dirLight = scene.addLight({
	type: "directional",
	rotationDegrees: [-45, 45, 0],
	color: "#ffffff",
	intensity: 1,
});
scene.addLight({
	type: "point",
	position: [2, 1, 0],
	color: "#ffffff",
	intensity: 1,
});

let fpsElement = document.getElementById("fps-value");

// Loop de renderização totalmente gerenciado pela Scene
scene.render((dt) => {
	let fps = 1 / dt;
	fpsElement.textContent = fps.toFixed(0);
	// Agora giramos a luz igual fazemos no Node3D da Godot Engine!
	dirLight.rotationDegrees.y += 90 * dt;
});
