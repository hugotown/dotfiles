import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { GitInfo, ProjectInfo } from "./state.ts";

// Each manifest maps to a project type. Order matters only for readability.
const MANIFESTS: Array<{ file: string; type: string }> = [
  { file: "package.json", type: "node" },
  { file: "Cargo.toml", type: "rust" },
  { file: "pyproject.toml", type: "python" },
  { file: "setup.py", type: "python" },
  { file: "requirements.txt", type: "python" },
  { file: "go.mod", type: "go" },
  { file: "pom.xml", type: "java" },
  { file: "build.gradle", type: "java" },
  { file: "build.gradle.kts", type: "java" },
  { file: "mise.toml", type: "mise" },
  { file: ".mise.toml", type: "mise" },
  { file: "Dockerfile", type: "docker" },
  { file: "deno.json", type: "deno" },
  { file: "deno.jsonc", type: "deno" },
  { file: "bun.lockb", type: "bun" },
  { file: "pnpm-workspace.yaml", type: "node" },
  { file: "turbo.json", type: "node" },
  { file: "nx.json", type: "node" },
];

const PLAYWRIGHT_CONFIGS = ["playwright.config.ts", "playwright.config.js", "playwright.config.mjs"];
const CYPRESS_CONFIGS = ["cypress.config.ts", "cypress.config.js"];

const COMMON_E2E_FOLDERS = ["tests/e2e", "e2e", "cypress/e2e", "playwright-tests"];
const COMMON_INTEGRATION_FOLDERS = ["tests/integration", "__tests__", "test/integration"];

async function fileExists(pi: ExtensionAPI, cwd: string, rel: string): Promise<boolean> {
  return (await pi.exec("test", ["-f", rel], { cwd })).code === 0;
}

async function dirExists(pi: ExtensionAPI, cwd: string, rel: string): Promise<boolean> {
  return (await pi.exec("test", ["-d", rel], { cwd })).code === 0;
}

async function detectGit(pi: ExtensionAPI, cwd: string): Promise<GitInfo> {
  const hasGit = (await pi.exec("test", ["-d", ".git"], { cwd })).code === 0;
  if (!hasGit) return { hasGit: false, baseBranch: null, snapshotSha: null, currentBranch: null, featureBranch: null };

  const currentRes = await pi.exec("git", ["branch", "--show-current"], { cwd });
  const currentBranch = currentRes.code === 0 ? currentRes.stdout.trim() || null : null;

  const headRes = await pi.exec("git", ["rev-parse", "HEAD"], { cwd });
  const snapshotSha = headRes.code === 0 ? headRes.stdout.trim() || null : null;

  let baseBranch: string | null = null;
  const symRes = await pi.exec("git", ["symbolic-ref", "refs/remotes/origin/HEAD"], { cwd });
  if (symRes.code === 0) {
    const m = symRes.stdout.trim().match(/refs\/remotes\/origin\/(.+)$/);
    if (m) baseBranch = m[1];
  }
  if (!baseBranch) {
    for (const candidate of ["main", "master", "trunk"]) {
      const r = await pi.exec("git", ["show-ref", "--verify", "--quiet", `refs/heads/${candidate}`], { cwd });
      if (r.code === 0) { baseBranch = candidate; break; }
    }
  }

  return { hasGit: true, baseBranch, snapshotSha, currentBranch, featureBranch: null };
}

async function detectManifests(pi: ExtensionAPI, cwd: string): Promise<{ manifests: string[]; types: string[] }> {
  const manifests: string[] = [];
  const typeSet = new Set<string>();
  for (const { file, type } of MANIFESTS) {
    if (await fileExists(pi, cwd, file)) {
      manifests.push(file);
      typeSet.add(type);
    }
  }
  return { manifests, types: Array.from(typeSet) };
}

async function detectMonorepo(
  pi: ExtensionAPI,
  cwd: string,
  manifests: string[],
): Promise<{ isMonorepo: boolean; workspaces: string[] }> {
  if (manifests.includes("turbo.json") || manifests.includes("nx.json") || manifests.includes("pnpm-workspace.yaml"))
    return { isMonorepo: true, workspaces: await readWorkspaces(pi, cwd) };

  if (manifests.includes("package.json")) {
    const pkg = await pi.exec("cat", ["package.json"], { cwd });
    if (pkg.code === 0) {
      try {
        const json = JSON.parse(pkg.stdout);
        if (Array.isArray(json.workspaces) || (json.workspaces && Array.isArray(json.workspaces.packages))) {
          const ws: string[] = Array.isArray(json.workspaces) ? json.workspaces : json.workspaces.packages;
          return { isMonorepo: true, workspaces: ws };
        }
      } catch { /* ignore */ }
    }
  }
  return { isMonorepo: false, workspaces: [] };
}

