import { Scene, ShaderMaterial } from "nano-webgpu";
import { highlightShader } from "./highlightShader";
import { waterShader } from "./water";

const scene = await Scene.init("#canvas")
const canvas = scene.getCanvas()
scene.backgroundColor = "#80d0fd"
scene.setCamera({ position: [0, 3, 4] })

const sun = scene.addLight({
    type: "directional",
    rotationDegrees: [-135, 30, 0],
    shadowRadius: 1.0
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
        height: 0.05,
        wave_speed: 1.0,
    },
})
const highlighEffect = new ShaderMaterial({
    shaderCode: highlightShader,
    parameters: {
        color: [1.0, 0.9, 0.4, 1.0],
        cycleInterval: 1.5,
        speed: 1.5,
        width: 8.0,
    },
})
const key = await scene.loadMesh("./key.glb", {
    scale: 1.5,
    position: [0, 1, 0],
    nextPass: highlighEffect
})

scene.addPlane({ material: waterMaterial, scale: 25 })

scene.render(() => {
    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
    }
});