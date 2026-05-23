import type { Api } from "@earendil-works/pi-ai";

export const PROVIDER_NAME = "claude-local-cli";
export const PROVIDER_API: Api = "claude-local-cli";

export const MODELS = [
  { id: "claude-opus-4-7", name: "Claude Opus 4.7 (via Subprocess)" },
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6 (via Subprocess)" },
  { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5 (via Subprocess)" },
];
