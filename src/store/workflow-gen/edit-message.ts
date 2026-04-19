// ─── Edit-Mode User Message Builder ──────────────────────────────────────────
// Constructs the user message sent to the LLM in Edit mode. Embeds the current
// workflow JSON and the user's change request while preserving the
// preservation-guarantee language that mirrors the system prompt.

import type { WorkflowJSON } from "@/types/workflow";

/**
 * Build the user message for Edit mode.
 *
 * Shape:
 *   Output a WorkflowJSON object for this workflow. ...
 *
 *   Editing an existing workflow. Preserve IDs, positions, ...
 *
 *   Current workflow:
 *   ```json
 *   { ... }
 *   ```
 *
 *   Edit request: <userPrompt>
 */
export function buildEditUserMessage(current: WorkflowJSON, userPrompt: string): string {
  const serialized = JSON.stringify(current, null, 2);
  return `Output a WorkflowJSON object for this workflow. Do NOT plan, do NOT explain, do NOT use tools. Start your response with { immediately.

Editing an existing workflow. Preserve IDs, positions, and data fields of nodes and edges that the user did NOT explicitly ask to change. Only modify what is required by the edit request. Return the COMPLETE updated WorkflowJSON (not a diff).

Current workflow:
\`\`\`json
${serialized}
\`\`\`

Edit request: ${userPrompt}`;
}
