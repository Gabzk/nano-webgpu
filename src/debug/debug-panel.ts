/**
 * @module DebugPanel
 * @description
 * HTML overlay debug panel inspired by Godot's Debugger panel.
 * Displays real-time performance metrics, VRAM allocations, and scene stats
 * in a semi-transparent dark panel with tabs.
 *
 * Activated via scene.enableDebug() and toggled with F3.
 */

import { PerformanceTracker } from "./performance-tracker";
import { VRAMTracker } from "./vram-tracker";

export interface DebugPanelOptions {
	/** Panel position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' */
	position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
	/** Default active tab */
	defaultTab?: "monitors" | "vram" | "scene";
	/** Keyboard hotkey to toggle visibility */
	hotkey?: string;
	/** Panel opacity (0–1) */
	opacity?: number;
}

type TabName = "monitors" | "vram" | "scene";

export class DebugPanel {
	private container!: HTMLDivElement;
	private fpsCanvas!: HTMLCanvasElement;
	private fpsCtx!: CanvasRenderingContext2D;
	private tabContentEl!: HTMLDivElement;
	private activeTab: TabName = "monitors";
	private visible: boolean = true;
	private hotkey: string;
	private perf: PerformanceTracker;
	private opacity: number;

	// Tab button elements for styling
	private tabButtons: Map<TabName, HTMLButtonElement> = new Map();

	// Throttle: avoid DOM thrashing at high FPS
	private lastUpdateTime: number = 0;
	private readonly updateIntervalMs: number = 100; // Monitors refresh rate
	private readonly slowUpdateIntervalMs: number = 500; // VRAM/Scene refresh rate

	// Scene stats callback
	private getSceneStats?: () => {
		totalMeshes: number;
		totalNodes: number;
		lightCount: number;
	};

	constructor(
		canvas: HTMLCanvasElement,
		perf: PerformanceTracker,
		options: DebugPanelOptions = {},
	) {
		this.perf = perf;
		this.hotkey = options.hotkey ?? "F3";
		this.activeTab = options.defaultTab ?? "monitors";
		this.opacity = options.opacity ?? 0.9;

		this.createDOM(canvas, options.position ?? "top-left");
		this.setupHotkey();
	}

	/**
	 * Provide a callback to retrieve live scene stats.
	 */
	public setSceneStatsProvider(
		fn: () => { totalMeshes: number; totalNodes: number; lightCount: number },
	): void {
		this.getSceneStats = fn;
	}

	/**
	 * Called each frame from Scene._renderFrame() to refresh the panel.
	 */
	public update(): void {
		if (!this.visible) return;

		const now = performance.now();
		const interval =
			this.activeTab === "monitors"
				? this.updateIntervalMs
				: this.slowUpdateIntervalMs;

		if (now - this.lastUpdateTime < interval) return;
		this.lastUpdateTime = now;

		switch (this.activeTab) {
			case "monitors":
				this.renderMonitorsTab();
				break;
			case "vram":
				this.renderVRAMTab();
				break;
			case "scene":
				this.renderSceneTab();
				break;
		}
	}

	public toggle(): void {
		this.visible = !this.visible;
		this.container.style.display = this.visible ? "block" : "none";
	}

	public show(): void {
		this.visible = true;
		this.container.style.display = "block";
	}

	public hide(): void {
		this.visible = false;
		this.container.style.display = "none";
	}

	public destroy(): void {
		this.container.remove();
		document.removeEventListener("keydown", this.onKeyDown);
	}

	// ─── DOM Construction ─────────────────────────────────────────

