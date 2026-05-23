// steps/gather-context.ts — Step 1: deterministic exploration + compression
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { compressConfig, compressPackageJson, compressTree } from "../lib/compress.ts";

const CONFIG_PATTERNS = [
  "package.json", "pyproject.toml", "Cargo.toml", "pom.xml",
  "build.gradle", "turbo.json", "mise.toml", "composer.json",
  "Gemfile", "go.mod", "deno.json", "tsconfig.json", "angular.json", "nx.json",
];

export async function gatherContext(
  pi: ExtensionAPI,
  cwd: string,
  signal?: AbortSignal,
): Promise<string> {
  // 1. Project tree (depth 5)
  const treeResult = await pi.exec("eza", ["--tree", "--level=5", "."], { signal, timeout: 10000 });
  const tree = treeResult.code === 0 ? treeResult.stdout : "";

  // 2. Detect config files
  const globArgs = CONFIG_PATTERNS.map((p) => ["-name", p]).flat();
  const findArgs = [".", "-maxdepth", "3", "(", ...globArgs.reduce<string[]>((acc, arg, i) => {
    if (i > 0 && i % 2 === 0) acc.push("-o");
    acc.push(arg);
    return acc;
  }, []), ")", "-type", "f"];

  const configResult = await pi.exec("find", findArgs, { signal, timeout: 5000 });
  const configFiles = configResult.code === 0
    ? configResult.stdout.split("\n").filter((l) => {
        const t = l.trim();
        return t && CONFIG_PATTERNS.some((p) => t.endsWith(p));
      })
    : [];

  // 3. Read each config (limit to 10)
  const configs: Array<{ filename: string; content: string }> = [];
  for (const file of configFiles.slice(0, 10)) {
    const r = await pi.exec("cat", [file], { signal, timeout: 3000 });
    if (r.code === 0) configs.push({ filename: file.split("/").pop() || file, content: r.stdout });
  }

  // 4. Check graphify-out
  const graphifyResult = await pi.exec("test", ["-d", "graphify-out"], { signal, timeout: 2000 });
  const graphifyExists = graphifyResult.code === 0;

  return assembleContext(tree, configs, graphifyExists);
}

function assembleContext(
  tree: string,
  configs: Array<{ filename: string; content: string }>,
  graphifyExists: boolean,
): string {
  const sections: string[] = [];

  if (tree) sections.push(`## Project Structure\n${compressTree(tree)}`);

  for (const cfg of configs) {
    const compressed = cfg.filename === "package.json"
      ? compressPackageJson(cfg.content)
      : compressConfig(cfg.filename, cfg.content);
    sections.push(`## ${cfg.filename}\n${compressed}`);
  }

  if (graphifyExists) {
    sections.push("## Knowledge Graph\ngraphify-out/ exists — can query codebase graph.");
  }

  const assembled = sections.join("\n\n");
  return assembled.length > 8000 ? assembled.slice(0, 8000) + "\n\n[context truncated]" : assembled;
}
