// Fallback file-contract extraction. The preferred path is a json block the
// plandraft writes into the plan ("## File Contracts"); when that's missing we
// derive contracts from the plan's "Create:/Modify:/Test:" file lines so a good
// plan isn't rejected over a missing json array. Derived contracts have no
// dependsOn (the DAG then treats them as one parallel level).

import type { FileContract } from "../../types.ts";

export function deriveContracts(planText: string): FileContract[] {
  const out: FileContract[] = [];
  const seen = new Set<string>();
  const re = /(?:Create|Modify|Test)\s*:\s*`?([^\s`:)]+\.[A-Za-z0-9]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(planText)) !== null) {
    const path = m[1].trim();
    if (path && !seen.has(path)) {
      seen.add(path);
      out.push({ path, purpose: "", dependsOn: [] });
    }
  }
  return out;
}
