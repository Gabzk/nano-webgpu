import { Scene, Color } from "nano-webgpu";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const scene = await Scene.init(canvas);

scene.setCamera({ position: [0, 2, 8], target: [0, 0, 0] });
scene.backgroundColor = Color.fromHex("#1a1a2e");

scene.addLight({
	type: "directional",
	color: "#ffffff",
	intensity: 1,
	rotationDegrees: [-30, 45, 0],
});
scene.addLight({
	type: "point",
	position: [2, 2, 2],
	color: "#ff00ff",
	intensity: 2,
});

// Referencial de Centro (Sempre visível)
const centerSphere = scene.addSphere({
	position: [0, 0, 0],
	scale: 0.3,
	material: { albedoColor: "#00e5ff", roughness: 0.2, metallic: 0.8 },
});

// Cubo que vamos ocultar
const orbitingCube = scene.addCube({
	position: [3, 0, 0],
	scale: 1,
	material: { albedoColor: "#ff0055", roughness: 0.5, metallic: 0.1 },
});

// Pegando UI
const btn = document.getElementById("toggle-btn")!;

btn.addEventListener("click", () => {
	orbitingCube.visible = !orbitingCube.visible;

	if (orbitingCube.visible) {
		btn.innerText = "Ocultar Cubo";
		btn.style.background = "#00e5ff";
	} else {
		btn.innerText = "Revelar Cubo";
		btn.style.background = "#ff4444";
	}
});

let time = 0;

scene.render((dt) => {
	if (canvas.width != innerWidth || canvas.height != innerHeight) {
		canvas.width = innerWidth;
		canvas.height = innerHeight;
	}

	time += dt;

	// Nós fazemos o cubo orbitar e rodar o tempo todo, mesmo quando orbitingCube.visible == false.
	// Isso prova que a matemática do "Node3D" continua correndo na CPU (ótimo pra física),
	// apenas não é despachado para forçar a GPU.

	orbitingCube.position.set(
		Math.cos(time * 2) * 3, // Orbita X
		Math.sin(time * 4) * 1, // Sobe e desce suavemente V
		Math.sin(time * 2) * 3, // Orbita Z
	);

	orbitingCube.rotationDegrees = [time * 50, time * 100, time * 25];
});
