// The single decision function: note path + frontmatter + settings → what to
// do with the properties panel. Imports nothing from obsidian.

import { matchesAny, type CompiledRules } from "./rules";
import type { PdmSettings } from "./settings";

export type Decision = "collapse" | "expand" | "none";
export type Override = "collapse" | "expand";

const COLLAPSE_WORDS = new Set(["collapse", "collapsed", "fold", "folded", "true", "yes", "on"]);
const EXPAND_WORDS = new Set(["expand", "expanded", "unfold", "unfolded", "false", "no", "off"]);

/** Maps a frontmatter value to an override; unrecognized values give null. */
export function parseOverride(value: unknown): Override | null {
	if (value === true) return "collapse";
	if (value === false) return "expand";
	if (typeof value !== "string") return null;
	const word = value.trim().toLowerCase();
	if (COLLAPSE_WORDS.has(word)) return "collapse";
	if (EXPAND_WORDS.has(word)) return "expand";
	return null;
}

/** Reads the override key: exact key first, then a case-insensitive match. */
export function readOverride(frontmatter: Record<string, unknown> | null | undefined, key: string): Override | null {
	if (!frontmatter) return null;
	if (Object.prototype.hasOwnProperty.call(frontmatter, key)) return parseOverride(frontmatter[key]);
	const lower = key.toLowerCase();
	for (const candidate of Object.keys(frontmatter)) {
		if (candidate.toLowerCase() === lower) return parseOverride(frontmatter[candidate]);
	}
	return null;
}

/**
 * Frontmatter override (when enabled) wins; otherwise a note is collapsed if
 * any enabled rule matches its path, and left alone ("none") if none does.
 */
export function decide(
	path: string,
	frontmatter: Record<string, unknown> | null | undefined,
	settings: PdmSettings,
	compiled: CompiledRules,
): Decision {
	if (settings.frontmatterEnabled) {
		const override = readOverride(frontmatter, settings.frontmatterKey);
		if (override) return override;
	}
	return matchesAny(compiled, path) ? "collapse" : "none";
}
