import { Scene, ShaderMaterial } from "nano-webgpu";
import { highlightShader } from "./highlightShader";

const scene = await Scene.init("#canvas")
const canvas = scene.getCanvas()

scene.bloom.enabled = true;
scene.bloom.threshold = 0.65; // Extrai somente o brilho HDR real das runas
scene.bloom.intensity = 0.5;  // Intensidade suave e cinematográfica
scene.bloom.passes = 3;       // Lindo halo de dispersão

scene.setCamera({ position: [0, 2, 5] })

const csm = scene.addLight({
    type: "directional",
    rotationDegrees: [-45, 45, 0],
    color: "#ffffff",
    intensity: 0.5,
    useCSM: true,
    cascadeCount: 3,
    csmMaxDistance: 150.0,
});

const highlight = new ShaderMaterial({
    shaderCode: highlightShader,
    parameters: {
        color: [1.0, 1.0, 1.0, 1.0],
        cycleInterval: 1.5,
        speed: 1.5,
        width: 8.0,
    },
})

const key = await scene.loadMesh("./stylized_fantasy_key.glb", {
    position: [0, -1, 0],
    scale: 0.01,
    rotationDegrees: [0, 0, -90]
})

if (key.material) {
    key.material.nextPass = highlight
}

const plane = scene.addPlane({
    position: [0, -1.5, 0],
    scale: 10,
    material: { albedoColor: [1, 1, 1] }
})

const floatAnimation = (obj: any, originalY: number, amplitude: number = 0.1, speed = 2,) => {
    const { dt, time } = scene.getRenderInfo()
    obj.rotationDegrees.x += 90 * dt
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