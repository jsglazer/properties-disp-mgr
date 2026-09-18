// Machine-checks the reviewer read-criteria against the source text.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..", "src");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const all = ["main.ts", "settings-tab.ts", "adapter.ts", ...readdirSync(join(root, "core")).map((f) => `core/${f}`)];

describe("reviewer criteria", () => {
	it("src/core imports nothing from obsidian (or anything outside core)", () => {
		for (const f of all.filter((f) => f.startsWith("core/"))) {
			const imports = [...read(f).matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
			for (const spec of imports) expect(spec.startsWith("./"), `${f} imports ${spec}`).toBe(true);
		}
	});
	it("adapter does not import obsidian", () => {
		expect(read("adapter.ts")).not.toMatch(/from\s+["']obsidian["']/);
	});
	it("no timers, observers, DOM queries, or command execution anywhere", () => {
		for (const f of all) {
			const src = read(f);
			for (const banned of ["setTimeout", "setInterval", "MutationObserver", "querySelector", "executeCommandById", "console.log"]) {
				expect(src.includes(banned), `${f} uses ${banned}`).toBe(false);
			}
		}
	});
	it("undocumented internals are referenced only in the adapter", () => {
		for (const f of all.filter((f) => f !== "adapter.ts")) {
			expect(read(f), f).not.toMatch(/metadataEditor|setCollapse|canShowProperties|setMode|editMode/);
		}
	});
	it("the prototype hook is registered for unload", () => {
		expect(read("main.ts")).toMatch(/this\.register\(installHooks\(/);
	});
});