	private createDOM(canvas: HTMLCanvasElement, position: string): void {
		// Ensure parent is positioned
		const parent = canvas.parentElement || document.body;
		const parentPos = getComputedStyle(parent).position;
		if (parentPos === "static") {
			parent.style.position = "relative";
		}

		this.container = document.createElement("div");
		this.container.id = "nano-debug-panel";
		this.container.style.cssText = this.getContainerStyle(position);

		// TRICK: Move the CSS resize handle to the bottom-left if the panel is on the right edge.
		if (position.includes("right")) {
			this.container.style.direction = "rtl";
		}

		// Inner wrapper resets direction back to left-to-right for the contents
		const innerWrapper = document.createElement("div");
		innerWrapper.style.direction = "ltr";

		// Header with title and tabs
		const header = document.createElement("div");
		header.style.cssText = `
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 6px 10px;
			border-bottom: 1px solid rgba(255,255,255,0.1);
			user-select: none;
		`;

		const title = document.createElement("span");
		title.textContent = "nano-webgpu";
		title.style.cssText = `
			font-weight: 700;
			font-size: 11px;
			color: #a0e8ff;
			letter-spacing: 0.5px;
			text-transform: uppercase;
		`;

		const tabs = document.createElement("div");
		tabs.style.cssText = `display: flex; gap: 2px;`;

		const tabDefs: { name: TabName; icon: string; tooltip: string }[] = [
			{ name: "monitors", icon: "📊", tooltip: "Monitors" },
			{ name: "vram", icon: "🎮", tooltip: "VRAM" },
			{ name: "scene", icon: "🌳", tooltip: "Scene" },
		];

		for (const def of tabDefs) {
			const btn = document.createElement("button");
			btn.textContent = def.icon;
			btn.title = def.tooltip;
			btn.style.cssText = this.getTabButtonStyle(def.name === this.activeTab);
			btn.addEventListener("click", () => this.switchTab(def.name));
			tabs.appendChild(btn);
			this.tabButtons.set(def.name, btn);
		}

		header.appendChild(title);
		header.appendChild(tabs);
		innerWrapper.appendChild(header);

		// Tab content area
		this.tabContentEl = document.createElement("div");
		this.tabContentEl.style.cssText = `padding: 8px 10px; font-size: 12px;`;
		innerWrapper.appendChild(this.tabContentEl);

		// FPS graph canvas (only shown in monitors tab)
		this.fpsCanvas = document.createElement("canvas");
		this.fpsCanvas.width = 260;
		this.fpsCanvas.height = 40;
		this.fpsCanvas.style.cssText = `
			display: block;
			width: 100%;
			height: 40px;
			margin-top: 6px;
			border-radius: 4px;
			background: rgba(0,0,0,0.3);
		`;
		this.fpsCtx = this.fpsCanvas.getContext("2d")!;

		this.container.appendChild(innerWrapper);
		parent.appendChild(this.container);
	}

	private getContainerStyle(position: string): string {
		const posMap: Record<string, string> = {
			"top-left": "top: 10px; left: 10px;",
			"top-right": "top: 10px; right: 10px;",
			"bottom-left": "bottom: 10px; left: 10px;",
			"bottom-right": "bottom: 10px; right: 10px;",
		};

		return `
			position: absolute;
			${posMap[position] || posMap["top-left"]}
			width: 300px;
			min-width: 280px;
			max-width: 800px;
			resize: horizontal;
			background: rgba(18, 18, 28, ${this.opacity});
			backdrop-filter: blur(12px);
			-webkit-backdrop-filter: blur(12px);
			border: 1px solid rgba(255, 255, 255, 0.08);
			border-radius: 8px;
			color: #e0e0e0;
			font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', monospace;
			font-size: 12px;
			line-height: 1.5;
			z-index: 10000;
			pointer-events: auto;
			box-shadow: 0 4px 24px rgba(0,0,0,0.5);
			overflow: hidden;
		`;
	}

	private getTabButtonStyle(active: boolean): string {
		return `
			background: ${active ? "rgba(160, 232, 255, 0.15)" : "transparent"};
			border: 1px solid ${active ? "rgba(160, 232, 255, 0.3)" : "transparent"};
			border-radius: 4px;
			padding: 2px 6px;
			cursor: pointer;
			font-size: 13px;
			line-height: 1;
			transition: background 0.15s;
		`;
	}

