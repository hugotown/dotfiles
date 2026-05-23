// flag-autocomplete — Autocomplete provider for --flag tokens in the TUI editor
//
// Listens for "flag:registered" events from other extensions and provides
// Tab-completion for any --xxx prefix typed in the input editor.
// Zero coupling: does NOT import from any other extension.
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const FLAG_PREFIX_REGEX = /(^|\s)(--[\w-]*)$/;

interface FlagDescriptor {
  token: string;
  description: string;
}

export default function (pi: ExtensionAPI) {
  const flags = new Map<string, string>(); // token → description

  // Collect flags announced by other extensions
  pi.events.on("flag:registered", (descriptor: FlagDescriptor) => {
    flags.set(descriptor.token, descriptor.description);
  });

  // Wire autocomplete on session start
  pi.on("session_start", (_event, ctx: ExtensionContext) => {
    if (!ctx.hasUI) return;

    ctx.ui.addAutocompleteProvider((current) => ({
      async getSuggestions(lines, cursorLine, cursorCol, options) {
        const text = lines[cursorLine] ?? "";
        const upToCursor = text.slice(0, cursorCol);
        const partial = FLAG_PREFIX_REGEX.exec(upToCursor);
        if (!partial) return current.getSuggestions(lines, cursorLine, cursorCol, options);

        const needle = partial[2].slice(2).toLowerCase();
        const items = [...flags.entries()]
          .map(([token, description]) => {
            const haystack = token.slice(2).toLowerCase();
            let score = -1;
            if (haystack === needle) score = 0;
            else if (haystack.startsWith(needle)) score = 1;
            else if (haystack.endsWith(needle)) score = 2;
            else if (haystack.includes(needle)) score = 3;
            return { token, description, score };
          })
          .filter((e) => e.score >= 0)
          .sort((a, b) => a.score - b.score || a.token.localeCompare(b.token))
          .map(({ token, description }) => ({ value: token, label: token, description }));

        if (items.length === 0) return current.getSuggestions(lines, cursorLine, cursorCol, options);
        return { items, prefix: partial[2] };
      },

      applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
        if (!item.value.startsWith("--")) {
          return current.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
        }
        const next = [...lines];
        const line = next[cursorLine] ?? "";
        const before = line.slice(0, cursorCol - prefix.length);
        const after = line.slice(cursorCol);
        next[cursorLine] = before + item.value + after;
        return { lines: next, cursorLine, cursorCol: (before + item.value).length };
      },

      shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
        const text = lines[cursorLine] ?? "";
        if (FLAG_PREFIX_REGEX.test(text.slice(0, cursorCol))) return true;
        return current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ?? false;
      },
    }));
  });
}
