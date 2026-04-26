# E2E Specification — AI Side-Kick ACP UX

## User Story

Validate that a workflow author can open the persistent AI side-kick, ask it to inspect the canvas, apply Nexus workflow actions, approve or deny destructive actions, and respond to forwarded ACP permission requests without leaving the editor.

## Test Steps

> Browser driving is reserved for the E2E pipeline and should use `playwright-cli` there only.

1. Open the side-kick via the header button and capture screenshot `sidekick-open-empty`.
2. Send `What can you tell me about this canvas?` and assert an assistant text response appears with no Nexus action card.
3. Send `Add a Prompt node named Draft Prompt and connect it after Start` using a mocked/deterministic bridge response, then assert an `addNode` card is `done`, a `connectNodes` card is `done`, and the canvas contains `Draft Prompt`; capture `sidekick-action-success`.
4. Select the created node and send `Delete this node`, assert a destructive action card appears with `Allow once`, `Allow always`, and `Deny`; capture `sidekick-approval-card`.
5. Click `Deny`, assert the node remains and the card status is `denied`.
6. Repeat delete, click `Allow once`, assert the node is removed and status is `done`.
7. Trigger a mocked forwarded ACP permission request, assert the permission card displays option buttons, choose `allow_once`, and assert it becomes resolved; capture `sidekick-permission-resolved`.
8. Click `New conversation`, assert message history clears and side-kick remains open; capture `sidekick-new-conversation`.

## Success Criteria

- Side-kick opens from the header and remains anchored in the bottom-right editor area.
- Text-only assistant responses render as assistant messages with no action cards.
- Nexus action cards show action names, arguments, and terminal `done` or `error` state.
- Destructive actions show exactly `Allow once`, `Allow always`, and `Deny` while awaiting approval.
- Denying a destructive action leaves the target node on the canvas and marks the card `denied`.
- Allowing once removes the target node and marks the card `done`.
- Forwarded ACP permission cards show option buttons and transition to resolved after choosing an option.
- New conversation clears visible message history, resets approvals, and keeps the panel open.

## Screenshot Capture Points

- `sidekick-open-empty`
- `sidekick-action-success`
- `sidekick-approval-card`
- `sidekick-permission-resolved`
- `sidekick-new-conversation`
