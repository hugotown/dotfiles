---
description: Run a new fm task
---

Captain structure:

!`eza --tree --level=5 --git-ignore ~/fm-home 2>&1`

Docker version:

!`docker --version 2>&1`

Docker containers:

!`docker ps 2>&1`

Hello Firstmate.

Please dispatch the task or set of tasks: `$2`, for the project: `$1`.

### Initial Assessment (Triage)
- **If the task(s) are SIMPLE:** Dispatch them immediately using a crewmate in the PI harness with the most cost-effective model for each task (strictly respecting the rule of zero installations on the host system). Stop here.
- **If they are NOT simple:** Execute the following pipeline for the requested tasks (if there are multiple tasks, parallelize the technical analysis but consolidate all user questions and interactions into single batches):

---

## 1. Grounding, Clarification & Docker Environment (Parallel)
Spawn two disposable crewmates in parallel using the PI harness:

1. **Crewmate A (Grounding & Docker) [*mid-tier model*]:**
   - **Strict Rule:** Installing programming languages or tools of any kind on the base (host) system is strictly forbidden. All development, testing, and validation must take place inside a Docker container.
   - **Action:** Analyze the architecture and perform codebase grounding using `eza`, `ast-grep`, and `rg`. Propose the preliminary Docker container requirements and formulate the most critical (non-obvious) questions regarding the scope of `$2`.
2. **Crewmate B (Model Scout) [*low-tier model*]:**
   - **Action:** Search in parallel using `tool:pi-web-access` and `tool:fetch` to identify which free models are currently available at `https://opencode.ai/go`.
   - **Close B:** Deliver the list as `[FREE_MODELS]` and **immediately dispose of Crewmate B**.

### Resolution & Container Creation Sequence (with Crewmate A):
- **1.a. User Clarification:** Present Crewmate A's questions to the user. Iterate on the answers between the user and Crewmate A until neither has any doubts about the scope.
- **1.b. Container Optimization & Authorization:** Once the scope is locked, review with Crewmate A the final tool requirements for the Docker container (where the task will be developed, tested, and validated). Iterate with Crewmate A until you are certain the container includes only the indispensable requirements and is optimized not to waste host computer resources. Explicitly authorize the creation of the container so it is ready for work.
- **1.c. Close A:** Jointly with Crewmate A, generate the consolidated `[GROUNDING_REPORT]` (architecture overview, resolved Q&A, and details/ID of the authorized Docker container). Preserve `[GROUNDING_REPORT]` and **dispose of Crewmate A**.

---

## 2. UX/UI with Lavish (Conditional)
Evaluate the impact of `$2`: if it involves modifying UI design or UX user experience (even if not explicitly stated by the user), execute this phase. **If not applicable, skip to step 3.**

- **2.a.** Spawn a disposable crewmate in the PI harness using the `*lavish-tier model*`. Instruct it that its mandatory first step is to run `lavish-axi --help` (to verify annotation properties and active WebSocket listening) and to read and strictly follow the master UX/UI map at all times: `cat ~/fm-home/data/ux-ui-mapa-maestro.md`.
- **2.b.** Pass the complete `$2` task and the `[GROUNDING_REPORT]` to the Lavish crewmate. Ask if it has any questions for the user *before* starting on the Lavish canvas. Once all doubts are clarified with the user, proceed to the UI/UX design.
- **2.c.** Maintain active, real-time monitoring between the Lavish crewmate, yourself, and the user. It is a top priority that everyone is notified of any response or interaction received in Lavish the exact second it occurs.
- **2.d. Close Lavish:** Iterate the feedback loop between the user and the Lavish crewmate until full agreement is reached. Save the generated artifacts as `[UX_ARTIFACTS]` and **dispose of the Lavish crewmate**.

---

## 3. Planning (Orchestration & Parallelization)
Spawn a disposable `*opus or astra crewmate*` in the PI harness, passing as context: `$2`, `[GROUNDING_REPORT]`, `[FREE_MODELS]`, and `[UX_ARTIFACTS]` (if applicable).

The Planner must deliver the `[MASTER_PLAN]` fulfilling these points:
- **3.a. Effort & Environment:** An effort-level analysis required to solve the task, establishing that all development, test execution, and validation will run inside the Docker container created in Step 1.
- **3.b. Real-World Verification:** Validate that everything outlined in the plan matches real-world implementations by searching the internet in parallel using `pi-web-access`.
- **3.c. Maximum Parallelization & PI Harness Tooling:** A detailed proposal to granularize tasks to the maximum extent and optimize cost, token usage, and time by assigning the most suitable model to each tool (leveraging `[FREE_MODELS]` where applicable):
  - `pi-interactive-shell`: Run interactive CLIs in an observable overlay with full PTY emulation. User can take over anytime., Can run in foreground or background; allows running `opencode` (to use `opencode-go` models) or `pi-boomerang`, among other capabilities the Planner must verify and evaluate.
  - `pi-boomerang`: For activity loops (needs pi-interactive-sheel foreground).
  - `pi-subagents`:Delegate to child agents with chains, parallel execution, and async dispatch, (subagent task workflows).
  - `pi-messenger`: Multi-agent coordination through the filesystem. Agents join, claim tasks, reserve files, send messages. 
  - `pi-web-access`: Web search and content extraction. Works with Chrome cookies.
  - `pi-review-loop`: Automated code review loop that re-prompts until no issues found or max iterations hit.
  - `pi-rewind-hook` - Git-backed checkpoints for AI coding sessions. Browse and restore file states
  - `pi-model-switch`: Lets the agent switch its own model mid-session.
- **3.d. Mandatory Plan Constraints:**
  1. **Worktrees:** Do not create any additional git worktree beyond the one `treehouse` already created.
  2. **Nesting Limits:** Respect the technical limitations of each tool (e.g., never plan to run a `pi-interactive-shell` -> inside it a `pi-boomerang` -> and inside that an `opencode`; that is not possible).
  3. **Cleanup:** Include explicit steps to clean up all temporary artifacts generated by the tools.
  4. **Clarity:** Provide clear, concise instructions on how to dispatch the task: objective, sequential/parallel steps, and exactly when and how to use each PI tool and `pi-interactive-shell` (with or without `opencode`).

- **3.e. Close Planner:** Preserve the `[MASTER_PLAN]` and **dispose of the Planner crewmate**.

---

## 4. Dispatch (Execution, Testing & Validation)
Using the `[MASTER_PLAN]`, `[GROUNDING_REPORT]`, and `[UX_ARTIFACTS]` (if any), dispatch the task as you normally do in Firstmate, delegating execution to a crewmate running a `*mid-high tier model*` capable of orchestrating the entire workflow.

**Mandatory directives for the executing crewmate:**
1. All development, testing, and final validation must be performed **inside the Docker container** prepared in Phase 1.
2. Using the PI harness tools detailed in the `[MASTER_PLAN]` **is not about blindly delegating work to someone else**, but rather about amplifying its own capacity to parallelize, ensure quality, and optimize time and tokens.