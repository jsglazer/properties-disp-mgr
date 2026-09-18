import { describe, expect, it } from "vitest";
import { decide, parseOverride, readOverride } from "../src/core/decide";
import { compileRules } from "../src/core/rules";
import { DEFAULT_SETTINGS, type PdmSettings } from "../src/core/settings";

const settings = (over: Partial<PdmSettings> = {}): PdmSettings => ({ ...DEFAULT_SETTINGS, ...over });
const projectsRule = { id: "r1", type: "folder" as const, value: "Projects", recursive: true, enabled: true };

describe("parseOverride", () => {
	it.each(["collapse", "Collapsed", " fold ", "FOLDED", "true", "yes", "on", true])("%s → collapse", (v) => {
		expect(parseOverride(v)).toBe("collapse");
	});
	it.each(["expand", "Expanded", "unfold", "unfolded", "false", "no", "off", false])("%s → expand", (v) => {
		expect(parseOverride(v)).toBe("expand");
	});
	it.each(["maybe", "", 1, null, undefined, ["collapse"], { a: 1 }])("%s → null", (v) => {
		expect(parseOverride(v)).toBeNull();
	});
});

describe("readOverride", () => {
	it("prefers the exact key, then falls back case-insensitively", () => {
		expect(readOverride({ propdispmgr: "collapse", PropDispMgr: "expand" }, "propdispmgr")).toBe("collapse");
		expect(readOverride({ PropDispMgr: "expand" }, "propdispmgr")).toBe("expand");
	});
	it("handles missing frontmatter", () => {
		expect(readOverride(undefined, "propdispmgr")).toBeNull();
		expect(readOverride(null, "propdispmgr")).toBeNull();
	});
	it("does not read inherited properties", () => {
		expect(readOverride({}, "toString")).toBeNull();
	});
});

describe("decide", () => {
	it("no rules and no override → none (plugin does nothing)", () => {
		const s = settings();
		expect(decide("Projects/a.md", {}, s, compileRules(s.rules))).toBe("none");
	});
	it("matching rule → collapse; non-matching → none", () => {
		const s = settings({ rules: [projectsRule] });
		const c = compileRules(s.rules);
		expect(decide("Projects/x/a.md", undefined, s, c)).toBe("collapse");
		expect(decide("Other/a.md", undefined, s, c)).toBe("none");
	});
	it("expand override beats a matching folder rule", () => {
		const s = settings({ rules: [projectsRule] });
		expect(decide("Projects/a.md", { propdispmgr: "expand" }, s, compileRules(s.rules))).toBe("expand");
	});
	it("collapse override works with no rules at all", () => {
		const s = settings();
		expect(decide("Other/a.md", { propdispmgr: "collapse" }, s, compileRules(s.rules))).toBe("collapse");
	});
	it("custom frontmatter key", () => {
		const s = settings({ frontmatterKey: "fold-props" });
		const c = compileRules(s.rules);
		expect(decide("a.md", { "fold-props": "yes" }, s, c)).toBe("collapse");
		expect(decide("a.md", { propdispmgr: "yes" }, s, c)).toBe("none");
	});
	it("override disabled → frontmatter ignored", () => {
		const s = settings({ frontmatterEnabled: false, rules: [projectsRule] });
		expect(decide("Projects/a.md", { propdispmgr: "expand" }, s, compileRules(s.rules))).toBe("collapse");
	});
	it("unrecognized override value falls through to rules", () => {
		const s = settings({ rules: [projectsRule] });
		expect(decide("Projects/a.md", { propdispmgr: "sometimes" }, s, compileRules(s.rules))).toBe("collapse");
	});
});
