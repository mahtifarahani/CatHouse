// Builds the GitHub Release body for a version tag.
//   node scripts/release-notes.mjs --tag vX.Y.Z [--out release-notes.md]
// The tag (without the leading v) must match packages/extension/package.json,
// and docs/CHANGELOG.md must contain a "## [x.y.z]" section for that version.
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;
const HEADING = /^## \[([^\]\s]+)\](?:\s|$)/;

const ASSETS = [
  ["macOS Apple Silicon", "darwin-arm64"],
  ["macOS Intel", "darwin-x64"],
  ["Linux x64", "linux-x64"],
  ["Linux ARM64", "linux-arm64"],
];

export function versionFromTag(tag) {
  if (!TAG.test(tag)) {
    throw new Error(`tag ${tag} must look like vX.Y.Z or vX.Y.Z-rc.1`);
  }
  return tag.slice(1);
}

export function extractChangelog(changelog, version) {
  const lines = changelog.split(/\r?\n/);
  const start = lines.findIndex((line) => {
    const match = HEADING.exec(line);
    return match?.[1] === version;
  });
  if (start < 0) {
    throw new Error(
      `docs/CHANGELOG.md has no "## [${version}]" section. Move the Unreleased notes under that heading before tagging.`,
    );
  }
  const body = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) break;
    body.push(lines[i]);
  }
  const text = body.join("\n").trim();
  if (!text) throw new Error(`changelog section [${version}] is empty`);
  return text;
}

export function renderReleaseNotes(version, changelogBody) {
  const rows = ASSETS.map(
    ([label, target]) => `| ${label} | \`cathouse-${target}-${version}.vsix\` |`,
  ).join("\n");
  return `CatHouse ${version} for VS Code and Cursor.

## Install

VS Code: [install from the VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=cathouse.cathouse), search for \`CatHouse\` in Extensions, or run:

\`\`\`bash
code --install-extension cathouse.cathouse
\`\`\`

Cursor: [install from Open VSX](https://open-vsx.org/extension/cathouse/cathouse), search for \`CatHouse\` in Extensions, or run:

\`\`\`bash
cursor --install-extension cathouse.cathouse
\`\`\`

## Manual or offline download

| Machine | Asset |
|---|---|
${rows}

\`SHA256SUMS\` lists the checksums. Windows is not supported.

\`\`\`bash
sha256sum -c SHA256SUMS
\`\`\`

On macOS, \`shasum -a 256 -c SHA256SUMS\` checks the same file. Download the VSIX for your machine, then choose **Extensions → … → Install from VSIX...** in VS Code or Cursor. You can also run:

\`\`\`bash
code --install-extension ./cathouse-darwin-arm64-${version}.vsix
cursor --install-extension ./cathouse-darwin-arm64-${version}.vsix
\`\`\`

## After install

1. Open a trusted Git repository.
2. Select the CatHouse icon in the Activity Bar.
3. Complete Setup. Each installer runs only after you click it.
4. Open Chat, describe the task, and select **Start task**.

## Release notes

${changelogBody}
`;
}

function parseArgs(argv) {
  const parsed = { tag: process.env.GITHUB_REF_NAME ?? "", outPath: "" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--tag") {
      const value = argv[++i];
      if (!value) throw new Error("--tag needs a value");
      parsed.tag = value;
    } else if (arg === "--out") {
      const value = argv[++i];
      if (!value) throw new Error("--out needs a value");
      parsed.outPath = value;
    } else {
      throw new Error(`unknown argument ${arg}`);
    }
  }
  if (!parsed.tag) throw new Error("pass --tag vX.Y.Z or set GITHUB_REF_NAME");
  return parsed;
}

export function buildReleaseNotes({ tag, changelog, manifestVersion }) {
  const version = versionFromTag(tag);
  if (manifestVersion !== version) {
    throw new Error(
      `tag ${tag} does not match packages/extension/package.json version ${manifestVersion}`,
    );
  }
  return renderReleaseNotes(version, extractChangelog(changelog, version));
}

function main() {
  const { tag, outPath } = parseArgs(process.argv.slice(2));
  const manifest = JSON.parse(readFileSync(join(root, "packages/extension/package.json"), "utf8"));
  const changelog = readFileSync(join(root, "docs/CHANGELOG.md"), "utf8");
  const notes = buildReleaseNotes({
    tag,
    changelog,
    manifestVersion: manifest.version,
  });
  if (outPath) writeFileSync(outPath, notes);
  else process.stdout.write(notes);
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(realpathSync(entry)).href;
}

if (isDirectRun()) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
