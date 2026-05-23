// lib/compress.ts — Pure compression functions for project context

const FILTERED_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next",
  "__pycache__", "target/debug", "target/release",
  ".turbo", ".cache", "coverage",
]);

export function compressTree(tree: string): string {
  const lines = tree.split("\n");
  const result: string[] = [];
  let skipDepth = -1;

  for (const line of lines) {
    const trimmed = line.replace(/[├└│─\s]/g, "").trim();
    const depth = line.search(/\S/);

    if (skipDepth >= 0 && depth > skipDepth) continue;
    skipDepth = -1;

    const dirName = trimmed.replace(/[/\\]$/, "");
    if (FILTERED_DIRS.has(dirName)) {
      skipDepth = depth;
      continue;
    }
    result.push(line);
  }
  return result.join("\n");
}

export function compressPackageJson(content: string): string {
  try {
    const pkg = JSON.parse(content);
    const parts: string[] = [];
    if (pkg.name) parts.push(`name: ${pkg.name}`);
    if (pkg.dependencies) parts.push(`deps: ${Object.keys(pkg.dependencies).join(", ")}`);
    if (pkg.devDependencies) parts.push(`devDeps: ${Object.keys(pkg.devDependencies).join(", ")}`);
    if (pkg.scripts) parts.push(`scripts: ${Object.keys(pkg.scripts).join(", ")}`);
    return parts.join("\n");
  } catch {
    return content.slice(0, 200);
  }
}

export function compressConfig(filename: string, content: string): string {
  const parts: string[] = [`[${filename}]`];

  const nameMatch = content.match(/name\s*=\s*"([^"]+)"/);
  if (nameMatch) parts.push(`name: ${nameMatch[1]}`);

  const depsSection = content.match(
    /\[(?:dependencies|tool\.poetry\.dependencies|project\.dependencies)\]([\s\S]*?)(?=\n\[|$)/,
  );
  if (depsSection) {
    const depNames = depsSection[1]
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#") && !l.startsWith("["))
      .map((l) => l.split(/\s*[=:{]/)[0].trim())
      .filter(Boolean);
    if (depNames.length > 0) parts.push(`deps: ${depNames.join(", ")}`);
  }
  return parts.join("\n");
}
