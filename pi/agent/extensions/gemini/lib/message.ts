/**
 * Shared plain-text transcript renderer. Modules surface their results via
 * sendText() instead of each registering a near-identical renderer.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Container, Text } from "@earendil-works/pi-tui";

export const TEXT_MESSAGE_TYPE = "gemini-text";

interface TextDetails {
  title?: string;
}

export function registerTextRenderer(pi: ExtensionAPI): void {
  pi.registerMessageRenderer<TextDetails>(TEXT_MESSAGE_TYPE, (message, _options, theme) => {
    const c = new Container();
    if (message.details?.title) c.addChild(new Text(theme.fg("accent", theme.bold(message.details.title))));
    const content = typeof message.content === "string" ? message.content : "";
    c.addChild(new Text(content));
    return c;
  });
}

export function sendText(pi: ExtensionAPI, content: string, title?: string): void {
  pi.sendMessage<TextDetails>({
    customType: TEXT_MESSAGE_TYPE,
    content,
    display: true,
    details: { title },
  });
}
