/**
 * @module PerformanceTracker
 * @description
 * Collects per-frame performance metrics for the debug panel.
 * Inspired by Godot's Monitors tab: tracks FPS, frame time, draw calls,
 * vertex/triangle counts, and maintains a rolling history for graphing.
 */

export class PerformanceTracker {
	// --- Current frame metrics ---
	public fps: number = 0;
	public frameTimeMs: number = 0;
	public drawCalls: number = 0;
	public verticesDrawn: number = 0;
	public trianglesDrawn: number = 0;
	public visibleMeshes: number = 0;
	public totalMeshes: number = 0;
	public nodeCount: number = 0;
	public lightCount: number = 0;
	public materialChanges: number = 0;

	// --- History for FPS graph (last N frames) ---
	public fpsHistory: number[] = [];
	public frameTimeHistory: number[] = [];
	private readonly historySize: number = 120;

	// --- Internal timing ---
	private frameStart: number = 0;
	private frameCount: number = 0;
	private fpsAccumulator: number = 0;
	private fpsUpdateInterval: number = 200; // ms between FPS updates
	private lastFpsUpdate: number = 0;
	private smoothFps: number = 60;

	// --- Per-frame accumulators (reset each frame) ---
	private _drawCalls: number = 0;
	private _verticesDrawn: number = 0;
	private _trianglesDrawn: number = 0;
	private _visibleMeshes: number = 0;
	private _materialChanges: number = 0;

	/**
	 * Call at the very start of _renderFrame().
	 */
	public beginFrame(): void {
		this.frameStart = performance.now();
		this._drawCalls = 0;
		this._verticesDrawn = 0;
		this._trianglesDrawn = 0;
		this._visibleMeshes = 0;
		this._materialChanges = 0;
	}

	/**
	 * Record a single draw call with its vertex/index info.
	 */
	public recordDraw(vertexCount: number, indexCount: number): void {
		this._drawCalls++;
		this._verticesDrawn += vertexCount;
		this._trianglesDrawn += Math.floor(indexCount / 3);
		this._visibleMeshes++;
	}

	/**
	 * Record a pipeline/material switch.
	 */
	public recordMaterialChange(): void {
		this._materialChanges++;
	}

	/**
	 * Call at the very end of _renderFrame().
	 */
	public endFrame(): void {
		const now = performance.now();
		this.frameTimeMs = now - this.frameStart;

		// Commit per-frame accumulators
		this.drawCalls = this._drawCalls;
		this.verticesDrawn = this._verticesDrawn;
		this.trianglesDrawn = this._trianglesDrawn;
		this.visibleMeshes = this._visibleMeshes;
		this.materialChanges = this._materialChanges;

		// Smooth FPS calculation
		this.frameCount++;
		this.fpsAccumulator += this.frameTimeMs;

		if (now - this.lastFpsUpdate >= this.fpsUpdateInterval) {
			this.smoothFps = (this.frameCount / this.fpsAccumulator) * 1000;
			this.fps = Math.round(this.smoothFps);
			this.frameCount = 0;
			this.fpsAccumulator = 0;
			this.lastFpsUpdate = now;
		}

		// Push to history
		this.fpsHistory.push(this.smoothFps);
		if (this.fpsHistory.length > this.historySize) this.fpsHistory.shift();

		this.frameTimeHistory.push(this.frameTimeMs);
		if (this.frameTimeHistory.length > this.historySize)
			this.frameTimeHistory.shift();
	}

	/**
	 * Format large numbers with K/M suffixes.
	 */
	public static formatCount(n: number): string {
		if (n < 1000) return n.toString();
		if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
		return `${(n / 1_000_000).toFixed(1)}M`;
	}
}
