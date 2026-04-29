import { Color, Input, Scene, StandardMaterial } from "../../src/index";

async function main() {
	// Config
	const canvas = document.getElementById("canvas") as HTMLCanvasElement;
	const scene = await Scene.init(canvas);
	const gravity = 25;

	// Input
	Input.addAction("ui_up", ["KeyW", "ArrowUp"]);
	Input.addAction("ui_down", ["KeyS", "ArrowDown"]);
	Input.addAction("ui_left", ["KeyA", "ArrowLeft"]);
	Input.addAction("ui_right", ["KeyD", "ArrowRight"]);
	Input.addAction("ui_jump", ["Space"]);
	Input.setMouseMode("captured");

	// Camera — 2 linhas para terceira pessoa!
	const camera = scene.setCamera({ position: [0, 5, 10] });

	// Materials
	const cubeMaterial = new StandardMaterial({
		albedoColor: new Color(1.0, 1.0, 1.0, 1.0),
		metallic: 0.1,
		roughness: 0.4,
	});

	const groundMaterial = new StandardMaterial({
		albedoColor: new Color(0.2, 0.2, 0.2, 1.0),
		metallic: 0.1,
		roughness: 0.4,
	});

	// Mesh
	const cube = scene.addCube({
		position: [0, 0, 0],
		scale: 1,
		material: cubeMaterial,
	});

	const _ground = scene.addCube({
		position: [0, -1, 0],
		scale: [10, 1, 10],
		material: groundMaterial,
	});

	// Light
	scene.addLight({
		type: "directional",
		rotationDegrees: [-45, 45, 0],
		color: "#ffffff",
		intensity: 1,
	});

	// Controller — câmera em 3ª pessoa automática!
	const ctrl = camera.addController("orbit", {
		center: [0, 0, 0],
		distance: 10,
		sensitivity: 0.003,
	});

	// Variables
	let velocityY = 0;
	let isGrounded = true;
	const speed = 5.0;

	// Render loop
	scene.render((dt) => {
		// Atualiza o canvas em tempo real
		if (canvas.width !== innerWidth || canvas.height !== innerHeight) {
			canvas.width = innerWidth;
			canvas.height = innerHeight;
		}

		// --- Movement input (relativo à câmera — ZERO trigonometria!) ---
		const forward = ctrl.getForward();
		const right = ctrl.getRight();

		let moveX = 0,
			moveZ = 0;
		if (Input.isActionPressed("ui_up")) {
			moveX += forward.x;
			moveZ += forward.z;
		}
		if (Input.isActionPressed("ui_down")) {
			moveX -= forward.x;
			moveZ -= forward.z;
		}
		if (Input.isActionPressed("ui_left")) {
			moveX += right.x;
			moveZ += right.z;
		}
		if (Input.isActionPressed("ui_right")) {
			moveX -= right.x;
			moveZ -= right.z;
		}

		// Normaliza diagonal para não andar mais rápido
		const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
		if (len > 0) {
			cube.position.x += (moveX / len) * speed * dt;
			cube.position.z += (moveZ / len) * speed * dt;
			// Cubo vira na direção do movimento
			cube.rotation.y = Math.atan2(moveX, moveZ);
		}

		// Jump logic
		if (Input.isActionJustPressed("ui_jump") && isGrounded) {
			velocityY = 10;
			isGrounded = false;
		}

		// Gravity
		if (!isGrounded) {
			velocityY -= gravity * dt;
			cube.position.y += velocityY * dt;

			if (cube.position.y <= 0) {
				cube.position.y = 0;
				isGrounded = true;
				velocityY = 0;
			}
		}

		// Change color while mouse left button is held
		if (Input.isMouseButtonPressed(0)) {
			const time = performance.now() / 1000;
			cubeMaterial.albedoColor.r = (Math.sin(time * 5) + 1) / 2;
			cubeMaterial.albedoColor.g = (Math.cos(time * 3) + 1) / 2;
		}
	});
}

main();
