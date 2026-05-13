import { createClaudeCli } from "../claude-cli-provider/index.mjs";

const LOCKED_MODEL_ID = "claude-opus-4-7";
const PROVIDER_ID = "claude-opus";

export function createClaudeOpus(options = {}) {
  return createClaudeCli({
    name: PROVIDER_ID,
    lockedModelId: LOCKED_MODEL_ID,
    ...options,
  });
}

export default createClaudeOpus;
