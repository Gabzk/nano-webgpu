import { Context, Scene, Camera, DirectionalLight, PointLight, StandardMaterial, Color } from "nano-webgpu";

const ctx = await Context.init("#canvas");
const scene = new Scene(ctx);

const camera = new Camera({ position: [0, 1, 5] });
scene.setCamera(camera);

// // 1. Primitive with Default White Material
// const defaultCube = ctx.createCube({
//     position: [-2, 0, 0],
//     scale: 1.0,
// });
// scene.add(defaultCube);

// 2. Primitive with PBR Shiny Red Material
// const shinyRedMaterial = new StandardMaterial({
//     albedoColor: "#ff0000",
//     roughness: 0.8,
//     metallic: 0.8
// });
// const shinyCube = ctx.createCube({
//     position: [0, 0, 0],
//     scale: 1.0,
//     material: shinyRedMaterial
// });
// scene.add(shinyCube);

// 3. Loaded OBJ with Full PBR Material
const crateMesh = await ctx.loadMesh(`./assets/crate/source/Wood_Box.obj`, {
    material: new StandardMaterial({
        albedoTexture: "./assets/crate/textures/Wood_Box_low_DefaultMaterial_BaseColor.png",
        normalTexture: "./assets/crate/textures/Wood_Box_low_DefaultMaterial_Normal.png",
        roughnessTexture: "./assets/crate/textures/Wood_Box_low_DefaultMaterial_Roughness.png",
        metallicTexture: "./assets/crate/textures/Wood_Box_low_DefaultMaterial_Metallic.png"
    }),
    position: [0, 0, 0],
    scale: 0.5,
});
scene.add(crateMesh);


scene.addLight(new PointLight({
    position: [0, 2, 0],
    color: "#ffffff",
    intensity: 1.0
}));

ctx.run((dt) => {
    // defaultCube.rotation.y += 0.5 * dt;
    // shinyCube.rotation.y += 0.5 * dt;
    // shinyCube.rotation.x += 0.3 * dt;
    crateMesh.rotation.y += 0.5 * dt;
    
    scene.render();
});