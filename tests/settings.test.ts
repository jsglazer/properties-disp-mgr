import { describe, expect, it } from "vitest";
import { createRule, DEFAULT_SETTINGS, MAX_RULES, nextRuleId, normalizeSettings } from "../src/core/settings";

describe("normalizeSettings", () => {
	it.each([undefined, null, 42, "x", [], true])("non-object data (%s) → defaults", (raw) => {
		expect(normalizeSettings(raw)).toEqual(DEFAULT_SETTINGS);
	});
	it("ill-typed fields fall back to defaults", () => {
		const s = normalizeSettings({ frontmatterEnabled: "yes", frontmatterKey: 7, rules: "nope" });
		expect(s).toEqual(DEFAULT_SETTINGS);
	});
	it("blank key falls back to the default key; key is trimmed and capped", () => {
		expect(normalizeSettings({ frontmatterKey: "   " }).frontmatterKey).toBe("propdispmgr");
		expect(normalizeSettings({ frontmatterKey: " fold " }).frontmatterKey).toBe("fold");
		expect(normalizeSettings({ frontmatterKey: "k".repeat(300) }).frontmatterKey).toHaveLength(100);
	});
	it("drops malformed rules and fills rule defaults", () => {
		const s = normalizeSettings({
			rules: [null, { type: "glob", value: "x" }, { type: "folder" }, { id: "r9", type: "regex", value: "^a", enabled: false }],
		});
		expect(s.rules).toEqual([
			{ id: "r1", type: "folder", value: "", recursive: true, enabled: true },
			{ id: "r9", type: "regex", value: "^a", recursive: true, enabled: false },
		]);
	});
	it("reassigns duplicate ids so every id is unique", () => {
		const s = normalizeSettings({ rules: [{ id: "r1", type: "folder" }, { id: "r1", type: "folder" }, { type: "regex" }] });
		expect(new Set(s.rules.map((r) => r.id)).size).toBe(3);
	});
	it("caps rule count and value length", () => {
		const rules = Array.from({ length: MAX_RULES + 10 }, (_, i) => ({ id: `r${i + 1}`, type: "folder", value: "v".repeat(900) }));
		const s = normalizeSettings({ rules });
		expect(s.rules).toHaveLength(MAX_RULES);
		expect(s.rules[0].value).toHaveLength(500);
	});
	it("round-trips valid settings unchanged", () => {
		const valid = { frontmatterEnabled: false, frontmatterKey: "k", rules: [{ id: "r2", type: "folder", value: "A", recursive: false, enabled: true }] };
		expect(normalizeSettings(JSON.parse(JSON.stringify(valid)))).toEqual(valid);
	});
});

describe("rule ids", () => {
	it("nextRuleId picks max+1", () => {
		expect(nextRuleId([])).toBe("r1");
		expect(nextRuleId([createRule([], "folder"), { ...createRule([], "regex"), id: "r7" }])).toBe("r8");
	});
	it("createRule defaults to enabled and recursive with an empty value", () => {
		expect(createRule([], "regex")).toEqual({ id: "r1", type: "regex", value: "", recursive: true, enabled: true });
	});
});
