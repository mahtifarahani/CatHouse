import { expect, test } from "vitest";
import { buildReleaseNotes, extractChangelog, versionFromTag } from "./release-notes.mjs";

const changelog = `# Changelog

## Unreleased

- in progress

## [0.1.0] - 2026-09-29

- first public download

## [0.1.0-rc.1] - 2026-09-28

- release candidate
`;

test("reads the version from a release tag", () => {
  expect(versionFromTag("v0.1.0")).toBe("0.1.0");
  expect(versionFromTag("v0.1.0-rc.1")).toBe("0.1.0-rc.1");
  expect(() => versionFromTag("0.1.0")).toThrow(/vX\.Y\.Z/);
});

test("extracts only the matching changelog section", () => {
  expect(extractChangelog(changelog, "0.1.0")).toBe("- first public download");
  expect(extractChangelog(changelog, "0.1.0-rc.1")).toBe("- release candidate");
  expect(() => extractChangelog(changelog, "0.2.0")).toThrow(/0\.2\.0/);
});

test("refuses a tag that does not match the extension version", () => {
  expect(() => buildReleaseNotes({ tag: "v0.2.0", changelog, manifestVersion: "0.1.0" })).toThrow(
    /0\.1\.0/,
  );
});

test("names every platform VSIX and both editors", () => {
  const notes = buildReleaseNotes({
    tag: "v0.1.0",
    changelog,
    manifestVersion: "0.1.0",
  });
  expect(notes).toContain("cathouse-darwin-arm64-0.1.0.vsix");
  expect(notes).toContain("cathouse-darwin-x64-0.1.0.vsix");
  expect(notes).toContain("cathouse-linux-x64-0.1.0.vsix");
  expect(notes).toContain("cathouse-linux-arm64-0.1.0.vsix");
  expect(notes).toContain("Install in VS Code");
  expect(notes).toContain("Install in Cursor");
  expect(notes).toContain("- first public download");
  expect(notes).not.toContain("release candidate");
});
