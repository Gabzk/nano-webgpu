/**
 * 🎮 CUBE RUNNER — Mini jogo feito inteiramente com nano-webgpu
 *
 * Objetivo: Desviar dos cubos vermelhos que se aproximam.
 * Controles: A/D ou ←/→ para mover, ESPAÇO para reiniciar.
 *
 * Este jogo serve como stress-test da biblioteca, exercitando:
 * - Scene.init(), setCamera(), addLight(), addCube(), addSphere(), addPlane()
 * - Node3D position/rotation/scale por frame
 * - StandardMaterial com cores distintas
 * - Vec3 para colisão por distância
 * - ctx.run(dt) como game loop
 * - Color.fromHex() e Color.lerp()
 */

import {
	Camera,
	Color,
	DirectionalLight,
	Input,
	type Mesh,
	type PointLight,
	Scene,
	StandardMaterial,
	Vec3,
} from "nano-webgpu";

const fpsValue = document.getElementById("fps-value")!;

// ===================== CONFIGURAÇÃO DA CENA =====================

const scene = await Scene.init("#canvas");

const camera = scene.setCamera({
	position: [0, 4, 8],
	target: [0, 0, -5],
});

scene.backgroundColor = Color.fromHex("#0a0a1a");

// Luzes
const sun = scene.addLight({
	type: "directional",
	rotationDegrees: [-50, 30, 0],
	color: "#ffeedd",
	intensity: 0.8,
});

const orbLight = scene.addLight({
	type: "point",
	position: [0, 3, 0],
	color: "#4488ff",
	intensity: 1.5,
}) as PointLight;

// ===================== CENÁRIO =====================

// Chão
const floor = scene.addPlane({
	scale: 30,
	position: [0, -0.5, -10],
	material: new StandardMaterial({
		albedoColor: "#1a1a2e",
		roughness: 0.9,
		metallic: 0.1,
	}),
});

// Paredes laterais (limites visuais)
const wallMaterial = new StandardMaterial({
	albedoColor: "#16213e",
	roughness: 0.7,
	metallic: 0.3,
});

const leftWall = scene.addCube({
	position: [-5.5, 0.5, -10],
	scale: [0.3, 2, 30],
	material: wallMaterial,
});

const rightWall = scene.addCube({
	position: [5.5, 0.5, -10],
	scale: [0.3, 2, 30],
	material: wallMaterial,
});

// ===================== JOGADOR =====================

const player = await scene.addMesh("../render/assets/shiba.glb", {
	position: [0, 0, 2],
	scale: 0.5,
	rotation: [-1.5, 0, 0],
});

// ===================== ESTADO DO JOGO =====================

interface Obstacle {
	mesh: Mesh;
	speed: number;
	passed: boolean;
}

let obstacles: Obstacle[] = [];
let score = 0;
let gameOver = false;
let gameTime = 0;
let spawnTimer = 0;
let difficulty = 1;

// Faixa de movimento do jogador (eixo X)
const LANE_MIN = -4.5;
const LANE_MAX = 4.5;
const PLAYER_SPEED = 8.0;
const SPAWN_Z = -35; // de onde vêm os cubos
const DESPAWN_Z = 6; // onde somem (atrás do jogador)

// Pool de materiais para os obstáculos (diversidade visual)
const obstacleMaterials = [
	new StandardMaterial({
		albedoColor: "#e74c3c",
		roughness: 0.3,
		metallic: 0.6,
	}),
	new StandardMaterial({
		albedoColor: "#e67e22",
		roughness: 0.4,
		metallic: 0.5,
	}),
	new StandardMaterial({
		albedoColor: "#9b59b6",
		roughness: 0.3,
		metallic: 0.7,
	}),
	new StandardMaterial({
		albedoColor: "#e91e63",
		roughness: 0.2,
		metallic: 0.8,
	}),
	new StandardMaterial({
		albedoColor: "#ff5722",
		roughness: 0.5,
		metallic: 0.4,
	}),
];

// ===================== INPUT =====================

Input.addAction("left", ["KeyA", "ArrowLeft"]);
Input.addAction("right", ["KeyD", "ArrowRight"]);
Input.addAction("confirm", ["Space"]);

// ===================== HUD (DOM) =====================
// (Gap #2: sem sistema de UI/Texto na lib)

const scoreEl = document.getElementById("score")!;
const gameOverEl = document.getElementById("game-over")!;
const finalScoreEl = document.getElementById("final-score")!;

function updateHUD() {
	scoreEl.textContent = `${Math.floor(score)}`;
	if (gameOver) {
		gameOverEl.style.display = "flex";
		finalScoreEl.textContent = `${Math.floor(score)}`;
	} else {
		gameOverEl.style.display = "none";
	}
}