async function readWorkspaces(pi: ExtensionAPI, cwd: string): Promise<string[]> {
  // Lightweight: parse pnpm-workspace.yaml `packages:` block. For turbo/nx the workspace globs live in package.json or per-config.
  const yml = await pi.exec("cat", ["pnpm-workspace.yaml"], { cwd });
  if (yml.code === 0) {
    const out: string[] = [];
    for (const line of yml.stdout.split("\n")) {
      const m = line.match(/^\s*-\s*['"]?([^'"\s]+)['"]?\s*$/);
      if (m) out.push(m[1]);
    }
    if (out.length) return out;
  }
  const pkg = await pi.exec("cat", ["package.json"], { cwd });
  if (pkg.code === 0) {
    try {
      const json = JSON.parse(pkg.stdout);
      if (Array.isArray(json.workspaces)) return json.workspaces;
      if (json.workspaces?.packages) return json.workspaces.packages;
    } catch { /* ignore */ }
  }
  return [];
}

async function detectPlaywright(
  pi: ExtensionAPI,
  cwd: string,
  manifests: string[],
): Promise<{ has: boolean; configPath: string | null }> {
  for (const cfg of PLAYWRIGHT_CONFIGS) {
    if (await fileExists(pi, cwd, cfg)) return { has: true, configPath: cfg };
  }
  if (manifests.includes("package.json")) {
    const pkg = await pi.exec("cat", ["package.json"], { cwd });
    if (pkg.code === 0) {
      try {
        const json = JSON.parse(pkg.stdout);
        const deps = { ...(json.dependencies ?? {}), ...(json.devDependencies ?? {}) };
        if (deps["@playwright/test"]) return { has: true, configPath: null };
      } catch { /* ignore */ }
    }
  }
  return { has: false, configPath: null };
}

async function detectCypress(
  pi: ExtensionAPI,
  cwd: string,
  manifests: string[],
): Promise<{ has: boolean; configPath: string | null }> {
  for (const cfg of CYPRESS_CONFIGS) {
    if (await fileExists(pi, cwd, cfg)) return { has: true, configPath: cfg };
  }
  if (manifests.includes("package.json")) {
    const pkg = await pi.exec("cat", ["package.json"], { cwd });
    if (pkg.code === 0) {
      try {
        const json = JSON.parse(pkg.stdout);
        const deps = { ...(json.dependencies ?? {}), ...(json.devDependencies ?? {}) };
        if (deps["cypress"]) return { has: true, configPath: null };
      } catch { /* ignore */ }
    }
  }
  return { has: false, configPath: null };
}

/** Best-effort read of testDir from a playwright config file. Regex, not AST. */
async function readPlaywrightTestDir(pi: ExtensionAPI, cwd: string, cfgPath: string): Promise<string | null> {
  const r = await pi.exec("cat", [cfgPath], { cwd });
  if (r.code !== 0) return null;
  const m = r.stdout.match(/testDir\s*:\s*['"`]([^'"`]+)['"`]/);
  return m ? m[1] : null;
}

async function pickE2EFolder(pi: ExtensionAPI, cwd: string, pwCfg: string | null, cyHas: boolean): Promise<string> {
  if (pwCfg) {
    const dir = await readPlaywrightTestDir(pi, cwd, pwCfg);
    if (dir) return dir;
  }
  if (cyHas) return "cypress/e2e";
  for (const f of COMMON_E2E_FOLDERS) if (await dirExists(pi, cwd, f)) return f;
  return "tests/e2e";
}

async function pickIntegrationFolder(pi: ExtensionAPI, cwd: string): Promise<string> {
  for (const f of COMMON_INTEGRATION_FOLDERS) if (await dirExists(pi, cwd, f)) return f;
  return "tests/integration";
}

/** Build the project tree (eza --level=5). Returned for use as compressedContext in RESEARCH. */
export async function buildProjectTree(pi: ExtensionAPI, cwd: string): Promise<string> {
  const tree = await pi.exec(
    "eza",
    ["--tree", "--level=5", "-I", "node_modules|.git|dist|build|coverage|target|.venv|__pycache__|.next|.turbo"],
    { cwd },
  );
  if (tree.code !== 0 || !tree.stdout.trim()) return "(no tree available)";
  return tree.stdout.length > 8000 ? tree.stdout.slice(0, 8000) + "\n... (truncated)" : tree.stdout;
}

/** Full project detection. Returns the structured info; obsidianPath is taken from the caller. */
export async function detectProject(pi: ExtensionAPI, cwd: string, obsidianPath: string): Promise<{ projectInfo: ProjectInfo; gitInfo: GitInfo }> {
  const gitInfo = await detectGit(pi, cwd);
  const { manifests, types } = await detectManifests(pi, cwd);
  const { isMonorepo, workspaces } = await detectMonorepo(pi, cwd, manifests);
  const pw = await detectPlaywright(pi, cwd, manifests);
  const cy = await detectCypress(pi, cwd, manifests);
  const e2e = await pickE2EFolder(pi, cwd, pw.configPath, cy.has);
  const integration = await pickIntegrationFolder(pi, cwd);

  const projectInfo: ProjectInfo = {
    manifests,
    types,
    isMonorepo,
    workspaces,
    hasPlaywright: pw.has,
    hasCypress: cy.has,
    testFolders: { e2e, integration },
    obsidianPath,
  };
  return { projectInfo, gitInfo };
}

export async function hasGraphify(pi: ExtensionAPI, cwd: string): Promise<boolean> {
  return (await pi.exec("test", ["-d", "graphify-out"], { cwd })).code === 0;
}
