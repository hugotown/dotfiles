// Keymap for the Gemini flag panel: the TAB-style trigger that opens it, plus the
// in-panel navigation keys. Pure (no I/O) so it is trivial to test; config.yml loading
// lives in settings.ts. Key ids follow pi's format (up, down, enter, escape, tab, …).

export interface KeymapConfig {
  /** Key that opens the panel when the editor text ends with a `--gemini-*` flag. */
  trigger: { key: string };
  nav: {
    up: string[];
    down: string[];
    /** Cycle an enum/bool field to the previous value. */
    prev: string[];
    /** Cycle an enum/bool field to the next value. */
    next: string[];
    /** Edit a text/number field, or activate the focused button. */
    edit: string[];
    /** Close the panel without running. */
    cancel: string[];
  };
}

export const DEFAULT_KEYMAP: KeymapConfig = {
  trigger: { key: "tab" },
  nav: {
    up: ["up", "k", "shift+tab"],
    down: ["down", "j", "tab"],
    prev: ["left", "h"],
    next: ["right", "l", "space"],
    edit: ["enter", "return"],
    cancel: ["escape", "esc"],
  },
};

export function mergeKeymap(raw: Partial<KeymapConfig> | undefined): KeymapConfig {
  return {
    trigger: { ...DEFAULT_KEYMAP.trigger, ...raw?.trigger },
    nav: { ...DEFAULT_KEYMAP.nav, ...raw?.nav },
  };
}
