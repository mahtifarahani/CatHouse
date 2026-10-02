import type { SessionEvent } from "@cathouse/protocol";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Transcript } from "./Transcript";

vi.mock("../lib/rpc", () => ({ onEvent: () => () => {}, request: async () => ({}) }));

const text = (value: string): SessionEvent => ({
  kind: "text",
  text: value,
  parentToolUseId: null,
});

describe("transcript host switch", () => {
  it("offers Codex next to the latest Claude session limit", () => {
    const html = renderToStaticMarkup(
      createElement(Transcript, {
        events: [
          text("You've hit your session limit · resets 4:40pm"),
          text("Session limit reached"),
        ],
        onSwitchToCodex: () => {},
      }),
    );
    expect(html.match(/Switch to Codex/g)).toHaveLength(1);
    expect(html).toContain("this chat stays with Claude");
  });

  it("does not offer Codex on unrelated failures or when Claude is not selected", () => {
    const quota = [text("You've hit your session limit")];
    expect(renderToStaticMarkup(createElement(Transcript, { events: quota }))).not.toContain(
      "Switch to Codex",
    );
    expect(
      renderToStaticMarkup(
        createElement(Transcript, {
          events: [text("Permission denied")],
          onSwitchToCodex: () => {},
        }),
      ),
    ).not.toContain("Switch to Codex");
    const codexInit: SessionEvent = {
      kind: "init",
      host: "codex",
      sessionId: "codex-thread",
      claudeCodeVersion: "",
      catherdPlugin: { name: "catherd", path: "/plugin" },
      catherdMcpStatus: "connected",
      pluginErrors: [],
      agents: [],
      permissionMode: "default",
    };
    expect(
      renderToStaticMarkup(
        createElement(Transcript, { events: [codexInit, ...quota], onSwitchToCodex: () => {} }),
      ),
    ).not.toContain("Switch to Codex");
  });
});
