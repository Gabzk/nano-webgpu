import { Scene, ShaderMaterial } from "nano-webgpu";
import { highlightShader } from "./highlightShader";

const scene = await Scene.init("#canvas")
const canvas = scene.getCanvas()

scene.backgroundColor = "#1a1a2e"
scene.setCamera({ position: [0, 1.5, 2.5] })
scene.addLight({ type: "directional", rotationDegrees: [45, 45, 0], intensity: 1.2, castShadow: true })

scene.addPlane({ scale: 4 })

const highlight = new ShaderMaterial({
    shaderCode: highlightShader,
    parameters: {
        color: [1.0, 1, 1, 1.0],    // vec4 — white shimmer tint + alpha
        cycleInterval: 1.5,         // f32  — band density  (lower  = denser)
        speed: 1.5,                 // f32  — sweep speed   (higher = faster)
        width: 8.0,                 // f32  — band thickness
    },
})


const key = await scene.loadMesh("./key.glb", {
    position: [0, 0.5, 0],
})

if (key.material) {
    key.material.nextPass = highlight
}

scene.render(() => {
    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
    }

    const dt = scene.getRenderInfo().dt
    key.rotationDegrees.y += 40 * dt
})