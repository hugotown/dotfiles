// ui/wireframe.ts — {{color}} / {{bold}} tag → theme renderer for ASCII wireframes
export interface ThemeLike {
	fg: (color: string, text: string) => string;
	bold: (text: string) => string;
}
const COLOR_TAGS = ["accent", "success", "warning", "error", "muted", "dim"] as const;

export function renderWireframe(lines: string[], theme: ThemeLike): string[] {
	return lines.map((line) => renderWireframeLine(line, theme));
}
function renderWireframeLine(line: string, theme: ThemeLike): string {
	let result = line.replace(/\{\{bold\}\}(.*?)\{\{\/bold\}\}/g, (_m, t) => theme.bold(t));
	for (const color of COLOR_TAGS) {
		const regex = new RegExp(`\\{\\{${color}\\}\\}(.*?)\\{\\{\\/${color}\\}\\}`, "g");
		result = result.replace(regex, (_m, t) => theme.fg(color, t));
	}
	return result;
}
