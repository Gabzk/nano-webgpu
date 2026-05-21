/**
 * Specifies the behavior of the cursor within the viewport.
 * - `"visible"`: The default mouse pointer mode, cursor is visible and free.
 * - `"captured"`: Locks and hides the cursor within the target canvas using the Pointer Lock API.
 */
export type MouseMode = "visible" | "captured";

/**
 * InputManager coordinates keyboard and mouse input events, maintaining instantaneous button/key states,
 * delta movement values, and mapping physical keyboard keys to abstract semantic action bindings.
 */
export class InputManager {
	/** @internal Instantaneous keyboard keys down. */
	private keys: Set<string> = new Set();
	/** @internal Keys pressed down exactly on this frame. */
	private keysJustPressed: Set<string> = new Set();
	/** @internal Keys released exactly on this frame. */
	private keysJustReleased: Set<string> = new Set();

	/** @internal Instantaneous mouse buttons down (0: Left, 1: Middle, 2: Right). */
	private mouseButtons: Set<number> = new Set();
	/** @internal Mouse buttons pressed down exactly on this frame. */
	private mouseButtonsJustPressed: Set<number> = new Set();
	/** @internal Mouse buttons released exactly on this frame. */
	private mouseButtonsJustReleased: Set<number> = new Set();

	/** Absolute coordinates of the mouse pointer within client window space. */
	public mousePosition: { x: number; y: number } = { x: 0, y: 0 };
	/** Accumulated delta movement coordinates of the mouse since the last frame. */
	public mouseMovement: { x: number; y: number } = { x: 0, y: 0 };

	/** @internal Mapping of semantic action names to associated physical hardware event codes. */
	private actions: Map<string, string[]> = new Map();
	/** @internal Initialization lock variable. */
	private initialized = false;

	/** @internal Active operational mouse pointer mode. */
	private _mouseMode: MouseMode = "visible";
	/** @internal Target HTMLCanvasElement for context capture locks. */
	private _canvas: HTMLCanvasElement | null = null;

	/** Determines whether the mouse pointer is currently locked/captured by the browser Pointer Lock API. */
	public get isMouseCaptured(): boolean {
		return (
			document.pointerLockElement === this._canvas && this._canvas !== null
		);
	}

	/** Retrieves the active mouse pointer mode. */
	public get mouseMode(): MouseMode {
		return this._mouseMode;
	}

	/**
	 * Registers event listeners on the global window scope to track keydown, keyup,
	 * mousedown, mouseup, mousemove, and pointerlockchange events.
	 * Automatically queries the active canvas to associate pointer lock targets.
	 */
	public init() {
		if (this.initialized) return;

		// Auto-detect the canvas in the page
		this._canvas = document.querySelector("canvas");

		window.addEventListener("keydown", (e) => {
			if (!this.keys.has(e.code)) {
				this.keysJustPressed.add(e.code);
			}
			this.keys.add(e.code);
		});

		window.addEventListener("keyup", (e) => {
			this.keys.delete(e.code);
			this.keysJustReleased.add(e.code);
		});

		window.addEventListener("mousedown", (e) => {
			if (!this.mouseButtons.has(e.button)) {
				this.mouseButtonsJustPressed.add(e.button);
			}
			this.mouseButtons.add(e.button);
			// Request pointer lock here (inside the user gesture handler)
			// so the browser allows it. Only if the mode is already "captured".
			if (
				this._mouseMode === "captured" &&
				this._canvas &&
				!document.pointerLockElement
			) {
				this._canvas.requestPointerLock();
			}
		});

		window.addEventListener("mouseup", (e) => {
			this.mouseButtons.delete(e.button);
			this.mouseButtonsJustReleased.add(e.button);
		});

		window.addEventListener("mousemove", (e) => {
			this.mousePosition.x = e.clientX;
			this.mousePosition.y = e.clientY;
			this.mouseMovement.x += e.movementX;
			this.mouseMovement.y += e.movementY;
		});

		// Listen for pointer lock changes (e.g. user presses Escape)
		document.addEventListener("pointerlockchange", () => {
			if (!document.pointerLockElement) {
				this._mouseMode = "visible";
			}
		});

		this.initialized = true;
	}

