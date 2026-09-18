// The only module that touches undocumented Obsidian internals:
//   MarkdownView#metadataEditor.{collapsed, setCollapse(collapsed, animate)}
//   MarkdownView#canShowProperties()
//   MarkdownView#setMode(mode) → Promise<boolean>
//   MarkdownView#editMode.cm (the CodeMirror EditorView)
// Verified against Obsidian 1.13.7. Every access is feature-detected and
// degrades to a no-op, so an API change is a one-file fix. This module does not
// import `obsidian`; views arrive as `unknown`, which keeps it testable headless.

import { foldable, foldedRanges, foldEffect, unfoldEffect } from "@codemirror/language";
import type { EditorState, StateEffect } from "@codemirror/state";
import { around } from "monkey-around";
import type { Decision } from "./core/decide";
import { frontmatterEndLine } from "./core/frontmatter";

interface EditorViewLike {
	state: EditorState;
	dispatch(spec: { effects: StateEffect<unknown> }): void;
}

interface MetadataEditorLike {
	collapsed: boolean;
	setCollapse(collapsed: boolean, animate?: boolean): void;
}

export type ViewCallback = (view: unknown) => void;

type SetViewData = (this: unknown, data: string, clear: boolean) => void;
type SetMode = (this: unknown, ...args: unknown[]) => unknown;

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

export function getMetadataEditor(view: unknown): MetadataEditorLike | null {
	if (!isObject(view)) return null;
	const editor = view.metadataEditor;
	if (!isObject(editor)) return null;
	if (typeof editor.collapsed !== "boolean" || typeof editor.setCollapse !== "function") return null;
	return editor as unknown as MetadataEditorLike;
}

/** False in source mode or when properties are hidden/shown as source. */
export function canShowProperties(view: unknown): boolean {
	if (!isObject(view)) return false;
	const fn = view.canShowProperties;
	if (typeof fn !== "function") return true;
	try {
		return (fn as () => unknown).call(view) === true;
	} catch {
		return false;
	}
}

/**
 * Puts the view's properties in the decided state and returns true if anything
 * changed. When Obsidian shows a properties panel, the panel is collapsed or
 * expanded with animate=false, which also skips Obsidian's fold persistence.
 * When it does not (properties shown as source, or source mode), the raw
 * frontmatter block is folded or unfolded in the editor instead, the same
 * fallback Obsidian's own "Toggle fold properties" command uses.
 */
export function applyDecision(view: unknown, decision: Decision): boolean {
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

function getEditorView(view: unknown): EditorViewLike | null {
	if (!isObject(view) || typeof view.getMode !== "function") return null;
	if ((view.getMode as () => unknown).call(view) !== "source") return null;
	const editMode = view.editMode;
	if (!isObject(editMode)) return null;
	const cm = editMode.cm;
	if (!isObject(cm) || !isObject(cm.state) || typeof cm.dispatch !== "function") return null;
	return cm as unknown as EditorViewLike;
}

/** The frontmatter fold range: Obsidian's own fold for line 1 if it has one, else end of `---` to end of the closer. */
export function frontmatterRange(state: EditorState): { from: number; to: number } | null {
	const doc = state.doc;
	const end = frontmatterEndLine((n) => doc.line(n).text, doc.lines);
	if (end === null) return null;
	const first = doc.line(1);
	return foldable(state, first.from, first.to) ?? { from: first.to, to: doc.line(end).to };
}

/** Folds (collapsed=true) or unfolds the frontmatter block. Returns true if it dispatched. */
export function applyFrontmatterFold(view: unknown, collapsed: boolean): boolean {
	const cm = getEditorView(view);
	if (!cm) return false;
	const state = cm.state;
	const range = frontmatterRange(state);
	if (!range) return false;
	let existing: { from: number; to: number } | null = null;
	foldedRanges(state).between(0, state.doc.line(1).to, (from, to) => {
		existing = { from, to };
		return false;
	});
	if (collapsed && !existing) {
		cm.dispatch({ effects: foldEffect.of(range) });
		return true;
	}
	if (!collapsed && existing) {
		cm.dispatch({ effects: unfoldEffect.of(existing) });
		return true;
	}
	return false;
}

function safely(callback: ViewCallback, view: unknown): void {
	try {
		callback(view);
	} catch {
		// Never let plugin logic break Obsidian's own file loading.
	}
}

/** Runs `onLoaded` right after a file's content is loaded into the view (clear === true). */
export function wrapSetViewData(next: SetViewData, onLoaded: ViewCallback): SetViewData {
	return function (this: unknown, data: string, clear: boolean) {
		next.call(this, data, clear);
		if (clear) safely(onLoaded, this);
	};
}

/** Runs `onChanged` after setMode resolves true (the mode actually changed). */
export function wrapSetMode(next: SetMode, onChanged: ViewCallback): SetMode {
	return function (this: unknown, ...args: unknown[]) {
		const result = next.apply(this, args);
		if (result instanceof Promise) {
			result.then(
				(changed) => {
					if (changed === true) safely(onChanged, this);
				},
				() => undefined,
			);
		}
		return result;
	};
}

/**
 * Installs both wrappers on MarkdownView.prototype (passed in by the shell).
 * setMode is wrapped only if present. Returns an uninstaller that is safe even
 * when other plugins have wrapped the same methods afterwards.
 */
export function installHooks(proto: object, onApply: ViewCallback): () => void {
	type HookableProto = { setViewData: SetViewData; setMode: SetMode };
	const target = proto as Partial<HookableProto>;
	const factories: { [K in keyof HookableProto]?: (next: HookableProto[K]) => HookableProto[K] } = {};
	if (typeof target.setViewData === "function") {
		factories.setViewData = (next) => wrapSetViewData(next, onApply);
	}
	if (typeof target.setMode === "function") {
		factories.setMode = (next) => wrapSetMode(next, onApply);
	}
	return around(target as HookableProto, factories);
}
