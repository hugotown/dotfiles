import { expect, test } from "bun:test";
import { parseStack, EXCLUDE_DIRS, gatherContext, type ExecFn } from "../context/gather.ts";

test("parseStack reduces package.json to name + dep + script names only", () => {
	const pkg = JSON.stringify({
		name: "demo",
		version: "1.0.0",
		dependencies: { react: "^18", zod: "^3" },
		devDependencies: { typescript: "^5" },
		scripts: { build: "tsc", test: "vitest" },
	});
	const out = parseStack("package.json", pkg);
	expect(out).toContain("demo");
	expect(out).toContain("react");
	expect(out).toContain("zod");
	expect(out).toContain("typescript");
	expect(out).toContain("build");
	expect(out).toContain("test");
	// No version strings leak through.
	expect(out).not.toContain("^18");
	expect(out).not.toContain("vitest"); // script *values* are dropped; only names kept
});

test("parseStack handles unknown manifest by emitting just its name", () => {
	expect(parseStack("go.mod", "module example.com/x\n")).toContain("go.mod");
});

test("EXCLUDE_DIRS contains the required exclusions", () => {
	for (const d of ["node_modules", ".git", "dist", "build", ".next", "__pycache__", "target", ".venv", "coverage"]) {
		expect(EXCLUDE_DIRS).toContain(d);
	}
});

test("gatherContext probes ast-grep and graphify and never throws on missing tools", async () => {
	const exec: ExecFn = async (cmd, args) => {
		if (cmd === "eza") return { code: 0, stdout: "src\n  index.ts", stderr: "" };
		if (cmd === "which" && args[0] === "ast-grep") return { code: 1, stdout: "", stderr: "" }; // absent
		if (cmd === "test") return { code: 1, stdout: "", stderr: "" }; // graphify-out absent
		if (cmd === "cat") return { code: 0, stdout: JSON.stringify({ name: "demo", dependencies: { a: "1" } }), stderr: "" };
		if (cmd === "ls") return { code: 0, stdout: "package.json", stderr: "" };
		return { code: 1, stdout: "", stderr: "" };
	};
	const result = await gatherContext(exec, "/repo");
	expect(result.probes).toContain("ast_grep=false");
	expect(result.probes).toContain("graphify=false");
	expect(result.tree).toContain("src");
	expect(result.stack).toContain("demo");
});
