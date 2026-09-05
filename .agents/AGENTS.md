# Workspace Guidelines

AGENTS.md at the repository root is canonical. These are the rules most useful to an Antigravity worker:

- Claim one task and non-overlapping files before editing. Use an isolated worktree when available.
- Keep main for integration. Do not reset, checkout over, or overwrite another agent's work.
- Run focused checks while iterating; run npm run tauri build -- --no-bundle once after integration, at the Ready for QA gate.
- Do not launch app.exe or quick-build.bat from a headless agent session. Hand the release binary to the user for desktop QA.
- Never commit or push without explicit user approval. Keep local coordination documents, generated output, and the test harness uncommitted.
- Use English Sentence Case for all user-facing UI copy.

## Focused checks

```powershell
git diff --check
npm run build
Push-Location src-tauri; cargo check; Pop-Location
node --check devtools/irc-test-server/index.js
```

Run only the command relevant to the changed layer. Documentation-only changes need git diff --check only.

## End-to-end tests

Use npm run test:e2e only when the task explicitly concerns the E2E suite or the user requests it. Otherwise, use the focused checks and the local IRC harness documented in AGENTS.md.
