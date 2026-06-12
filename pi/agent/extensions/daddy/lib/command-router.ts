// lib/command-router.ts — Parse the raw /daddy argument string into a command.
export type ParsedCommand =
  | { kind: "run"; flow: string; args: string }
  | { kind: "list" } | { kind: "status" }
  | { kind: "resume"; id: string }
  | { kind: "approve"; comment: string } | { kind: "reject"; reason: string }
  | { kind: "merge" } | { kind: "remove" } | { kind: "keep" }
  | { kind: "validate"; name: string }
  | { kind: "unknown"; raw: string };

export function parseCommand(args: string): ParsedCommand {
  const trimmed = args.trim();
  const flow = trimmed.match(/^flow=(\S+)\s*([\s\S]*)$/);
  if (flow) return { kind: "run", flow: flow[1], args: flow[2].trim() };
  const [word, ...rest] = trimmed.split(/\s+/);
  const tail = trimmed.slice(word.length).trim();
  switch (word) {
    case "list": return { kind: "list" };
    case "status": return { kind: "status" };
    case "resume": return { kind: "resume", id: rest[0] ?? "" };
    case "approve": return { kind: "approve", comment: tail };
    case "reject": return { kind: "reject", reason: tail };
    case "merge": return { kind: "merge" };
    case "remove": return { kind: "remove" };
    case "keep": return { kind: "keep" };
    case "validate": return { kind: "validate", name: rest[0] ?? "" };
    default: return { kind: "unknown", raw: trimmed };
  }
}
