import { Node } from "./node";
import { Vec3 } from "../math/vec3";
import { Mat4 } from "../math/mat4";

/**
 * A 3D Node with position, rotation, and scale properties.
 */
export class Node3D extends Node {
    private _position: Vec3 = new Vec3(0, 0, 0);
    private _rotation: Vec3 = new Vec3(0, 0, 0);
    private _scale: Vec3 = new Vec3(1, 1, 1);

    /**
     * Gets or sets the position of the node.
     */
    get position(): Vec3 {
        return this._position;
    }

    set position(val: Vec3) {
        this._position.copy(val);
        this.isDirty = true;
    }

    /**
     * Gets or sets the rotation of the node (in radians).
     */
    get rotation(): Vec3 {
        return this._rotation;
    }

    set rotation(val: Vec3) {
        this._rotation.copy(val);
        this.isDirty = true;
    }

    private _rotationDegreesProxy?: Vec3;

    /**
     * Godot-Style syntactic sugar! Gets or sets the rotation of the node in DEGREES (0 to 360).
     */
    get rotationDegrees(): Vec3 {
        if (!this._rotationDegreesProxy) {
            this._rotationDegreesProxy = new Proxy(new Vec3(), {
                get: (target, prop, receiver) => {
                    if (prop === 'x') return this._rotation.x * (180 / Math.PI);
                    if (prop === 'y') return this._rotation.y * (180 / Math.PI);
                    if (prop === 'z') return this._rotation.z * (180 / Math.PI);
                    return Reflect.get(target, prop, receiver);
                },
                set: (target, prop, value, receiver) => {
                    let dirty = false;
                    if (prop === 'x') { this._rotation.x = value * (Math.PI / 180); dirty = true; }
                    else if (prop === 'y') { this._rotation.y = value * (Math.PI / 180); dirty = true; }
                    else if (prop === 'z') { this._rotation.z = value * (Math.PI / 180); dirty = true; }
                    else { Reflect.set(target, prop, value, receiver); }
                    
                    if (dirty) this.isDirty = true;
                    return true;
                }
            });
        }
        return this._rotationDegreesProxy;
    }

    set rotationDegrees(val: Vec3 | number[]) {
        const v = Vec3.from(val as any);
        this._rotation.x = v.x * (Math.PI / 180);
        this._rotation.y = v.y * (Math.PI / 180);
        this._rotation.z = v.z * (Math.PI / 180);
        this.isDirty = true;
    }

    /**
     * Gets or sets the scale of the node.
     */
    get scale(): Vec3 {
        return this._scale;
    }

    set scale(val: Vec3) {
        this._scale.copy(val);
        this.isDirty = true;
    }

    /**
     * Helper to set all transforms at once.
     */
    public setTransform(position?: Vec3, rotation?: Vec3, scale?: Vec3): void {
        if (position) this._position.copy(position);
        if (rotation) this._rotation.copy(rotation);
        if (scale) this._scale.copy(scale);
        this.isDirty = true;
    }

    /**
     * Updates the local matrix based on position, rotation, and scale.
     */
    public override updateLocalMatrix(): void {
        this.localMatrix.identity();
        
        // Translate
        if (this._position.x !== 0 || this._position.y !== 0 || this._position.z !== 0) {
            this.localMatrix.translate(this._position);
        }
        
        // Rotate
        if (this._rotation.x !== 0 || this._rotation.y !== 0 || this._rotation.z !== 0) {
            this.localMatrix.rotate(this._rotation.x, this._rotation.y, this._rotation.z);
        }
        
        // Scale
        if (this._scale.x !== 1 || this._scale.y !== 1 || this._scale.z !== 1) {
            this.localMatrix.scale(this._scale);
        }
    }
}
