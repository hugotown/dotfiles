// panel/wire.ts — Single bridge from dag-executor emissions to the panel store.
import type { RunDeps, RunState } from "../runtime-types.ts";
import type { Store } from "./store.ts";

function baseNodeId(id: string): string {
  return id.replace(/ #\d+$/, "");
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
    progress: (nodeId: string, text: string) => {
      base.progress?.(nodeId, text);
      store.setLive(baseNodeId(nodeId), text);
    },
  };
}
