// lib/semaphore.ts — Counting semaphore (verified pattern from subagent).
export interface Semaphore { acquire(): Promise<void>; release(): void; }

export function createSemaphore(limit: number): Semaphore {
  let active = 0;
  const waiters: Array<() => void> = [];
  return {
    acquire(): Promise<void> {
      if (active < limit) { active++; return Promise.resolve(); }
      return new Promise<void>((r) => waiters.push(r)).then(() => { active++; });
    },
    release(): void { active--; waiters.shift()?.(); },
  };
}
