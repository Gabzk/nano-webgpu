import { CameraController, Scene, StandardMaterial } from "nano-webgpu";

const scene = await Scene.init("#canvas");
const camera = scene.setCamera({ position: [0, 2, 7] });
scene.backgroundColor = "#c6c6c6";

const texture = "./brick.png";
const normal = "./brick_normal.png";
const ao = "./brick_ao.png";

const cube = scene.addCube()
cube.material = new StandardMaterial({ albedoTexture: texture, normalTexture: normal, aoTexture: ao })

const ctrl = new CameraController(camera, "third-person", {
  target: cube,
  distance: 5,
  height: 0
});

const sun = scene.addLight({
  type: "directional",
  rotationDegrees: [0, 0, 0],
  color: "#ffffff",
  intensity: 1,
});

const canvas = scene.getCanvas();
let time = 0;

scene.render(() => {
  // Redimensiona o canvas para preencher a tela
  if (
    canvas.width != window.innerWidth ||
    canvas.height != window.innerHeight
  ) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  ctrl.update(scene.getRenderInfo().dt)
  // cube.rotationDegrees.y += 60 * scene.getRenderInfo().dt;
});
