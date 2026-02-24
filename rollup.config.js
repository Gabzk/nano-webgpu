import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

export default {
	input: "src/index.ts",
	output: {
		dir: "dist",
		format: "es",
		sourcemap: true,
	},
	plugins: [resolve(), commonjs(), typescript({ tsconfig: "./tsconfig.json" })],
};
