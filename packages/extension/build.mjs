import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");

/** @type {import("esbuild").BuildOptions} */
const options = {
  entryPoints: ["src/extension.ts"],
  outfile: "dist/extension.js",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  // The Agent SDK is ESM-only and locates its platform binary relative to its package, so it
  // stays in node_modules and is loaded with import() (see src/orchestrator/session.ts).
  external: ["vscode", "@anthropic-ai/claude-agent-sdk"],
  sourcemap: true,
  minify: !watch,
  logLevel: "info",
};

// E2E tests run inside a real VS Code (@vscode/test-cli); bundled like the extension.
if (process.argv.includes("--e2e")) {
  await esbuild.build({
    ...options,
    entryPoints: ["src/test/e2e/*.e2e.ts"],
    outfile: undefined,
    outdir: "out-test",
    minify: false,
    external: ["vscode", "mocha", "@anthropic-ai/claude-agent-sdk"],
  });
} else if (process.argv.includes("--spike")) {
  // Phase 1 spike harness (scripts/spike.ts), run with plain node outside VS Code.
  await esbuild.build({
    ...options,
    entryPoints: ["scripts/spike.ts"],
    outfile: "dist-spike/spike.mjs",
    format: "esm",
    minify: false,
    banner: {
      js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
    },
  });
} else if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  await esbuild.build(options);
}
