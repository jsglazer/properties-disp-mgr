import { describe, expect, it } from "vitest";
import { compileRegex, compileRules, folderTest, matchesAny, normalizeFolder, parentFolder } from "../src/core/rules";
import type { Rule } from "../src/core/settings";

const rule = (over: Partial<Rule>): Rule => ({ id: "r1", type: "folder", value: "", recursive: true, enabled: true, ...over });

describe("normalizeFolder / parentFolder", () => {
	it("trims whitespace and slashes", () => {
		expect(normalizeFolder("  /Projects/Alpha/ ")).toBe("Projects/Alpha");
		expect(normalizeFolder("/")).toBe("");
		expect(normalizeFolder("")).toBe("");
	});
	it("returns the parent folder, empty at root", () => {
		expect(parentFolder("Projects/Alpha/note.md")).toBe("Projects/Alpha");
		expect(parentFolder("note.md")).toBe("");
	});
});

describe("folderTest", () => {
	it("non-recursive matches only direct children", () => {
		const test = folderTest("Projects", false);
		expect(test("Projects/a.md")).toBe(true);
		expect(test("Projects/Alpha/a.md")).toBe(false);
		expect(test("Other/a.md")).toBe(false);
	});
	it("recursive matches descendants but not name-prefix siblings", () => {
		const test = folderTest("Projects", true);
		expect(test("Projects/a.md")).toBe(true);
		expect(test("Projects/Alpha/Beta/a.md")).toBe(true);
		expect(test("ProjectsArchive/a.md")).toBe(false);
		expect(test("a.md")).toBe(false);
	});
	it("vault root: non-recursive = root notes only, recursive = everything", () => {
		expect(folderTest("/", false)("a.md")).toBe(true);
		expect(folderTest("/", false)("X/a.md")).toBe(false);
		expect(folderTest("", true)("X/Y/a.md")).toBe(true);
	});
	it("normalizes slashes in the configured value", () => {
		expect(folderTest("/Projects/", false)("Projects/a.md")).toBe(true);
	});
	it("is case-sensitive", () => {
		expect(folderTest("projects", true)("Projects/a.md")).toBe(false);
	});
});

describe("compileRegex", () => {
	it("returns a RegExp for valid input", () => {
		expect(compileRegex("^Daily/")).toBeInstanceOf(RegExp);
	});
	it("returns an error string for invalid, empty, or oversized input and never throws", () => {
		expect(typeof compileRegex("(")).toBe("string");
		expect(typeof compileRegex("  ")).toBe("string");
		expect(typeof compileRegex("a".repeat(501))).toBe("string");
	});
});

describe("compileRules / matchesAny", () => {
	it("empty rule list matches nothing", () => {
		expect(matchesAny(compileRules([]), "a.md")).toBe(false);
	});
	it("regex rules test the full path", () => {
		const compiled = compileRules([rule({ type: "regex", value: "^Daily/\\d{4}" })]);
		expect(matchesAny(compiled, "Daily/2026-09-18.md")).toBe(true);
		expect(matchesAny(compiled, "Notes/Daily/2026.md")).toBe(false);
	});
	it("an invalid regex is skipped and reported, other rules still apply", () => {
		const compiled = compileRules([rule({ id: "bad", type: "regex", value: "(" }), rule({ id: "ok", value: "Projects" })]);
		expect(compiled.errors.has("bad")).toBe(true);
		expect(compiled.tests).toHaveLength(1);
		expect(matchesAny(compiled, "Projects/a.md")).toBe(true);
	});
	it("disabled rules are ignored (but invalid disabled regex is still reported)", () => {
		const compiled = compileRules([
			rule({ value: "Projects", enabled: false }),
			rule({ id: "r2", type: "regex", value: "[", enabled: false }),
		]);
		expect(matchesAny(compiled, "Projects/a.md")).toBe(false);
		expect(compiled.errors.has("r2")).toBe(true);
	});
	it("combines rules with OR", () => {
		const compiled = compileRules([rule({ value: "A", recursive: false }), rule({ id: "r2", type: "regex", value: "\\.canvas\\.md$" })]);
		expect(matchesAny(compiled, "A/x.md")).toBe(true);
		expect(matchesAny(compiled, "B/x.canvas.md")).toBe(true);
		expect(matchesAny(compiled, "B/x.md")).toBe(false);
	});
});
