/**
 * Specifies the behavior of the cursor within the viewport.
 * - `"visible"`: The default mouse pointer mode, cursor is visible and free.
 * - `"captured"`: Locks and hides the cursor within the target canvas using the Pointer Lock API.
 *
 * @group Input & Physics
 */
export type MouseMode = "visible" | "captured";

/**
 * InputManager coordinates keyboard and mouse input events, maintaining instantaneous button/key states,
 * delta movement values, and mapping physical keyboard keys to abstract semantic action bindings.
 *
 * @group Input & Physics
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

	/** @internal Listener callbacks stored for clean teardown. */
	private keydownListener: ((e: KeyboardEvent) => void) | null = null;
	private keyupListener: ((e: KeyboardEvent) => void) | null = null;
	private mousedownListener: ((e: MouseEvent) => void) | null = null;
	private mouseupListener: ((e: MouseEvent) => void) | null = null;
	private mousemoveListener: ((e: MouseEvent) => void) | null = null;
	private pointerlockchangeListener: (() => void) | null = null;

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
	 * Automatically associates with the target canvas element to scope event tracking.
	 */
	public init(canvasElement?: HTMLCanvasElement) {
		if (this.initialized) return;

		this._canvas = canvasElement || document.querySelector("canvas");

		this.keydownListener = (e: KeyboardEvent) => {
			if (!this.keys.has(e.code)) {
				this.keysJustPressed.add(e.code);
			}
			this.keys.add(e.code);
		};

		this.keyupListener = (e: KeyboardEvent) => {
			this.keys.delete(e.code);
			this.keysJustReleased.add(e.code);
		};

		this.mousedownListener = (e: MouseEvent) => {
			if (this._canvas && !this._canvas.contains(e.target as Node)) {
				return;
			}
			setActiveInput(this);

			if (!this.mouseButtons.has(e.button)) {
				this.mouseButtonsJustPressed.add(e.button);
			}
			this.mouseButtons.add(e.button);

			if (
				this._mouseMode === "captured" &&
				this._canvas &&
				!document.pointerLockElement
			) {
				this._canvas.requestPointerLock();
			}
		};

		this.mouseupListener = (e: MouseEvent) => {
			this.mouseButtons.delete(e.button);
			this.mouseButtonsJustReleased.add(e.button);
		};

		this.mousemoveListener = (e: MouseEvent) => {
			this.mousePosition.x = e.clientX;
			this.mousePosition.y = e.clientY;
			this.mouseMovement.x += e.movementX;
			this.mouseMovement.y += e.movementY;
		};

		this.pointerlockchangeListener = () => {
			if (document.pointerLockElement !== this._canvas) {
				this._mouseMode = "visible";
			}
		};

		window.addEventListener("keydown", this.keydownListener);
		window.addEventListener("keyup", this.keyupListener);
		window.addEventListener("mousedown", this.mousedownListener);
		window.addEventListener("mouseup", this.mouseupListener);
		window.addEventListener("mousemove", this.mousemoveListener);
		document.addEventListener(
			"pointerlockchange",
			this.pointerlockchangeListener,
		);

		this.initialized = true;
	}

	/**
	 * Tears down all registered event listeners on window and document.
	 */
	public destroy() {
		if (!this.initialized) return;

		if (this.keydownListener) {
			window.removeEventListener("keydown", this.keydownListener);
			this.keydownListener = null;
		}
		if (this.keyupListener) {
			window.removeEventListener("keyup", this.keyupListener);
			this.keyupListener = null;
		}
		if (this.mousedownListener) {
			window.removeEventListener("mousedown", this.mousedownListener);
			this.mousedownListener = null;
		}
		if (this.mouseupListener) {
			window.removeEventListener("mouseup", this.mouseupListener);
			this.mouseupListener = null;
		}
		if (this.mousemoveListener) {
			window.removeEventListener("mousemove", this.mousemoveListener);
			this.mousemoveListener = null;
		}
		if (this.pointerlockchangeListener) {
			document.removeEventListener(
				"pointerlockchange",
				this.pointerlockchangeListener,
			);
			this.pointerlockchangeListener = null;
		}

		this.keys.clear();
		this.keysJustPressed.clear();
		this.keysJustReleased.clear();
		this.mouseButtons.clear();
		this.mouseButtonsJustPressed.clear();
		this.mouseButtonsJustReleased.clear();
		this.actions.clear();

		this.initialized = false;
		this._canvas = null;
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

/** Global input instance manager reference tracking. */
let activeInput: InputManager | null = null;

/**
 * Sets the active InputManager instance.
 *
 * @param input - InputManager instance.
 */
export function setActiveInput(input: InputManager) {
	activeInput = input;
}

/**
 * Retrieves the currently active InputManager instance, falling back to a default singleton.
 *
 * @returns The active InputManager.
 */
export function getActiveInput(): InputManager {
	if (!activeInput) {
		activeInput = new InputManager();
		activeInput.init();
	}
	return activeInput;
}

/**
 * Global InputManager proxy singleton instance.
 * Forwards all calls dynamically to the active context's InputManager.
 *
 * @group Input & Physics
 */
export const Input = new Proxy(new InputManager(), {
	// biome-ignore lint/suspicious/noExplicitAny: proxy generic target
	get(target: any, prop: string | symbol) {
		const active = getActiveInput();
		const val = Reflect.get(active, prop, active);
		if (typeof val === "function") {
			return val.bind(active);
		}
		return val;
	},
	// biome-ignore lint/suspicious/noExplicitAny: proxy generic target
	set(target: any, prop: string | symbol, value: any) {
		const active = getActiveInput();
		return Reflect.set(active, prop, value, active);
	},
}) as unknown as InputManager;
