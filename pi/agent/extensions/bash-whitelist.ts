/**
 * Bash Whitelist Extension
 *
 * Only allows bash commands that start with a whitelisted binary.
 * All other bash calls are blocked.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const WHITELIST_FILE = join(dirname(fileURLToPath(import.meta.url)), "bash-whitelist.json");

function loadUserWhitelist(): string[] {
  if (!existsSync(WHITELIST_FILE)) return [];
  try {
    return JSON.parse(readFileSync(WHITELIST_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function saveUserWhitelist(list: string[]): void {
  writeFileSync(WHITELIST_FILE, JSON.stringify(list, null, 2) + "\n");
}

const defaults = [
  "eza",
  "rg",
  "find",
  "grep",
  "bat",
  "echo",
  "pwd",
  "head",
  "tail",
  "wc",
  "sort",
  "uniq",
  "diff",
  "which",
  "env",
  "npx",
  "node",
  "git",
  "mkdir",
  "cp",
  "mv",
  "touch",
  "chmod",
  "cd",
];

const allowed = [...defaults, ...loadUserWhitelist()];

function getFirstCommand(command: string): string {
  // Strip leading env vars (FOO=bar), source/exec prefixes, and whitespace
  const stripped = command.trimStart();

  // Handle multiline: check each line's first real command
  const lines = stripped
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#"));
  if (lines.length === 0) return "";

  const firstLine = lines[0].trim();

  // Strip inline env assignments (VAR=value cmd ...)
  const withoutEnvVars = firstLine.replace(/^(\w+=\S*\s+)+/, "");

  // Get the binary name (first token), strip path prefix
  const binary = withoutEnvVars.split(/\s/)[0];
  return binary.split("/").pop() || "";
}

function allCommandsAllowed(command: string): boolean {
  // Split on pipes, &&, ||, ; to check each sub-command
  const subCommands = command.split(/\s*(?:\|&|\||&&|;)\s*/);

  for (const sub of subCommands) {
    const trimmed = sub.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const binary = getFirstCommand(trimmed);
    if (!binary) continue;

    if (!allowed.includes(binary)) {
      return false;
    }
  }

  return true;
}

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    if (!isToolCallEventType("bash", event)) return;

    const command = event.input.command;

    if (!allCommandsAllowed(command)) {
      const binary = getFirstCommand(command);
      const ok = await ctx.ui.confirm(
        "Bash command not whitelisted",
        `"${binary}" is not in the whitelist. Allow execution?\n\n$ ${command.length > 120 ? command.slice(0, 120) + "..." : command}`,
      );

      if (!ok) {
        return {
          block: true,
          reason: `Command "${binary}" is not in the bash whitelist`,
        };
      } else {
        const save = await ctx.ui.confirm(
          "Add to whitelist?",
          `Add "${binary}" permanently? (takes effect on next /reload)`,
        );
        if (save) {
          const userList = loadUserWhitelist();
          if (!userList.includes(binary)) {
            userList.push(binary);
            saveUserWhitelist(userList);
          }
        }
      }
    }
  });
}
