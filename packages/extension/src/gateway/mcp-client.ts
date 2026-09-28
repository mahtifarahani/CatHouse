import { PINNED } from "@cathouse/compat";
import { Client } from "@modelcontextprotocol/sdk/client";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CatherdError } from "./errors";
import { type AllowedTool, isAllowedTool } from "./mcp-tools";
import { McpErrorSchema } from "./schemas";

export interface McpOptions {
  /** Repo root: the server's cwd; every call also passes `repo` explicitly (ADR 0006). */
  repo: string;
  env: () => Promise<Record<string, string>>;
  onStderr?: (line: string) => void;
}

const CALL_TIMEOUT_MS = 120_000;

/** Extracts a tool result: JSON (or raw text for read tools) on success, CatherdError on failure. */
export function decodeToolResult(result: {
  content?: unknown;
  isError?: boolean;
  structuredContent?: unknown;
}): unknown {
  const first = Array.isArray(result.content) ? result.content[0] : undefined;
  const text =
    first && typeof first === "object" && "text" in first && typeof first.text === "string"
      ? first.text
      : "";
  if (result.isError) {
    const err = McpErrorSchema.safeParse(result.structuredContent);
    if (err.success) throw new CatherdError(err.data.code, err.data.message, err.data.fix);
    throw new CatherdError("E_MCP_ERROR", text || "catherd MCP tool failed");
  }
  try {
    return JSON.parse(text);
  } catch {
    return text; // read_run_file and read_knowledge return raw text
  }
}

/** One long-lived `catherd mcp` per repo (ADR 0006). Restarted lazily after a crash. */
export class CatherdMcp {
  private client: Client | undefined;
  private connecting: Promise<Client> | undefined;

  constructor(private readonly opts: McpOptions) {}

  private async connect(): Promise<Client> {
    const transport = new StdioClientTransport({
      command: "bunx",
      args: [`catherd-cli@${PINNED.catherd}`, "mcp"],
      cwd: this.opts.repo,
      env: await this.opts.env(),
      stderr: "pipe",
    });
    transport.stderr?.on("data", (b: Buffer) => this.opts.onStderr?.(b.toString("utf8")));
    const client = new Client({ name: "cathouse", version: "0.0.1" });
    transport.onclose = () => {
      this.client = undefined;
    };
    await client.connect(transport);
    const server = client.getServerVersion();
    if (server?.name !== "catherd" || server.version !== PINNED.catherd) {
      await client.close();
      throw new CatherdError(
        "E_VERSION_MISMATCH",
        `catherd MCP server is ${server?.name}@${server?.version}, CatHouse expects catherd@${PINNED.catherd}`,
        "open CatHouse Setup to install the supported version",
      );
    }
    this.client = client;
    return client;
  }

  private async ready(): Promise<Client> {
    if (this.client) return this.client;
    this.connecting ??= this.connect().finally(() => {
      this.connecting = undefined;
    });
    return this.connecting;
  }

  async serverVersion(): Promise<string | undefined> {
    return (await this.ready()).getServerVersion()?.version;
  }

  async call(tool: AllowedTool, args: Record<string, unknown> = {}): Promise<unknown> {
    if (!isAllowedTool(tool)) {
      throw new CatherdError("E_TOOL_FORBIDDEN", `CatHouse may not call catherd tool "${tool}"`);
    }
    const client = await this.ready();
    const result = await client.callTool({ name: tool, arguments: args }, undefined, {
      timeout: CALL_TIMEOUT_MS,
    });
    return decodeToolResult(result as Parameters<typeof decodeToolResult>[0]);
  }

  async close(): Promise<void> {
    await this.client?.close();
    this.client = undefined;
  }
}
