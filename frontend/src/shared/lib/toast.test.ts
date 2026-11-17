import { afterEach, describe, expect, it, vi } from "vitest";

import {
  dismissToast,
  getToasts,
  MAX_TOASTS,
  resetToasts,
  subscribeToToasts,
  toast,
  underConstruction,
  UNDER_CONSTRUCTION_MESSAGE,
  UNDER_CONSTRUCTION_TITLE,
} from "./toast";

afterEach(resetToasts);

describe("toast queue", () => {
  it("adds a toast with defaults and notifies subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToToasts(listener);

    const id = toast({ title: "Saved" });

    expect(getToasts()).toEqual([
      expect.objectContaining({ id, title: "Saved", tone: "info", duration: 4500 }),
    ]);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("dismisses by id and ignores unknown ids", () => {
    const listener = vi.fn();
    const id = toast({ title: "One" });
    subscribeToToasts(listener);

    dismissToast(9999);
    expect(listener).not.toHaveBeenCalled();

    dismissToast(id);
    expect(getToasts()).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it(`keeps only the newest ${MAX_TOASTS}`, () => {
    for (let i = 1; i <= MAX_TOASTS + 2; i++) toast({ title: `T${i}` });
    expect(getToasts().map((t) => t.title)).toEqual(["T3", "T4", "T5"]);
  });

  it("underConstruction says this is a prototype, naming the feature when given", () => {
    underConstruction();
    underConstruction("Release payment");
    const [plain, named] = getToasts();
    expect(plain).toMatchObject({ title: UNDER_CONSTRUCTION_TITLE, description: UNDER_CONSTRUCTION_MESSAGE });
    expect(named.description).toBe("Release payment: this function is under construction.");
  });
});