	private switchTab(tab: TabName): void {
		this.activeTab = tab;
		for (const [name, btn] of this.tabButtons) {
			btn.style.cssText = this.getTabButtonStyle(name === tab);
		}
	}

	// ─── Hotkey ───────────────────────────────────────────────────

	private onKeyDown = (e: KeyboardEvent) => {
		if (e.key === this.hotkey) {
			e.preventDefault();
			this.toggle();
		}
	};

	private setupHotkey(): void {
		document.addEventListener("keydown", this.onKeyDown);
	}

	// ─── Tab Renderers ────────────────────────────────────────────

	private renderMonitorsTab(): void {
		const p = this.perf;
		const vram = VRAMTracker.getSummary();

		// FPS color: green > 50, yellow > 25, red <= 25
		const fpsColor =
			p.fps >= 50 ? "#4ade80" : p.fps >= 25 ? "#facc15" : "#f87171";

		const sceneStats = this.getSceneStats?.() ?? {
			totalMeshes: p.totalMeshes,
			totalNodes: p.nodeCount,
			lightCount: p.lightCount,
		};

		this.tabContentEl.innerHTML = `
			<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2px 12px;">
				${this.metricRow("FPS", `<span style="color:${fpsColor};font-weight:700">${p.fps}</span>`)}
				${this.metricRow("Frame", `${p.frameTimeMs.toFixed(1)} ms`)}
				${this.metricRow("Draw Calls", `${p.drawCalls}`)}
				${this.metricRow("Vertices", PerformanceTracker.formatCount(p.verticesDrawn))}
				${this.metricRow("Triangles", PerformanceTracker.formatCount(p.trianglesDrawn))}
				${this.metricRow("Mat Changes", `${p.materialChanges}`)}
			</div>
			<div style="margin-top:6px; border-top: 1px solid rgba(255,255,255,0.06); padding-top:6px;
			            display: grid; grid-template-columns: 1fr 1fr; gap: 2px 12px;">
				${this.metricRow("Meshes", `${p.visibleMeshes}/${sceneStats.totalMeshes}`)}
				${this.metricRow("Nodes", `${sceneStats.totalNodes}`)}
				${this.metricRow("Lights", `${sceneStats.lightCount}`)}
				${this.metricRow("VRAM", VRAMTracker.formatBytes(vram.totalBytes))}
			</div>
		`;

		// Append the FPS graph canvas
		this.tabContentEl.appendChild(this.fpsCanvas);
		this.drawFpsGraph();
	}

	private renderVRAMTab(): void {
		const entries = VRAMTracker.getEntries();
		const summary = VRAMTracker.getSummary();

		// Preserve scroll position so it doesn't jump to top on update
		const scrollContainer = this.tabContentEl.querySelector(
			".vram-scroll-container",
		);
		const currentScroll = scrollContainer ? scrollContainer.scrollTop : 0;

		let tableRows = "";
		for (const e of entries) {
			const icon = e.type === "texture" ? "🟦" : "🟩";
			const typeName = e.type === "texture" ? "Tex" : "Buf";

			tableRows += `
				<tr style="border-bottom: 1px solid rgba(255,255,255,0.02)">
					<td style="padding: 4px; white-space: nowrap;">${icon} ${typeName}</td>
					<td style="padding: 4px; color: #ccc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${e.label}">${e.label}</td>
					<td style="padding: 4px; text-align: right; color: #a0e8ff; white-space: nowrap;">${VRAMTracker.formatBytes(e.sizeBytes)}</td>
					<td style="padding: 4px; color: #888; white-space: nowrap;">${e.owner}</td>
				</tr>
			`;
		}

		this.tabContentEl.innerHTML = `
			<div style="margin-bottom: 6px; color: #a0e8ff; font-weight: 600;">
				VRAM: ${VRAMTracker.formatBytes(summary.totalBytes)}
				<span style="color: #888; font-weight: 400;"> (${summary.totalResources} resources)</span>
			</div>
			<div class="vram-scroll-container" style="max-height: 280px; min-height: 100px; display: block; overflow-y: auto; overflow-x: hidden; scrollbar-width: thin; resize: vertical;">
				<table style="width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed;">
					<thead>
						<tr style="color: #888; border-bottom: 1px solid rgba(255,255,255,0.08);">
							<th style="padding: 2px 4px; text-align: left; width: 65px;">Type</th>
							<th style="padding: 2px 4px; text-align: left;">Label</th>
							<th style="padding: 2px 4px; text-align: right; width: 60px;">Size</th>
							<th style="padding: 2px 4px; text-align: left; width: 20%;">Owner</th>
						</tr>
					</thead>
					<tbody>
						${tableRows}
					</tbody>
				</table>
			</div>
		`;

		// Restore scroll position
		const newScrollContainer = this.tabContentEl.querySelector(
			".vram-scroll-container",
		);
		if (newScrollContainer) {
			newScrollContainer.scrollTop = currentScroll;
		}
	}

