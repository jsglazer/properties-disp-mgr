"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => PropertiesDisplayManager
});
module.exports = __toCommonJS(main_exports);
var import_obsidian2 = require("obsidian");

// src/adapter.ts
var import_language = require("@codemirror/language");

// node_modules/monkey-around/dist/index.mjs
function around(obj, factories) {
  const removers = Object.keys(factories).map((key) => around1(obj, key, factories[key]));
  return removers.length === 1 ? removers[0] : function() {
    removers.forEach((r) => r());
  };
}
function around1(obj, method, createWrapper) {
  const inherited = obj[method], hadOwn = obj.hasOwnProperty(method), original = hadOwn ? inherited : function() {
    return Object.getPrototypeOf(obj)[method].apply(this, arguments);
  };
  let current = createWrapper(original);
  if (inherited)
    Object.setPrototypeOf(current, inherited);
  Object.setPrototypeOf(wrapper, current);
  obj[method] = wrapper;
  return remove;
  function wrapper(...args) {
    if (current === original && obj[method] === wrapper)
      remove();
    return current.apply(this, args);
  }
  function remove() {
    if (obj[method] === wrapper) {
      if (hadOwn)
        obj[method] = original;
      else
        delete obj[method];
    }
    if (current === original)
      return;
    current = original;
    Object.setPrototypeOf(wrapper, inherited || Function);
  }
}

// src/core/frontmatter.ts
var MAX_FRONTMATTER_LINES = 2e3;
function frontmatterEndLine(lineText, lineCount) {
  if (lineCount < 2 || lineText(1).trimEnd() !== "---") return null;
  const last = Math.min(lineCount, MAX_FRONTMATTER_LINES);
  for (let line = 2; line <= last; line++) {
    const text = lineText(line).trimEnd();
    if (text === "---" || text === "...") return line;
  }
  return null;
}

// src/adapter.ts
function isObject(value) {
  return typeof value === "object" && value !== null;
}
function getMetadataEditor(view) {
  if (!isObject(view)) return null;
  const editor = view.metadataEditor;
  if (!isObject(editor)) return null;
  if (typeof editor.collapsed !== "boolean" || typeof editor.setCollapse !== "function") return null;
  return editor;
}
function canShowProperties(view) {
  if (!isObject(view)) return false;
  const fn = view.canShowProperties;
  if (typeof fn !== "function") return true;
  try {
    return fn.call(view) === true;
  } catch (e) {
    return false;
  }
}
function applyDecision(view, decision) {
  if (decision === "none") return false;
  const collapsed = decision === "collapse";
  const editor = getMetadataEditor(view);
  if (editor && canShowProperties(view)) {
    if (editor.collapsed === collapsed) return false;
    editor.setCollapse(collapsed, false);
    return true;
  }
  return applyFrontmatterFold(view, collapsed);
}
function getEditorView(view) {
  if (!isObject(view) || typeof view.getMode !== "function") return null;
  if (view.getMode.call(view) !== "source") return null;
  const editMode = view.editMode;
  if (!isObject(editMode)) return null;
  const cm = editMode.cm;
  if (!isObject(cm) || !isObject(cm.state) || typeof cm.dispatch !== "function") return null;
  return cm;
}
function frontmatterRange(state) {
  var _a;
  const doc = state.doc;
  const end = frontmatterEndLine((n) => doc.line(n).text, doc.lines);
  if (end === null) return null;
  const first = doc.line(1);
  return (_a = (0, import_language.foldable)(state, first.from, first.to)) != null ? _a : { from: first.to, to: doc.line(end).to };
}
function applyFrontmatterFold(view, collapsed) {
  const cm = getEditorView(view);
  if (!cm) return false;
  const state = cm.state;
  const range = frontmatterRange(state);
  if (!range) return false;
  let existing = null;
  (0, import_language.foldedRanges)(state).between(0, state.doc.line(1).to, (from, to) => {
    existing = { from, to };
    return false;
  });
  if (collapsed && !existing) {
    cm.dispatch({ effects: import_language.foldEffect.of(range) });
    return true;
  }
  if (!collapsed && existing) {
    cm.dispatch({ effects: import_language.unfoldEffect.of(existing) });
    return true;
  }
  return false;
}
function safely(callback, view) {
  try {
    callback(view);
  } catch (e) {
  }
}
function wrapSetViewData(next, onLoaded) {
  return function(data, clear) {
    next.call(this, data, clear);
    if (clear) safely(onLoaded, this);
  };
}
function wrapSetMode(next, onChanged) {
  return function(...args) {
    const result = next.apply(this, args);
    if (result instanceof Promise) {
      result.then(
        (changed) => {
          if (changed === true) safely(onChanged, this);
        },
        () => void 0
      );
    }
    return result;
  };
}
function installHooks(proto, onApply) {
  const target = proto;
  const factories = {};
  if (typeof target.setViewData === "function") {
    factories.setViewData = (next) => wrapSetViewData(next, onApply);
  }
  if (typeof target.setMode === "function") {
    factories.setMode = (next) => wrapSetMode(next, onApply);
  }
  return around(target, factories);
}

