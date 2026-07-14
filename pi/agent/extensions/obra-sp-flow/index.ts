// obra-flow — pi extension.
// Registers the `/obra-flow <requirement>` slash command: loads the OBRA FLOW
// methodology (autonomous nested cascade — superpowers + pi-subagents) and kicks
// off a MAIN run for the requirement typed by the user.
//
// The methodology is EMBEDDED in this file — no external doc, no live read. It is
// split into a reusable HEAD (the skill-loading preamble + the `<req>` marker) and
// the METHODOLOGY (contracts + phases, verbatim). The command injects the user's
// requirement between them, so the same autonomous flow applies to any requirement.
// To evolve the methodology, edit HEAD/METHODOLOGY below directly.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const HEAD = `Load in the MAIN agent ONLY these three skills: \`using-superpowers\`, \`brainstorming\`, and the bundled
\`pi-subagents\` skill. Do NOT load ANY other skill in MAIN — writing-plans, executing-plans,
test-driven-development, systematic-debugging, dispatching-parallel-agents, receiving-code-review, etc.
are loaded by the SUBAGENTS, never by MAIN (MAIN touches no code and stays context-clean).
Then use brainstorming to design this requirement:

<req>`;

const METHODOLOGY = `## contracts   (shared — DRY. Every phase says \`obeys: [...]\`; the rules are NOT repeated inline.)

\`\`\`yaml
contracts:

  autonomy:
    human_gates:              # the ONLY moments a human is involved
      - brainstorming_qa      # PHASE 1 (main): one question at a time
      - spec_approval         # HARD GATE (main): SAME interaction bundles two decisions asked inline right before approval — (a) model selection (best cost/benefit, see PHASE 1) then (b) explicit approval of the design spec. One gate moment, not two.
      - finishing_choice      # CLOSE (main): which integration option (+ typed "discard")
    after_gate: NEVER ask the user anything from spec_approval until finishing_choice.
    subagent_human_channel: FORBIDDEN — no subagent (depth >=1) may call
      intercom / contact_supervisor / boomerang, or any blocking human-input tool.
      The three human_gates are MAIN-only. A subagent that believes it needs the
      human MUST instead exit 0 with a report UP the ladder (repair_ladder /
      handoff.human_facing); MAIN owns the single allowed escalation at CLOSE.
      WHY: a subagent runs headless under a hard wall-clock timeout — blocking on
      human input burns that budget until the kill, and the killed session drops
      the reply (verified RCA: planner intercom reply lost, "Session not found").
    neutralize:               # these skills ship a human gate — OVERRIDE it when loaded in a subagent
      writing-plans:            execution approach is PRE-DECIDED (subagent-driven); do NOT ask "which approach".
      executing-plans:          do NOT ask; all work in the current workspace; on a concern, proceed with best judgment and document it.
      test-driven-development:  do NOT ask permission for exceptions; on failure, escalate the repair ladder (systematic-debugging), never ask.
      systematic-debugging:     "stop after 3 fails and ask the human" becomes → exit 0 with a failure report; the gate repairs; escalate to the human ONLY in the final unresolved-file report.
      receiving-code-review:    apply feedback or give reasoned pushback autonomously; do NOT ask.

  fault_isolation:            # verified: a chain aborts if ANY task exits != 0 (chain-execution.ts:781); failFast:false does NOT prevent it
    worker_exit: ALWAYS 0.    # a recoverable failure is DATA, not a non-zero exit — one bad file must never abort the wave/chain
    source_of_truth: the phase GATE — the orchestrating agent RUNS the real checks itself, never trusts worker self-reports
    repair_ladder:            # workers do NOT fix; failures escalate UP, each level tries systematic-debugging ONCE then reports up. Vehicle = the systematic-debugging SKILL (works at any depth via edit/bash); boomerang is unusable in subagents.
      worker(4):           DOCUMENT the exact error, exit 0, report up. Do NOT fix, do NOT spawn.
      tdd(3):              repair rung #1 — read systematic-debugging, fix the failing file(s), re-gate. Still red after one pass → report up. Never re-dispatch workers (same weak model = same failure).
      executing-plans(2):  repair rung #2 (FINAL, most brain) — systematic-debugging, re-gate. Still red → report the unresolved file up.
      main(0):             no code repair — surfaces the unresolved file to the HUMAN at CLOSE (the single allowed escalation).
    parallelism: failFast:false everywhere; bound concurrency

  budget:                     # bound every run so an error can't spin forever — enforces the escalation ladder
    wall_clock: a hard per-subagent wall-clock timeout kills the process regardless
      of turns (verified: "Subagent timed out after 3600000ms"). It is NOT paused by
      blocking on input — so a subagent MUST never wait on a human/interactive channel
      (see autonomy.subagent_human_channel). turnBudget below bounds TURNS, not time.
    turnBudget: { maxTurns: <per role>, graceTurns: 2 }   # SOFT = maxTurns (child WARNED to wrap up); HARD = maxTurns+graceTurns (supervisor aborts, partial output). Verified in turn-budget.ts.
    per_tier: |
      LEAF worker: tight (~15) — bounds ONE file. DRIVERS (tdd ~60, executing-plans ~90): a HIGH safety ceiling
      against runaway loops — tune UP for larger changes; NOT a tight bound (too low aborts a legit long run).
      On a DRIVER's soft warning it wraps up = reports current progress + unresolved files UP and exits 0
      (chain-safe), and the parent escalates. Never let any run reach the HARD abort.
    lean_on_SOFT_not_HARD: |
      Rely on the SOFT signal so the chain never breaks. When the wrap-up warning fires, the child STOPS new work,
      finalizes its report, and EXITS 0 immediately — it must NOT run to the HARD limit. A hard abort returns a
      partial/failed run that (per fault_isolation) could abort the whole chain; soft wrap-up + exit 0 keeps the wave alive.
    pass_fail_is_OBJECTIVE: |
      "ok" vs "failed" is decided by an OBJECTIVE verify command's EXIT CODE (the plan's test/build/lint/typecheck),
      NOT by the agent's judgment. Leaf workers are weaker models — they must NOT judge correctness; they run the
      command and read exit 0. Needs no structured_output; matches "the gate is the source of truth".
    survive_WITHOUT_structured_output: |
      Handoff is prose + files, never structured_output (weak models skip it). The moment a check fails, the child
      documents the exact error IMMEDIATELY: (a) append it to .pi-subagents/reports/<phase>/<safe-file>.md and
      (b) make it the FIRST line of its output — so it survives even a hard abort. The parent reads the report file
      (authoritative) + partial prose, then escalates. No outputSchema anywhere.

  handoff:                    # keep context clean up the cascade → minimize tokens
    format: PLAIN PROSE. No structured_output, no outputSchema (weak models skip it → step fails → chain aborts).
    artifacts: pass as FILES the next phase reads; the parent receives pointers, not bodies.
    brevity: DESCRIPTIVE only ("aim to stay under ~40 lines"; a worker report is a few lines). NEVER a hard maxOutput cap — truncation can cut the exact error a worker must report.
    human_facing: NEVER file-only (file-only once hid the human gate and broke it).
    no_dumps: never paste file contents, diffs, raw rg/ast-grep matches, full command logs, or reasoning.
    conservation: |
      DETECTED FACTS ARE A SET THAT ONLY GROWS DOWN THE CASCADE — never shrinks. Any test runner/level, coupled
      file, or contract detected upstream MUST survive VERBATIM into every downstream artifact. Dropping a
      detected item between phases is a CONTRACT VIOLATION (this is exactly how an integration test level was
      once lost: the context-builder detected it, the plan omitted it). Critical topology (test levels, files,
      contracts) travels as a FILE with a fixed shape (the grounding artifact), NEVER as inline prose a weak
      model can silently drop.
    reconcile_multi: |
      When more than one context-builder pass runs, reconcile by UNION — the SUPERSET wins. A richer detection is
      NEVER silently replaced by a poorer one (no last-writer-wins); merge every pass's findings into the one
      grounding file.

  skills:
    load: a mention does NOT load a skill — \`read .agents/skills/<name>/SKILL.md\` IN FULL before acting.
    one_per_subagent: each fresh subagent loads only its own skill(s) — SRP, no context bleed.
    web_research: |
      The ONLY web-research skill is \`librarian\` (from pi-web-access) — read IN FULL at
      \`.pi/npm/node_modules/pi-web-access/skills/librarian/SKILL.md\`. It is HEAVY (web_search, repo clones,
      git/gh, version-specific lookups with permalinks), so it is loaded ONLY inside an EPHEMERAL
      \`context-builder\` research pass — NEVER in MAIN or any long-lived driver. That pass fetches, DISTILLS,
      and returns SHORT citable prose (obeys handoff.no_dumps + brevity). STACK-AGNOSTIC: this cascade assumes
      NO stack — librarian looks up versions/APIs/docs against whatever registry or source the DETECTED stack
      actually uses; the target is never hardcoded, only picked from what the context-builder detected. Three
      call sites reference it: PHASE 1 brainstorming (best practices), PHASE 2 writing-plans (current
      versions/API), PHASE 3 executing-plans repair rung #2 (error vs current docs).
      headless: this cascade runs autonomous/headless (e.g. a VPS with no browser). ALWAYS invoke librarian
      with \`workflow: "none"\` — the curator is an INTERACTIVE browser UI that would block/timeout a headless
      subagent (this is autonomy.neutralize applied to librarian). Raw results only, never open the curator.
      degradation: capability-aware, and NEVER block — mirror PHASE 1's tooling check ("note it and continue"):
        - \`web_search\` needs a provider: OpenAI (codex auth or key), Exa (MCP or key), Brave/Tavily/Parallel/
          Perplexity/Gemini (key), or Gemini-Web (browser cookies). With NONE of these it is DEAD — do NOT
          retry it, degrade immediately.
        - \`fetch_content\` + GitHub clone + Jina Reader + PDF SURVIVE on outbound network + \`git\` ALONE (no key,
          no browser, no MCP). This is CLONE-ONLY mode — verified: non-HTML bodies (JSON/text/md) are returned
          directly by extract.ts.
        - CLONE-ONLY covers PHASE 2 (versions) and PHASE 3 (error vs docs) fully: clone the repo, read
          tags/releases/CHANGELOG + \`git log\`/\`blame\`. For VERSION queries there is NO auto-routing to package
          registries, so the pass MUST hit the DETECTED stack's OWN key-free JSON registry endpoint EXPLICITLY
          (returned directly, no key) — which registry depends on the stack and is NEVER assumed. The following
          are EXAMPLES ONLY, to illustrate the pattern (use whichever matches the detected stack, or the
          equivalent registry for any other): Rust → \`https://crates.io/api/v1/crates/<name>\`,
          JS/TS → \`https://registry.npmjs.org/<pkg>\`, Python → \`https://pypi.org/pypi/<pkg>/json\`,
          Go → \`https://proxy.golang.org/<module>/@latest\`.
        - PHASE 1 (open best-practices DISCOVERY) is the ONLY casualty when \`web_search\` is dead: fetch KNOWN
          doc URLs if available, else NOTE the degraded discovery and continue — never block.
        - If even \`git\`/network is unavailable → SKIP web_research, document it in the handoff, continue.

  workspace:
    git_worktrees: NEVER.
    branch:                   # created by MAIN before the first file is written; permeates the whole tree (shared git state, no worktrees)
      base: the branch checked out when the run starts — capture with \`git rev-parse --abbrev-ref HEAD\`
      work: \`agent/<YYYYMMDD-HHMMSS>-<topic>\` — \`git checkout -b <work>\` OFF <base>
      rule: never commit to <base>; every phase runs on <work>; pass <base> and <work> down in each task's context.
    commit: ONE final commit on <work>, at CLOSE only. Workers and gates NEVER commit (avoids parallel git races).
    close: open a PR from <work> into <base> via finishing-a-development-branch.

  models:                     # per-call model wins over settings.json. \`[built-in agent]\` shown per role. The REPAIR LADDER ramps capability upward — re-running the same weak model on the same failure repeats it, so each escalation gets more brain. IDs below are DEFAULTS/EXAMPLES ONLY — the real values are RESOLVED at runtime by PHASE 1 "Model selection" (pi --list-models, best cost/benefit, human-picked) and mapped onto these roles preserving the capability ramp.
    verifier[oracle]:                  openai-codex/gpt-5.5        # design critique, 1 call
    planner[planner]:                  openai-codex/gpt-5.5        # writing-plans + architecture, 1 call
    executing-plans[delegate]:         openai-codex/gpt-5.5        # drives execution + FINAL repair rung (top of ladder, most brain)
    tdd[delegate]:                     openai-codex/gpt-5.4        # drives the phase chain + repair rung #1
    worker[worker]:                    opencode-go/kimi-k2.7-code  # per-file coding waves — highest volume; DOCUMENTS failures, does NOT fix
    reviewer[reviewer]:                openai-codex/gpt-5.4        # per-phase + full-diff review
    context-builder[context-builder]:  opencode-go/qwen3.7-plus    # mechanical grounding + librarian web research (best practices / current versions / docs). NOTE: this default is tuned for mechanical grounding; if librarian synthesis (web + code reading) OR test-topology detection proves too weak for it, bump this role UP — it is OUTSIDE the human model pick. A weaker pass must NEVER be trusted over a richer one — see handoff.reconcile_multi (multiple passes reconcile by UNION, not last-writer-wins).
    # tools: the chosen built-ins already carry what each role needs — delegate/planner have read+write+bash+subagent (spawn + fix); worker/reviewer/context-builder/oracle have read+write+bash. No settings.json change required.

  templates:

    worker:                   # ONE template, parameterized by <PHASE> and <file> — used by EVERY wave (DRY)
      agent: worker
      context: fresh
      model: {models.worker}
      turnBudget: { maxTurns: 15, graceTurns: 2 }   # SOFT wrap-up (tune per stack). Finalize + exit 0 at the warning — never reach the hard abort.
      obeys: [autonomy, fault_isolation, handoff, skills, workspace, budget]
      task: |
        Read .agents/skills/verification-before-completion/SKILL.md IN FULL, then act on ONE file only:
        <file>, for phase <PHASE>, against its contract from the plan.
        The stack is NOT fixed — use the plan's declared test runner / linter / stub sentinel; assume no stack.
        Decide pass/fail OBJECTIVELY: run the plan's verify command for <PHASE> and read its EXIT CODE —
        do NOT judge correctness yourself. Exit 0 → status "ok". Non-zero → status "failed".
        On "failed": do NOT repair and do NOT spawn. IMMEDIATELY document the exact error — (a) append it to
        .pi-subagents/reports/<PHASE>/<safe-file>.md and (b) make it your FIRST output line — so it survives a
        turn-budget wrap-up/abort. Then exit 0. Repair is your parent's job (ladder: tdd → executing-plans).
        If the wrap-up warning fires: stop, finalize the report, exit 0 NOW (do not reach the hard limit).
        Do NOT touch any other file. Do NOT commit. NEVER ask the user.
        Report (plain prose, a few lines): file | phase | status: ok|failed | error | commands→EXIT:code

    review:                   # ONE template, parameterized by <PHASE> — used by every REVIEW (DRY)
      agent: reviewer
      context: fresh
      model: {models.reviewer}
      obeys: [autonomy, handoff, skills]
      task: |
        Review the <PHASE> output for that phase's intent
        (A = contract fidelity; D = implementation vs contract & tests; diff = full change).
        Report issues by severity, one concise line each. Do NOT edit — findings only.
\`\`\`

---

## PHASE 1 — brainstorming   (MAIN, depth 0, INTERACTIVE)   [human_gate: brainstorming_qa]

- Tooling check: \`eza --help\`, \`rg --help\`, \`ast-grep --help\` (if missing, note it and continue).
- INTERNAL grounding only — the user NEVER sees the stack, tools, or findings. Launch a context-builder
  (model {models.context-builder}, context: fresh) to (a) detect the stack from the repo's manifests, (b) map
  the TEST TOPOLOGY — EVERY test runner/level with its exact command and file+line — plus the files coupled to
  the requirement, and (c) load \`librarian\` (contracts.skills.web_research) to research real-world BEST
  PRACTICES for the requirement. It WRITES the grounding to a FILE (not inline prose a downstream weak model can
  drop — see handoff.conservation): \`docs/superpowers/context/YYYY-MM-DD-<topic>-grounding.md\`, with a MANDATORY
  \`## Test topology\` section listing every detected runner/level VERBATIM. Before \`<topic>\` is converged the
  file uses a temp name; MAIN renames it to the \`<topic>\` path at convergence and records that path so every
  downstream phase reads the SAME file. The pass ALSO returns ONE concise distilled summary inline so MAIN knows
  WHAT to ask. \`obeys: [handoff, skills]\`. Detection is SURGICAL (scoped to the requirement), NOT a full repo
  inventory — but whatever it detects MUST survive down the cascade.
- Run the \`brainstorming\` skill: WHAT/WHY, business-only, one question at a time, 2-3 approaches with
  tradeoffs, ASCII wireframes. Optionally re-ground between questions with another context-builder pass.
- Converge on the design and the \`<topic>\`. Then, BEFORE writing ANY file: capture \`<base>\` (the branch
  checked out now, \`git rev-parse --abbrev-ref HEAD\`) and create the work branch off it —
  \`git checkout -b agent/<YYYYMMDD-HHMMSS>-<topic>\` → \`<work>\`. Record both in \`contracts.workspace.branch\`;
  they permeate every downstream phase (shared git state + passed in each task's context). Never commit to \`<base>\`.
- Write the spec (now on \`<work>\`) to \`docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md\`.

### Design verification (before the gate)
Launch the verifier — \`subagent(agent: oracle, model: {models.verifier}, context: fresh)\` at depth 1: audit
the spec for ambiguities, gaps, contradictions, and weak/untestable acceptance. It does NOT edit files.
Surface its findings to the user in business language, fold in the accepted ones, then →

### Model selection   (MAIN — the LAST thing before the gate)   [folded into spec_approval, NOT a 4th gate]
The concrete models in \`contracts.models\` are NOT hardcoded — they are RESOLVED HERE, per run, on best
cost-per-result (a.k.a. best cost/benefit). Do this immediately before opening the HARD GATE:
1. Run \`pi --list-models\` to enumerate the providers + models ACTUALLY available in this pi install.
   Use ONLY models present in \`pi --list-models\` (drop anything pi cannot run).
2. Score each model by cost-per-result / cost-benefit: pricing (input+output $/Mtok) weighed against
   capability signals (context window, reasoning tier, benchmarks). Group BY PROVIDER and
   order providers — and each provider's options — from BEST to WORST cost/benefit.
3. Ask the human ONE question INLINE in the conversation (obeys \`handoff.human_facing\` — NEVER file-only;
   writing the pick to a doc and moving on is FORBIDDEN). It is part of the spec_approval interaction — the
   ONLY moment it is asked, so it does NOT add a fourth human gate — and it BLOCKS: per provider available
   in pi, ordered best→worst, present that provider's top 3 models + a thinking/reasoning variant. MAIN
   STOPS and waits. There is NO silent default: if the human does not choose, nothing proceeds and no models
   are applied. The top-ranked entry is only a labeled recommendation the human may explicitly accept — it is
   NEVER auto-applied on timeout, silence, or by writing it to the spec.
4. Map the chosen models onto the \`contracts.models\` roles, PRESERVING the capability ramp: cheapest
   good-enough for the high-volume \`worker\`, more brain up the repair ladder (\`tdd\` < \`executing-plans\`),
   strongest for \`planner\`/\`verifier\`. Record the final assignments — every downstream phase reads them.
NOTE on scope: the human pick governs ONLY the code-generation cascade (\`planner\`, \`executing-plans\`, \`tdd\`,
\`worker\`, \`reviewer\`). \`verifier\` (design audit) is a one-shot pre-gate role and is NOT re-launched. The
\`context-builder\` (grounding + \`librarian\` web research) is a fixed cheap role OUTSIDE the human pick: it runs
on its default model EVERY time it is invoked — pre-gate (PHASE 1 brainstorming) and post-gate (PHASE 2 planner
grounding, PHASE 3 repair research) alike.

## >>> HARD GATE   (MAIN)   [human_gate: spec_approval]
Wait for EXPLICIT human approval. From here, \`contracts.autonomy.after_gate\` applies — never ask again
until finishing_choice.

## PHASE 2 — writing-plans   (subagent, depth 1)   [obeys: autonomy.neutralize.writing-plans, handoff, skills, workspace]
Launch \`subagent(agent: planner, model: {models.planner}, context: fresh)\`. It:
- Reads \`.agents/skills/writing-plans/SKILL.md\` in full, then reads the PHASE 1 grounding file
  (\`docs/superpowers/context/YYYY-MM-DD-<topic>-grounding.md\`) and carries its \`## Test topology\` VERBATIM.
  Grounds with a context-builder pass that ALSO loads \`librarian\` (contracts.skills.web_research) to pull the
  CURRENT versions + latest API shapes of the libraries/packages in scope (e.g. a framework renamed or dropped
  an API in its latest major, or a package moved a module), so the plan's \`contract:\` lines cite recent,
  accurate references — and writes the plan to \`docs/superpowers/plans/YYYY-MM-DD-<topic>-implementation.md\`.
- The plan MUST declare, as data the downstream reads verbatim:
  - \`## Files\` — one line per file: \`path | parallelSafe: yes/no | contract: <public interface>\`
  - \`## Test topology\` — copy EVERY runner/level from the grounding file VERBATIM, each with its exact command
    (unit, integration, e2e, … — whatever was detected). One runner → list one; three → list three. Dropping
    ANY detected level is a contract violation (handoff.conservation). After writing the plan, ASSERT this
    section covers every level in the grounding file's \`## Test topology\`; if a level is missing, abort and
    re-detect — NEVER silently proceed.
  - \`## Pipeline\` — the ordered phases + gates (below), the linter, and the **stub sentinel** GATE C checks for
    (e.g. TS \`throw new Error("not implemented")\`, Python \`NotImplementedError\`, Go \`panic("not implemented")\`
    — whatever fits the detected stack). Every GATE that runs "the suite" runs ALL levels from \`## Test
    topology\`, not just one.
- Then launches PHASE 3 as its child, and after it returns runs the Code-review close (below).

## PHASE 3 — executing-plans   (agent: delegate, model: {models.executing-plans}, depth 2)   [obeys: autonomy.neutralize.executing-plans, fault_isolation, handoff, skills, workspace]
Launch \`subagent(agent: delegate, model: {models.executing-plans}, context: fresh, turnBudget: { maxTurns: 90, graceTurns: 3 })\`. It reads the plan's
\`## Files\` + \`## Pipeline\`, launches the TDD driver, and is **repair rung #2 (FINAL, most brain)**: if TDD
reports an unresolved file, read \`.agents/skills/systematic-debugging/SKILL.md\`, and before fixing launch a
\`context-builder\`+\`librarian\` research pass (contracts.skills.web_research) to check whether the failure is a
version/API mismatch — verify error vs implementation vs CURRENT docs — then fix it yourself and re-run
the gate. Still red after your pass → report the unresolved file up (MAIN does not touch code). Never
re-dispatch workers for a repair.

### The TDD phase chain   (agent: delegate, model: {models.tdd}, depth 3)
Launch \`subagent(agent: delegate, model: {models.tdd}, context: fresh, turnBudget: { maxTurns: 60, graceTurns: 3 })\` — it reads
\`.agents/skills/test-driven-development\` + \`.agents/skills/dispatching-parallel-agents\` and drives the
phases IN ORDER as a RESILIENT chain: each phase is a parallel wave it gates between; because workers
always exit 0, the chain never aborts.

Per phase: fan out \`contracts.templates.worker\` (agent: worker) with \`<PHASE>\` set — ONE worker per file
(depth 4), via dispatching-parallel-agents, \`failFast:false\`, bounded concurrency. Then run the phase's
REVIEW (where listed) and run the GATE YOURSELF (source of truth). Every "full suite" GATE below runs ALL
levels from the plan's \`## Test topology\` (unit + integration + e2e + … together), not a single runner — a
level absent from the run is precisely the signal-loss bug this contract exists to prevent.
If the gate is red → you are **repair rung #1**: read \`.agents/skills/systematic-debugging/SKILL.md\`, fix
the failing file(s) directly, re-run the gate. Still red after ONE systematic-debugging pass → do NOT loop
and do NOT re-dispatch workers; report the unresolved file(s) with their exact errors UP to executing-plans.
No commits.

| Phase | REVIEW | GATE (you run the real check) |
|-------|--------|-------------------------------|
| A STUBS     | REVIEW(A) — contract fidelity | lint + imports resolve |
| B TESTS     | —          | GATE C: full suite RED for the RIGHT reason (the plan's stub sentinel) |
| D IMPL      | REVIEW(D) — impl vs contract  | GATE E: full suite GREEN + lint together — on CONTRACT MISMATCH → H TRIAGE |
| F HARDENING | —          | full suite GREEN + lint |
| G EDGE      | —          | full suite GREEN + lint, edge cases covered |
| I REFACTOR  | —          | full suite GREEN + lint, no behavior change |

- **H TRIAGE** (conditional — only when GATE E flags a contract mismatch): a worker wave that diagnoses
  whether the mismatch is in impl / test / contract, reconciles it against the plan's contract, re-verifies,
  then rejoins the pipeline. \`obeys: [fault_isolation]\`.

### Code-review close   (owner: the PHASE 2 agent, after PHASE 3 returns)
1. Launch a fresh reviewer — \`contracts.templates.review\` (no \`<PHASE>\`, model {models.reviewer}) — over the
   FULL diff. It PRODUCES the review feedback.
2. Read \`.agents/skills/receiving-code-review/SKILL.md\` and apply that feedback autonomously: verify each
   item against the code, then fix it or give reasoned pushback, one at a time.
   \`obeys: [autonomy.neutralize.receiving-code-review]\`.
3. Re-run the gate, then make the ONE final commit (\`contracts.workspace.commit\`) UNCONDITIONALLY on green —
   NEVER ask the human whether to commit (that is not a gate; see autonomy.subagent_human_channel). Report
   OK / not-OK and any residual failure UP to MAIN — plain prose only.

## CLOSE   (MAIN, depth 0)   [human_gate: finishing_choice]
- If not-OK, or a file is still failing after the repair ladder topped out at executing-plans → STOP and
  report to the human: the file, the exact error, and what each rung tried. This is the SINGLE allowed escalation.
- If OK → run \`finishing-a-development-branch\` to OPEN A PR from \`<work>\` into \`<base>\` (its push-PR option);
  it still surfaces finishing_choice ("which option?", typed "discard" to discard). MAIN only manages the
  branch lifecycle (created \`<work>\` in PHASE 1, opens the PR here) and reads the verdict — it never wrote code.

</req>
`;

/**
 * Build the MAIN prompt: HEAD (verbatim) → the user's requirement → METHODOLOGY
 * (verbatim). Mirrors the original head + req + tail composition, now fully inline.
 */
function buildPrompt(requirement: string): string {
  return `${HEAD}\n\n# ${requirement}\n\n---\n\n${METHODOLOGY}`;
}

export default function obraFlow(pi: ExtensionAPI): void {
  pi.registerCommand("obra-sp-flow", {
    description:
      "Run the OBRA FLOW autonomous cascade for a requirement (/obra-sp-flow <requirement>)",
    handler: async (args, ctx) => {
      const requirement = args.trim();
      if (!requirement) {
        ctx.ui.notify("Usage: /obra-sp-flow <requirement>", "warning");
        return;
      }
      if (!ctx.isIdle()) {
        ctx.ui.notify(
          "Agent is busy — run /obra-sp-flow when the agent is idle.",
          "warning",
        );
        return;
      }
      pi.sendUserMessage(buildPrompt(requirement));
    },
  });
}
