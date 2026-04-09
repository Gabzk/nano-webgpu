import { Mat4 } from "../math/mat4";

/**
 * Base Node class for building a scene graph.
 */
export class Node {
	public name: string = "";
	public parent: Node | null = null;
	public readonly children: Node[] = [];
	public localMatrix: Mat4 = new Mat4();
	public worldMatrix: Mat4 = new Mat4();
	public isDirty: boolean = true;

	/**
	 * Adds a child node to this node.
	 * @param child - The node to add as a child.
	 */
	public add(child: Node): void {
		if (child.parent) {
			child.parent.remove(child);
		}
		child.parent = this;
		this.children.push(child);
		child.isDirty = true;
	}

	/**
	 * Removes a child node from this node.
	 * @param child - The node to remove.
	 */
	public remove(child: Node): void {
		const index = this.children.indexOf(child);
		if (index !== -1) {
			child.parent = null;
			this.children.splice(index, 1);
			child.isDirty = true;
		}
	}

	/**
	 * Called whenever local transform properties change.
	 * Should be overridden by subclasses to update `localMatrix`.
	 */
	public updateLocalMatrix(): void {
		// Base Node has no transform properties besides the matrix itself.
		// It's up to Node3D or Node2D to update the localMatrix from position/rotation/scale.
	}

	/**
	 * Updates the world matrix of this node and its children.
	 * @param force - If true, forces the update even if not marked as dirty.
	 */
	public updateWorldMatrix(force: boolean = false): void {
		if (this.isDirty || force) {
			this.updateLocalMatrix();

			if (this.parent) {
				// worldMatrix = parent.worldMatrix * localMatrix
				this.worldMatrix
					.copy(this.parent.worldMatrix)
					.multiply(this.localMatrix);
			} else {
				this.worldMatrix.copy(this.localMatrix);
			}
			this.isDirty = false;
			force = true; // Force children to update if parent updated
		}

		for (const child of this.children) {
			child.updateWorldMatrix(force);
		}
	}
}
