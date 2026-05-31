// Facade: full project detection. Composes git, manifest, test, and tree sub-modules.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { GitInfo, ProjectInfo } from "../state.ts";
import { detectGit } from "./git-detect.ts";
import { detectManifests, detectMonorepo } from "./manifest-detect.ts";
import { detectPlaywright, detectCypress, pickE2EFolder, pickIntegrationFolder } from "./test-detect.ts";

export { buildProjectTree, hasGraphify } from "./tree.ts";

export async function detectProject(pi: ExtensionAPI, cwd: string, obsidianPath: string): Promise<{ projectInfo: ProjectInfo; gitInfo: GitInfo }> {
  const gitInfo = await detectGit(pi, cwd);
  const { manifests, types } = await detectManifests(pi, cwd);
  const { isMonorepo, workspaces } = await detectMonorepo(pi, cwd, manifests);
  const pw = await detectPlaywright(pi, cwd, manifests);
  const cy = await detectCypress(pi, cwd, manifests);
  const e2e = await pickE2EFolder(pi, cwd, pw.configPath, cy.has);
  const integration = await pickIntegrationFolder(pi, cwd);

  const projectInfo: ProjectInfo = {
    manifests, types, isMonorepo, workspaces,
    hasPlaywright: pw.has, hasCypress: cy.has,
    testFolders: { e2e, integration }, obsidianPath,
  };
  return { projectInfo, gitInfo };
}
