// Folder/regex rule compilation and matching. Imports nothing from obsidian.

import { MAX_VALUE_LENGTH, type Rule } from "./settings";

export type PathTest = (path: string) => boolean;

export interface CompiledRules {
	/** One test per enabled, valid rule, in rule order. */
	tests: PathTest[];
	/** Rule id → human-readable reason the rule was skipped (invalid regex). */
	errors: Map<string, string>;
}

/** Trims whitespace and leading/trailing slashes; "" means vault root. */
export function normalizeFolder(value: string): string {
	return value.trim().replace(/^\/+|\/+$/g, "");
}

/** Parent folder of a vault path ("" for a note at the vault root). */
export function parentFolder(path: string): string {
	const slash = path.lastIndexOf("/");
	return slash === -1 ? "" : path.slice(0, slash);
}

export function folderTest(value: string, recursive: boolean): PathTest {
	const folder = normalizeFolder(value);
	if (folder === "") return recursive ? () => true : (path) => parentFolder(path) === "";
	const prefix = `${folder}/`;
	return recursive
		? (path) => {
				const parent = parentFolder(path);
				return parent === folder || parent.startsWith(prefix);
			}
		: (path) => parentFolder(path) === folder;
}

/** Compiles a user regex; returns the RegExp or an error message. Never throws. */
export function compileRegex(source: string): RegExp | string {
	if (source.trim() === "") return "Pattern is empty";
	if (source.length > MAX_VALUE_LENGTH) return `Pattern is longer than ${MAX_VALUE_LENGTH} characters`;
	try {
		return new RegExp(source, "u");
	} catch (e) {
		return e instanceof Error ? e.message : "Invalid regular expression";
	}
}

/**
 * Compiles the rule list once (per settings change) into path tests that the
 * hot path reuses. Disabled rules are skipped; an invalid regex skips only its
 * own rule and is reported in `errors`.
 */
export function compileRules(rules: readonly Rule[]): CompiledRules {
	const tests: PathTest[] = [];
	const errors = new Map<string, string>();
	for (const rule of rules) {
		if (rule.type === "regex") {
			const compiled = compileRegex(rule.value);
			if (typeof compiled === "string") {
				errors.set(rule.id, compiled);
				continue;
			}
			if (rule.enabled) tests.push((path) => compiled.test(path));
		} else if (rule.enabled) {
			tests.push(folderTest(rule.value, rule.recursive));
		}
	}
	return { tests, errors };
}

export function matchesAny(compiled: CompiledRules, path: string): boolean {
	return compiled.tests.some((test) => test(path));
}
