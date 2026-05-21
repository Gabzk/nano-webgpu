import { Mat4 } from "../math/mat4";

/**
 * Base class for all nodes in the scene graph hierarchy.
 * Handles hierarchical parent-child relationships, traversal, and coordinate space transformations
 * by propagating dirty transform states down the tree.
 */
export class Node {
	/** Unique identifier or friendly name for the node. */
	public name: string = "";

	/** Parent node in the scene graph. Null if this is the root node. */
	public parent: Node | null = null;

	/** List of child nodes belonging to this node. */
	public readonly children: Node[] = [];

	/** Local transformation matrix relative to the parent node. */
	public localMatrix: Mat4 = new Mat4();

	/** Global world transformation matrix relative to the scene origin. */
	public worldMatrix: Mat4 = new Mat4();

	/** Whether the local transform has changed and needs to be recomputed and propagated. */
	public isDirty: boolean = true;

	/** Visibility flag. If false, this node and its descendants are typically skipped in rendering. */
	public visible: boolean = true;

	/**
	 * Adds a child node to this node's hierarchy.
	 * If the child already has a parent, it is automatically removed from that parent first.
	 * Sets the child's dirty flag to true to force transform updates.
	 *
	 * @param child - The Node instance to append as a child.
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
	 * Removes a child node from this node's hierarchy.
	 * Clears the parent reference of the child node and sets its dirty flag.
	 *
	 * @param child - The Node instance to detach.
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
	 * Performs a depth-first traversal of the node hierarchy starting from this node,
	 * executing the provided callback on each visited node.
	 *
	 * @param callback - The function to invoke for each node.
	 */
	public traverse(callback: (node: Node) => void): void {
		callback(this);
		for (const child of this.children) {
			child.traverse(callback);
		}
	}

	/**
	 * Recomputes the node's local transformation matrix.
	 * Base Node does not define individual translation, rotation, or scale properties.
	 * This should be overridden in subclasses (e.g. Node3D) that maintain distinct components.
	 */
	public updateLocalMatrix(): void {
		// Base Node has no transform properties besides the matrix itself.
		// It's up to Node3D or Node2D to update the localMatrix from position/rotation/scale.
	}

	/**
	 * Updates the global world matrix of this node and recursively propagates the updates
	 * down the hierarchy to all child nodes.
	 *
	 * @param force - If true, forces transformation matrices to be recomputed even if they are not flagged as dirty.
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
