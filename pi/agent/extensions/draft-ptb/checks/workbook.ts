// Workbook check execution.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { WorkbookCheck } from "../state.ts";
import { fmtResult } from "./check-utils.ts";

export async function runOneWorkbook(pi: ExtensionAPI, cwd: string, wbPath: string): Promise<WorkbookCheck> {
  const r = await pi.exec("wb", ["run", wbPath, "--bail"], { cwd });
  if (r.code === 127) return { path: wbPath, passed: true, output: "skipped (wb CLI not installed)" };
  return { path: wbPath, passed: r.code === 0, output: fmtResult(r) };
}
