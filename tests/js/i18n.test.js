import { t, plural, MESSAGES } from "../../frontend/i18n.js";
import { describe, expect, it } from "vitest";

describe("t", () => {
  it("returns the message for a known key", () => {
    expect(t("nav.main")).toBe(MESSAGES.en["nav.main"]);
    expect(t("nav.main")).toBe("Pomotodo");
  });

  it("substitutes interpolation variables", () => {
    expect(t("streak.toLongRest", { n: 3 })).toBe("3 to long rest");
    expect(t("timer.timeForBreak")).toBe("Time for a break!");
  });

  it("returns the key when unknown", () => {
    expect(t("nonexistent.key")).toBe("nonexistent.key");
  });
});

describe("plural", () => {
  it("returns singular for n=1", () => {
    expect(plural("block", 1)).toBe("block");
    expect(plural("pomo", 1)).toBe("pomo");
  });

  it("returns plural for n=2", () => {
    expect(plural("block", 2)).toBe("blocks");
    expect(plural("pomo", 2)).toBe("pomos");
  });
});
