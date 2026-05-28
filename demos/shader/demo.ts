import { Scene, ShaderMaterial } from "nano-webgpu";
import { highlightShader } from "./highlightShader";
import { waterShader } from "./water";

const scene = await Scene.init("#canvas")
const canvas = scene.getCanvas()

scene.backgroundColor = "#80d0fd"
scene.setCamera({ position: [0, 3, 4] })
const csm = scene.addLight({
  type: "directional",
  rotationDegrees: [-135, 0, 0],
  color: "#ffffff",
  intensity: 0.5,
  castShadow: true,
  shadowMapSize: 4096,
  usePCF: true,
  useCSM: true,
  cascadeCount: 4,
  csmMaxDistance: 150.0,
  cascadeSplitLambda: 0.85,
  shadowBias: 0.0001
});


const waterMaterial = new ShaderMaterial({
    shaderCode: waterShader,
    parameters: {
        water_color: [0.04, 0.38, 0.88, 1.0],
        water_color2: [0.04, 0.35, 0.78, 1.0],
        foam_color: [0.8125, 0.9609, 0.9648, 1.0],
        tile: [25.0, 25.0],
        wave_size: [2.0, 2.0],
        distortion_speed: 1.5,
        height: 0.05, // keep height displacement subtle to prevent any stretching
        wave_speed: 1.0,
    },
})

// Standard plane from the framework with scale 5
scene.addPlane({ material: waterMaterial, scale: 25 })

const link = await scene.loadMesh("./link_cartoon.glb", {
  rotationDegrees: [-90, 30, 0],
  position: [-.5, 0.5, 0],
  scale: 0.2
});

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
    position: [0, 1, 0],
})

if (key.material) {
    key.material.nextPass = highlight
}


const floatAnimation = (obj: any, originalY: number, amplitude: number = 0.1, speed = 2,) => {
    const { dt, time } = scene.getRenderInfo()
    obj.rotationDegrees.y += 90 * dt
    obj.position.y = originalY + Math.sin(time * speed) * amplitude
}

const originalY = key.position.y

scene.render(() => {
    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
    }

    floatAnimation(key, originalY)
});