import { spawn } from "node:child_process";

export interface RunOptions {
  cwd?: string;
  env: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
  stdin?: string;
  /** Streams output as it arrives (Setup shows install output live). */
  onOutput?: (chunk: string, stream: "stdout" | "stderr") => void;
}

export interface RunResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

/** Runs a command to completion. Never rejects for a non-zero exit; only for spawn failures. */
export function runProcess(cmd: string, args: string[], opts: RunOptions): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: opts.env,
      stdio: ["pipe", "pipe", "pipe"],
      signal: opts.signal,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer =
      opts.timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            timedOut = true;
            child.kill("SIGTERM");
          }, opts.timeoutMs);
    child.stdout.setEncoding("utf8").on("data", (c: string) => {
      stdout += c;
      opts.onOutput?.(c, "stdout");
    });
    child.stderr.setEncoding("utf8").on("data", (c: string) => {
      stderr += c;
      opts.onOutput?.(c, "stderr");
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr, timedOut });
    });
    child.stdin.end(opts.stdin ?? "");
  });
}
