// Test framework detection (Playwright, Cypress) and folder resolution.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { fileExists, dirExists, packageHasDep } from "../utils.ts";

const PLAYWRIGHT_CONFIGS = ["playwright.config.ts", "playwright.config.js", "playwright.config.mjs"];
const CYPRESS_CONFIGS = ["cypress.config.ts", "cypress.config.js"];
const COMMON_E2E_FOLDERS = ["tests/e2e", "e2e", "cypress/e2e", "playwright-tests"];
const COMMON_INTEGRATION_FOLDERS = ["tests/integration", "__tests__", "test/integration"];

export async function detectPlaywright(pi: ExtensionAPI, cwd: string, manifests: string[]): Promise<{ has: boolean; configPath: string | null }> {
  for (const cfg of PLAYWRIGHT_CONFIGS) {
    if (await fileExists(pi, cwd, cfg)) return { has: true, configPath: cfg };
  }
  if (manifests.includes("package.json") && await packageHasDep(pi, cwd, "@playwright/test")) {
    return { has: true, configPath: null };
  }
  return { has: false, configPath: null };
}

export async function detectCypress(pi: ExtensionAPI, cwd: string, manifests: string[]): Promise<{ has: boolean; configPath: string | null }> {
  for (const cfg of CYPRESS_CONFIGS) {
    if (await fileExists(pi, cwd, cfg)) return { has: true, configPath: cfg };
  }
  if (manifests.includes("package.json") && await packageHasDep(pi, cwd, "cypress")) {
    return { has: true, configPath: null };
  }
  return { has: false, configPath: null };
}

export async function pickE2EFolder(pi: ExtensionAPI, cwd: string, pwCfg: string | null, cyHas: boolean): Promise<string> {
  if (pwCfg) {
    const dir = await readPlaywrightTestDir(pi, cwd, pwCfg);
    if (dir) return dir;
  }
  if (cyHas) return "cypress/e2e";
  for (const f of COMMON_E2E_FOLDERS) if (await dirExists(pi, cwd, f)) return f;
  return "tests/e2e";
}

export async function pickIntegrationFolder(pi: ExtensionAPI, cwd: string): Promise<string> {
  for (const f of COMMON_INTEGRATION_FOLDERS) if (await dirExists(pi, cwd, f)) return f;
  return "tests/integration";
}

async function readPlaywrightTestDir(pi: ExtensionAPI, cwd: string, cfgPath: string): Promise<string | null> {
  const r = await pi.exec("cat", [cfgPath], { cwd });
  if (r.code !== 0) return null;
  const m = r.stdout.match(/testDir\s*:\s*['"`]([^'"`]+)['"`]/);
  return m ? m[1] : null;
}
