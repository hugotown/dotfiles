import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Open `path` in the OS default image viewer. Platform-specific.
 */
export function openImageExternally(pi: ExtensionAPI, path: string): Promise<unknown> {
  if (process.platform === "darwin") return pi.exec("open", [path]);
  if (process.platform === "linux") return pi.exec("xdg-open", [path]);
  if (process.platform === "win32") return pi.exec("cmd", ["/c", "start", "", path]);
  return Promise.reject(new Error(`Unsupported platform: ${process.platform}`));
}
