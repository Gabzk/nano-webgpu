import { Scene } from "nano-webgpu";

// Initialize the WebGPU Scene in the canvas
const scene = await Scene.init("#canvas");
const canvas = scene.canvas;

// Configure camera with interactive orbit controls
const camera = scene.setCamera({ position: [0, 4, 8] });
camera.addController("orbit", {
	center: [0, 0, 0],
	distance: 8.5,
});

// Set premium dark background
scene.backgroundColor = "#07070b";

// Add a flat floor plane with standard standard-roughness material color
scene.addPlane({
	position: [0, -2, 0],
	scale: 15,
	color: "#161622",
});

// Load the high-quality Shiba GLB mesh in the center of the spotlight
const shiba = await scene.loadMesh("../render/assets/shiba.glb", {
	position: [0, -1, 0],
	scale: 1.6,
	rotation: [-Math.PI / 2, 0, 0],
});

// Add another decorative object next to the Shiba
scene.addInstance(shiba, {
	position: [-2, -1, -1],
	scale: 1.0,
	rotation: [-Math.PI / 2, 0, Math.PI / 4],
});

scene.addInstance(shiba, {
	position: [2, -1, 1],
	scale: 1.0,
	rotation: [-Math.PI / 2, 0, -Math.PI / 4],
});

// Add a dim, blueish directional light as ambient fill moonlight
scene.addLight({
	type: "directional",
	rotationDegrees: [-45, 45, 0],
	color: "#2a2a44",
	intensity: 0.25,
	castShadow: false,
});

// Add the premium, shadow-casting cyan SpotLight
const spotlight = scene.addLight({
	type: "spotlight",
	position: [0, 1, 5],
	rotationDegrees: [-45, 0, 0],
	color: "#00f0ff", // Vibrant neon cyan
	intensity: 3.5,
	castShadow: true,
	shadowMapSize: 2048,
	usePCF: true,
	innerAngle: 30,
	outerAngle: 50,
	range: 30.0,

});

console.log(spotlight.getShadowConfig(	));

// Expose standard performance visual overlays
scene.enableDebug({
	opacity: 0.8,
	position: "top-right",
});

// Main render loop
let time = 0;
scene.render(() => {
	// Keep canvas size responsive
	if (canvas.width !== innerWidth || canvas.height !== innerHeight) {
		canvas.width = innerWidth;
		canvas.height = innerHeight;
	}

	// Dynamic spotlight animation to showcase real-time PSM shadow recalculation
	time += 0.008;
	const coneYaw = Math.sin(time) * 30; // Swings left and right by 30 degrees
	const conePitch = -65 + Math.cos(time * 2.0) * 8; // Slight pitch animation
	spotlight.rotationDegrees.set(conePitch, coneYaw, 0);
});
