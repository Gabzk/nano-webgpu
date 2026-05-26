import { Scene, ShaderMaterial } from "nano-webgpu";
import { highlightShader } from "./highlightShader";
import { waterShader } from "./water";

const scene = await Scene.init("#canvas")
const canvas = scene.getCanvas()

scene.backgroundColor = "#0d0d1a"
scene.setCamera({ position: [0, 1.8, 2.8] })
scene.addLight({ type: "directional", rotationDegrees: [45, 45, 0], intensity: 1.5, castShadow: true })

const waterMaterial = new ShaderMaterial({
    shaderCode: waterShader,
    parameters: {
        water_color: [0.04, 0.38, 0.88, 1.0],
        water_color2: [0.04, 0.35, 0.78, 1.0],
        foam_color: [0.8125, 0.9609, 0.9648, 1.0],
        tile: [5.0, 5.0],
        wave_size: [2.0, 2.0],
        distortion_speed: 1.5,
        height: 0.05, // keep height displacement subtle to prevent any stretching
        wave_speed: 1.0,
    },
})

// Standard plane from the framework with scale 5
scene.addPlane({ material: waterMaterial, scale: 5 })

const highlight = new ShaderMaterial({
    shaderCode: highlightShader,
    parameters: {
        color: [1.0, 0.9, 0.4, 1.0],    // golden shimmer tint
        cycleInterval: 1.5,
        speed: 1.5,
        width: 8.0,
    },
})

const key = await scene.loadMesh("./key.glb", {
    position: [0, 0.5, 0],
    scale: 0.8
})

if (key.material) {
    key.material.nextPass = highlight
}

let elapsed = 0
scene.render(() => {
    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
    }

    const dt = scene.getRenderInfo().dt
    elapsed += dt
    key.rotationDegrees.y += 40 * dt
    
    // Gently hover the key up and down mimicking floating
    key.position.y = 0.5 + Math.sin(elapsed * 2.0) * 0.08
})