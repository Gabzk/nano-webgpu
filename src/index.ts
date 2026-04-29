export { CollisionShape } from "./core/collision-shape";
export { Context } from "./core/context";
export { Input } from "./core/input";
export { Loader } from "./core/loader";
export { Node } from "./core/node";
export { Node3D } from "./core/node3d";
export { DebugPanel } from "./debug/debug-panel";
export { PerformanceTracker } from "./debug/performance-tracker";
export { VRAMTracker } from "./debug/vram-tracker";
export { Camera, type CameraOptions } from "./graphics/camera";
export {
	CameraController,
	type CameraMode,
	type FirstPersonOptions,
	type OrbitOptions,
	type ThirdPersonOptions,
} from "./graphics/camera-controller";
export { DirectionalLight, PointLight, type LightOptions, type DirectionalLightOptions, type PointLightOptions } from "./graphics/light";
export { Material } from "./graphics/materials/material";
export { ShaderMaterial } from "./graphics/materials/shader-material";
export { StandardMaterial, type StandardMaterialOptions } from "./graphics/materials/standard-material";
export { Mesh, type MeshOptions } from "./graphics/mesh";
export { Scene, type SceneLightOptions, type SceneGeometryOptions } from "./graphics/scene";
export { Texture } from "./graphics/texture";
export { AABB } from "./math/aabb";
export { Color } from "./math/color";
export { Mat4 } from "./math/mat4";
export { Vec2 } from "./math/vec2";
export { Vec3 } from "./math/vec3";

export const VERSION = "0.1.0";
