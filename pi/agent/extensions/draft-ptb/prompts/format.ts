import type { Approach } from "../state.ts";

/**
 * Format approaches as a widget displayed above the editor while the user picks one.
 *
 * Layout:
 *   ┌─ ⭐ A — Approach Name (RECOMMENDED) ──┐
 *   │ Description...                        │
 *   │ Tradeoffs: ...                        │
 *   └───────────────────────────────────────┘
 */
export function formatApproachesWidget(
  approaches: Approach[],
  recommendation: string,
): string[] {
  const width = 78;
  const lines: string[] = [];

  lines.push("APPROACHES PROPUESTOS — usa ↑↓ + Enter en el selector de abajo");
  lines.push("");

  approaches.forEach((approach, idx) => {
    const letter = String.fromCharCode(65 + idx); // A, B, C
    const isRecommended = recommendation === approach.name;
    const marker = isRecommended ? "⭐" : "  ";
    const suffix = isRecommended ? " (RECOMMENDED)" : "";
    const title = `${marker} ${letter} — ${approach.name}${suffix}`;

    lines.push(border("┌", "─", "┐", title, width));
    lines.push(...wrapBody(approach.description, "Descripción:", width));
    lines.push(borderBlank(width));
    lines.push(...wrapBody(approach.tradeoffs, "Tradeoffs:", width));
    lines.push(border("└", "─", "┘", "", width));

    if (idx < approaches.length - 1) lines.push("");
  });

  return lines;
}

function border(left: string, fill: string, right: string, label: string, width: number): string {
  const inner = width - 2;
  if (!label) return left + fill.repeat(inner) + right;
  const labelText = ` ${label} `;
  const remaining = inner - labelText.length;
  if (remaining <= 0) return left + labelText.slice(0, inner) + right;
  return left + fill + labelText + fill.repeat(remaining - 1) + right;
}

function borderBlank(width: number): string {
  return "│" + " ".repeat(width - 2) + "│";
}

function wrapBody(text: string, label: string, width: number): string[] {
  const inner = width - 4; // 2 borders + 2 padding
  const labelLine = `│ ${label.padEnd(width - 4)} │`;
  const wrapped = wrapText(text, inner);
  return [labelLine, ...wrapped.map((line) => `│ ${line.padEnd(inner)} │`)];
}

function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word.length > maxWidth ? word.slice(0, maxWidth) : word;
      continue;
    }
    if (current.length + 1 + word.length <= maxWidth) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word.length > maxWidth ? word.slice(0, maxWidth) : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}
