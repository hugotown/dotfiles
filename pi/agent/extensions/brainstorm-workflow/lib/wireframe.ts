// lib/wireframe.ts — {{color}} tag → theme.fg() renderer

interface ThemeLike {
  fg: (color: string, text: string) => string;
  bold: (text: string) => string;
}

const COLOR_TAGS = ["accent", "success", "warning", "error", "muted", "dim"] as const;

export function renderWireframe(lines: string[], theme: ThemeLike): string[] {
  return lines.map((line) => renderWireframeLine(line, theme));
}

function renderWireframeLine(line: string, theme: ThemeLike): string {
  let result = line;

  // Handle bold tag
  result = result.replace(/\{\{bold\}\}(.*?)\{\{\/bold\}\}/g, (_match, text) => {
    return theme.bold(text);
  });

  // Handle color tags
  for (const color of COLOR_TAGS) {
    const regex = new RegExp(`\\{\\{${color}\\}\\}(.*?)\\{\\{\\/${color}\\}\\}`, "g");
    result = result.replace(regex, (_match, text) => {
      return theme.fg(color, text);
    });
  }

  return result;
}
