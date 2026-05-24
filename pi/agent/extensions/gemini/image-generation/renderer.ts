import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Container, getImageDimensions, Image, Text } from "@earendil-works/pi-tui";
import { IMAGE_MESSAGE_TYPE, type GeneratedImageDetails } from "./types";

/** Inline-image renderer for the conversation transcript. */
export function registerImageRenderer(pi: ExtensionAPI) {
  pi.registerMessageRenderer<GeneratedImageDetails>(IMAGE_MESSAGE_TYPE, (message, _options, theme) => {
    const d = message.details;
    if (!d) return undefined;
    const dims = getImageDimensions(d.base64, d.mimeType);
    const c = new Container();
    c.addChild(new Text(theme.fg("accent", `✓ Generated · ${d.model} · ${d.aspectRatio} · ${d.imageSize}`)));
    c.addChild(new Text(theme.fg("dim", d.path)));
    if (dims) {
      c.addChild(new Image(d.base64, d.mimeType,
        { fallbackColor: (s) => theme.fg("muted", s) },
        { maxHeightCells: 30, filename: d.path }, dims));
    } else {
      c.addChild(new Text(theme.fg("warning", "(image dimensions unavailable, open the file directly)")));
    }
    return c;
  });
}
