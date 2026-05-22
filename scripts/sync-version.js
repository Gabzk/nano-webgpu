import fs from "node:fs";

const pkg = JSON.parse(
	fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

const versionContent = `/**
 * The current version of the nano-webgpu library.
 *
 * @group Core
 */
export const VERSION = "${pkg.version}";
`;

fs.writeFileSync(new URL("../src/version.ts", import.meta.url), versionContent);
