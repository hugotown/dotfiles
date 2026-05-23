import { GLOBAL_REQUIRED, ROLE_PROFILES } from "./constants";
import type { AgentReqs, ModelCaps } from "../types";

const MODALITY_INPUT_TOKENS = new Set([
  "text",
  "image",
  "video",
  "audio",
  "pdf",
]);

export function resolveAgentReqs(
  file: string,
  firstLine: string,
): { reqs: AgentReqs; profiles: string[] } {
  const haystack = `${file}\n${firstLine}`;
  const required = new Set<string>();
  const optional = new Set<string>();
  const excluded = new Set<string>();
  const profiles: string[] = [];
  for (const profile of ROLE_PROFILES) {
    if (!profile.patterns.some((p) => p.test(haystack))) continue;
    profiles.push(profile.name);
    for (const r of profile.required ?? []) required.add(r);
    for (const o of profile.optional ?? []) optional.add(o);
    for (const e of profile.excluded ?? []) excluded.add(e);
  }
  return {
    reqs: {
      required: Array.from(required),
      optional: Array.from(optional),
      excluded: Array.from(excluded),
    },
    profiles,
  };
}

function hasCapability(caps: ModelCaps, token: string): boolean {
  if (MODALITY_INPUT_TOKENS.has(token)) return caps.input.includes(token);
  if (token === "tool_call") return caps.toolCall;
  if (token === "reasoning") return caps.reasoning;
  if (token === "attachment") return caps.attachment;
  return false;
}

export function modelMatchesReqs(
  caps: ModelCaps | undefined,
  reqs: AgentReqs,
): boolean {
  const required = Array.from(
    new Set([...GLOBAL_REQUIRED, ...(reqs.required ?? [])]),
  );
  const excluded = reqs.excluded ?? [];
  if (!caps) {
    return required.every((r) => r === "text");
  }
  for (const r of required) if (!hasCapability(caps, r)) return false;
  for (const e of excluded) if (hasCapability(caps, e)) return false;
  return true;
}
