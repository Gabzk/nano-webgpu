# Exemplos de Uso Ideal — nano-webgpu

## 1. Triângulo Colorido

```typescript
import { Context, Mesh, Color, Vec3 } from "nano-webgpu";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = new Context();
await ctx.init(canvas);

const triangle = new Mesh(ctx, {
  vertices: [
      0.0,  0.5, 0.0,          1.0, 0.0, 0.0, 1.0,
     -0.5, -0.5, 0.0,          0.0, 1.0, 0.0, 1.0,
      0.5, -0.5, 0.0,          0.0, 0.0, 1.0, 1.0,
  ],
  format: ["position:3", "color:4"],
});

ctx.run(() => {
  ctx.clear(Color.fromHex("#1a1a2e"));
  triangle.draw();
});
```

## 2. Cubo Texturizado

```typescript
import { Context, Mesh, Mat4, Vec3, Loader, Color } from "nano-webgpu";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = new Context();
await ctx.init(canvas);

const loader = new Loader(ctx.device);
const texture = await loader.loadTexture("./crate.png");

const cube = Mesh.createCube(ctx, { size: 1.0, texture });

const projection = new Mat4().perspective(
  Math.PI / 4,
  canvas.width / canvas.height,
  0.1,
  100.0,
);

const view = new Mat4().lookAt(
  new Vec3(2, 2, 4),
  new Vec3(0, 0, 0),
  new Vec3(0, 1, 0),
);

cube.setProjection(projection);
cube.setView(view);

ctx.run(() => {
  ctx.clear(Color.fromHex("#0f0f23"));
  cube.draw();
});
```

## 3. Movendo e Rotacionando o Cubo

```typescript
import { Context, Mesh, Mat4, Vec3, Loader, Color } from "nano-webgpu";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = new Context();
await ctx.init(canvas);

const loader = new Loader(ctx.device);
const texture = await loader.loadTexture("./crate.png");

const cube = Mesh.createCube(ctx, { size: 1.0, texture });

const projection = new Mat4().perspective(Math.PI / 4, canvas.width / canvas.height, 0.1, 100.0);
const view = new Mat4().lookAt(new Vec3(0, 2, 5), new Vec3(0, 0, 0), new Vec3(0, 1, 0));

cube.setProjection(projection);
cube.setView(view);

const position = new Vec3(0, 0, 0);
const rotation = new Vec3(0, 0, 0);

const keys: Record<string, boolean> = {};
window.addEventListener("keydown", (e) => (keys[e.key] = true));
window.addEventListener("keyup", (e) => (keys[e.key] = false));

ctx.run((dt) => {
  rotation.y += dt * 1.5;
  rotation.x += dt * 0.5;

  const speed = 3.0 * dt;
  if (keys["w"]) position.z -= speed;
  if (keys["s"]) position.z += speed;
  if (keys["a"]) position.x -= speed;
  if (keys["d"]) position.x += speed;

  const model = new Mat4()
    .translate(position)
    .rotate(rotation.x, rotation.y, rotation.z);

  cube.setModel(model);

  ctx.clear(Color.fromHex("#0f0f23"));
  cube.draw();
});
```

## 4. Modelo OBJ com Iluminação

```typescript
import { Context, Mesh, Mat4, Vec3, Loader, Color, DirectionalLight } from "nano-webgpu";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = new Context();
await ctx.init(canvas);

const loader = new Loader(ctx.device);

const modelData = await loader.loadModel("./suzanne.obj");
const texture = await loader.loadTexture("./stone.png");

const monkey = new Mesh(ctx, {
  vertices: modelData.vertices,
  normals: modelData.normals,
  uvs: modelData.uvs,
  indices: modelData.indices,
  texture,
});

const projection = new Mat4().perspective(Math.PI / 4, canvas.width / canvas.height, 0.1, 100.0);
const view = new Mat4().lookAt(new Vec3(0, 1, 3), new Vec3(0, 0, 0), new Vec3(0, 1, 0));

monkey.setProjection(projection);
monkey.setView(view);

const sun = new DirectionalLight({
  direction: new Vec3(-1, -1, -1).normalize(),
  color: new Color(1.0, 0.95, 0.8),
  intensity: 1.2,
});

ctx.run((dt) => {
  const model = new Mat4().rotate(0, dt * 0.5, 0);
  monkey.setModel(model);

  ctx.clear(Color.fromHex("#111122"));
  monkey.draw({ light: sun });
});
```

## 5. Cena Completa com Múltiplos Objetos

```typescript
import {
  Context, Scene, Camera, Mesh, Mat4, Vec3, Loader, Color,
  DirectionalLight, PointLight,
} from "nano-webgpu";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = new Context();
await ctx.init(canvas);

const loader = new Loader(ctx.device);
const scene = new Scene(ctx);

const camera = new Camera({
  fov: Math.PI / 4,
  aspect: canvas.width / canvas.height,
  near: 0.1,
  far: 100.0,
  position: new Vec3(0, 3, 8),
  target: new Vec3(0, 0, 0),
});
camera.enableOrbitControls(canvas);
scene.setCamera(camera);

// Chão
const floor = Mesh.createPlane(ctx, {
  width: 10,
  height: 10,
  texture: await loader.loadTexture("./grass.jpg"),
});
floor.setModel(new Mat4().translate(0, -1, 0));
scene.add(floor);

// Cubo
const crate = Mesh.createCube(ctx, {
  size: 1.0,
  texture: await loader.loadTexture("./crate.png"),
});
crate.setModel(new Mat4().translate(-2, 0, 0));
scene.add(crate);

// Modelo OBJ
const modelData = await loader.loadModel("./barrel.obj");
const barrel = new Mesh(ctx, {
  ...modelData,
  texture: await loader.loadTexture("./barrel.png"),
});
barrel.setModel(new Mat4().translate(2, 0, 0).scale(0.5, 0.5, 0.5));
scene.add(barrel);

// Esfera
const sphere = Mesh.createSphere(ctx, {
  radius: 0.6,
  segments: 32,
  color: Color.fromHex("#e74c3c"),
});
sphere.setModel(new Mat4().translate(0, 1, 0));
scene.add(sphere);

// Luzes
scene.addLight(new DirectionalLight({
  direction: new Vec3(-1, -2, -1).normalize(),
  color: new Color(1.0, 0.95, 0.9),
  intensity: 0.8,
}));

scene.addLight(new PointLight({
  position: new Vec3(0, 3, 0),
  color: Color.fromHex("#3498db"),
  intensity: 2.0,
  radius: 10.0,
}));

// Animação
let time = 0;

ctx.run((dt) => {
  time += dt;

  crate.setModel(
    new Mat4()
      .translate(-2, 0, 0)
      .rotate(0, time, 0),
  );

  sphere.setModel(
    new Mat4().translate(0, 1 + Math.sin(time * 2) * 0.5, 0),
  );

  scene.render();
});
```
