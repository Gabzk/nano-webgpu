/**
 * PerformanceTracker aggregates frame timing and draw metrics.
 * Records FPS, frame processing duration (in milliseconds), total draw calls,
 * mesh counts, polygon indices, and maintains a rolling history to feed profiling graphs.
 */
export class PerformanceTracker {
	/** Estimated frames per second. */
	public fps: number = 0;
	/** Processing duration in milliseconds for the current frame. */
	public frameTimeMs: number = 0;
	/** Number of draw commands submitted this frame. */
	public drawCalls: number = 0;
	/** Number of coordinates sent to vertex pipelines this frame. */
	public verticesDrawn: number = 0;
	/** Number of polygon faces processed this frame. */
	public trianglesDrawn: number = 0;
	/** Number of active visible meshes drawn this frame. */
	public visibleMeshes: number = 0;
	/** Total registered meshes in the active scene graph. */
	public totalMeshes: number = 0;
	/** Total nodes in the active scene graph. */
	public nodeCount: number = 0;
	/** Count of active light sources in the scene. */
	public lightCount: number = 0;
	/** Count of material pipeline switches this frame. */
	public materialChanges: number = 0;

	/** Rolling collection of recorded FPS values. */
	public fpsHistory: number[] = [];
	/** Rolling collection of recorded frame timing millisecond values. */
	public frameTimeHistory: number[] = [];
	/** Size limit of the rolling history arrays. Defaults to `120`. */
	private readonly historySize: number = 120;

	/** @internal Frame calculations starting timestamp. */
	private frameStart: number = 0;
	/** @internal Frame counter. */
	private frameCount: number = 0;
	/** @internal Target interval between FPS metrics calculations. Defaults to `200` ms. */
	private fpsUpdateInterval: number = 200;
	/** @internal Timestamp of the last FPS update. */
	private lastFpsUpdate: number = 0;
	/** @internal Filtered running average FPS calculation. */
	private smoothFps: number = 60;

	// --- Per-frame accumulators (reset each frame) ---
	/** @internal Frame draw call accumulator. */
	private _drawCalls: number = 0;
	/** @internal Frame vertices drawn accumulator. */
	private _verticesDrawn: number = 0;
	/** @internal Frame triangles drawn accumulator. */
	private _trianglesDrawn: number = 0;
	/** @internal Frame visible meshes count accumulator. */
	private _visibleMeshes: number = 0;
	/** @internal Frame material switches accumulator. */
	private _materialChanges: number = 0;

	/**
	 * Signals the start of a new frame computation. Resets active counter accumulators
	 * and stores the starting timestamp.
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
	 * Registers draw pass details, incrementing vertices and estimated triangle counts.
	 *
	 * @param vertexCount - Number of vertices drawn.
	 * @param indexCount - Number of indices processed.
	 */
	public recordDraw(vertexCount: number, indexCount: number): void {
		this._drawCalls++;
		this._verticesDrawn += vertexCount;
		this._trianglesDrawn += Math.floor(indexCount / 3);
		this._visibleMeshes++;
	}

	/**
	 * Registers a pipeline or material bind group switch.
	 */
	public recordMaterialChange(): void {
		this._materialChanges++;
	}

	/**
	 * Signals the end of the frame computations. Calculates elapsed processing time,
	 * computes rolling averages, and pushes results to metrics history queues.
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

		// Smooth FPS calculation using actual elapsed wall-clock time
		this.frameCount++;

		if (now - this.lastFpsUpdate >= this.fpsUpdateInterval) {
			const elapsedMs = now - this.lastFpsUpdate;
			this.smoothFps = (this.frameCount / elapsedMs) * 1000;
			this.fps = Math.round(this.smoothFps);
			this.frameCount = 0;
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
	 * Formats large count values using compact SI symbols (K for thousands, M for millions).
	 *
	 * @param n - Raw count number.
	 * @returns Formatted string.
	 */
	public static formatCount(n: number): string {
		if (n < 1000) return n.toString();
		if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
		return `${(n / 1_000_000).toFixed(1)}M`;
	}
}
