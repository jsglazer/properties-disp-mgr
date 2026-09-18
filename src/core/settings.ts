// Settings model and the normalizer that turns untrusted data.json content
// into a well-typed settings object. Imports nothing.

export type RuleType = "folder" | "regex";

export interface Rule {
	id: string;
	type: RuleType;
	value: string;
	/** Folder rules only: also match notes in subfolders. Ignored for regex rules. */
	recursive: boolean;
	enabled: boolean;
}

export interface PdmSettings {
	frontmatterEnabled: boolean;
	frontmatterKey: string;
	rules: Rule[];
}

export const DEFAULT_FRONTMATTER_KEY = "propdispmgr";
export const MAX_RULES = 200;
export const MAX_VALUE_LENGTH = 500;
export const MAX_KEY_LENGTH = 100;

export const DEFAULT_SETTINGS: PdmSettings = {
	frontmatterEnabled: true,
	frontmatterKey: DEFAULT_FRONTMATTER_KEY,
	rules: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Returns an id not used by any rule in `rules` ("r1", "r2", ...). */
export function nextRuleId(rules: readonly Rule[]): string {
	let max = 0;
	for (const rule of rules) {
		const match = /^r(\d+)$/.exec(rule.id);
		if (match) max = Math.max(max, Number(match[1]));
	}
	return `r${max + 1}`;
}

export function createRule(rules: readonly Rule[], type: RuleType): Rule {
	return { id: nextRuleId(rules), type, value: "", recursive: true, enabled: true };
}

function normalizeRule(raw: unknown): Rule | null {
	if (!isRecord(raw)) return null;
	if (raw.type !== "folder" && raw.type !== "regex") return null;
	return {
		id: typeof raw.id === "string" ? raw.id.slice(0, 50) : "",
		type: raw.type,
		value: typeof raw.value === "string" ? raw.value.slice(0, MAX_VALUE_LENGTH) : "",
		recursive: typeof raw.recursive === "boolean" ? raw.recursive : true,
		enabled: typeof raw.enabled === "boolean" ? raw.enabled : true,
	};
}

/**
 * Builds settings from whatever `loadData()` returned. Every field is checked
 * individually; anything missing or ill-typed falls back to its default, and
 * rules with a bad shape are dropped. Missing or duplicate rule ids are reassigned.
 */
export function normalizeSettings(raw: unknown): PdmSettings {
	const data = isRecord(raw) ? raw : {};
	const key = typeof data.frontmatterKey === "string" ? data.frontmatterKey.trim().slice(0, MAX_KEY_LENGTH) : "";

	const rules: Rule[] = [];
	const seen = new Set<string>();
	const rawRules = Array.isArray(data.rules) ? data.rules.slice(0, MAX_RULES) : [];
	for (const rawRule of rawRules) {
		const rule = normalizeRule(rawRule);
		if (!rule) continue;
		if (!rule.id || seen.has(rule.id)) rule.id = nextRuleId(rules);
		seen.add(rule.id);
		rules.push(rule);
	}

	return {
		frontmatterEnabled:
			typeof data.frontmatterEnabled === "boolean" ? data.frontmatterEnabled : DEFAULT_SETTINGS.frontmatterEnabled,
		frontmatterKey: key || DEFAULT_FRONTMATTER_KEY,
		rules,
	};
}
