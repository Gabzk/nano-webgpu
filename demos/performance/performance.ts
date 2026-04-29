import { Scene, StandardMaterial } from "nano-webgpu";

const scene = await Scene.init("#canvas");
scene.setCamera({ position: [0, 4, 12], target: [0, 0, 0] });
scene.addLight({
	type: "directional",
	rotationDegrees: [-50, 30, 0],
	color: "#ffeedd",
	intensity: 0.8,
});
scene.addLight({
	type: "point",
	position: [0, 3, 0],
	color: "#4488ff",
	intensity: 1.5,
});
scene.enableDebug({ position: "top-right" });
const colors = [
	"#e74c3c",
	"#e67e22",
	"#9b59b6",
	"#e91e63",
	"#ff5722",
	"#3498db",
	"#2ecc71",
	"#f1c40f",
];

const cubeTemplate = scene.addCube({ addToScene: false });

// Cache materials for each color to enable auto-batching
const materialCache = new Map<string, StandardMaterial>();
for (const color of colors) {
	materialCache.set(
		color,
		new StandardMaterial({
			albedoColor: color,
			roughness: 0.3,
			metallic: 0.5,
		}),
	);
}

function addCubes(n: number) {
	for (let i = 0; i < n; i++) {
		const color = colors[Math.floor(Math.random() * colors.length)];
		const material = materialCache.get(color);

		scene.instantiate(cubeTemplate, {
			position: [
				(Math.random() - 0.5) * 20,
				0.5 + Math.random() * 2,
				(Math.random() - 0.5) * 20,
			],
			scale: 0.5 + Math.random() * 0.8,
			material,
		});
	}
}

// Expose to window for the HTML buttons
(window as any).addCubes = addCubes;

// Start with 100 cubes to show performance
addCubes(100);

scene.render((dt) => {
	// Rotate all cubes
	for (const mesh of scene.meshes) {
		mesh.rotation.y += dt * 0.5;
	}
});
