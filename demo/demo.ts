import { Context, Scene, Camera, DirectionalLight, PointLight } from "nano-webgpu";

const ctx = await Context.init("#canvas");
const scene = new Scene(ctx);

const camera = new Camera();
camera.enableOrbitControls();
scene.setCamera(camera);

const floor = ctx.createPlane({
    size: 1,
    texture: "./grass.jpg",
    position: [0, -1, 2]
});
scene.add(floor);

// Criação baseada em primivitivas direta no ctx
const crate = ctx.createCube({
    size: 1.0,
    texture: "./grass.jpg",
    position: [-2, 0, 0]
});
scene.add(crate);

const cube = ctx.createCube({
    size: 1.0,
    texture: "./grass.jpg",
    position: [2, 0, 0]
});
scene.add(cube);

// Luzes com direções em array (Vec3 auto) e cores hexadecimais diretas
scene.addLight(new DirectionalLight({
    direction: [-1, -2, -1],
    color: "#ffd0b0",
    intensity: 1
}));

scene.addLight(new PointLight({
    position: [0, 1, 0],
    color: "#3498db"
}));

// Animação muito mais natural usando propriedades de transformação
ctx.run((dt, time) => {
    crate.rotation.y = time;
    cube.rotation.y = -time;
    scene.render();
});