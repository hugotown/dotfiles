import { createClaudeCli } from "../claude-cli-provider/index.mjs";

const LOCKED_MODEL_ID = "claude-sonnet-4-6";
const PROVIDER_ID = "claude-sonnet";

export function createClaudeSonnet(options = {}) {
  return createClaudeCli({
    name: PROVIDER_ID,
    lockedModelId: LOCKED_MODEL_ID,
    ...options,
  });
}

export default createClaudeSonnet;
