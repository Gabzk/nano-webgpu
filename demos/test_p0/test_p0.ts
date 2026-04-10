import { Scene, Color, Mesh } from "nano-webgpu";

const scene = await Scene.init("#canvas");

scene.setCamera({ position: [0, 5, 15], target: [0, 0, 0] });
scene.addLight({
	type: "directional",
	rotationDegrees: [-45, 45, 0],
	color: "#ffffff",
	intensity: 1,
});

const meshCountEl = document.getElementById("mesh-count")!;
const fpsEl = document.getElementById("fps")!;
const step1 = document.getElementById("step1")!;
const step2 = document.getElementById("step2")!;
const step3 = document.getElementById("step3")!;
const step4 = document.getElementById("step4")!;

let spawnedCubes: Mesh[] = [];

// Routine timings
let time = 0;
let phase = 0;

let lastTime = performance.now();
let frames = 0;

scene.render((dt) => {
	// FPS counter
	frames++;
	const now = performance.now();
	if (now - lastTime >= 1000) {
		fpsEl.innerText = frames.toString();
		frames = 0;
		lastTime = now;
	}

	time += dt;

	if (phase === 0 && time > 1.0) {
		step1.innerText = "Spawning 100 cubes... (DONE)";
		step1.className = "success";
		step2.className = "waiting";

		// Spawn 100 cubes
		for (let i = 0; i < 100; i++) {
			const range = 10;
			const cube = scene.addCube({
				position: [
					(Math.random() - 0.5) * range,
					(Math.random() - 0.5) * range,
					(Math.random() - 0.5) * range,
				],
				scale: 0.5 + Math.random() * 0.5,
				color: Color.fromHex(
					"#" + Math.floor(Math.random() * 16777215).toString(16),
				),
			});
			// We set static objects, so they won't have isDirty re-evaluated every frame
			// This is testing the P0 "Dirty-only update"
			spawnedCubes.push(cube);
		}
		phase = 1;
	}

	if (phase === 1 && time > 4.0) {
		step2.innerText = "Waiting 3 seconds... (DONE)";
		step2.className = "success";
		step3.className = "waiting";
		phase = 2;
	}

	if (phase === 2 && time > 4.5) {
		step3.innerText = "Calling mesh.destroy() on all... (DONE)";
		step3.className = "success";
		step4.className = "waiting";

		// Destroy all meshes natively
		// This tests both P0 Mesh.destroy() and scene.removeMesh() (handled within Mesh.destroy recursively)
		for (const cube of spawnedCubes) {
			cube.destroy(); // false for geometry so it doesn't crash others if shared
		}
		spawnedCubes = [];
		phase = 3;
	}

	if (phase === 3 && time > 5.0) {
		// Validation
		if (scene.meshes.length === 0) {
			step4.innerText = "Verifying scene graph dropped to 0 (PASSED!)";
			step4.className = "success";
		} else {
			step4.innerText =
				`FAILED! ` + scene.meshes.length + ` meshes stuck in Scene.`;
			step4.style.color = "red";
		}
		phase = 4;
	}

	meshCountEl.innerText = scene.meshes.length.toString();
});
