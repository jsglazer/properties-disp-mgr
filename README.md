# Properties Display Manager

[![GitHub release](https://img.shields.io/github/v/release/jsglazer/properties-disp-mgr?logo=github)](https://github.com/jsglazer/properties-disp-mgr/releases) [![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/jsglazer/properties-disp-mgr/blob/main/LICENSE) [![Made with Claude](https://img.shields.io/badge/Made_with-Claude-D97756?logo=anthropic)](https://claude.ai) [![Gemini Flash Antigravity](https://img.shields.io/badge/Gemini%20Flash-Antigravity-4f86f7?logo=google-gemini&logoColor=white)](https://github.com/google-gemini) [![CI](https://github.com/jsglazer/properties-disp-mgr/actions/workflows/ci.yml/badge.svg)](https://github.com/jsglazer/properties-disp-mgr/actions/workflows/ci.yml) [![CodeQL](https://github.com/jsglazer/properties-disp-mgr/actions/workflows/codeql.yml/badge.svg)](https://github.com/jsglazer/properties-disp-mgr/actions/workflows/codeql.yml) [![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/jsglazer/properties-disp-mgr/badge)](https://securityscorecards.dev/viewer/?uri=github.com/jsglazer/properties-disp-mgr)

Collapse the Obsidian properties (frontmatter) panel automatically when a note opens — but only where you want it, chosen by folder, by regex, or per note with a frontmatter key.

Based on the feature set of [Fold Properties By Default](https://github.com/tbergeron/obsidian-fold-properties-by-default) by Tommy Bergeron, rebuilt to be scoped, event-driven, and timer-free.

## What it does

- **Collapses properties on open** for notes that match your rules, in every open pane — not only the active one.
- **Works with every Properties in document setting.** With *Visible*, the properties panel is collapsed. With *Source* (or in source mode), where the frontmatter is raw YAML, the YAML block is folded in the editor instead — the same fallback Obsidian's own **Toggle fold properties** command uses. With *Hidden* there is nothing to fold.
- **Folder rules** — pick a folder by name (with suggestions from your vault). Turn on **Subfolders** to include everything beneath it. `/` means the vault root.
- **Regex rules** — a JavaScript regular expression tested against the note's full vault path, e.g. `^Daily/` or `\.excalidraw\.md$`. Invalid patterns are flagged inline in settings and skipped; they never break anything else.
- **Per-note frontmatter override** — add `propdispmgr: collapse` to force a note collapsed, or `propdispmgr: expand` to force it open. The override beats every folder and regex rule. The key name is configurable.
- **Leaves everything else alone.** With no rules the plugin collapses nothing, and notes that match no rule keep whatever state Obsidian gives them.
- **Re-applies after a reading/editing mode switch**, because Obsidian restores its saved fold state on every switch. Splitting a pane, resizing, or toggling a sidebar does not re-collapse a panel you opened yourself.

### Frontmatter values

| Result | Accepted values (case-insensitive) |
| --- | --- |
| Collapse | `collapse`, `collapsed`, `fold`, `folded`, `true`, `yes`, `on` |
| Expand | `expand`, `expanded`, `unfold`, `unfolded`, `false`, `no`, `off` |

Any other value is ignored and the folder/regex rules decide.

## Settings

| Setting | Default | Notes |
| --- | --- | --- |
| Use frontmatter override | On | Turn off to ignore the frontmatter key entirely. |
| Frontmatter key | `propdispmgr` | Any property name. Matched exactly first, then case-insensitively. |
| Folder rules | none | Add folder or regex rules. Each rule has an **On** toggle; folder rules also have **Subfolders**. |

## Commands

- **Apply rules to open notes** — re-evaluates every open note right now, for example after you edit rules or change a note's frontmatter.

## How it works

Obsidian restores each note's saved fold state after it has read the file, which happens asynchronously after the `file-open` event. The original plugin worked around that race by waiting 300 ms and polling the DOM up to 17 more times, then toggling the fold with a command on the active pane only.

This plugin instead runs immediately after Obsidian's own restore step (`MarkdownView.setViewData`) and after a mode switch (`setMode`), and sets the panel state directly with no animation. There are no timers, no DOM queries, and no commands executed, and your notes are never edited. The panel collapse is applied without animation, so it is not saved into Obsidian's fold history. The source-mode YAML fold is an ordinary editor fold, which Obsidian remembers the way it remembers any fold you make by hand.

The internal Obsidian objects it touches (`metadataEditor`, `setCollapse`, `canShowProperties`, `setMode`, `editMode.cm`) live in a single adapter file, are feature-detected, and fall back to doing nothing if a future Obsidian version changes them. Verified against Obsidian 1.13.7.

Reading view with properties shown as source has no fold control in Obsidian, so it is left alone.

## Installation

Not yet in the community plugin store. Install manually:

1. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/jsglazer/properties-disp-mgr/releases).
2. Copy them into `<vault>/.obsidian/plugins/properties-disp-mgr/`.
3. Reload Obsidian and enable **Properties Display Manager** under Settings → Community plugins.

Works on desktop and mobile.

## Development

```bash
npm install
npm test        # vitest, headless
npm run lint
npm run build   # typecheck + bundle to main.js
```

Rule evaluation lives in `src/core/` and imports nothing from Obsidian, so the whole test suite runs in Node.

## License

[MIT](LICENSE). Includes the MIT notice of the original Fold Properties By Default.
