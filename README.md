# nano-webgpu

[![npm version](https://img.shields.io/npm/v/nano-webgpu.svg?style=flat-square)](https://www.npmjs.com/package/nano-webgpu)
[![license](https://img.shields.io/npm/l/nano-webgpu.svg?style=flat-square)](./LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/nano-webgpu?style=flat-square)](https://bundlephobia.com/package/nano-webgpu)

> A lightweight, fast, and ergonomic 3D WebGPU graphics library for TypeScript and JavaScript.

`nano-webgpu` simplifies 3D graphics rendering on the web by wrapping raw WebGPU APIs into a clean, modern, and developer-friendly scene graph interface, without compromising performance or flexibility.

---

## ✨ Features

- **⚡ Native WebGPU Engine**: Built ground-up on WebGPU for next-generation rendering performance.
- **🎨 Ergonomic Scene Graph**: High-level abstractions (`Scene`, `Node3D`, `Mesh`, `Camera`) for rapid 3D development.
- **💡 Lighting & Shadows**: Support for `DirectionalLight`, `PointLight`, and `SpotLight` with shadow mapping (`ShadowSystem`).
- **💎 PBR & Custom Shaders**: `StandardMaterial` with metallic/roughness properties + `ShaderMaterial` for custom WGSL shaders.
- **🌸 Post-Processing**: Integrated bloom system (`BloomSystem`) for high-quality glow effects.
- **🎥 Camera Controllers**: Ready-to-use Orbit, First-Person, and Third-Person camera controls.
- **📦 3D Model Loader**: Built-in loader for GLTF / GLB 3D models with materials and textures.
- **🧮 Math Suite**: Included 3D math library (`Vec2`, `Vec3`, `Mat4`, `Quaternion`, `Color`, `AABB`).
- **📊 Debug & Profiling**: Built-in performance monitor (`PerformanceTracker`), `VRAMTracker`, and debug panel.
- **📘 100% TypeScript**: Full type definitions included out of the box.

---

## 📦 Installation

Install via `npm`, `pnpm`, or `yarn`:

```bash
# Using npm
npm install nano-webgpu

# Using pnpm
pnpm add nano-webgpu

# Using yarn
yarn add nano-webgpu
```

---

## 🚀 Quick Start

Here is a simple example showing how to initialize a WebGPU scene, add lighting, load a 3D model, and render:

```typescript
import { Scene } from "nano-webgpu";

// 1. Initialize scene on an HTML <canvas id="canvas"></canvas>
const scene = await Scene.init("#canvas");
const canvas = scene.getCanvas();

// 2. Set camera position and background color
scene.setCamera({ position: [0, 3, 8] });
scene.backgroundColor = "#07070b";

// 3. Add a ground plane
scene.addPlane({
  position: [0, -1, 0],
  scale: 15,
  color: "#161622",
  roughness: 0.7,
  metallic: 0.1,
});

// 4. Add a spotlight with shadow mapping
scene.addLight({
  type: "spotlight",
  position: [0, 5, 5],
  rotationDegrees: [-45, 0, 0],
  color: "#00f0ff",
  intensity: 3.5,
  innerAngle: 30,
  outerAngle: 50,
});

// 5. Load a GLTF / GLB model
const mesh = await scene.loadMesh("./models/character.glb", {
  position: [0, 0, 0],
  scale: 1.5,
});

// 6. Start render loop with automatic canvas resize handling
scene.render(() => {
  if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
});
```

---

## 🎮 Camera Controllers

Easily attach interactive controls to your camera:

```typescript
import { Scene, OrbitCameraController } from "nano-webgpu";

const scene = await Scene.init("#canvas");
const camera = scene.setCamera({ position: [0, 2, 5] });

// Enable Orbit Controls (mouse drag to rotate, scroll to zoom)
const controller = new OrbitCameraController(camera, {
  target: [0, 0, 0],
  distance: 5,
  damping: 0.1,
});
```

`nano-webgpu` also supports `FirstPersonCameraController` and `ThirdPersonCameraController`.

---

## 🎨 Materials & Custom WGSL Shaders

### Standard PBR Material

```typescript
import { StandardMaterial } from "nano-webgpu";

const material = new StandardMaterial({
  color: "#ff3366",
  metallic: 0.8,
  roughness: 0.2,
});
```

### Custom WGSL Shader Material

```typescript
import { ShaderMaterial } from "nano-webgpu";

const customMaterial = new ShaderMaterial({
  code: `
    @fragment
    fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
      return vec4f(uv.x, uv.y, 1.0, 1.0);
    }
  `
});
```

---

## 🛠 Browser Support

`nano-webgpu` relies on the W3C **WebGPU** standard. Compatible with:

- **Google Chrome** / **Microsoft Edge** 113+
- **Safari** 18+ (macOS 15+, iOS 18+)
- **Firefox Nightly** (with WebGPU flag enabled)

---

## 📜 License

Distributed under the **MIT License**. See [`LICENSE`](./LICENSE) for details.

---

Made with ❤️ by [Gabriel Alves](https://github.com/Gabzk)