// src/core/settings.ts
var DEFAULT_FRONTMATTER_KEY = "propdispmgr";
var MAX_RULES = 200;
var MAX_VALUE_LENGTH = 500;
var MAX_KEY_LENGTH = 100;
var DEFAULT_SETTINGS = {
  frontmatterEnabled: true,
  frontmatterKey: DEFAULT_FRONTMATTER_KEY,
  rules: []
};
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function nextRuleId(rules) {
  let max = 0;
  for (const rule of rules) {
    const match = /^r(\d+)$/.exec(rule.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `r${max + 1}`;
}
function createRule(rules, type) {
  return { id: nextRuleId(rules), type, value: "", recursive: true, enabled: true };
}
function normalizeRule(raw) {
  if (!isRecord(raw)) return null;
  if (raw.type !== "folder" && raw.type !== "regex") return null;
  return {
    id: typeof raw.id === "string" ? raw.id.slice(0, 50) : "",
    type: raw.type,
    value: typeof raw.value === "string" ? raw.value.slice(0, MAX_VALUE_LENGTH) : "",
    recursive: typeof raw.recursive === "boolean" ? raw.recursive : true,
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : true
  };
}
function normalizeSettings(raw) {
  const data = isRecord(raw) ? raw : {};
  const key = typeof data.frontmatterKey === "string" ? data.frontmatterKey.trim().slice(0, MAX_KEY_LENGTH) : "";
  const rules = [];
  const seen = /* @__PURE__ */ new Set();
  const rawRules = Array.isArray(data.rules) ? data.rules.slice(0, MAX_RULES) : [];
  for (const rawRule of rawRules) {
    const rule = normalizeRule(rawRule);
    if (!rule) continue;
    if (!rule.id || seen.has(rule.id)) rule.id = nextRuleId(rules);
    seen.add(rule.id);
    rules.push(rule);
  }
  return {
    frontmatterEnabled: typeof data.frontmatterEnabled === "boolean" ? data.frontmatterEnabled : DEFAULT_SETTINGS.frontmatterEnabled,
    frontmatterKey: key || DEFAULT_FRONTMATTER_KEY,
    rules
  };
}

// src/core/rules.ts
function normalizeFolder(value) {
  return value.trim().replace(/^\/+|\/+$/g, "");
}
function parentFolder(path) {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? "" : path.slice(0, slash);
}
function folderTest(value, recursive) {
  const folder = normalizeFolder(value);
  if (folder === "") return recursive ? () => true : (path) => parentFolder(path) === "";
  const prefix = `${folder}/`;
  return recursive ? (path) => {
    const parent = parentFolder(path);
    return parent === folder || parent.startsWith(prefix);
  } : (path) => parentFolder(path) === folder;
}
function compileRegex(source) {
  if (source.trim() === "") return "Pattern is empty";
  if (source.length > MAX_VALUE_LENGTH) return `Pattern is longer than ${MAX_VALUE_LENGTH} characters`;
  try {
    return new RegExp(source, "u");
  } catch (e) {
    return e instanceof Error ? e.message : "Invalid regular expression";
  }
}
function compileRules(rules) {
  const tests = [];
  const errors = /* @__PURE__ */ new Map();
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
function matchesAny(compiled, path) {
  return compiled.tests.some((test) => test(path));
}

// src/core/decide.ts
var COLLAPSE_WORDS = /* @__PURE__ */ new Set(["collapse", "collapsed", "fold", "folded", "true", "yes", "on"]);
var EXPAND_WORDS = /* @__PURE__ */ new Set(["expand", "expanded", "unfold", "unfolded", "false", "no", "off"]);
function parseOverride(value) {
  if (value === true) return "collapse";
  if (value === false) return "expand";
  if (typeof value !== "string") return null;
  const word = value.trim().toLowerCase();
  if (COLLAPSE_WORDS.has(word)) return "collapse";
  if (EXPAND_WORDS.has(word)) return "expand";
  return null;
}
function readOverride(frontmatter, key) {
  if (!frontmatter) return null;
  if (Object.prototype.hasOwnProperty.call(frontmatter, key)) return parseOverride(frontmatter[key]);
  const lower = key.toLowerCase();
  for (const candidate of Object.keys(frontmatter)) {
    if (candidate.toLowerCase() === lower) return parseOverride(frontmatter[candidate]);
  }
  return null;
}
function decide(path, frontmatter, settings, compiled) {
  if (settings.frontmatterEnabled) {
    const override = readOverride(frontmatter, settings.frontmatterKey);
    if (override) return override;
  }
  return matchesAny(compiled, path) ? "collapse" : "none";
}

// src/settings-tab.ts
var import_obsidian = require("obsidian");
var MAX_SUGGESTIONS = 50;
var FolderSuggest = class extends import_obsidian.AbstractInputSuggest {
  constructor(app, inputEl, onPick) {
    super(app, inputEl);
    this.inputEl = inputEl;
    this.onPick = onPick;
  }
  getSuggestions(query) {
    const needle = query.trim().toLowerCase();
    const folders = [];
    for (const file of this.app.vault.getAllLoadedFiles()) {
      if (!(file instanceof import_obsidian.TFolder)) continue;
      const path = file.isRoot() ? "/" : file.path;
      if (path.toLowerCase().includes(needle)) folders.push(path);
      if (folders.length >= MAX_SUGGESTIONS) break;
    }
    return folders.sort((a, b) => a.localeCompare(b));
  }
  renderSuggestion(path, el) {
    el.setText(path);
  }
  selectSuggestion(path) {
    this.inputEl.value = path;
    this.onPick(path);
    this.close();
  }
};
var PdmSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    const settings = this.plugin.settings;
    new import_obsidian.Setting(containerEl).setName("Frontmatter override").setHeading();
    new import_obsidian.Setting(containerEl).setName("Use frontmatter override").setDesc("A note whose frontmatter key is set to collapse or expand ignores the folder rules below.").addToggle(
      (toggle) => toggle.setValue(settings.frontmatterEnabled).onChange(async (value) => {
        settings.frontmatterEnabled = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Frontmatter key").setDesc(`Values: collapse, expand (also true/false, yes/no). Default key: ${DEFAULT_FRONTMATTER_KEY}.`).addText(
      (text) => text.setPlaceholder(DEFAULT_FRONTMATTER_KEY).setValue(settings.frontmatterKey).onChange(async (value) => {
        settings.frontmatterKey = value.trim() || DEFAULT_FRONTMATTER_KEY;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Folder rules").setDesc(
      "Properties are collapsed when a note opens if it matches any enabled rule. With no rules, nothing is collapsed. Notes that match no rule are left alone."
    ).setHeading();
    for (const rule of settings.rules) this.renderRule(containerEl, rule);
    new import_obsidian.Setting(containerEl).addButton((button) => button.setButtonText("Add folder rule").onClick(() => this.addRule("folder"))).addButton((button) => button.setButtonText("Add regex rule").onClick(() => this.addRule("regex")));
  }
  async addRule(type) {
    this.plugin.settings.rules.push(createRule(this.plugin.settings.rules, type));
    await this.plugin.saveSettings();
    this.display();
  }
  renderRule(containerEl, rule) {
    const setting = new import_obsidian.Setting(containerEl).setName(rule.type === "folder" ? "Folder" : "Regex");
    const showError = () => {
      const error = rule.type === "regex" ? this.plugin.compiled.errors.get(rule.id) : void 0;
      setting.setDesc(error != null ? error : rule.type === "folder" ? "Matched against the note's folder." : "Matched against the note's full path.");
      setting.descEl.toggleClass("mod-warning", error !== void 0);
    };
    setting.addText((text) => {
      text.setPlaceholder(rule.type === "folder" ? "Folder/subfolder" : "^Projects/.*\\.md$").setValue(rule.value);
      text.inputEl.addClass("pdm-rule-input");
      const save = async (value) => {
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
      setting.addToggle(
        (toggle) => toggle.setTooltip("Include subfolders").setValue(rule.recursive).onChange(async (value) => {
          rule.recursive = value;
          await this.plugin.saveSettings();
        })
      );
    }
    setting.controlEl.createSpan({ text: "On", cls: "pdm-toggle-label" });
    setting.addToggle(
      (toggle) => toggle.setTooltip("Enabled").setValue(rule.enabled).onChange(async (value) => {
        rule.enabled = value;
        await this.plugin.saveSettings();
      })
    ).addExtraButton(
      (button) => button.setIcon("trash-2").setTooltip("Delete rule").onClick(async () => {
        this.plugin.settings.rules = this.plugin.settings.rules.filter((r) => r !== rule);
        await this.plugin.saveSettings();
        this.display();
      })
    );
    showError();
  }
};

// src/main.ts
var PropertiesDisplayManager = class extends import_obsidian2.Plugin {
  async onload() {
    this.settings = normalizeSettings(await this.loadData());
    this.compiled = compileRules(this.settings.rules);
    this.addSettingTab(new PdmSettingTab(this.app, this));
    this.addCommand({
      id: "apply-rules-to-open-notes",
      name: "Apply rules to open notes",
      callback: () => this.applyToOpenViews()
    });
    this.register(installHooks(import_obsidian2.MarkdownView.prototype, (view) => this.applyToView(view)));
    this.app.workspace.onLayoutReady(() => this.applyToOpenViews());
  }
  async saveSettings() {
    this.compiled = compileRules(this.settings.rules);
    await this.saveData(this.settings);
  }
  applyToView(view) {
    var _a;
    if (!(view instanceof import_obsidian2.MarkdownView) || !view.file) return;
    const frontmatter = (_a = this.app.metadataCache.getFileCache(view.file)) == null ? void 0 : _a.frontmatter;
    applyDecision(view, decide(view.file.path, frontmatter, this.settings, this.compiled));
  }
  applyToOpenViews() {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      this.applyToView(leaf.view);
    }
  }
};
