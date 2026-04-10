export type MouseMode = "visible" | "captured";

export class InputManager {
	private keys: Set<string> = new Set();
	private keysJustPressed: Set<string> = new Set();
	private keysJustReleased: Set<string> = new Set();

	private mouseButtons: Set<number> = new Set();
	private mouseButtonsJustPressed: Set<number> = new Set();
	private mouseButtonsJustReleased: Set<number> = new Set();

	public mousePosition: { x: number; y: number } = { x: 0, y: 0 };
	public mouseMovement: { x: number; y: number } = { x: 0, y: 0 };

	private actions: Map<string, string[]> = new Map();
	private initialized = false;

	private _mouseMode: MouseMode = "visible";
	private _canvas: HTMLCanvasElement | null = null;

	/** Whether the mouse cursor is currently locked/captured. */
	public get isMouseCaptured(): boolean {
		return (
			document.pointerLockElement === this._canvas && this._canvas !== null
		);
	}

	/** Current mouse mode */
	public get mouseMode(): MouseMode {
		return this._mouseMode;
	}

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
	 * Sets the mouse mode.
	 * - "captured": Hides + locks the cursor. Click the canvas to actually capture.
	 *   Moving to "captured" arms the system — the lock happens on the next click
	 *   (required by the browser's user-gesture policy).
	 * - "visible": Releases the pointer lock immediately.
	 *
	 * Inspired by Godot's Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED).
	 */
	public setMouseMode(mode: MouseMode): void {
		this._mouseMode = mode;
		if (mode === "visible") {
			document.exitPointerLock();
		}
		// For "captured": the actual requestPointerLock() is called inside
		// the mousedown handler (user gesture), so the browser allows it.
	}

	public addAction(action: string, codes: string[]) {
		this.actions.set(action, codes);
	}

	public isActionPressed(action: string): boolean {
		const codes = this.actions.get(action);
		if (!codes) return false;
		return codes.some((code) => this.isKeyPressed(code));
	}

	public isActionJustPressed(action: string): boolean {
		const codes = this.actions.get(action);
		if (!codes) return false;
		return codes.some((code) => this.isKeyJustPressed(code));
	}

	public isActionJustReleased(action: string): boolean {
		const codes = this.actions.get(action);
		if (!codes) return false;
		return codes.some((code) => this.isKeyJustReleased(code));
	}

	public isKeyPressed(code: string): boolean {
		return this.keys.has(code);
	}

	public isKeyJustPressed(code: string): boolean {
		return this.keysJustPressed.has(code);
	}

	public isKeyJustReleased(code: string): boolean {
		return this.keysJustReleased.has(code);
	}

	public isMouseButtonPressed(button: number): boolean {
		return this.mouseButtons.has(button);
	}

	public isMouseButtonJustPressed(button: number): boolean {
		return this.mouseButtonsJustPressed.has(button);
	}

	public isMouseButtonJustReleased(button: number): boolean {
		return this.mouseButtonsJustReleased.has(button);
	}

	/**
	 * Should be called at the end of the frame to reset "just pressed" and "movement" states.
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

export const Input = new InputManager();
