import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export async function buildProjectContext(pi: ExtensionAPI, cwd: string): Promise<string> {
  const sections: string[] = [];

  const tree = await pi.exec("eza", ["--tree", "--level=2", "-I", "node_modules|.git|dist|build|coverage"], { cwd });
  if (tree.code === 0 && tree.stdout.trim())
    sections.push(`## Project Structure\n\`\`\`\n${truncate(tree.stdout, 2000)}\n\`\`\``);

  const pkg = await pi.exec("cat", ["package.json"], { cwd });
  if (pkg.code === 0) {
    try {
      const p = JSON.parse(pkg.stdout);
      const s = { name: p.name, description: p.description, scripts: Object.keys(p.scripts ?? {}), deps: Object.keys(p.dependencies ?? {}), devDeps: Object.keys(p.devDependencies ?? {}) };
      sections.push(`## Tech Stack\n\`\`\`json\n${JSON.stringify(s, null, 2)}\n\`\`\``);
    } catch { /* not node */ }
  }

  const cargo = await pi.exec("cat", ["Cargo.toml"], { cwd });
  if (cargo.code === 0 && cargo.stdout.trim())
    sections.push(`## Cargo.toml (excerpt)\n\`\`\`toml\n${truncate(cargo.stdout, 1000)}\n\`\`\``);

  const git = await pi.exec("git", ["log", "--oneline", "-10"], { cwd });
  if (git.code === 0 && git.stdout.trim())
    sections.push(`## Recent Commits\n\`\`\`\n${git.stdout.trim()}\n\`\`\``);

  const readme = await pi.exec("head", ["-50", "README.md"], { cwd });
  if (readme.code === 0 && readme.stdout.trim())
    sections.push(`## README (excerpt)\n${truncate(readme.stdout, 1000)}`);

  const hasGraph = await pi.exec("test", ["-d", "graphify-out"], { cwd });
  if (hasGraph.code === 0)
    sections.push(`## Knowledge Graph\n\`graphify-out/\` detected. Use \`graphify query "<question>"\` to explore architecture.`);

  return sections.length > 0 ? sections.join("\n\n") : "(No project context gathered)";
}

export async function hasGraphify(pi: ExtensionAPI, cwd: string): Promise<boolean> {
  return (await pi.exec("test", ["-d", "graphify-out"], { cwd })).code === 0;
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max) + "\n... (truncated)";
}
