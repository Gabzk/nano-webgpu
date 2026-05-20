import { Scene } from "nano-webgpu";

const scene = await Scene.init("#canvas");
scene.setCamera({ position: [0, 4, 10] });
scene.backgroundColor = "#c6c6c6";

scene.addPlane({
  position: [0, -0.94, -1],
  scale: 10,
  color: "#339933",
});

const link = await scene.loadMesh("./link_cartoon.glb",
  {
    rotationDegrees: [-90, 30, 0],
    position: [-2, -0.5, 0],
    scale: [0.5, 0.5, 0.5]
  }
);

scene.addInstance(link, {
  position: [2, -0.5, 0],
  scale: [0.5, 0.5, 0.5],
  rotationDegrees: [-90, -30, 0],
});

scene.addLight({
  type: "directional",
  rotationDegrees: [-135, 0, 0],
  color: "#ffffff",
  intensity: 0.5,
});

scene.addLight({
  type: "point",
  position: [0, 3, 2],
  color: "#ffffff",
  intensity: 1,
});

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
