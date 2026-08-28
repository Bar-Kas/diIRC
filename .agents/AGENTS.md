# Workspace Guidelines

- All user-facing UI messages, dialogs, titles, and labels in the application must be written in English.
- All user-facing UI messages, dialogs, titles, labels, and button texts in the application must be written in Sentence Case (e.g. "Join channel", "Connect to server", "Save changes"), with only the first word capitalized, except for proper nouns and technical abbreviations/acronyms (e.g., IRC, TLS, SSL, POMF, URL, API).

## End-to-End (E2E) & Visual Testing

- End-to-end and visual regression tests are located under the `test/` directory.
- Test commands, architecture guidelines, multi-instance orchestration (Multiremote), and multi-stage screenshot practices are fully documented in [`test/documentation.md`](file:///home/a15/programing/diIRC/test/documentation.md).
- Do not run tests automatically unless explicitly requested by the user or when actively working on tests.
- Always execute tests via `npm run test:e2e` to ensure Docker dependencies (Ergo IRC), Vite dev server, and dual `tauri-driver` processes are spawned and cleaned up properly.
