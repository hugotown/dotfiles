// Re-exports for backward compatibility.
// The original monolithic module has been split into:
//   - child-process.ts (shared spawning)
//   - status-parser.ts (STATUS line parsing)
//   - workspace-setup.ts (branch, backup, snapshots)
//   - impl-dispatcher.ts (implementation dispatch)
//   - test-dispatcher.ts (test generation dispatch)

export { dispatchImplementation } from "./impl-dispatcher.ts";
export { dispatchTestGeneration } from "./test-dispatcher.ts";