// ===================== SPAWNING =====================

function spawnObstacle() {
	const x = LANE_MIN + Math.random() * (LANE_MAX - LANE_MIN);
	const mat =
		obstacleMaterials[Math.floor(Math.random() * obstacleMaterials.length)];
	const cubeSize = 0.6 + Math.random() * 0.6;

	const cube = scene.addCube({
		position: [x, cubeSize / 2, SPAWN_Z],
		scale: cubeSize,
		material: mat,
	});

	obstacles.push({
		mesh: cube,
		speed: 8 + difficulty * 2 + Math.random() * 3,
		passed: false,
	});
}

// ===================== REMOÇÃO DE OBSTÁCULOS =====================
// (Gap #3: scene.meshes[] não tem removeMesh(), temos que fazer manual)

function removeObstacle(obs: Obstacle) {
	// Remove do scene graph (Node.remove)
	scene.remove(obs.mesh);
	// Remove da lista interna de meshes da Scene
	const idx = scene.meshes.indexOf(obs.mesh);
	if (idx !== -1) scene.meshes.splice(idx, 1);
	// NOTA: Sem .destroy() nos GPUBuffers! Memory leak potencial.
	// Gap #4: sem cleanup de GPU resources
}

// ===================== RESTART =====================

function restartGame() {
	// Limpar todos os obstáculos
	for (const obs of obstacles) {
		removeObstacle(obs);
	}
	obstacles = [];
	score = 0;
	gameTime = 0;
	spawnTimer = 0;
	difficulty = 1;
	gameOver = false;
	player.position.set(0, 0, 2);
	player.rotation.set(-1.5, 0, 0);
	updateHUD();
}

// ===================== GAME LOOP =====================

scene.render((dt) => {
	// Clamp dt para evitar saltos grandes (ex: ao trocar de aba)

	fpsValue.textContent = `${Math.floor(1 / dt)}`;

	dt = Math.min(dt, 0.1);

	if (gameOver) {
		// Apenas anima a luz orbitando enquanto em game over
		orbLight.position.set(
			Math.sin(gameTime * 0.5) * 5,
			3,
			Math.cos(gameTime * 0.5) * 5,
		);
		gameTime += dt;

		if (Input.isActionJustPressed("confirm")) {
			restartGame();
		}

		return;
	}

	gameTime += dt;
	score += dt * 10 * difficulty;
	difficulty = 1 + gameTime / 15; // Aumenta dificuldade a cada 15s

	// --- Input do jogador ---
	let moveX = 0;
	if (Input.isActionPressed("left")) moveX -= 1;
	if (Input.isActionPressed("right")) moveX += 1;

	const px = player.position.x + moveX * PLAYER_SPEED * dt;
	player.position.x = Math.max(LANE_MIN, Math.min(LANE_MAX, px));

	// Rotação visual do shiba (inclina na direção do movimento)
	player.rotation.y = Math.PI; // Shiba olha para frente (em direção aos cubos)
	player.rotation.z = -moveX * 0.3; // Leve inclinação ao mover

	// --- Spawn de obstáculos ---
	const spawnInterval = Math.max(0.3, 1.2 - difficulty * 0.08);
	spawnTimer += dt;
	if (spawnTimer >= spawnInterval) {
		spawnObstacle();
		// Chance de spawnar duplo em dificuldade alta
		if (difficulty > 2 && Math.random() > 0.5) {
			spawnObstacle();
		}
		spawnTimer = 0;
	}

	// --- Atualizar obstáculos ---
	const toRemove: number[] = [];
	for (let i = 0; i < obstacles.length; i++) {
		const obs = obstacles[i];
		obs.mesh.position.z += obs.speed * dt;
		obs.mesh.rotation.y += dt * 2;
		obs.mesh.rotation.x += dt * 1.5;

		// Colisão via AABB (nano-webgpu CollisionShape — sem mais Math.sqrt manual!)
		if (player.intersects(obs.mesh)) {
			gameOver = true;
			updateHUD();
			return;
		}

		// Despawn
		if (obs.mesh.position.z > DESPAWN_Z) {
			toRemove.push(i);
		}
	}

	// Remover de trás pra frente pra não bagunçar os índices
	for (let i = toRemove.length - 1; i >= 0; i--) {
		removeObstacle(obstacles[toRemove[i]]);
		obstacles.splice(toRemove[i], 1);
	}

	// --- Luz orbital ---
	orbLight.position.set(
		Math.sin(gameTime * 2) * 4,
		2 + Math.sin(gameTime * 3) * 0.5,
		player.position.z + Math.cos(gameTime * 2) * 4,
	);

	// --- HUD ---
	updateHUD();
});
