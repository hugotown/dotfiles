import { join } from "node:path";
import { homedir } from "node:os";
import type { RoleProfile } from "./types";

export const PROVIDERS: string[] = ["opencode-go", "github-copilot"];
export const REGEN_FLAG = "--agent-matrix-regen";
export const FETCH_TIMEOUT_MS = 15_000;
export const CAPS_API_URL = "https://models.dev/api.json";

// Capabilities every model must have, regardless of role.
export const GLOBAL_REQUIRED: string[] = ["tool_call"];

const xdgConfig = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
const xdgState =
  process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state");

export const SOURCE_DIR = join(xdgConfig, "agents", "agents");
export const OUTPUT_DIR = join(homedir(), ".pi", "agent", "agents");
export const LOG_DIR = join(xdgState, "agent-matrix-generator");
export const LOG_FILE = join(LOG_DIR, "regen-pi.log");

export const ROLE_PROFILES: RoleProfile[] = [
  {
    name: "designer",
    patterns: [/ux-?ui/i, /\bdesigner\b/i],
    required: ["image", "pdf"],
    optional: ["video"],
  },
  {
    name: "architect",
    patterns: [/\barchitect(?:ure|ural)?\b/i],
    required: ["reasoning"],
  },
  {
    name: "planner",
    patterns: [
      /\bprincipal\b/i,
      /\bplanner\b/i,
      /\bplanning\b/i,
      /\bstrategist\b/i,
    ],
    required: ["reasoning"],
  },
  {
    name: "security",
    patterns: [/\bsecurity\b/i, /\bthreat\b/i],
    required: ["reasoning"],
  },
  {
    name: "reviewer",
    patterns: [/\breviewer\b/i, /\bcode[- ]?review\b/i],
    required: ["reasoning"],
  },
  {
    name: "ai-engineer",
    patterns: [/\bllm\b/i, /\bprompt[- ]?engineer\b/i],
    required: ["reasoning"],
  },
  {
    name: "developer",
    patterns: [
      /\bdeveloper\b/i,
      /\bfull[- ]?stack\b/i,
      /\bbackend[- ]developer\b/i,
      /\bfrontend[- ]developer\b/i,
    ],
    required: ["reasoning", "attachment"],
  },
  {
    name: "worker-junior",
    patterns: [/\bworker\b/i, /\bjunior\b/i, /\bworker[- ]?junior\b/i],
    excluded: ["image", "attachment"],
  },
];
