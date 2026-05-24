// Detects a double press of the same key within a time window. Pure + testable.

export class DoublePressDetector {
	private lastAt = Number.NEGATIVE_INFINITY;

	constructor(private readonly windowMs: number) {}

	/** Call on each matching key press; returns true when it completes a double press. */
	press(now: number): boolean {
		const isDouble = now - this.lastAt <= this.windowMs;
		// Reset after completing a double so three presses don't read as two doubles.
		this.lastAt = isDouble ? Number.NEGATIVE_INFINITY : now;
		return isDouble;
	}
}
