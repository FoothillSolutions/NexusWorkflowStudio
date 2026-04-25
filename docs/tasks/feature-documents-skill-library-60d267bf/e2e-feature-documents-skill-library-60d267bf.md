# E2E: Documents Skill Library

## User Story

As a workspace user, I can create a pack with two skills, fork it into my user-local
library, edit a skill in real-time with a collaborator, publish a pack version,
reference that skill in a workflow, and export a self-contained `.nexus` archive
that resolves skill content offline.

## Test Steps (playwright-cli)

1. Open app at `http://localhost:3000` (screenshot: `01-app-initial.png`).
2. Open Documents panel from header toolbar by clicking the **Library** button (screenshot: `02-empty-workspace-library.png`).
3. Click **+ New** in the workspace pack list, enter `customer-support` as the pack key and `Customer Support` as the name, click **Create** (screenshot: `03-pack-detail-empty.png`).
4. In the file tree, click **+ add** under `SKILL.md` and create `support-triage/SKILL.md` (screenshot: `04-skill-doc-created.png`).
5. Select the new SKILL.md, edit it to contain:
   ```markdown
   ---
   name: support-triage
   description: Classifies support requests.
   ---
   # Support Triage

   Initial instructions.
   ```
   Click **Save snapshot** (screenshot: `05-version-history.png`).
6. Add `references/escalation-policy.md` via the file tree's References section (screenshot: `06-file-tree-two-docs.png`).
7. Click **+ New skill**, fill in `support-triage` for the key, `Support Triage` for the name, `Classifies support requests.` for description, select the SKILL.md as the entrypoint, click **Create skill**.
8. In the right column, enter `1.0.0` as the version and click **Publish version** (screenshot: `07-publish-success.png`).
9. Hover over the pack in the Workspace tab and click the **fork** icon to fork into the user-local library. Switch to the **User-local** tab — the pack appears with a "forked" badge (screenshot: `08-fork-badge.png`).
10. Switch back to the **Workspace** tab, select `customer-support`, edit `SKILL.md` to append `\n\nAdded v1.1 guidance.`, click **Save snapshot**, then publish version `1.1.0`.
11. Switch to the **User-local** tab, select the forked pack, click **Merge latest base** in the branch status panel — expect a clean merge toast and the appended text in the SKILL.md preview (screenshot: `09-merge-clean.png`).
12. Open a workflow, place a Skill node, in its properties open **Library Reference → Link to library skill**. Select `workspace / customer-support / support-triage @ 1.1.0` in the picker. The Skill node now displays a pack badge (screenshot: `10-skill-node-badge.png`).
13. Open **Generate / Export** dialog, click **Download .nexus archive**, capture the download (screenshot: `11-nexus-archive-download.png`).
14. Open the **Import** dialog in a fresh workspace (or via clearing the data dir), upload the `.nexus`, and confirm the skill resolves with the saved content (screenshot: `12-resolve-after-import.png`).

## Success Criteria

- Pack `customer-support` and skill `support-triage` appear with the exact names above.
- Published versions list contains both `1.0.0` and `1.1.0`.
- Forked pack shows `forked` and `behind base` before merge, becomes in-sync after merge.
- Workflow Skill node displays the pack badge `workspace/customer-support@1.1.0`.
- Exported `.nexus` archive contains:
  - `manifest.json`
  - `workflow.json`
  - `libraries/workspace/packs/customer-support/skills/support-triage/SKILL.md`
  - `hashes.json`
  - `runtime/resolver-metadata.json`
- Re-importing the archive reproduces the SKILL.md content byte-for-byte (every entry in `hashes.json` matches the imported file's SHA-256).

## Screenshot Capture Points

Capture screenshots at each numbered step above. Save under `screenshots/feature-documents-skill-library-60d267bf/`.
