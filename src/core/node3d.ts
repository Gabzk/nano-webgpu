import type { Material } from "../graphics/materials/material";
import type { AABB } from "../math/aabb";
import { Vec3 } from "../math/vec3";
import type { CollisionShape } from "./collision-shape";
import { Node } from "./node";

interface MeshLike {
	isMesh: boolean;
	material: Material;
}

/**
 * Node3D represents a node in the 3D scene graph.
 * It contains spatial transformation properties (position, Euler rotation in radians, scale)
 * and optional collision structures for physical overlap detection.
 *
 * @group Core
 */
export class Node3D extends Node {
	/** @internal Inner storage for node position in 3D space. */
	private _position: Vec3;
	/** @internal Inner storage for Euler rotation angles (pitch, yaw, roll) in radians. */
	private _rotation: Vec3;
	/** @internal Inner storage for node scale factors along major axes. */
	private _scale: Vec3;

	/**
	 * Optional collision shape representing the physical bounds of this node.
	 * Utilized for standard AABB intersection tests and spatial overlap checks.
	 */
	public collisionShape: CollisionShape | null = null;

	/**
	 * Creates a new Node3D instance with default identity transformations:
	 * position at (0,0,0), Euler rotation at (0,0,0) radians, and scale at (1,1,1).
	 */
	constructor() {
		super();
		this._position = new Vec3(0, 0, 0);
		this._rotation = new Vec3(0, 0, 0);
		this._scale = new Vec3(1, 1, 1);

		this._position.onChange = () => {
			this.isDirty = true;
		};
		this._rotation.onChange = () => {
			this.isDirty = true;
		};
		this._scale.onChange = () => {
			this.isDirty = true;
		};
	}

	/**
	 * Gets the spatial 3D position vector of this node.
	 * Modifying individual components of this vector will automatically flag the node as dirty.
	 */
	get position(): Vec3 {
		return this._position;
	}

	/**
	 * Sets the spatial 3D position vector of this node.
	 * Copies the components of the incoming vector and flags the node as dirty.
	 */
	set position(val: Vec3) {
		this._position.copy(val);
		this.isDirty = true;
	}

	/**
	 * Gets the spatial Euler rotation vector (pitch, yaw, roll) in radians.
	 * Modifying individual components of this vector will automatically flag the node as dirty.
	 */
	get rotation(): Vec3 {
		return this._rotation;
	}

	/**
	 * Sets the spatial Euler rotation vector (pitch, yaw, roll) in radians.
	 * Copies the components of the incoming vector and flags the node as dirty.
	 */
	set rotation(val: Vec3) {
		this._rotation.copy(val);
		this.isDirty = true;
	}

	/** @internal Lazy-initialized proxy to allow read/write in degrees. */
	private _rotationDegreesProxy?: Vec3;

	/**
	 * Gets the spatial Euler rotation vector in degrees.
	 * Accessing or mutating components of this proxy converts automatically to/from radians.
	 */
	get rotationDegrees(): Vec3 {
		if (!this._rotationDegreesProxy) {
			this._rotationDegreesProxy = new Proxy(new Vec3(), {
				get: (target, prop, receiver) => {
					if (prop === "x") return this._rotation.x * (180 / Math.PI);
					if (prop === "y") return this._rotation.y * (180 / Math.PI);
					if (prop === "z") return this._rotation.z * (180 / Math.PI);
					return Reflect.get(target, prop, receiver);
				},
				set: (target, prop, value, receiver) => {
					if (prop === "x") {
						this._rotation.x = (value as number) * (Math.PI / 180);
					} else if (prop === "y") {
						this._rotation.y = (value as number) * (Math.PI / 180);
					} else if (prop === "z") {
						this._rotation.z = (value as number) * (Math.PI / 180);
					} else {
						Reflect.set(target, prop, value, receiver);
					}
					return true;
				},
			});
		}
		return this._rotationDegreesProxy;
	}

	/**
	 * Sets the spatial Euler rotation vector in degrees.
	 * Converts the incoming components to radians and flags the node as dirty.
	 */
	set rotationDegrees(val: Vec3 | number[]) {
		// biome-ignore lint/suspicious/noExplicitAny: disable rule for now
		const v = Vec3.from(val as any);
		this._rotation.x = v.x * (Math.PI / 180);
		this._rotation.y = v.y * (Math.PI / 180);
		this._rotation.z = v.z * (Math.PI / 180);
		this.isDirty = true;
	}

