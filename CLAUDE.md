# CLAUDE.md

Read [`AGENTS.md`](AGENTS.md) first. It is the entry point and holds the project rules. Then read [`docs/STATUS.md`](docs/STATUS.md) for the current state and the exact next step.

Claude-specific notes:
- After finishing any section, write its report in `docs/` and update `docs/STATUS.md` before starting the next one. This is the project's most important rule.
- The catherd source for citations is https://github.com/47vigen/catherd at tag `v1.3.0` (commit `f1422f8`), the version CatHouse pins. The 1.2 upgrade doc cites `3cee546` (`v1.2.0`) and the 1.0.0 baseline research docs cite `b257da7`. Clone it to a scratch directory to verify a citation; never vendor it into this repo.
- For Claude Agent SDK questions, use `docs/research/claude-agent-sdk.md` first, then the official docs index at https://code.claude.com/docs/llms.txt.
