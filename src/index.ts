export { CollisionShape, type ShapeType } from "./core/collision-shape";
export { Context } from "./core/context";
export { Input, InputManager, type MouseMode } from "./core/input";
export { Loader } from "./core/loader";
export { Node } from "./core/node";
export { Node3D } from "./core/node3d";
export { DebugPanel, type DebugPanelOptions } from "./debug/debug-panel";
export { PerformanceTracker } from "./debug/performance-tracker";
export { VRAMTracker, type VRAMEntry } from "./debug/vram-tracker";
export { Camera, type CameraOptions } from "./graphics/camera";
export { Geometry } from "./graphics/geometry";
export {
	CameraController,
	type CameraMode,
	type FirstPersonOptions,
	type OrbitOptions,
	type ThirdPersonOptions,
} from "./graphics/camera-controller";
export {
	DirectionalLight,
	type DirectionalLightOptions,
	Light,
	type LightOptions,
	PointLight,
	type PointLightOptions,
} from "./graphics/light";
export { Material } from "./graphics/materials/material";
export {
	ShaderMaterial,
	type ShaderMaterialOptions,
} from "./graphics/materials/shader-material";
export {
	StandardMaterial,
	type StandardMaterialOptions,
} from "./graphics/materials/standard-material";
export { Mesh, type MeshOptions } from "./graphics/mesh";
export {
	Scene,
	type SceneGeometryOptions,
	type SceneLightOptions,
} from "./graphics/scene";
export { Renderer } from "./graphics/renderer";
export { PipelineManager } from "./graphics/pipeline";
export { Texture } from "./graphics/texture";
export { AABB } from "./math/aabb";
export { Color } from "./math/color";
export { Mat4 } from "./math/mat4";
export { Vec2 } from "./math/vec2";
export { Vec3 } from "./math/vec3";

export const VERSION = "0.3.1";