	/**
	 * Gets the spatial 3D scale vector of this node.
	 * Modifying individual components of this vector will automatically flag the node as dirty.
	 */
	get scale(): Vec3 {
		return this._scale;
	}

	/**
	 * Sets the spatial 3D scale vector of this node.
	 * Copies the components of the incoming vector and flags the node as dirty.
	 */
	set scale(val: Vec3) {
		this._scale.copy(val);
		this.isDirty = true;
	}

	/**
	 * Helper method to set position, rotation, and scale components simultaneously.
	 * Copies existing components from provided vectors and marks the node transform as dirty.
	 *
	 * @param position - Optional new position vector.
	 * @param rotation - Optional new Euler rotation vector in radians.
	 * @param scale - Optional new scale vector.
	 */
	public setTransform(position?: Vec3, rotation?: Vec3, scale?: Vec3): void {
		if (position) this._position.copy(position);
		if (rotation) this._rotation.copy(rotation);
		if (scale) this._scale.copy(scale);
		this.isDirty = true;
	}

	/**
	 * Recomputes the local transformation matrix (`localMatrix`) by applying
	 * translation, Euler rotation, and scaling transformations sequentially.
	 * Overrides the base Node behavior to process component values.
	 */
	public override updateLocalMatrix(): void {
		this.localMatrix.identity();

		// Translate
		if (
			this._position.x !== 0 ||
			this._position.y !== 0 ||
			this._position.z !== 0
		) {
			this.localMatrix.translate(this._position);
		}

		// Rotate
		if (
			this._rotation.x !== 0 ||
			this._rotation.y !== 0 ||
			this._rotation.z !== 0
		) {
			this.localMatrix.rotate(
				this._rotation.x,
				this._rotation.y,
				this._rotation.z,
			);
		}

		// Scale
		if (this._scale.x !== 1 || this._scale.y !== 1 || this._scale.z !== 1) {
			this.localMatrix.scale(this._scale);
		}
	}

	/**
	 * Computes and returns the world-space bounding box (AABB) of this node's collision shape.
	 * Transform the local shape bounds by the node's current world-space transformation matrix.
	 *
	 * @returns The transformed AABB bounding box, or null if no collision shape is set.
	 */
	public getWorldAABB(): AABB | null {
		if (!this.collisionShape) return null;
		const localAABB = this.collisionShape.getLocalAABB();
		return localAABB.transformed(this.worldMatrix);
	}

	/**
	 * Gets the material associated with this node if it is a Mesh,
	 * or recursively searches descendants and returns the material of the first child Mesh found.
	 *
	 * @returns The Material instance, or null if none was found.
	 */
	get material(): Material | null {
		const self = this as unknown as MeshLike;
		if (self.isMesh) {
			return self.material;
		}
		let found: Material | null = null;
		this.traverse((child) => {
			if (!found) {
				const c = child as unknown as MeshLike;
				if (c.isMesh) {
					found = c.material;
				}
			}
		});
		return found;
	}

	/**
	 * Sets the material for this node (if it is a Mesh) or recursively
	 * applies it to all descendant Mesh nodes.
	 *
	 * @param value - The Material instance to assign.
	 */
	set material(value: Material | null) {
		const self = this as unknown as MeshLike;
		if (self.isMesh) {
			if (value) {
				self.material = value;
			}
			return;
		}
		this.traverse((child) => {
			const c = child as unknown as MeshLike;
			if (c.isMesh && value) {
				c.material = value;
			}
		});
	}

	/**
	 * Determines if this node's world-space collision bounds overlap with another node's bounds.
	 * Both nodes must have active collision shapes; returns false otherwise.
	 *
	 * @param other - The other Node3D instance to test against.
	 * @returns True if the world-space AABBs intersect, false otherwise.
	 */
	public intersects(other: Node3D): boolean {
		const a = this.getWorldAABB();
		const b = other.getWorldAABB();
		if (!a || !b) return false;
		return a.intersects(b);
	}
}
