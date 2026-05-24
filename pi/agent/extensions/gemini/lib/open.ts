/**
 * Open a file in the OS default viewer. Shared by modules that produce
 * artifacts (images, annotated vision output) and want to surface them.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export function openExternally(pi: ExtensionAPI, path: string): Promise<unknown> {
  if (process.platform === "darwin") return pi.exec("open", [path]);
  if (process.platform === "linux") return pi.exec("xdg-open", [path]);
  if (process.platform === "win32") return pi.exec("cmd", ["/c", "start", "", path]);
  return Promise.reject(new Error(`Unsupported platform: ${process.platform}`));
}