	/**
	 * Alters the current MouseMode configuration.
	 * - `"captured"`: Arms pointer locking. Locking is initiated on the next valid mouse down event.
	 * - `"visible"`: Immediately exits the browser Pointer Lock context.
	 *
	 * @param mode - The target MouseMode configuration.
	 */
	public setMouseMode(mode: MouseMode): void {
		this._mouseMode = mode;
		if (mode === "visible") {
			document.exitPointerLock();
		}
	}

	/**
	 * Binds an array of hardware event codes to a custom named semantic action.
	 *
	 * @param action - Unique identifier name of the action.
	 * @param codes - Physical hardware event keys (e.g. `['KeyW', 'ArrowUp']`).
	 */
	public addAction(action: string, codes: string[]) {
		this.actions.set(action, codes);
	}

	/**
	 * Assesses if any physical key mapped to the semantic action is currently pressed down.
	 *
	 * @param action - Unique identifier name of the action.
	 * @returns True if any associated key is held down, false otherwise.
	 */
	public isActionPressed(action: string): boolean {
		const codes = this.actions.get(action);
		if (!codes) return false;
		return codes.some((code) => this.isKeyPressed(code));
	}

	/**
	 * Assesses if any physical key mapped to the semantic action was triggered down during the active frame.
	 *
	 * @param action - Unique identifier name of the action.
	 * @returns True if any associated key was newly pressed this frame, false otherwise.
	 */
	public isActionJustPressed(action: string): boolean {
		const codes = this.actions.get(action);
		if (!codes) return false;
		return codes.some((code) => this.isKeyJustPressed(code));
	}

	/**
	 * Assesses if any physical key mapped to the semantic action was released during the active frame.
	 *
	 * @param action - Unique identifier name of the action.
	 * @returns True if any associated key was newly released this frame, false otherwise.
	 */
	public isActionJustReleased(action: string): boolean {
		const codes = this.actions.get(action);
		if (!codes) return false;
		return codes.some((code) => this.isKeyJustReleased(code));
	}

	/**
	 * Verifies if a specific keyboard key is currently being held down.
	 *
	 * @param code - The physical keyboard event code (e.g., `'Space'`).
	 * @returns True if held down, false otherwise.
	 */
	public isKeyPressed(code: string): boolean {
		return this.keys.has(code);
	}

	/**
	 * Verifies if a specific keyboard key was pressed down exactly during the active frame.
	 *
	 * @param code - The physical keyboard event code (e.g., `'KeyA'`).
	 * @returns True if newly pressed this frame, false otherwise.
	 */
	public isKeyJustPressed(code: string): boolean {
		return this.keysJustPressed.has(code);
	}

	/**
	 * Verifies if a specific keyboard key was released exactly during the active frame.
	 *
	 * @param code - The physical keyboard event code (e.g., `'KeyS'`).
	 * @returns True if newly released this frame, false otherwise.
	 */
	public isKeyJustReleased(code: string): boolean {
		return this.keysJustReleased.has(code);
	}

	/**
	 * Verifies if a specific mouse button is currently held down.
	 *
	 * @param button - The mouse button index (0: Left, 1: Middle, 2: Right).
	 * @returns True if held down, false otherwise.
	 */
	public isMouseButtonPressed(button: number): boolean {
		return this.mouseButtons.has(button);
	}

	/**
	 * Verifies if a specific mouse button was pressed down exactly during the active frame.
	 *
	 * @param button - The mouse button index (0: Left, 1: Middle, 2: Right).
	 * @returns True if newly pressed this frame, false otherwise.
	 */
	public isMouseButtonJustPressed(button: number): boolean {
		return this.mouseButtonsJustPressed.has(button);
	}

	/**
	 * Verifies if a specific mouse button was released exactly during the active frame.
	 *
	 * @param button - The mouse button index (0: Left, 1: Middle, 2: Right).
	 * @returns True if newly released this frame, false otherwise.
	 */
	public isMouseButtonJustReleased(button: number): boolean {
		return this.mouseButtonsJustReleased.has(button);
	}

	/**
	 * Resets frame-transient key/button states and resets delta movement values.
	 * Must be invoked at the conclusion of every render/update frame loop.
	 */
	public update() {
		this.keysJustPressed.clear();
		this.keysJustReleased.clear();
		this.mouseButtonsJustPressed.clear();
		this.mouseButtonsJustReleased.clear();
		this.mouseMovement.x = 0;
		this.mouseMovement.y = 0;
	}
}

/** Global InputManager singleton instance for simplified client integration. */
export const Input = new InputManager();
