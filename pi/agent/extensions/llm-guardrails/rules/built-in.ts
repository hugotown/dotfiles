import type { Rule } from "../lib/types.ts";

const MESSAGE = "This shortcut hides the real problem. Resolve it at the root.";

export const BUILT_IN_RULES: readonly Rule[] = Object.freeze([
  {
    id: "no-linter-suppressions",
    name: "No linter suppressions",
    description: "Linter suppressions hide problems instead of fixing them.",
    filePatterns: ["**/*.{js,ts,jsx,tsx,vue,svelte,rb,php,css,scss}"],
    patterns: [
      /\/\/\s*eslint\s*-?\s*(disable|enable)\s*-?\s*next\s*-?\s*line\b[^\n]*/gi,
      /\/\/\s*eslint\s*-?\s*(disable|enable)\s*-?\s*line\b[^\n]*/gi,
      /\/\/\s*eslint\s*-?\s*(disable|enable)\b[^\n]*/gi,
      /\/\*\s*eslint\s*-?\s*(disable|enable)\b[\s\S]*?\*\//gi,
      /\/\*\s*stylelint\s*-?\s*disable\b[\s\S]*?\*\//gi,
      /#\s*rubocop:disable\b[^\n]*/gi,
      /^[^\S\n]*@phpstan-ignore-line\b[^\n]*/gim,
      /(?:\/\/|#)[^\S\n]*@phpstan-ignore-line\b[^\n]*/gi,
      /^[^\S\n]*\*[^\S\n]*@phpstan-ignore-line\b[^\n]*/gim,
      /^[^\S\n]*@psalm-suppress\b[^\n]*/gim,
      /(?:\/\/|#)[^\S\n]*@psalm-suppress\b[^\n]*/gi,
      /^[^\S\n]*\*[^\S\n]*@psalm-suppress\b[^\n]*/gim,
    ],
    message: MESSAGE,
    severity: "warning",
  },
  {
    id: "no-type-suppressions",
    name: "No type suppressions",
    description: "Type suppressions hide type errors instead of fixing them.",
    filePatterns: ["**/*.{ts,tsx,js,jsx,py}"],
    patterns: [
      /\/\/\s*@ts-(ignore|nocheck|expect-error)\b[^\n]*/gi,
      /#\s*type:\s*ignore\b[^\n]*/gi,
    ],
    message: MESSAGE,
    severity: "warning",
  },
  {
    id: "no-runtime-suppressions",
    name: "No runtime suppressions",
    description: "Runtime suppressions hide runtime problems instead of fixing them.",
    filePatterns: ["**/*.{ts,tsx,js,jsx,go,py}"],
    patterns: [
      /\/\/\s*@bun-ignore\b[^\n]*/gi,
      /\/\/\s*nolint(?::all)?\b[^\n]*/gi,
      /#\s*noqa\b[^\n]*/gi,
    ],
    message: MESSAGE,
    severity: "warning",
  },
  {
    id: "no-compiler-suppressions",
    name: "No compiler suppressions",
    description: "Compiler suppressions hide compiler diagnostics instead of fixing them.",
    filePatterns: ["**/*.{java,cs,c,cpp,h,hpp}"],
    patterns: [
      /@SuppressWarnings\b[^\n]*/gi,
      /#pragma\s+warning\s+disable\b[^\n]*/gi,
      /#pragma\s+GCC\s+diagnostic\b[^\n]*/gi,
    ],
    message: MESSAGE,
    severity: "warning",
  },
]);
