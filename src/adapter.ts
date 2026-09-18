// The only module that touches undocumented Obsidian internals:
//   MarkdownView#metadataEditor.{collapsed, setCollapse(collapsed, animate)}
//   MarkdownView#canShowProperties()
//   MarkdownView#setMode(mode) → Promise<boolean>
// Verified against Obsidian 1.13.7. Every access is feature-detected and
// degrades to a no-op, so an API change is a one-file fix. This module does not
// import `obsidian`; views arrive as `unknown`, which keeps it testable headless.

import { around } from "monkey-around";
import type { Decision } from "./core/decide";

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
 * Puts the view's properties panel in the decided state. Uses animate=false,
 * which also skips Obsidian's fold persistence, so nothing is written anywhere.
 * Returns true if the panel state changed.
 */
export function applyDecision(view: unknown, decision: Decision): boolean {
	if (decision === "none") return false;
	const editor = getMetadataEditor(view);
	if (!editor || !canShowProperties(view)) return false;
	const collapsed = decision === "collapse";
	if (editor.collapsed === collapsed) return false;
	editor.setCollapse(collapsed, false);
	return true;
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
