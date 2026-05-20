export { CollisionShape, type ShapeType } from "./core/collision-shape";
export { Context } from "./core/context";
export { Input, InputManager, type MouseMode } from "./core/input";
export { Loader } from "./core/loader";
export type { ModelData, ModelParser } from "./core/loader-parser";
export { Node } from "./core/node";
export { Node3D } from "./core/node3d";
export { DebugPanel, type DebugPanelOptions } from "./debug/debug-panel";
export { PerformanceTracker } from "./debug/performance-tracker";
export { type VRAMEntry, VRAMTracker } from "./debug/vram-tracker";
export { BatchManager } from "./graphics/batch-manager";
export { Camera, type CameraOptions } from "./graphics/camera";
export {
	CameraController,
	type CameraMode,
	type FirstPersonOptions,
	type OrbitOptions,
	type ThirdPersonOptions,
} from "./graphics/camera-controller";
export { Geometry } from "./graphics/geometry";
export {
	DirectionalLight,
	type DirectionalLightOptions,
	Light,
	type LightGPUData,
	type LightOptions,
	PointLight,
	type PointLightOptions,
	type ShadowConfig,
} from "./graphics/light";
export {
	isShaderMaterial,
	isStandardMaterial,
	Material,
} from "./graphics/materials/material";
export {
	ShaderMaterial,
	type ShaderMaterialOptions,
} from "./graphics/materials/shader-material";
export {
	StandardMaterial,
	type StandardMaterialOptions,
} from "./graphics/materials/standard-material";
export { Mesh, type MeshOptions } from "./graphics/mesh";
export { PipelineManager } from "./graphics/pipeline";
export { Renderer } from "./graphics/renderer";
export {
	Scene,
	type SceneGeometryOptions,
	type SceneLightOptions,
} from "./graphics/scene";
export { ShadowSystem } from "./graphics/shadow-system";
export { Texture } from "./graphics/texture";
export { AABB } from "./math/aabb";
export { Color } from "./math/color";
export { Mat4 } from "./math/mat4";
export { Vec2 } from "./math/vec2";
export { Vec3 } from "./math/vec3";
export { VERSION } from "./version";
