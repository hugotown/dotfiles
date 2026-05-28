/**
 * Open a file in the OS default viewer. Fire-and-forget; never blocks the caller.
 */
import { spawn } from "node:child_process";

export function openExternally(path: string): void {
  const args: [string, string[]] =
    process.platform === "darwin" ? ["open", [path]] :
    process.platform === "linux"  ? ["xdg-open", [path]] :
    process.platform === "win32"  ? ["cmd", ["/c", "start", "", path]] :
    ["echo", []]; // no-op on unknown platforms
  spawn(...args, { detached: true, stdio: "ignore" }).unref();
}
