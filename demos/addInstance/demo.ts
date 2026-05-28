import { Scene } from "nano-webgpu";

const scene = await Scene.init("#canvas");
// Position camera looking down the long runway, and add Orbit Controls
const camera = scene.setCamera({ position: [0, 5, 12], target: [0, 1, -15], far: 250 });
camera.addController("orbit", {
  center: [0, 1, -15],
  distance: 22,
  minPitch: -80,
  maxPitch: 80,
});

scene.backgroundColor = "#619bc0";

// A very long dramatic runway
scene.addPlane({
  position: [0, -0.94, -50], // Centered along z-axis runway
  scale: [15, 1, 120], // 15 units wide, 120 units long
  color: "#1a1a24",
  roughness: 0.7,
  metallic: 0.1,
});

// Load original mesh templates
const link = await scene.loadMesh("./link_cartoon.glb", {
  rotationDegrees: [-90, 30, 0],
  position: [-2.5, -0.5, 0],
  scale: [0.5, 0.5, 0.5]
});

const shiba = await scene.loadMesh("./shiba.glb", {
  position: [2.5, -0.5, 0],
  scale: [1.2, 1.2, 1.2],
  rotationDegrees: [0, -30, 0]
});

// List to track all characters for dynamic animations
const characters = [link, shiba];

// Add multiple instances of both characters stretching deep into the distance
const distances = [-15, -30, -45, -60, -80, -100];
for (const z of distances) {
  const linkInstance = scene.addInstance(link, {
    position: [-2.5, -0.5, z],
    scale: [0.5, 0.5, 0.5],
    rotationDegrees: [-90, 30, 0],
  });

  const shibaInstance = scene.addInstance(shiba, {
    position: [2.5, -0.5, z],
    scale: [1.2, 1.2, 1.2],
    rotationDegrees: [0, -30, 0],
  });

  characters.push(linkInstance, shibaInstance);
}

scene.enableDebug()

// Standard Directional Shadow mapping (stretched across the massive runway)
const sun = scene.addLight({
  type: "directional",
  rotationDegrees: [-135, 30, 0], // Slight angle to cast shadows across the runway
  color: "#ffffff",
  intensity: 0.5,
  castShadow: true,
  shadowMapSize: 8192,
  usePCF: true,
  shadowRadius: 75.0, // Stretched to 150 units wide/long to cover the runway
  shadowDepthRange: 250.0,
  shadowBias: 0.0001
});
scene.removeLight(sun); // Start with CSM active only

// CSM Directional Shadow mapping (4 split depth cascades for extreme near sharpness)
const csm = scene.addLight({
  type: "directional",
  rotationDegrees: [-135, 30, 0],
  color: "#ffffff",
  intensity: 0.5,
  castShadow: true,
  shadowMapSize: 8192,
  usePCF: true,
  useCSM: true,
  cascadeCount: 1,
  csmMaxDistance: 150.0,
  cascadeSplitLambda: 0.85,
  shadowBias: 0.0001
});

// Start with CSM by default
let activeLight = csm;

// Interactive UI elements binding
const activeText = document.getElementById("active-technique");
const toggleBtn = document.getElementById("toggle-light-btn");
const infoText = document.querySelector(".info-text");

if (toggleBtn && activeText && infoText) {
  toggleBtn.addEventListener("click", () => {
    scene.removeLight(activeLight);

    if (activeLight === csm) {
      activeLight = sun;
      activeText.textContent = "Standard Shadows";
      activeText.className = "value badge std-badge";
      toggleBtn.textContent = "Switch to CSM Shadows";
      infoText.innerHTML = "<b>Standard directional shadow mapping</b> uses a single orthographic projection matrix stretched over 150 units (shadowRadius = 75). Look closely at the near shadows: they look extremely pixelated, blurry, and jagged because the 4096px resolution is spread thin. Use <b>Left Click + Drag</b> to rotate camera and observe.";
    } else {
      activeLight = csm;
      activeText.textContent = "Cascaded Shadow Map (CSM)";
      activeText.className = "value badge csm-badge";
      toggleBtn.textContent = "Switch to Standard Shadows";
      infoText.innerHTML = "<b>Cascaded Shadow Maps (CSM)</b> splits the camera view frustum into 4 dynamic depth layers (cascades). Cascade 0 (near camera) only covers 10 units of distance, concentrating the shadow resolution right in front of your eyes for razor-sharp, block-free shadows. Use <b>Left Click + Drag</b> to inspect.";
    }

    scene.addLight(activeLight);
  });
}

const canvas = scene.getCanvas();

scene.render(() => {
  if (
    canvas.width != window.innerWidth ||
    canvas.height != window.innerHeight
  ) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
});
