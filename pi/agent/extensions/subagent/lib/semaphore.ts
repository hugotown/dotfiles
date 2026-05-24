// A minimal counting semaphore for bounding concurrent agent runs.

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
