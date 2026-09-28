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
  external: ["vscode"],
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
    external: ["vscode", "mocha"],
  });
} else if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  await esbuild.build(options);
}
