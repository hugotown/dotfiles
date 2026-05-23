// orchestrator.ts — Shared state, helpers, and constants for the brainstorm workflow
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { type BrainstormState, createInitialState, transition } from "./state.ts";

export const BRAINSTORM_FLAG = "--brainstorm";
const SONNET_MODEL_ID = "claude-sonnet-4-20250514";
const OPUS_MODEL_ID = "claude-opus-4-20250514";
const PROVIDER = "anthropic";

// Tools restricted per phase
export const RESEARCH_TOOLS = ["bash", "brainstorm_questions"];
export const APPROACH_TOOLS = ["brainstorm_approaches"];
export const DESIGN_TOOLS = ["brainstorm_design"];
export const REVISION_TOOLS = ["brainstorm_design_revision"];
export const REVIEW_TOOLS = ["brainstorm_review"];

export class BrainstormOrchestrator {
  state: BrainstormState = createInitialState();
  allToolNames: string[] = [];
  pi: ExtensionAPI;

  constructor(pi: ExtensionAPI) {
    this.pi = pi;
  }

  isActive(): boolean {
    return this.state.phase !== "IDLE" && this.state.phase !== "COMPLETE";
  }

  persist(): void {
    this.pi.appendEntry("brainstorm-state", this.state);
  }

  transition(event: Parameters<typeof transition>[1], payload?: Parameters<typeof transition>[2]): void {
    this.state = transition(this.state, event, payload);
  }

  async setModelToSonnet(ctx: ExtensionContext): Promise<void> {
    this.captureOriginalModel(ctx);
    const sonnet = ctx.modelRegistry.find(PROVIDER, SONNET_MODEL_ID);
    if (sonnet) await this.pi.setModel(sonnet);
  }

  async setModelToOpus(ctx: ExtensionContext): Promise<void> {
    this.captureOriginalModel(ctx);
    const opus = ctx.modelRegistry.find(PROVIDER, OPUS_MODEL_ID);
    if (opus) await this.pi.setModel(opus);
  }

  async restoreModel(ctx: ExtensionContext): Promise<void> {
    if (this.state.originalModel) {
      const model = ctx.modelRegistry.find(this.state.originalModel.provider, this.state.originalModel.id);
      if (model) await this.pi.setModel(model);
    }
  }

  restoreTools(): void {
    if (this.allToolNames.length > 0) {
      this.pi.setActiveTools(this.allToolNames);
    }
  }

  async cancel(ctx: ExtensionContext): Promise<void> {
    this.transition("RESET");
    this.restoreTools();
    await this.restoreModel(ctx);
    this.persist();
    ctx.ui.notify("Brainstorming cancelled.", "info");
  }

  formatAssumptions(): string {
    return this.state.assumptions
      .map((a) => `- ${a.text} (${a.confidence})`)
      .join("\n");
  }

  formatAnswers(): string {
    return Object.entries(this.state.answers)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join("\n");
  }

  setActiveTools(tools: string[]): void {
    this.pi.setActiveTools(tools);
  }

  sendMessage(prompt: string): void {
    this.pi.sendUserMessage(prompt, { deliverAs: "followUp" });
  }

  private captureOriginalModel(ctx: ExtensionContext): void {
    if (!this.state.originalModel) {
      const current = ctx.model;
      if (current) {
        this.state.originalModel = { provider: current.provider, id: current.id };
      }
    }
  }
}
