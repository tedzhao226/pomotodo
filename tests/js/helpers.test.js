import { formatTime, escapeHtml, markdownToHtml } from "../../frontend/helpers.js";
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
