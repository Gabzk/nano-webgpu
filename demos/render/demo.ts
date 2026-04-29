import { Input, InputManager, Scene } from "nano-webgpu";

// Inicializando o WebGPU e a Scene de uma vez só (mantive o await para evitar engasgos no runtime)
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const scene = await Scene.init("#canvas");

canvas.height = window.innerHeight;
canvas.width = window.innerWidth;

scene.enableFXAA = true;

// Configurando a câmera com atributos simples
scene.setCamera({ position: [0, 2, 5] });

// scene.setDefaultDir("./assets/shiba");

scene.addPlane({
	position: [0, -0.94, -3],
	scale: 10,
	color: "#339933",
});

// Adicionando Mesh do GLTF nativamente (Materiais serão auto-inferidos visualmente)
const shiba = await scene.loadMesh(`./assets/shiba.glb`, {
	position: [-1, 0, 0],
	scale: 1,
	rotation: [-1.5, 0.5, 0], // em radianos
});

scene.instantiate(shiba, {
	position: [1, 0, 0],
	rotation: [-1.5, -0.5, 0],
});

const cube = scene.addCube()

// Adicionando luzes via opções fáceis
const sun = scene.addLight({
	type: "directional",
	rotationDegrees: [-90 ,0, 0],
	color: "#ffffff",
	intensity: 0.5,
	castShadow: true,
	shadowMapSize: 4096,
	usePCF: true,
});

scene.addLight({
	type: "point",
	position: [2, 1, 0],
	color: "#ffffff",
	intensity: 1,
	castShadow: true,
	shadowMapSize: 256,
});

scene.enableDebug({
	opacity: 0.5,
	position: "top-right",
});


scene.render((_dt) => {

});

