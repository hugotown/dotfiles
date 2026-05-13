import { createClaudeCli } from "../claude-cli-provider/index.mjs";

const LOCKED_MODEL_ID = "claude-haiku-4-5-20251001";
const PROVIDER_ID = "claude-haiku";

export function createClaudeHaiku(options = {}) {
  return createClaudeCli({
    name: PROVIDER_ID,
    lockedModelId: LOCKED_MODEL_ID,
    ...options,
  });
}

export default createClaudeHaiku;
