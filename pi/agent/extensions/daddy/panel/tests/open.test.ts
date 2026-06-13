// panel/tests/open.test.ts
import { test, expect } from "bun:test";
import { openDaddyPanel } from "../open.ts";
import { createStore } from "../store.ts";

test("openDaddyPanel calls ctx.ui.custom with overlay options", async () => {
  const store = createStore();
  let customCalled = false;
  let overlayOpts: any = null;
  const mockCtx = {
    ui: {
      custom: (_factory: any, opts: any) => {
        customCalled = true;
        overlayOpts = opts;
        // Simulate immediate close
        return Promise.resolve();
      },
    },
  } as any;
  const mockDeps = { exec: async () => ({ stdout: "", stderr: "", code: 0, killed: false }),
    notify: () => {}, emit: () => {}, home: "/h", bundledDir: "/b", projectDir: "/p" } as any;

  await openDaddyPanel(mockCtx, store, mockDeps);
  expect(customCalled).toBe(true);
  expect(overlayOpts.overlay).toBe(true);
  expect(overlayOpts.overlayOptions.width).toBe("85%");
  expect(overlayOpts.overlayOptions.anchor).toBe("center");
});
