// Locates the YAML frontmatter block in a document, for folding it as raw text
// when Obsidian shows properties as source. Imports nothing.

/** Longest frontmatter block the scan will look through, in lines. */
export const MAX_FRONTMATTER_LINES = 2000;

/**
 * Returns the 1-based line number of the closing `---` (or `...`) delimiter, or
 * null when line 1 is not `---` or no closing delimiter is found. `lineText(n)`
 * returns the text of 1-based line n; only lines up to the closer are read.
 */
export function frontmatterEndLine(lineText: (line: number) => string, lineCount: number): number | null {
	if (lineCount < 2 || lineText(1).trimEnd() !== "---") return null;
	const last = Math.min(lineCount, MAX_FRONTMATTER_LINES);
	for (let line = 2; line <= last; line++) {
		const text = lineText(line).trimEnd();
		if (text === "---" || text === "...") return line;
	}
	return null;
}
