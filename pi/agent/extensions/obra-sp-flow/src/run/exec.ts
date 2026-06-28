/**
 * Real `Exec` port: spawn a deterministic command (git/eza/rg/test/lint), capture
 * stdout/stderr/exit code. Abort is handled natively via the spawn `signal`; an
 * optional `timeout` hard-kills the child (SIGKILL) and flags `killed`.
 */
import type { Exec, ExecResult } from "../types/common.ts";
import { type SpawnChild, type SpawnFn } from "./spawn.ts";

/** Build an `Exec` bound to a spawn implementation and a fixed working directory. */
export function makeExec(spawnImpl: SpawnFn, cwd?: string): Exec {
	return (command, args, opts) => {
		let resolve!: (r: ExecResult) => void;
		const done = new Promise<ExecResult>((r) => {
			resolve = r;
		});

		let stdout = "";
		let stderr = "";
		let killed = false;
		let settled = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const finish = (r: ExecResult): void => {
			if (settled) return;
			settled = true;
			if (timer) clearTimeout(timer);
			resolve(r);
		};

		let proc: SpawnChild;
		try {
			proc = spawnImpl(command, args, {
				cwd,
				shell: false,
				stdio: ["ignore", "pipe", "pipe"],
				signal: opts?.signal,
			});
		} catch (err) {
			finish({ stdout: "", stderr: String(err), code: null, killed: false });
			return done;
		}

		if (opts?.timeout && opts.timeout > 0) {
			timer = setTimeout(() => {
				killed = true;
				proc.kill("SIGKILL");
			}, opts.timeout);
		}

		proc.stdout?.on("data", (d) => {
			stdout += String(d);
		});
		proc.stderr?.on("data", (d) => {
			stderr += String(d);
		});
		proc.on("error", (err) =>
			finish({ stdout, stderr: stderr ? `${stderr}\n${err}` : String(err), code: null, killed }),
		);
		proc.on("close", (code) => finish({ stdout, stderr, code, killed }));
		return done;
	};
}
