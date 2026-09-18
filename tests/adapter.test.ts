import { describe, expect, it, vi } from "vitest";
import { applyDecision, canShowProperties, getMetadataEditor, installHooks, wrapSetMode, wrapSetViewData } from "../src/adapter";

function fakeView(collapsed: boolean, opts: { canShow?: boolean | "throws" | "missing" } = {}) {
	const setCollapse = vi.fn(function (this: { collapsed: boolean }, value: boolean) {
		this.collapsed = value;
	});
	const view: Record<string, unknown> = { metadataEditor: { collapsed, setCollapse } };
	if (opts.canShow !== "missing") {
		view.canShowProperties = () => {
			if (opts.canShow === "throws") throw new Error("boom");
			return opts.canShow ?? true;
		};
	}
	return { view, setCollapse };
}

describe("applyDecision", () => {
	it("collapses an expanded panel with animate=false", () => {
		const { view, setCollapse } = fakeView(false);
		expect(applyDecision(view, "collapse")).toBe(true);
		expect(setCollapse).toHaveBeenCalledWith(true, false);
	});
	it("expands a collapsed panel with animate=false", () => {
		const { view, setCollapse } = fakeView(true);
		expect(applyDecision(view, "expand")).toBe(true);
		expect(setCollapse).toHaveBeenCalledWith(false, false);
	});
	it("is a no-op when already in the target state", () => {
		const { view, setCollapse } = fakeView(true);
		expect(applyDecision(view, "collapse")).toBe(false);
		expect(setCollapse).not.toHaveBeenCalled();
	});
	it("is a no-op for decision none", () => {
		const { view, setCollapse } = fakeView(false);
		expect(applyDecision(view, "none")).toBe(false);
		expect(setCollapse).not.toHaveBeenCalled();
	});
	it("is a no-op when canShowProperties() is false or throws", () => {
		for (const canShow of [false, "throws"] as const) {
			const { view, setCollapse } = fakeView(false, { canShow });
			expect(applyDecision(view, "collapse")).toBe(false);
			expect(setCollapse).not.toHaveBeenCalled();
		}
	});
	it("treats a missing canShowProperties as allowed", () => {
		const { view } = fakeView(false, { canShow: "missing" });
		expect(canShowProperties(view)).toBe(true);
		expect(applyDecision(view, "collapse")).toBe(true);
	});
	it("is a no-op when internals are missing or malformed", () => {
		for (const view of [null, undefined, {}, { metadataEditor: null }, { metadataEditor: { collapsed: "no", setCollapse: () => 0 } }, { metadataEditor: { collapsed: true } }]) {
			expect(getMetadataEditor(view)).toBeNull();
			expect(applyDecision(view, "collapse")).toBe(false);
		}
	});
});

describe("wrapSetViewData", () => {
	it("calls the original first, then the callback only when clear is true", () => {
		const order: string[] = [];
		const next = vi.fn(() => order.push("next"));
		const cb = vi.fn(() => order.push("cb"));
		const wrapped = wrapSetViewData(next, cb);
		const view = {};
		wrapped.call(view, "data", false);
		expect(cb).not.toHaveBeenCalled();
		wrapped.call(view, "data", true);
		expect(order).toEqual(["next", "next", "cb"]);
		expect(cb).toHaveBeenCalledWith(view);
		expect(next).toHaveBeenLastCalledWith("data", true);
	});
	it("never throws into the wrapped method", () => {
		const wrapped = wrapSetViewData(() => undefined, () => {
			throw new Error("plugin bug");
		});
		expect(() => wrapped.call({}, "d", true)).not.toThrow();
	});
});

describe("wrapSetMode", () => {
	it("returns the original promise and fires only when it resolves true", async () => {
		const cb = vi.fn();
		const view = {};
		const p1 = Promise.resolve(true);
		const wrapped = wrapSetMode(() => p1, cb);
		expect(wrapped.call(view, "preview")).toBe(p1);
		await p1;
		await Promise.resolve();
		expect(cb).toHaveBeenCalledWith(view);

		cb.mockClear();
		const p2 = Promise.resolve(false);
		await wrapSetMode(() => p2, cb).call(view);
		await Promise.resolve();
		expect(cb).not.toHaveBeenCalled();
	});
	it("does not swallow or add rejections, and survives callback errors", async () => {
		const failing = Promise.reject(new Error("mode failed"));
		const wrapped = wrapSetMode(() => failing, vi.fn());
		await expect(wrapped.call({}) as Promise<unknown>).rejects.toThrow("mode failed");

		const throwingCb = wrapSetMode(() => Promise.resolve(true), () => {
			throw new Error("plugin bug");
		});
		await expect(throwingCb.call({}) as Promise<unknown>).resolves.toBe(true);
		await Promise.resolve();
	});
});

describe("installHooks", () => {
	it("wraps both methods, calls back with the instance, and uninstalls cleanly", async () => {
		class FakeView {
			loaded = 0;
			setViewData(_data: string, _clear: boolean) {
				this.loaded++;
			}
			setMode(_mode: string) {
				return Promise.resolve(true);
			}
		}
		const originalSVD = FakeView.prototype.setViewData;
		const originalSM = FakeView.prototype.setMode;
		const cb = vi.fn();
		const uninstall = installHooks(FakeView.prototype, cb);
		const v = new FakeView();
		v.setViewData("x", true);
		expect(v.loaded).toBe(1);
		expect(cb).toHaveBeenCalledWith(v);
		await v.setMode("source");
		await Promise.resolve();
		expect(cb).toHaveBeenCalledTimes(2);
		uninstall();
		expect(FakeView.prototype.setViewData).toBe(originalSVD);
		expect(FakeView.prototype.setMode).toBe(originalSM);
	});
	it("skips setMode when it does not exist", () => {
		class NoMode {
			setViewData(_d: string, _c: boolean) {}
		}
		const uninstall = installHooks(NoMode.prototype, vi.fn());
		expect("setMode" in NoMode.prototype).toBe(false);
		uninstall();
	});
});
