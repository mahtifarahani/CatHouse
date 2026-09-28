import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownText } from "./MarkdownText";

describe("MarkdownText", () => {
  it("renders common and GitHub-flavoured Markdown", () => {
    const html = renderToStaticMarkup(
      createElement(MarkdownText, null, "- **Status:** ready with `state.md`\n- ~~old~~ new"),
    );

    expect(html).toContain("<ul");
    expect(html).toContain("<strong>Status:</strong>");
    expect(html).toContain("<code");
    expect(html).toContain("state.md</code>");
    expect(html).toContain("<del>old</del>");
  });

  it("does not render raw HTML", () => {
    const html = renderToStaticMarkup(
      createElement(MarkdownText, null, '**safe**\n\n<script>alert("no")</script>'),
    );

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("alert");
    expect(html).toContain("<strong>safe</strong>");
  });
});
