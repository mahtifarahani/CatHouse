// Builds one platform-specific VSIX (ADR 0008):
//   node scripts/package.mjs [--target darwin-arm64|darwin-x64|linux-x64|linux-arm64]
// Stages .pkg/<target>/ with the manifest, the bundled extension + webview, and node_modules
// holding only the Claude Agent SDK and its binary for that target (the SDK is external to the
// esbuild bundle; see src/orchestrator/session.ts). Its peer dependencies are type-only and are
// not shipped (verified 2026-09-28: the SDK loads and starts a session without them).
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const args = process.argv.slice(2);
const target =
  args[args.indexOf("--target") + 1] && args.includes("--target")
    ? args[args.indexOf("--target") + 1]
    : `${process.platform}-${process.arch}`;
const TARGETS = {
  "darwin-arm64": "darwin-arm64",
  "darwin-x64": "darwin-x64",
  "linux-x64": "linux-x64",
  "linux-arm64": "linux-arm64",
};
if (!TARGETS[target])
  throw new Error(`unsupported target ${target}; one of ${Object.keys(TARGETS).join(", ")}`);

const req = createRequire(join(root, "package.json"));
const sdkDir = dirname(req.resolve("@anthropic-ai/claude-agent-sdk"));
const sdkVersion = JSON.parse(readFileSync(join(sdkDir, "package.json"), "utf8")).version;
const platformPkg = `@anthropic-ai/claude-agent-sdk-${TARGETS[target]}`;

for (const f of ["dist/extension.js", "dist/webview/index.js", "dist/webview/index.css"]) {
  if (!existsSync(join(root, f))) throw new Error(`${f} is missing: run pnpm build first`);
}

const stage = join(root, ".pkg", target);
rmSync(stage, { recursive: true, force: true });
mkdirSync(join(stage, "dist", "webview"), { recursive: true });

// Manifest without dev-only fields. The shipped node_modules is declared as dependencies so vsce's
// npm-based dependency detection packs it (--no-dependencies would skip node_modules entirely).
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
delete manifest.devDependencies;
delete manifest.scripts;
manifest.dependencies = { "@anthropic-ai/claude-agent-sdk": sdkVersion, [platformPkg]: sdkVersion };
writeFileSync(join(stage, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
for (const f of ["package.nls.json", "README.md"]) cpSync(join(root, f), join(stage, f));
for (const d of ["media", "l10n"]) cpSync(join(root, d), join(stage, d), { recursive: true });
for (const f of ["dist/extension.js", "dist/webview/index.js", "dist/webview/index.css"]) {
  cpSync(join(root, f), join(stage, f));
}

// node_modules: the SDK (without its own nested node_modules) + the target's binary package.
const nm = join(stage, "node_modules", "@anthropic-ai");
mkdirSync(nm, { recursive: true });
cpSync(sdkDir, join(nm, "claude-agent-sdk"), {
  recursive: true,
  dereference: true,
  filter: (p) => !p.includes(`${sdkDir}/node_modules`),
});
{
  const sdkPkgPath = join(nm, "claude-agent-sdk", "package.json");
  const sdkPkg = JSON.parse(readFileSync(sdkPkgPath, "utf8"));
  // The platform binary is declared at the top level; other platforms' optionals and the
  // type-only peers are not shipped, so npm must not look for them.
  delete sdkPkg.optionalDependencies;
  delete sdkPkg.peerDependencies;
  delete sdkPkg.peerDependenciesMeta;
  writeFileSync(sdkPkgPath, `${JSON.stringify(sdkPkg, null, 2)}\n`);
}
let localPlatform;
try {
  localPlatform = dirname(
    createRequire(join(sdkDir, "package.json")).resolve(`${platformPkg}/package.json`),
  );
} catch {}
const platformDest = join(nm, `claude-agent-sdk-${TARGETS[target]}`);
if (localPlatform) {
  cpSync(localPlatform, platformDest, { recursive: true, dereference: true });
} else {
  // Another platform: fetch the exact version from npm.
  const tmp = join(root, ".pkg", `tmp-${target}`);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const tgz = execFileSync("npm", ["pack", `${platformPkg}@${sdkVersion}`, "--silent"], {
    cwd: tmp,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .pop();
  execFileSync("tar", ["-xzf", tgz], { cwd: tmp });
  cpSync(join(tmp, "package"), platformDest, { recursive: true });
  rmSync(tmp, { recursive: true, force: true });
}

writeFileSync(join(stage, ".vscodeignore"), "**/*.map\n**/*.d.ts\n");
mkdirSync(join(root, "..", "..", "dist"), { recursive: true });
const out = join(root, "..", "..", "dist", `cathouse-${target}-${manifest.version}.vsix`);
execFileSync(
  join(root, "node_modules", ".bin", "vsce"),
  ["package", "--target", target, "--skip-license", "--allow-missing-repository", "--out", out],
  { cwd: stage, stdio: "inherit" },
);
console.log(`packaged ${out}`);
