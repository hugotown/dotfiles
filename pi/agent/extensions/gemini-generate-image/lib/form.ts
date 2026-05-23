import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { DynamicBorder, getSettingsListTheme } from "@earendil-works/pi-coding-agent";
import { Container, Input, SettingsList, Text, type SettingItem } from "@earendil-works/pi-tui";
import { ASPECT_RATIOS, IMAGE_SIZES, MODELS, defaultForm, type FormValues } from "./types";

function textInputSubmenu(): NonNullable<SettingItem["submenu"]> {
  return (currentValue, done) => {
    const input = new Input();
    input.setValue(currentValue);
    input.focused = true;
    input.onSubmit = (value) => done(value);
    input.onEscape = () => done();
    return input;
  };
}

export async function showForm(ctx: ExtensionContext, initialPrompt: string): Promise<FormValues | null> {
  return ctx.ui.custom<FormValues | null>((tui, theme, _kb, done) => {
    const state = defaultForm(initialPrompt);

    const promptItem: SettingItem = { id: "prompt", label: "Prompt", currentValue: state.prompt, submenu: textInputSubmenu() };
    const modelItem: SettingItem = { id: "model", label: "Model", currentValue: state.model, values: [...MODELS] };
    const aspectItem: SettingItem = { id: "aspectRatio", label: "Aspect ratio", currentValue: state.aspectRatio, values: [...ASPECT_RATIOS] };
    const sizeItem: SettingItem = { id: "imageSize", label: "Image size", currentValue: state.imageSize, values: [...IMAGE_SIZES] };
    const tempItem: SettingItem = { id: "temperature", label: "Temperature", currentValue: state.temperature.toString(), submenu: textInputSubmenu() };
    const seedItem: SettingItem = { id: "seed", label: "Seed", currentValue: state.seed === null ? "null" : state.seed.toString(), submenu: textInputSubmenu() };
    const outDirItem: SettingItem = { id: "outputDir", label: "Output dir", currentValue: state.outputDir, submenu: textInputSubmenu() };
    const generateItem: SettingItem = { id: "__generate", label: "▶ Generate image", currentValue: "press enter", values: ["press enter"] };
    const cancelItem: SettingItem = { id: "__cancel", label: "✗ Cancel", currentValue: "esc", values: ["esc"] };

    const items: SettingItem[] = [generateItem, promptItem, modelItem, aspectItem, sizeItem, tempItem, seedItem, outDirItem, cancelItem];

    const settingsList = new SettingsList(
      items, items.length, getSettingsListTheme(theme),
      (id, newValue) => {
        if (id === "__generate") { done({ ...state }); return; }
        if (id === "__cancel") { done(null); return; }
        if (id === "prompt") state.prompt = newValue.trim();
        else if (id === "model") state.model = newValue;
        else if (id === "aspectRatio") state.aspectRatio = newValue;
        else if (id === "imageSize") state.imageSize = newValue;
        else if (id === "temperature") {
          const n = Number(newValue);
          if (Number.isFinite(n) && n >= 0 && n <= 2) state.temperature = n;
          tempItem.currentValue = state.temperature.toString();
        } else if (id === "seed") {
          const trimmed = newValue.trim();
          if (!trimmed || trimmed === "null") state.seed = null;
          else { const n = Number(trimmed); state.seed = Number.isInteger(n) ? n : state.seed; }
          seedItem.currentValue = state.seed === null ? "null" : state.seed.toString();
        } else if (id === "outputDir") {
          state.outputDir = newValue.trim() || "gemini-output";
          outDirItem.currentValue = state.outputDir;
        }
        tui.requestRender();
      },
      () => done(null),
    );

    const container = new Container();
    container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
    container.addChild(new Text(theme.fg("accent", theme.bold("Generate image with Gemini"))));
    container.addChild(new Text(theme.fg("dim", "↑↓ navigate • enter activate • esc cancel")));
    container.addChild(settingsList);
    container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

    return {
      render(width: number) { return container.render(width); },
      invalidate() { container.invalidate(); },
      handleInput(data: string) { settingsList.handleInput(data); tui.requestRender(); },
    };
  });
}
