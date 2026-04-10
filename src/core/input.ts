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

	public init() {
		if (this.initialized) return;

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

		this.initialized = true;
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
