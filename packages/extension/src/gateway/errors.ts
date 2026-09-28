/** One error shape for everything catherd reports, from MCP or the CLI (ADR 0005). */
export class CatherdError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly fix = "",
  ) {
    super(message);
    this.name = "CatherdError";
  }

  toJSON(): { code: string; message: string; fix: string } {
    return { code: this.code, message: this.message, fix: this.fix };
  }
}

/**
 * Parses catherd's CLI error format (src/entry/cli-kit.ts:18-21 upstream):
 *   error E_CODE: message
 *   fix: what to do
 * Returns undefined when stderr carries no catherd error line.
 */
export function parseCliError(stderr: string): CatherdError | undefined {
  const lines = stderr.split(/\r?\n/);
  const i = lines.findIndex((l) => /^error E_[A-Z_]+: /.test(l));
  if (i === -1) return undefined;
  const m = /^error (E_[A-Z_]+): (.*)$/.exec(lines[i] ?? "");
  if (!m) return undefined;
  const fixLine = lines.slice(i + 1).find((l) => l.startsWith("fix: "));
  return new CatherdError(m[1] as string, m[2] as string, fixLine ? fixLine.slice(5) : "");
}
