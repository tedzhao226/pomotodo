import { formatTime, escapeHtml, markdownToHtml, signOffRemaining } from "../../frontend/helpers.js";
import { describe, expect, it } from "vitest";

describe("formatTime", () => {
  it("formats seconds as MM:SS", () => {
    expect(formatTime(1500)).toBe("25:00");
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(5)).toBe("00:05");
    expect(formatTime(65)).toBe("01:05");
    expect(formatTime(3599)).toBe("59:59");
  });
});

describe("escapeHtml", () => {
  it("escapes HTML special characters", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
    expect(escapeHtml("&")).toBe("&amp;");
    expect(escapeHtml('"')).toBe('"');
  });
});

describe("markdownToHtml", () => {
  it("renders bold", () => {
    expect(markdownToHtml("**bold**")).toContain("<strong>bold</strong>");
  });

  it("renders headings", () => {
    expect(markdownToHtml("# Heading")).toContain("<h3>Heading</h3>");
  });

  it("renders unordered lists", () => {
    const html = markdownToHtml("- a\n- b");
    expect(html).toContain("<ul>");
    expect(html.match(/<li>/g)).toHaveLength(2);
  });

  it("escapes raw script tags in source", () => {
    const html = markdownToHtml("<script>alert(1)</script>");
    expect(html).not.toContain("<script>");
  });

  it("renders links with security attributes", () => {
    const html = markdownToHtml("[x](https://e.com)");
    expect(html).toContain('href="https://e.com"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});

describe("signOffRemaining", () => {
  it("returns hours and minutes until target", () => {
    expect(signOffRemaining(new Date(2026, 5, 22, 13, 0, 0), "18:00")).toEqual({
      past: false,
      hours: 5,
      minutes: 0,
    });
  });

  it("returns minutes-only when under an hour", () => {
    expect(signOffRemaining(new Date(2026, 5, 22, 17, 21, 0), "18:00")).toEqual({
      past: false,
      hours: 0,
      minutes: 39,
    });
  });

  it("floors seconds in the remaining time", () => {
    expect(signOffRemaining(new Date(2026, 5, 22, 13, 10, 30), "18:00")).toEqual({
      past: false,
      hours: 4,
      minutes: 49,
    });
  });

  it("marks past when now exactly equals target", () => {
    expect(signOffRemaining(new Date(2026, 5, 22, 18, 0, 0), "18:00")).toEqual({
      past: true,
      hours: 0,
      minutes: 0,
    });
  });

  it("marks past when now is after target", () => {
    expect(signOffRemaining(new Date(2026, 5, 22, 18, 30, 0), "18:00").past).toBe(true);
  });

  it("returns null for blank or malformed input", () => {
    expect(signOffRemaining(new Date(2026, 5, 22, 13, 0, 0), "")).toBe(null);
    expect(signOffRemaining(new Date(2026, 5, 22, 13, 0, 0), "9")).toBe(null);
    expect(signOffRemaining(new Date(2026, 5, 22, 13, 0, 0), "99:99")).toBe(null);
  });
});
