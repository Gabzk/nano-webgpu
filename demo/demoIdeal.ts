import { Context, Scene, Camera, DirectionalLight, PointLight, StandardMaterial, Color } from "nano-webgpu";

// Tentar esconder o Context dentro do scene
const scene = new Scene("#canvas");

// Tentar configurar a camera direto na scene mas mantendo a opção de setar ela por fora e depois mandar pra cena
const camera = scene.setCamera({ position: [0, 1, 5] });

// Ver se tem como definir um diretorio pros assets da scene para diminuir o tamanho da importação
scene.setDefaultDir("./assets/crate/")

// Ver se existe algum jeito de esconder o Await
const crateMesh = await scene.addMesh(`source/Wood_Box.obj`, {
    // shaderMaterial: "./shaders/shaderCustomizado.wgsl", Infere shaderMaterial
    material: { // Infere o standardMaterial
        albedoTexture: "textures/Wood_Box_low_DefaultMaterial_BaseColor.png",
        normalTexture: "textures/Wood_Box_low_DefaultMaterial_Normal.png",
        roughnessTexture: "textures/Wood_Box_low_DefaultMaterial_Roughness.png",
        metallicTexture: "textures/Wood_Box_low_DefaultMaterial_Metallic.png"
    },
    position: [0, 0, 0],
    scale: 0.5,
});

// Adicionar formas primitivas direto na cena recebendo interface SphereOptions ou algo do tipo.
const sphere = scene.addSphere({ position: [0, 0, 0], scale: 0.5 });

// Mesma coisa aqui só que padronizando o scene.addSomething e passando o tipo de luz no Options
scene.addLight({ type: 'directional', direction: [1, -2, 0], color: "#ffffff", intensity: 0.5 });

// Simplificar de ctx.run((dt) => {scene.render()}) para isso.
scene.render((dt) => {
    // defaultCube.rotation.y += 0.5 * dt;
    // shinyCube.rotation.y += 0.5 * dt;
    // shinyCube.rotation.x += 0.3 * dt;
    // crateMesh.rotation.y += 0.5 * dt;
});