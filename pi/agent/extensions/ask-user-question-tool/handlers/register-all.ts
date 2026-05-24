// handlers/register-all.ts — registers all built-in question types into the registry
import { registerType } from "../registry.ts";
import { textType } from "./text.ts";
import { selectType } from "./select.ts";
import { multiselectType } from "./multiselect.ts";
import { wireframeSelectType } from "./wireframe-select.ts";
import { colorPaletteType } from "./color-palette.ts";

export function registerAllHandlers(): void {
	registerType(textType);
	registerType(selectType);
	registerType(multiselectType);
	registerType(wireframeSelectType);
	registerType(colorPaletteType);
}
