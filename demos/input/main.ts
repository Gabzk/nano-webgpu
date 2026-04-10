import {
	Camera,
	Context,
	Scene,
	StandardMaterial,
	Color,
	Input,
} from "../../src/index";

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

	// Camera
	const camera = scene.setCamera({ position: [0, 5, 10] });

	// Materials
	const cubeMaterial = new StandardMaterial({
		albedoColor: new Color(1.0, 1.0, 1.0, 1.0),
		metallic: 0.1,
		roughness: 0.4,
	});

	// Mesh
	const cube = scene.addCube({
		position: [0, 0, 0],
		scale: 1,
		material: cubeMaterial,
	});

	// Light
	scene.addLight({
		type: "directional",
		rotationDegrees: [-45, 45, 0],
		color: "#ffffff",
		intensity: 1,
	});

	// Variables
	let velocityY = 0;
	let isGrounded = true;
	const speed = 5.0;

	// Render loop
	scene.render((dt) => {
		// Atualiza o canvas em tempo real
		if (canvas.width != innerWidth || canvas.height != innerHeight) {
			canvas.width = innerWidth;
			canvas.height = innerHeight;
		}

		// Movement input
		if (Input.isActionPressed("ui_left")) {
			cube.position.x -= speed * dt;
		}
		if (Input.isActionPressed("ui_right")) {
			cube.position.x += speed * dt;
		}
		if (Input.isActionPressed("ui_up")) {
			cube.position.z -= speed * dt;
		}
		if (Input.isActionPressed("ui_down")) {
			cube.position.z += speed * dt;
		}

		// Jump logic
		if (Input.isActionJustPressed("ui_jump") && isGrounded) {
			velocityY = 10;
			isGrounded = false;
			// Juice effect squash and stretch
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
			// Pulse color
			const time = performance.now() / 1000;
			cubeMaterial.albedoColor.r = (Math.sin(time * 5) + 1) / 2;
			cubeMaterial.albedoColor.g = (Math.cos(time * 3) + 1) / 2;
		}

		// Mouse movement rotation
		cube.rotationDegrees.y += Input.mouseMovement.x * 0.5;
		cube.rotationDegrees.x += Input.mouseMovement.y * 0.5;
	});
}

main();
