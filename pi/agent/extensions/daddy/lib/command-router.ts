// lib/command-router.ts — Parse the raw /daddy argument string into a command.
export type ParsedCommand =
  | { kind: "run"; flow: string; args: string }
  | { kind: "list" } | { kind: "status"; id: string } | { kind: "observer" } | { kind: "doctor" }
  | { kind: "resume"; id: string }
  | { kind: "approve"; comment: string } | { kind: "reject"; reason: string }
  | { kind: "cancel"; id: string; reason: string }
  | { kind: "recover"; id: string }
  | { kind: "retry"; id: string; node: string }
  | { kind: "cleanup" }
  | { kind: "preflight"; flow: string; args: string }
  | { kind: "merge" } | { kind: "remove" } | { kind: "keep" }
  | { kind: "validate"; name: string }
  | { kind: "unknown"; raw: string };

export function parseCommand(args: string): ParsedCommand {
  const trimmed = args.trim();
  const flow = trimmed.match(/^flow=(\S+)\s*([\s\S]*)$/);
  if (flow) return { kind: "run", flow: flow[1], args: flow[2].trim() };
  const [word = "", ...rest] = trimmed.split(/\s+/);
  const tail = trimmed.slice(word.length).trim();
  switch (word) {
    case "list": return { kind: "list" };
    case "status": return { kind: "status", id: rest[0] ?? "" };
    case "observer": return { kind: "observer" };
    case "doctor": return { kind: "doctor" };
    case "resume": return { kind: "resume", id: rest[0] ?? "" };
    case "approve": return { kind: "approve", comment: tail };
    case "reject": return { kind: "reject", reason: tail };
    case "cancel": return { kind: "cancel", id: rest[0] ?? "", reason: rest.slice(1).join(" ") };
    case "recover": return { kind: "recover", id: rest[0] ?? "" };
    case "retry": return { kind: "retry", id: rest[0] ?? "", node: rest[1] ?? "" };
    case "cleanup": return { kind: "cleanup" };
    case "preflight": return { kind: "preflight", flow: rest[0] ?? "", args: rest.slice(1).join(" ") };
    case "merge": return { kind: "merge" };
    case "remove": return { kind: "remove" };
    case "keep": return { kind: "keep" };
    case "validate": return { kind: "validate", name: rest[0] ?? "" };
    default: return { kind: "unknown", raw: trimmed };
  }
}
