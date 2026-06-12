// lib/loader.ts — Parse workflow YAML text into a WorkflowDef (structural only).
import { parse } from "yaml";
import type { WorkflowDef } from "../types.ts";

export function parseWorkflow(yamlText: string): WorkflowDef {
  const raw = parse(yamlText);
  if (!raw || typeof raw !== "object") throw new Error("Workflow must be a YAML object");
  const def = raw as Partial<WorkflowDef>;
  if (typeof def.name !== "string") throw new Error("Workflow 'name' is required");
  if (typeof def.description !== "string") throw new Error("Workflow 'description' is required");
  if (!Array.isArray(def.nodes) || def.nodes.length === 0) {
    throw new Error("Workflow 'nodes' must be a non-empty array");
  }
  return def as WorkflowDef;
}
