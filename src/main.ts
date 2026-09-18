import { MarkdownView, Plugin } from "obsidian";
import { applyDecision, installHooks } from "./adapter";
import { decide } from "./core/decide";
import { compileRules, type CompiledRules } from "./core/rules";
import { normalizeSettings, type PdmSettings } from "./core/settings";
import { PdmSettingTab } from "./settings-tab";

export default class PropertiesDisplayManager extends Plugin {
	settings!: PdmSettings;
	compiled!: CompiledRules;

	async onload(): Promise<void> {
		this.settings = normalizeSettings(await this.loadData());
		this.compiled = compileRules(this.settings.rules);

		this.addSettingTab(new PdmSettingTab(this.app, this));
		this.addCommand({
			id: "apply-rules-to-open-notes",
			name: "Apply rules to open notes",
			callback: () => this.applyToOpenViews(),
		});

		// Fires right after Obsidian restores its own fold state on file load and
		// on reading/editing mode switches. The uninstaller runs on unload.
		this.register(installHooks(MarkdownView.prototype, (view) => this.applyToView(view)));

		// Notes restored with the workspace were loaded before the hook existed.
		this.app.workspace.onLayoutReady(() => this.applyToOpenViews());
	}

	async saveSettings(): Promise<void> {
		this.compiled = compileRules(this.settings.rules);
		await this.saveData(this.settings);
	}

	applyToView(view: unknown): void {
		if (!(view instanceof MarkdownView) || !view.file) return;
		const frontmatter = this.app.metadataCache.getFileCache(view.file)?.frontmatter;
		applyDecision(view, decide(view.file.path, frontmatter, this.settings, this.compiled));
	}

	applyToOpenViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			this.applyToView(leaf.view);
		}
	}
}
