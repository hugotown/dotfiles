// A minimal counting semaphore for bounding concurrent sub-pi spawns.
// Identical pattern to subagent/lib/semaphore.ts (duplicated by design: the
// extensions README forbids cross-extension imports).

export interface Semaphore {
  acquire(): Promise<void>;
  release(): void;
}

export function createSemaphore(limit: number): Semaphore {
  let active = 0;
  const waiters: Array<() => void> = [];
  return {
    acquire(): Promise<void> {
      if (active < limit) {
        active++;
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => waiters.push(resolve)).then(() => {
        active++;
      });
    },
    release(): void {
      active--;
      waiters.shift()?.();
    },
  };
}
