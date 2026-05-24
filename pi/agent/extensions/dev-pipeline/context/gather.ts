export type ExecFn = (
	command: string,
	args: string[],
	options?: { timeout?: number },
) => Promise<{ code: number; stdout: string; stderr: string }>;

/** FR-6 exclusions. */
export const EXCLUDE_DIRS = [
	"node_modules",
	".git",
	"dist",
	"build",
	".next",
	"__pycache__",
	"target",
	".venv",
	"coverage",
];

const MANIFESTS = ["package.json", "pyproject.toml", "Cargo.toml", "go.mod", "pom.xml", "build.gradle", "Gemfile"];

export interface GatheredContext {
	tree: string;
	stack: string;
	probes: string;
	astGrep: boolean;
	graphify: boolean;
}

/**
 * FR-7: reduce a manifest to compressed signal only.
 * package.json → name + dependency names + script names (never versions/values).
 * Other manifests → just the filename marker (full parsing out of scope for v1).
 */
export function parseStack(manifest: string, content: string): string {
	if (manifest === "package.json") {
		try {
			const pkg = JSON.parse(content) as {
				name?: string;
				dependencies?: Record<string, string>;
				devDependencies?: Record<string, string>;
				scripts?: Record<string, string>;
			};
			const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
			const scripts = Object.keys(pkg.scripts ?? {});
			return [
				`package.json: ${pkg.name ?? "(unnamed)"}`,
				deps.length ? `deps: ${deps.join(", ")}` : "deps: (none)",
				scripts.length ? `scripts: ${scripts.join(", ")}` : "scripts: (none)",
			].join("\n");
		} catch {
			return "package.json: (unparseable)";
		}
	}
	return `${manifest}: present`;
}

function buildTreeArgs(cwd: string): string[] {
	// Single --ignore-glob with pipe-separated patterns: eza 0.23 only honours the last
	// --ignore-glob flag when a positional path is supplied, so we combine all patterns.
	return ["--tree", "--level=3", "--ignore-glob", EXCLUDE_DIRS.join("|"), cwd];
}

/** All probes are best-effort: a non-zero exit means "absent", never an error (FR-8/FR-18). */
export async function gatherContext(exec: ExecFn, cwd: string): Promise<GatheredContext> {
	// FR-6 tree
	let tree = "";
	try {
		const r = await exec("eza", buildTreeArgs(cwd), { timeout: 15000 });
		tree = r.code === 0 ? r.stdout.trim() : "(tree unavailable)";
	} catch {
		tree = "(tree unavailable)";
	}

	// FR-7 stack: list manifests present, then compress each.
	const stackParts: string[] = [];
	try {
		const ls = await exec("ls", ["-1", cwd]);
		const present = ls.code === 0 ? ls.stdout.split("\n").map((s) => s.trim()) : [];
		for (const manifest of MANIFESTS) {
			if (!present.includes(manifest)) continue;
			const cat = await exec("cat", [`${cwd}/${manifest}`]);
			stackParts.push(parseStack(manifest, cat.code === 0 ? cat.stdout : ""));
		}
	} catch {
		// leave stackParts empty
	}
	const stack = stackParts.length ? stackParts.join("\n\n") : "(no recognized manifest)";

	// FR-8 probes
	const astGrep = (await safeCode(exec, "which", ["ast-grep"])) === 0;
	const graphify = (await safeCode(exec, "test", ["-d", `${cwd}/graphify-out`])) === 0;
	const probes = `ast_grep=${astGrep} graphify=${graphify}`;

	return { tree, stack, probes, astGrep, graphify };
}

async function safeCode(exec: ExecFn, command: string, args: string[]): Promise<number> {
	try {
		return (await exec(command, args)).code;
	} catch {
		return 1;
	}
}
