// lib/command-loader.ts — Load a .md command template's raw text.
import * as fs from "node:fs";
import { findCommand } from "./discovery.ts";

export function loadCommandText(name: string, dirs: string[]): string {
  const file = findCommand(name, dirs);
  if (!file) throw new Error(`Command "${name}" not found in ${dirs.join(", ")}`);
  return fs.readFileSync(file, "utf-8");
}
