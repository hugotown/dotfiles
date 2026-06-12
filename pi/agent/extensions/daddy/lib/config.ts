// lib/config.ts — Load config.yml into AppConfig, merging over defaults.
import * as fs from "node:fs";
import { parse as parseYaml } from "yaml";
import { DEFAULT_CONCURRENCY } from "../constants.ts";

export interface AppConfig { concurrency: number; nodeTimeoutMs: number; loopIdleMs: number; }

const DEFAULTS: AppConfig = { concurrency: DEFAULT_CONCURRENCY, nodeTimeoutMs: 600000, loopIdleMs: 1800000 };

export function parseConfig(text: string): AppConfig {
  const raw = (parseYaml(text) ?? {}) as { engine?: { concurrency?: number; node_timeout_ms?: number; loop_idle_ms?: number } };
  const e = raw.engine ?? {};
  return {
    concurrency: e.concurrency ?? DEFAULTS.concurrency,
    nodeTimeoutMs: e.node_timeout_ms ?? DEFAULTS.nodeTimeoutMs,
    loopIdleMs: e.loop_idle_ms ?? DEFAULTS.loopIdleMs,
  };
}

export function loadConfig(path: string): AppConfig {
  try { return parseConfig(fs.readFileSync(path, "utf-8")); } catch { return parseConfig(""); }
}
