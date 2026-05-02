# E2E: Claude/Cowork Plugin Export

## User Story
A workflow author can choose the Claude/Cowork Plugin target and see accurate ZIP/folder export guidance that does not mention writing to `.claude`.

## Test Steps
1. Use `playwright-cli` to open the app.
2. Open the Generate menu.
3. Choose the Claude/Cowork Plugin target.
4. Inspect the export dialog target card, target directory copy, selected folder explanation, and ZIP/footer copy.
5. Switch among OpenCode, PI, and Claude targets.
6. Verify the Claude target copy/folder labels update to plugin package language while OpenCode/PI keep their dot-folder language.

## Success Criteria
- Claude card/selected target shows plugin package language.
- No visible `.claude` output folder language appears for Claude.
- ZIP copy mentions Cowork/plugin compatibility and `.claude-plugin/plugin.json` at ZIP root.
- Folder copy mentions the dynamic `nexus-<workflow-slug>` plugin folder.
- OpenCode/PI copy still mentions `.opencode`/`.pi`.

## Screenshot Capture Points
- Initial Generate menu.
- Claude selected export dialog.
- Folder target explanation for Claude.
- OpenCode/PI regression states.