	private renderSceneTab(): void {
		const p = this.perf;
		const vram = VRAMTracker.getSummary();
		const sceneStats = this.getSceneStats?.() ?? {
			totalMeshes: p.totalMeshes,
			totalNodes: p.nodeCount,
			lightCount: p.lightCount,
		};

		this.tabContentEl.innerHTML = `
			<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2px 12px;">
				<div style="grid-column: 1 / -1; color: #a0e8ff; font-weight: 600; margin-bottom: 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Objects</div>
				${this.metricRow("Total Meshes", `${sceneStats.totalMeshes}`)}
				${this.metricRow("Visible", `${p.visibleMeshes}`)}
				${this.metricRow("Hidden", `${sceneStats.totalMeshes - p.visibleMeshes}`)}
				${this.metricRow("Total Nodes", `${sceneStats.totalNodes}`)}
				${this.metricRow("Lights", `${sceneStats.lightCount}`)}
			</div>
			<div style="margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 8px;
			            display: grid; grid-template-columns: 1fr 1fr; gap: 2px 12px;">
				<div style="grid-column: 1 / -1; color: #a0e8ff; font-weight: 600; margin-bottom: 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Memory</div>
				${this.metricRow("VRAM Total", VRAMTracker.formatBytes(vram.totalBytes))}
				${this.metricRow("Buffers", `${vram.buffers}`)}
				${this.metricRow("Textures", `${vram.textures}`)}
			</div>
		`;
	}

	// ─── Helpers ──────────────────────────────────────────────────

	private metricRow(label: string, value: string): string {
		return `
			<div style="color: #888; font-size: 11px;">${label}</div>
			<div style="text-align: right;">${value}</div>
		`;
	}

	private drawFpsGraph(): void {
		const ctx = this.fpsCtx;
		const w = this.fpsCanvas.width;
		const h = this.fpsCanvas.height;
		const history = this.perf.fpsHistory;

		ctx.clearRect(0, 0, w, h);

		if (history.length < 2) return;

		// Find max for normalization
		const maxFps = Math.max(...history, 60);

		// Draw bars
		const barWidth = w / this.perf.fpsHistory.length;

		for (let i = 0; i < history.length; i++) {
			const val = history[i];
			const ratio = val / maxFps;
			const barH = ratio * (h - 4);

			// Color gradient: green > yellow > red
			let color: string;
			if (val >= 50) color = "rgba(74, 222, 128, 0.7)";
			else if (val >= 25) color = "rgba(250, 204, 21, 0.7)";
			else color = "rgba(248, 113, 113, 0.7)";

			ctx.fillStyle = color;
			ctx.fillRect(i * barWidth, h - barH - 2, barWidth - 0.5, barH);
		}

		// 60 FPS reference line
		const refY = h - (60 / maxFps) * (h - 4) - 2;
		ctx.strokeStyle = "rgba(160, 232, 255, 0.3)";
		ctx.lineWidth = 1;
		ctx.setLineDash([3, 3]);
		ctx.beginPath();
		ctx.moveTo(0, refY);
		ctx.lineTo(w, refY);
		ctx.stroke();
		ctx.setLineDash([]);
	}
}
