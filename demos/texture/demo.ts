import { OrbitCameraController, Scene, StandardMaterial } from "nano-webgpu";

const scene = await Scene.init("#canvas");
const camera = scene.setCamera({ position: [0, 2, 7] });
scene.backgroundColor = "#c6c6c6";


const texture = "./Brick_Wall_028_SD/Brick_Wall_028_basecolor.png";
const normal = "./Brick_Wall_028_SD/Brick_Wall_028_normal.png";
const ao = "./Brick_Wall_028_SD/Brick_Wall_028_ambientOcclusion.png";
const roughness = "./Brick_Wall_028_SD/Brick_Wall_028_roughness.png";
const height = "./Brick_Wall_028_SD/Brick_Wall_028_height.png";

const cube = scene.addCube()
cube.material = new StandardMaterial({
  albedoTexture: texture,
  normalTexture: normal,
  roughnessTexture: roughness,
  aoTexture: ao,
});

const ctrl = camera.addController("orbit", {
  center: cube.position,
  distance: 5,
});

const sun = scene.addLight({
  type: "directional",
  rotationDegrees: [0, 0, 0],
  color: "#ffffff",
  intensity: 1,
});

const canvas = scene.getCanvas();

scene.render(() => {
  // Redimensiona o canvas para preencher a tela
  if (
    canvas.width != window.innerWidth ||
    canvas.height != window.innerHeight
  ) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
});
