// forge — pi extension.
//   (1) `/forge <request>` triages an incoming request: the LLM
//       classifies it into requirements (change-requests) and issues (bugs),
//       then calls the `catalog_work` tool. The tool captures the counts into a
//       session variable (CatalogStore) and announces them on the event bus.
//   (2) `/work-catalog` reports the session totals (the stored variable).
//   (3) Passive skill-load detection: watches `read` on SKILL.md — but ONLY
//       after `/forge` has activated the extension for the session.
//
// Activation gate: pi registers commands/tools/listeners once at load, so the
// extension is always *registered*. To make it *do* nothing until `/forge` is
// used, every runtime behavior is gated behind `active`, which only `/forge`
// flips on and each new session resets. The `catalog_work` tool is also
// removed from the active tool set until `/forge` runs — otherwise it sits in
// the system prompt of every request and the LLM calls it on ordinary
// prompts that were never meant to be triaged.
//
// Why a tool and not a regex: "issue vs requirement" is a semantic judgment only
// the LLM makes reliably; the tool's typed schema is the exact boundary where
// that fuzzy decision becomes structured data we can count and store.
import {
  isToolCallEventType,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { SkillTracker, skillFromReadPath } from "./lib/skill-detector.ts";
import { CatalogStore } from "./lib/work-catalog.ts";
import { createCatalogWorkTool } from "./tools/catalog-work.ts";

const CLASSIFY = `You are triaging an incoming work request. It MAY mix, in any language, feature requirements and bug/issue reports.

Split it into distinct, atomic items and classify each as:
- a REQUIREMENT (change-request): a new feature, capability, or change (e.g. "quiero una pantalla de kiosko").
- an ISSUE: a bug, defect, or something to fix/repair (e.g. "arreglar la autenticación").

Then call the \`catalog_work\` tool ONCE with the two lists. Cataloging is the ONLY task right now — do not start any other work.

Request to classify:`;

function buildPrompt(request: string): string {
  return `${CLASSIFY}\n\n${request}`;
}

const CATALOG_TOOL_NAME = "catalog_work";

export default function forge(pi: ExtensionAPI): void {
  const skills = new SkillTracker();
  const catalog = new CatalogStore(); // session variable: how many reqs / issues

  // Forge stays inert until `/forge` is invoked. Registration below happens at
  // load (pi wires everything once), but no runtime behavior fires while false.
  let active = false;

  const hideCatalogTool = () => {
    pi.setActiveTools(
      pi.getActiveTools().filter((name) => name !== CATALOG_TOOL_NAME),
    );
  };

  const exposeCatalogTool = () => {
    const names = pi.getActiveTools();
    if (!names.includes(CATALOG_TOOL_NAME)) {
      pi.setActiveTools([...names, CATALOG_TOOL_NAME]);
    }
  };

  // Each session starts inert — a prior `/forge` in another session must not
  // leak activation into a fresh one within the same process. Hiding the tool
  // here (not at load) keeps it out of the LLM's tool list on every prompt
  // until `/forge` exposes it.
  pi.on("session_start", () => {
    active = false;
    hideCatalogTool();
  });

  // The LLM classifies; this tool captures structure into the session variable
  // and announces it on the bus (event bus only — no file).
  pi.registerTool(
    createCatalogWorkTool((entry) => {
      catalog.add(entry);
      pi.events.emit("catalog:cataloged", entry);
    }),
  );

  pi.registerCommand("forge", {
    description:
      "Classify a request into requirements vs issues (/forge <request>)",
    handler: async (args, ctx) => {
      const request = args.trim();
      if (!request) {
        ctx.ui.notify("Usage: /forge <request>", "warning");
        return;
      }
      if (!ctx.isIdle()) {
        ctx.ui.notify(
          "Agent is busy — run /forge when the agent is idle.",
          "warning",
        );
        return;
      }
      active = true; // activate forge's runtime behavior for this session
      exposeCatalogTool(); // the LLM can only see/call catalog_work from now on
      pi.sendUserMessage(buildPrompt(request));
    },
  });

  pi.registerCommand("work-catalog", {
    description: "Show session totals: requirements (change-requests) vs issues",
    handler: async (_args, ctx) => {
      const t = catalog.total();
      ctx.ui.notify(
        `catalog totals — requirements: ${t.requirements}, issues: ${t.issues}`,
        "info",
      );
    },
  });

  // Passive skill-load detection at MAIN depth: a `read` on SKILL.md == a load.
  // Only runs once `/forge` has activated the extension this session.
  pi.on("tool_call", (event) => {
    if (!active) return;
    if (!isToolCallEventType("read", event)) return;
    const skill = skillFromReadPath(event.input.path);
    if (!skill) return;
    const { firstLoad } = skills.record(skill);
    pi.events.emit("skill:loaded", { skill, firstLoad, path: event.input.path });
  });
}
