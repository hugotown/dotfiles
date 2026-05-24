import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { DynamicBorder, getSettingsListTheme } from "@earendil-works/pi-coding-agent";
import { Container, Input, SettingsList, Text, type SettingItem } from "@earendil-works/pi-tui";
import { ASPECT_RATIOS, IMAGE_MODELS, IMAGE_SIZES } from "../lib/models";
import { defaultForm, type ImageForm } from "./types";

function textInput(): NonNullable<SettingItem["submenu"]> {
  return (currentValue, done) => {
    const input = new Input();
    input.setValue(currentValue);
    input.focused = true;
    input.onSubmit = (value) => done(value);
    input.onEscape = () => done();
    return input;
  };
}

export async function showImageForm(ctx: ExtensionContext, initialPrompt: string): Promise<ImageForm | null> {
  return ctx.ui.custom<ImageForm | null>((tui, theme, _kb, done) => {
    const state = defaultForm(initialPrompt);
    const tempItem: SettingItem = { id: "temperature", label: "Temperature", currentValue: "1", submenu: textInput() };
    const seedItem: SettingItem = { id: "seed", label: "Seed", currentValue: "null", submenu: textInput() };

    const items: SettingItem[] = [
      { id: "__generate", label: "▶ Generate image", currentValue: "press enter", values: ["press enter"] },
      { id: "prompt", label: "Prompt", currentValue: state.prompt, submenu: textInput() },
      { id: "model", label: "Model", currentValue: state.model, values: [...IMAGE_MODELS] },
      { id: "aspectRatio", label: "Aspect ratio", currentValue: state.aspectRatio, values: [...ASPECT_RATIOS] },
      { id: "imageSize", label: "Image size", currentValue: state.imageSize, values: [...IMAGE_SIZES] },
      tempItem, seedItem,
      { id: "__cancel", label: "✗ Cancel", currentValue: "esc", values: ["esc"] },
    ];

    const list = new SettingsList(items, items.length, getSettingsListTheme(), (id, value) => {
      if (id === "__generate") return done({ ...state });
      if (id === "__cancel") return done(null);
      if (id === "prompt") state.prompt = value.trim();
      else if (id === "model") state.model = value;
      else if (id === "aspectRatio") state.aspectRatio = value;
      else if (id === "imageSize") state.imageSize = value;
      else if (id === "temperature") {
        const n = Number(value);
        if (Number.isFinite(n) && n >= 0 && n <= 2) state.temperature = n;
        tempItem.currentValue = state.temperature.toString();
      } else if (id === "seed") {
        const t = value.trim();
        state.seed = !t || t === "null" ? null : (Number.isInteger(Number(t)) ? Number(t) : state.seed);
        seedItem.currentValue = state.seed === null ? "null" : state.seed.toString();
      }
      tui.requestRender();
    }, () => done(null));

    const container = new Container();
    container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
    container.addChild(new Text(theme.fg("accent", theme.bold("Generate image with Gemini"))));
    container.addChild(new Text(theme.fg("dim", "↑↓ navigate • enter activate • esc cancel")));
    container.addChild(list);
    container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

    return {
      render(width: number) { return container.render(width); },
      invalidate() { container.invalidate(); },
      handleInput(data: string) { list.handleInput(data); tui.requestRender(); },
    };
  });
}
