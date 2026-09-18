import { defineConfig } from "vitest/config";

// Tests import only from src/core/ and src/adapter.ts, neither of which imports
// `obsidian`, so the whole suite runs headless with no stubbing.
export default defineConfig({
	test: {
		include: ["tests/**/*.test.ts"],
		environment: "node",
	},
});
