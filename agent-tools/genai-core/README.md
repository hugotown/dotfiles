# genai-core

Shared Gemini logic for every agent facade in `~/.config/`.

Consumers add this package via the `file:` protocol:

    "genai-core": "file:<relative path to this folder>"

Pure logic only — no agent SDK, no TUI, no OS-side effects beyond writing
artifacts to `<cwd>/gemini-output/<category>/`. Each function takes the
project root (`cwd`) as its last parameter; the core anchors the output
folder there.

See `~/.config/docs/superpowers/specs/2026-05-28-gemini-shared-core-design.md`
for the architecture.