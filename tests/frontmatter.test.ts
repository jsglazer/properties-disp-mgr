import { describe, expect, it } from "vitest";
import { frontmatterEndLine, MAX_FRONTMATTER_LINES } from "../src/core/frontmatter";

const scan = (text: string) => {
	const lines = text.split("\n");
	return frontmatterEndLine((n) => lines[n - 1], lines.length);
};

describe("frontmatterEndLine", () => {
	it("finds the closing delimiter", () => {
		expect(scan("---\na: 1\nb: 2\n---\nbody")).toBe(4);
		expect(scan("---\na: 1\n...\nbody")).toBe(3);
		expect(scan("---\n---\nbody")).toBe(2);
	});
	it("tolerates trailing whitespace on delimiters", () => {
		expect(scan("---  \na: 1\n---\t\n")).toBe(3);
	});
	it("returns null without frontmatter", () => {
		expect(scan("body\n---\n")).toBeNull();
		expect(scan("---")).toBeNull();
		expect(scan("---\na: 1\nno closer")).toBeNull();
		expect(scan(" ---\na\n---")).toBeNull();
	});
	it("stops scanning at the line cap", () => {
		const lines = ["---", ...Array.from({ length: MAX_FRONTMATTER_LINES + 5 }, () => "a: 1"), "---"];
		let reads = 0;
		const result = frontmatterEndLine((n) => {
			reads++;
			return lines[n - 1];
		}, lines.length);
		expect(result).toBeNull();
		expect(reads).toBeLessThanOrEqual(MAX_FRONTMATTER_LINES);
	});
});
