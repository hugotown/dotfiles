// panel/store.ts — Reactive store for the daddy panel (pub/sub, one per run).
import type { RunState } from "../runtime-types.ts";

export interface StreamEntry {
  type: "text" | "tool_call" | "status";
  content: string;
  timestamp: number;
}

export interface PanelState {
  run: RunState | null;
  streams: Record<string, StreamEntry[]>;
  live: Record<string, string>;
  waitingForInput: string | null;
  inputPrompt: string | null;
}

export type PanelListener = () => void;

export function createStore() {
  let state: PanelState = {
    run: null, streams: {}, live: {}, waitingForInput: null, inputPrompt: null,
  };
  const listeners = new Set<PanelListener>();

  const notify = () => { for (const l of listeners) l(); };

  return {
    getState: () => state,
    setState: (updater: (s: PanelState) => PanelState) => {
      state = updater(state);
      notify();
    },
    subscribe: (listener: PanelListener): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    appendStream: (nodeId: string, entry: StreamEntry) => {
      state = {
        ...state,
        streams: {
          ...state.streams,
          [nodeId]: [...(state.streams[nodeId] ?? []), entry],
        },
      };
      notify();
    },
    setLive: (nodeId: string, text: string) => {
      state = { ...state, live: { ...state.live, [nodeId]: text } };
      notify();
    },
    clearLive: (nodeId: string) => {
      const { [nodeId]: _omit, ...rest } = state.live;
      state = { ...state, live: rest };
      notify();
    },
    setWaiting: (nodeId: string | null, prompt: string | null) => {
      state = { ...state, waitingForInput: nodeId, inputPrompt: prompt };
      notify();
    },
    setRun: (run: RunState) => {
      state = { ...state, run };
      notify();
    },
  };
}

export type Store = ReturnType<typeof createStore>;
