/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

export default defineConfig({
	server: {
		port: 3000,
		open: "/demo/index.html",
	},
	resolve: {
		alias: {
			"nano-webgpu": "/src/index.ts",
		},
	},
	test: {
		globals: true,
		environment: "happy-dom",
		include: ["test/**/*.test.ts"],
	},
});
