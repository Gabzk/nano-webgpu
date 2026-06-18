import { Scene } from "nano-webgpu";

const scene = await Scene.init("#canvas");
const canvas = scene.getCanvas();

scene.setCamera({ position: [0, 5, 12] });
scene.backgroundColor = "#619bc0";

scene.addPlane({
  position: [0, -0.94, 0],
  scale: [15, 1, 15],
  color: "#1a1a24",
  roughness: 0.7,
  metallic: 0.1,
});

const link = await scene.loadMesh("./link_cartoon.glb", {
  rotationDegrees: [-90, 30, 0],
  position: [-2.5, -0.5, 0],
  scale: [0.5, 0.5, 0.5]
});

const link_instance = scene.addInstance(link, {
  position: [2.5, -0.5, 0],
  rotationDegrees: [-90, -30, 0],
  scale: [0.5, 0.5, 0.5]
});

const sun = scene.addLight({
  type: "directional",
  rotationDegrees: [-135, 30, 0], // Slight angle to cast shadows across the runway
  color: "#ffffff",
  intensity: 0.8,
  shadowMapSize: 4096,
});

scene.render(() => {
  if (canvas.width != window.innerWidth || canvas.height != window.innerHeight) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
});
