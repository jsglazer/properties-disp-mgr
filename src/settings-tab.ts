import { AbstractInputSuggest, App, PluginSettingTab, Setting, TFolder } from "obsidian";
import { createRule, DEFAULT_FRONTMATTER_KEY, type Rule, type RuleType } from "./core/settings";
import type PropertiesDisplayManager from "./main";

const MAX_SUGGESTIONS = 50;

class FolderSuggest extends AbstractInputSuggest<string> {
	constructor(
		app: App,
		private readonly inputEl: HTMLInputElement,
		private readonly onPick: (path: string) => void,
	) {
		super(app, inputEl);
	}

	protected getSuggestions(query: string): string[] {
		const needle = query.trim().toLowerCase();
		const folders: string[] = [];
		for (const file of this.app.vault.getAllLoadedFiles()) {
			if (!(file instanceof TFolder)) continue;
			const path = file.isRoot() ? "/" : file.path;
			if (path.toLowerCase().includes(needle)) folders.push(path);
			if (folders.length >= MAX_SUGGESTIONS) break;
		}
		return folders.sort((a, b) => a.localeCompare(b));
	}

	renderSuggestion(path: string, el: HTMLElement): void {
		el.setText(path);
	}

	selectSuggestion(path: string): void {
		this.inputEl.value = path;
		this.onPick(path);
		this.close();
	}
}

export class PdmSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: PropertiesDisplayManager,
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		const settings = this.plugin.settings;

		new Setting(containerEl).setName("Frontmatter override").setHeading();

		new Setting(containerEl)
			.setName("Use frontmatter override")
			.setDesc("A note whose frontmatter key is set to collapse or expand ignores the folder rules below.")
			.addToggle((toggle) =>
				toggle.setValue(settings.frontmatterEnabled).onChange(async (value) => {
					settings.frontmatterEnabled = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Frontmatter key")
			.setDesc(`Values: collapse, expand (also true/false, yes/no). Default key: ${DEFAULT_FRONTMATTER_KEY}.`)
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_FRONTMATTER_KEY)
					.setValue(settings.frontmatterKey)
					.onChange(async (value) => {
						settings.frontmatterKey = value.trim() || DEFAULT_FRONTMATTER_KEY;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Folder rules")
			.setDesc(
				"Properties are collapsed when a note opens if it matches any enabled rule. With no rules, nothing is collapsed. Notes that match no rule are left alone.",
			)
			.setHeading();

		for (const rule of settings.rules) this.renderRule(containerEl, rule);

		new Setting(containerEl)
			.addButton((button) => button.setButtonText("Add folder rule").onClick(() => this.addRule("folder")))
			.addButton((button) => button.setButtonText("Add regex rule").onClick(() => this.addRule("regex")));
	}

	private async addRule(type: RuleType): Promise<void> {
		this.plugin.settings.rules.push(createRule(this.plugin.settings.rules, type));
		await this.plugin.saveSettings();
		this.display();
	}

	private renderRule(containerEl: HTMLElement, rule: Rule): void {
		const setting = new Setting(containerEl).setName(rule.type === "folder" ? "Folder" : "Regex");

		const showError = (): void => {
			const error = rule.type === "regex" ? this.plugin.compiled.errors.get(rule.id) : undefined;
			setting.setDesc(error ?? (rule.type === "folder" ? "Matched against the note's folder." : "Matched against the note's full path."));
			setting.descEl.toggleClass("mod-warning", error !== undefined);
		};

		setting.addText((text) => {
			text.setPlaceholder(rule.type === "folder" ? "Folder/subfolder" : "^Projects/.*\\.md$").setValue(rule.value);
			text.inputEl.addClass("pdm-rule-input");
			const save = async (value: string): Promise<void> => {
				rule.value = value;
				await this.plugin.saveSettings();
				showError();
			};
			text.onChange(save);
			if (rule.type === "folder") new FolderSuggest(this.app, text.inputEl, (path) => void save(path));
			else text.inputEl.setAttr("spellcheck", "false");
		});

		if (rule.type === "folder") {
			setting.controlEl.createSpan({ text: "Subfolders", cls: "pdm-toggle-label" });
			setting.addToggle((toggle) =>
				toggle
					.setTooltip("Include subfolders")
					.setValue(rule.recursive)
					.onChange(async (value) => {
						rule.recursive = value;
						await this.plugin.saveSettings();
					}),
			);
		}

		setting.controlEl.createSpan({ text: "On", cls: "pdm-toggle-label" });
		setting
			.addToggle((toggle) =>
				toggle
					.setTooltip("Enabled")
					.setValue(rule.enabled)
					.onChange(async (value) => {
						rule.enabled = value;
						await this.plugin.saveSettings();
					}),
			)
			.addExtraButton((button) =>
				button
					.setIcon("trash-2")
					.setTooltip("Delete rule")
					.onClick(async () => {
						this.plugin.settings.rules = this.plugin.settings.rules.filter((r) => r !== rule);
						await this.plugin.saveSettings();
						this.display();
					}),
			);

		showError();
	}
}

