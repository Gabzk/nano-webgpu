import { CameraController, Color, Scene, StandardMaterial } from "../../src";

async function main() {
	const canvas = document.getElementById("canvas") as HTMLCanvasElement;

	// Configuração para preencher a tela inteira
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	window.addEventListener("resize", () => {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
	});

	// Iniciar a Scene
	const scene = await Scene.init(canvas);
	scene.backgroundColor = Color.fromHex("#0d0d1a");

	// Habilitar painel de debug para ver FPS e os Draw Call
	scene.enableDebug({ position: "top-right" });

	const camera = scene.setCamera({
		position: [0, 5, 20],
		target: [0, 0, 0],
	});
	camera.controller = new CameraController(camera, "orbit", {
		center: [0, 0, 0],
		distance: 20,
	});

	// Adicionar luz
	scene.addLight({
		type: "directional",
		rotationDegrees: [-45, 45, 0],
		color: "#ffffff",
		intensity: 1.0,
	});

	scene.addLight({
		type: "point",
		position: [0, 10, 0],
		color: "#00e5ff",
		intensity: 2.0,
	});

	// ==========================================
	// FEATURE 3: scene.buildMesh()
	// ==========================================
	// Criação de geometria do zero de forma super simples
	const triangle = scene.buildMesh({
		vertexFormat: ["position"],
		// Array raw com posições(xyz)
		vertexBuffer: [
			-0.5,
			-0.5,
			0, // Vértice 1
			0.5,
			-0.5,
			0, // Vértice 2
			0.0,
			0.5,
			0, // Vértice 3
		],
		topology: "triangles",
		material: new StandardMaterial({ albedoColor: "#ffffff", roughness: 0.2 }),
		addToScene: false,
	});

	const cubeTemplate = scene.addCube({
		size: 1,
		material: new StandardMaterial({
			albedoColor: "#00e5ff",
			roughness: 0.1,
			metallic: 0.8,
		}),
		addToScene: false,
	});

	// ==========================================
	// FEATURE 2: AUTO-BATCHING / INSTANCING
	// ==========================================
	const spacing = 2;
	const count = 25; // 25x25x4 = 2500 cubos
	const offset = (count * spacing) / 2;

	// 1. Instanciando 2500 cubos a partir do template (1 Draw Call!)
	for (let x = 0; x < count; x++) {
		for (let z = 0; z < count; z++) {
			for (let y = 0; y < 4; y++) {
				scene.addMesh(cubeTemplate, {
					position: [x * spacing - offset, y * spacing, z * spacing - offset],
				});
			}
		}
	}

	// 2. Instanciando 2000 triângulos customizados a partir do template buildMesh (1 Draw Call!)
	for (let x = 0; x < 20; x++) {
		for (let z = 0; z < 100; z++) {
			const clone = scene.addMesh(triangle, {
				position: [
					x * spacing * 2 - 20,
					10 + Math.random() * 5,
					z * spacing - 100,
				],
			});
			clone.rotationDegrees.x = Math.random() * 360;
			clone.rotationDegrees.y = Math.random() * 360;
		}
	}

	// ==========================================
	// RENDER LOOP
	// ==========================================
	scene.render((dt) => {
		// Animações dos triângulos para mostrar que são entidades separadas
		const time = performance.now() / 1000;
		let i = 0;
		for (const mesh of scene.meshes) {
			if (mesh.geometry === triangle.geometry && mesh.visible) {
				mesh.rotationDegrees.y += 45 * dt;
				mesh.position.y += Math.sin(time * 2 + i) * 0.01;
				mesh.isDirty = true; // Marca para atualizar a matriz (Single Thread!)
			}
			i++;
		}
	});
}

main().catch((err) => console.error(err));
