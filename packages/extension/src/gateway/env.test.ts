import { describe, expect, it } from "vitest";
import { processEnv } from "./env";

describe("processEnv", () => {
  it("declares Claude Code as catherd's orchestration host", async () => {
    const env = await processEnv();
    expect(env.CATHERD_ORCHESTRATION_HOST).toBe("claude-code");
  });

  it("strips host Claude session variables", async () => {
    process.env.CLAUDE_CODE_SESSION_ID = "leak";
    try {
      expect((await processEnv()).CLAUDE_CODE_SESSION_ID).toBeUndefined();
    } finally {
      delete process.env.CLAUDE_CODE_SESSION_ID;
    }
  });

  it("strips a leaked catherd role scope", async () => {
    process.env.CATHERD_ROLE = "20261003-120000-x/worker-m1";
    try {
      expect((await processEnv()).CATHERD_ROLE).toBeUndefined();
    } finally {
      delete process.env.CATHERD_ROLE;
    }
  });
});
