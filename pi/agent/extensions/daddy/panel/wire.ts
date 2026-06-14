// panel/wire.ts — Single bridge from dag-executor emissions to the panel store.
import type { RunDeps, RunState } from "../runtime-types.ts";
import type { Store, StreamEntry } from "./store.ts";

function baseNodeId(id: string): string {
  return id.replace(/ #\d+$/, "");
}

function appendOrCollapseThinking(store: Store, nodeId: string, text: string): void {
  const current = store.getState().streams[nodeId] ?? [];
  const last = current[current.length - 1];
  if (last && last.type === "thinking") {
    if (last.content === text) return;
    const next: StreamEntry[] = current.slice(0, -1);
    next.push({ type: "thinking", content: text, timestamp: Date.now() });
    store.setState((s) => ({ ...s, streams: { ...s.streams, [nodeId]: next } }));
    return;
  }
  store.appendStream(nodeId, { type: "thinking", content: text, timestamp: Date.now() });
}

export function wrapDeps(store: Store, base: RunDeps): RunDeps {
  return {
    ...base,
    emit: (state: RunState) => {
      base.emit(state);
      store.setRun(state);
      if (state.status === "paused" && state.paused_node) {
        store.setWaiting(state.paused_node, state.nodes[state.paused_node]?.output ?? "");
      } else {
        store.setWaiting(null, null);
      }
    },
    onStream: (nodeId: string, text: string) => {
      base.onStream?.(nodeId, text);
      store.appendStream(nodeId, { type: "text", content: text, timestamp: Date.now() });
      store.clearLive(nodeId);
    },
    onThinking: (nodeId: string, text: string) => {
      base.onThinking?.(nodeId, text);
      appendOrCollapseThinking(store, nodeId, text);
    },
    progress: (nodeId: string, text: string) => {
      base.progress?.(nodeId, text);
      store.setLive(baseNodeId(nodeId), text);
    },
  };
}
