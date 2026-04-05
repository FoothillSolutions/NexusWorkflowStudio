import { useCallback } from "react";
import Dagre from "@dagrejs/dagre";
import { useReactFlow } from "@xyflow/react";
import {
  AGENT_LIKE_NODE_TYPES,
  ATTACHMENT_NODE_TYPES,
  WorkflowNodeType,
  type NodeType,
  type WorkflowNode,
  type WorkflowEdge,
} from "@/types/workflow";
import { NODE_REGISTRY } from "@/lib/node-registry";
import { NodeSize, NODE_SIZE_DIMENSIONS } from "@/nodes/shared/node-size";
import { findSwitchBranchIndexByHandle } from "@/nodes/switch/branches";

const LAYOUT_DURATION = 400;

interface AutoLayoutOptions {
  getNodes: () => WorkflowNode[];
  getEdges: () => WorkflowEdge[];
  setNodes: (updater: (prev: WorkflowNode[]) => WorkflowNode[]) => void;
  onComplete?: (nodes: WorkflowNode[]) => void;
}

// Branch handle ordering
// If-else handles: "true" (first/top) → "false" (second/bottom)
const IF_ELSE_HANDLE_ORDER: Record<string, number> = { true: 0, false: 1 };

/** Minimum vertical distance (px) between branch target nodes. */
const MIN_BRANCH_GAP = 300;

/**
 * After Dagre computes positions, reorder branch targets so that:
 *   - if-else:  "true" target is ABOVE (smaller y) "false" target
 *   - switch:   branch targets are stacked top-to-bottom in branch order
 *   - parallel-agent: branch targets are stacked top-to-bottom in branch order
 *   - ask-user: option targets are stacked top-to-bottom in option order
 *
 * Also enforces a minimum vertical gap between branch targets and centres
 * them around the branching node so the edges fan out cleanly.
 *
 * Dagre doesn't know about sourceHandles so it places branch targets
 * in an arbitrary vertical order. This pass fixes that and adjusts
 * the positions of their entire downstream subtrees.
 */
function fixBranchOrdering(
  positions: Record<string, { x: number; y: number }>,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
) {
  const nodeDataMap = new Map<string, Record<string, unknown>>();
  for (const n of nodes) {
    nodeDataMap.set(n.id, n.data as Record<string, unknown>);
  }

  // Build outgoing-edge map grouped by source
  const outgoing = new Map<string, WorkflowEdge[]>();
  for (const e of edges) {
    if (!outgoing.has(e.source)) outgoing.set(e.source, []);
    outgoing.get(e.source)!.push(e);
  }

  for (const node of nodes) {
    const d = nodeDataMap.get(node.id);
    if (!d) continue;
    const nodeType = d.type as NodeType;

    const branchEdges = outgoing.get(node.id);
    if (!branchEdges || branchEdges.length < 2) continue;

    let orderedTargetIds: string[] | null = null;

    if (nodeType === WorkflowNodeType.IfElse) {
      // Sort edges by handle order: "true" first, "false" second
      const sorted = [...branchEdges]
        .filter((e) => e.sourceHandle === "true" || e.sourceHandle === "false")
        .sort((a, b) => (IF_ELSE_HANDLE_ORDER[a.sourceHandle ?? ""] ?? 99) - (IF_ELSE_HANDLE_ORDER[b.sourceHandle ?? ""] ?? 99));
      if (sorted.length >= 2) {
        orderedTargetIds = sorted.map((e) => e.target);
      }
    } else if (nodeType === WorkflowNodeType.Switch) {
      const branches = d.branches as import("@/types/workflow").SwitchBranch[] | undefined;
      if (branches && branches.length >= 2) {
        const ordered: string[] = [];
        const indexedTargets = new Map<number, string>();

        for (const edge of branchEdges) {
          const branchIndex = findSwitchBranchIndexByHandle(branches, edge.sourceHandle);
          if (branchIndex !== -1 && !indexedTargets.has(branchIndex)) {
            indexedTargets.set(branchIndex, edge.target);
          }
        }

        for (let index = 0; index < branches.length; index++) {
          const target = indexedTargets.get(index);
          if (target) ordered.push(target);
        }

        if (ordered.length >= 2) orderedTargetIds = ordered;
      }
    } else if (nodeType === WorkflowNodeType.ParallelAgent) {
      const branches = d.branches as Array<{ label: string }> | undefined;
      if (branches && branches.length >= 2) {
        const ordered: string[] = [];
        for (let index = 0; index < branches.length; index++) {
          const target = branchEdges.find((e) => e.sourceHandle === `branch-${index}`)?.target;
          if (target) ordered.push(target);
        }
        if (ordered.length >= 2) orderedTargetIds = ordered;
      }
    } else if (nodeType === WorkflowNodeType.AskUser) {
      // Single-select mode (not multi-select, not AI-suggested): each option
      // has its own handle "option-0", "option-1", etc.
      const multiSelect = d.multipleSelection as boolean | undefined;
      const aiSuggest = d.aiSuggestOptions as boolean | undefined;
      if (!multiSelect && !aiSuggest) {
        // Sort edges by option index extracted from "option-N" handles
        const optionEdges = branchEdges.filter((e) => e.sourceHandle?.startsWith("option-"));
        if (optionEdges.length >= 2) {
          const sorted = [...optionEdges].sort((a, b) => {
            const idxA = parseInt(a.sourceHandle?.replace("option-", "") ?? "99", 10);
            const idxB = parseInt(b.sourceHandle?.replace("option-", "") ?? "99", 10);
            return idxA - idxB;
          });
          orderedTargetIds = sorted.map((e) => e.target);
        }
      }
    }

    if (!orderedTargetIds) continue;

    // Only process targets that have computed positions
    const validTargetIds = orderedTargetIds.filter((id) => positions[id]);
    if (validTargetIds.length < 2) continue;

    // ── Compute ideal positions centred around the branching node ──
    const branchNodeY = positions[node.id]?.y;
    if (branchNodeY === undefined) continue;

    const count = validTargetIds.length;
    // Total span needed: (count - 1) * gap, centred on branchNodeY
    const totalSpan = (count - 1) * MIN_BRANCH_GAP;
    const topY = branchNodeY - totalSpan / 2;

    // Assign ideal y positions and compute deltas + shift subtrees
    for (let i = 0; i < validTargetIds.length; i++) {
      const targetId = validTargetIds[i];
      const idealY = topY + i * MIN_BRANCH_GAP;
      const oldY = positions[targetId].y;
      const delta = idealY - oldY;

      if (Math.abs(delta) < 1) continue; // already close enough

      // Move the target and its entire downstream subtree
      const subtree = collectSubtree(targetId, outgoing, new Set(validTargetIds));
      for (const id of subtree) {
        if (positions[id]) {
          positions[id] = { x: positions[id].x, y: positions[id].y + delta };
        }
      }
    }
  }
}

/** BFS to collect all downstream nodes from a root, stopping at nodes in the stopSet (other branch roots). */
function collectSubtree(
  rootId: string,
  outgoing: Map<string, WorkflowEdge[]>,
  stopSet: Set<string>,
): Set<string> {
  const visited = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const children = outgoing.get(id);
    if (children) {
      for (const e of children) {
        if (!visited.has(e.target) && !stopSet.has(e.target)) {
          queue.push(e.target);
        }
      }
    }
  }
  return visited;
}

// Attachment layout constants


/** Script nodes wired into a skill are also attachment-like for layout. */
const SCRIPT_ATTACHMENT_HANDLE = "scripts";

/** Horizontal gap (px) between the attachment column and the agent's left edge. */
const ATTACHMENT_X_GAP = 40;

/** Vertical offset (px) below the agent's bottom edge where attachments start. */
const ATTACHMENT_Y_OFFSET = 30;

/** Vertical gap (px) between stacked skill/document nodes. */
const ATTACHMENT_Y_GAP = 60;

/** Vertical gap between stacked script nodes under a skill. */
const SCRIPT_ATTACHMENT_Y_GAP = 40;


export function useAutoLayout({ getNodes, getEdges, setNodes, onComplete }: AutoLayoutOptions) {
  const { fitView } = useReactFlow();

  return useCallback(() => {
    const currentNodes = getNodes();
    const currentEdges = getEdges();
    if (currentNodes.length === 0) return;

    const defaultDim = NODE_SIZE_DIMENSIONS[NodeSize.Medium];
    const scriptDim = NODE_SIZE_DIMENSIONS[NODE_REGISTRY.script.size ?? NodeSize.Large] ?? defaultDim;
    const skillDim = NODE_SIZE_DIMENSIONS[NODE_REGISTRY.skill.size ?? NodeSize.Medium] ?? defaultDim;
    const documentDim = NODE_SIZE_DIMENSIONS[NODE_REGISTRY.document.size ?? NodeSize.Small] ?? defaultDim;

    // ── Discover script nodes attached to skills ──────────
    const scriptAttachmentIds = new Set<string>();
    const skillScriptAttachments = new Map<string, WorkflowNode[]>();
    const claimedScriptAttachments = new Set<string>();

    for (const edge of currentEdges) {
      const sourceNode = currentNodes.find((node) => node.id === edge.source);
      const targetNode = currentNodes.find((node) => node.id === edge.target);
      if (
        edge.targetHandle === SCRIPT_ATTACHMENT_HANDLE
        && sourceNode?.data?.type === WorkflowNodeType.Script
        && targetNode?.data?.type === WorkflowNodeType.Skill
      ) {
        if (claimedScriptAttachments.has(edge.source)) continue;
        claimedScriptAttachments.add(edge.source);
        scriptAttachmentIds.add(edge.source);
        if (!skillScriptAttachments.has(edge.target)) skillScriptAttachments.set(edge.target, []);
        const list = skillScriptAttachments.get(edge.target)!;
        if (!list.some((node) => node.id === edge.source)) list.push(sourceNode);
      }
    }

    // ── Separate attachment (skill/document/script) nodes from flow nodes ────
    const flowNodes: WorkflowNode[] = [];
    const attachmentNodes: WorkflowNode[] = [];
    const nodeDataMap = new Map<string, Record<string, unknown>>();

    for (const node of currentNodes) {
      const d = node.data as Record<string, unknown>;
      nodeDataMap.set(node.id, d);
       if (ATTACHMENT_NODE_TYPES.has(d.type as NodeType) || scriptAttachmentIds.has(node.id)) {
        attachmentNodes.push(node);
      } else {
        flowNodes.push(node);
      }
    }

    // Build map: agent-like node id → list of attachment nodes connected to it
    // Track which attachment nodes have already been claimed by an agent
    // so that if a skill/document is wired to multiple agents only the
    // first one "owns" it for layout purposes.
    const agentAttachments = new Map<string, WorkflowNode[]>();
    const claimedAttachments = new Set<string>();

    for (const edge of currentEdges) {
      const sourceData = nodeDataMap.get(edge.source);
      const targetData = nodeDataMap.get(edge.target);
      if (!sourceData || !targetData) continue;

      const srcType = sourceData.type as NodeType;
      const tgtType = targetData.type as NodeType;

      if (ATTACHMENT_NODE_TYPES.has(srcType) && AGENT_LIKE_NODE_TYPES.has(tgtType)) {
        // Skip if this attachment was already claimed by another agent
        if (claimedAttachments.has(edge.source)) continue;
        claimedAttachments.add(edge.source);

        if (!agentAttachments.has(edge.target)) agentAttachments.set(edge.target, []);
        const list = agentAttachments.get(edge.target)!;
        // Deduplicate — same node shouldn't appear twice for the same agent
        if (!list.some(n => n.id === edge.source)) {
          const attachNode = currentNodes.find(n => n.id === edge.source);
          if (attachNode) list.push(attachNode);
        }
      }
    }

     // ── Filter edges: only include flow edges for Dagre ──────────────
    const flowEdges = currentEdges.filter(edge => {
      const sourceData = nodeDataMap.get(edge.source);
       if ((sourceData && ATTACHMENT_NODE_TYPES.has(sourceData.type as NodeType)) || scriptAttachmentIds.has(edge.source)) return false;
      const targetData = nodeDataMap.get(edge.target);
       return !((targetData && ATTACHMENT_NODE_TYPES.has(targetData.type as NodeType))
         || scriptAttachmentIds.has(edge.target)
         || edge.targetHandle === SCRIPT_ATTACHMENT_HANDLE);
    });

    // ── Run Dagre on flow nodes only ─────────────────────────────────
    const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: "LR", nodesep: 120, ranksep: 250, marginx: 60, marginy: 60 });

    flowNodes.forEach((node) => {
      const entry = NODE_REGISTRY[node.type as NodeType];
      const dim = NODE_SIZE_DIMENSIONS[entry?.size ?? NodeSize.Medium] ?? defaultDim;
      g.setNode(node.id, { width: dim.width, height: dim.height });
    });

    flowEdges.forEach((edge) => {
      if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
        g.setEdge(edge.source, edge.target);
      }
    });
    Dagre.layout(g);

    const targetPositions: Record<string, { x: number; y: number }> = {};
    flowNodes.forEach((node) => {
      const dn = g.node(node.id);
      if (dn) {
        targetPositions[node.id] = {
          x: dn.x - dn.width / 2,
          y: dn.y - dn.height / 2,
        };
      }
    });

    // Fix branch ordering: ensure if-else "true" is above "false",
    // and switch / parallel-agent branches are ordered top-to-bottom by definition order.
    fixBranchOrdering(targetPositions, currentNodes, currentEdges);

    // ── Shift agent-like nodes with attachments to make room behind them ───────
    // Push the node (and everything at the same rank or later) right so
    // the single attachment column doesn't overlap with the previous rank.
    const maxAttachmentWidth = Math.max(skillDim.width, documentDim.width);

    for (const [agentId, attachments] of agentAttachments) {
      if (attachments.length === 0) continue;
      const agentPos = targetPositions[agentId];
      if (!agentPos) continue;

      const hasScriptColumn = attachments.some((attachment) => skillScriptAttachments.has(attachment.id));
      const totalAttachmentWidth = maxAttachmentWidth + ATTACHMENT_X_GAP + (hasScriptColumn ? scriptDim.width + ATTACHMENT_X_GAP : 0);

      // The left-most edge needed to fit all attachment columns.
      const neededLeft = agentPos.x - totalAttachmentWidth;

      // Find the closest flow node to the left of this agent
      let closestLeftEdge = -Infinity;
      for (const node of flowNodes) {
        if (node.id === agentId) continue;
        const pos = targetPositions[node.id];
        if (!pos) continue;
        const entry = NODE_REGISTRY[node.type as NodeType];
        const dim = NODE_SIZE_DIMENSIONS[entry?.size ?? NodeSize.Medium] ?? defaultDim;
        const rightEdge = pos.x + dim.width;
        if (rightEdge <= agentPos.x && rightEdge > closestLeftEdge) {
          closestLeftEdge = rightEdge;
        }
      }

      if (closestLeftEdge > -Infinity) {
        const minGap = 40;
        const overlap = (closestLeftEdge + minGap) - neededLeft;
        if (overlap > 0) {
          const agentX = agentPos.x;
          for (const node of flowNodes) {
            const pos = targetPositions[node.id];
            if (pos && pos.x >= agentX) {
              pos.x += overlap;
            }
          }
        }
      }
    }

    // ── Position attachment nodes behind their parent agent-like node ──────────
    // Attachments sit to the LEFT of the node and BELOW the node's
    // bottom edge (baseline). All stack vertically in a single column:
    // skills first, then documents, each underneath the previous one.
    for (const [agentId, attachments] of agentAttachments) {
      const agentPos = targetPositions[agentId];
      if (!agentPos) continue;

      const agentType = (nodeDataMap.get(agentId)?.type as NodeType | undefined) ?? WorkflowNodeType.Agent;
      const agentEntry = NODE_REGISTRY[agentType];
      const agentDim = NODE_SIZE_DIMENSIONS[agentEntry?.size ?? NodeSize.Large] ?? defaultDim;
      const attachDim = { width: maxAttachmentWidth, height: Math.max(skillDim.height, documentDim.height) };

      // x: single column to the left of the agent
      const attachX = agentPos.x - attachDim.width - ATTACHMENT_X_GAP;

      // y: starts below the agent's bottom edge
      let cursorY = agentPos.y + agentDim.height + ATTACHMENT_Y_OFFSET;

      // Sort: skills first, then documents
      const sorted = [...attachments].sort((a, b) => {
        const aType = (a.data as Record<string, unknown>).type as NodeType;
        const bType = (b.data as Record<string, unknown>).type as NodeType;
        if (aType === bType) return 0;
        return aType === WorkflowNodeType.Skill ? -1 : 1;
      });

      // Stack attachments and any script prompts under the owning skill.
      sorted.forEach((node) => {
        const nodeType = (node.data as Record<string, unknown>).type as NodeType;
        const currentDim = nodeType === WorkflowNodeType.Skill ? skillDim : documentDim;
        const nodePosition = {
          x: attachX,
          y: cursorY,
        };

        targetPositions[node.id] = nodePosition;

        let clusterBottom = nodePosition.y + currentDim.height;

        if (nodeType === WorkflowNodeType.Skill) {
          const scripts = skillScriptAttachments.get(node.id) ?? [];
          if (scripts.length > 0) {
            const scriptX = nodePosition.x - scriptDim.width - ATTACHMENT_X_GAP;
            let scriptCursorY = nodePosition.y + currentDim.height + ATTACHMENT_Y_OFFSET;

            scripts.forEach((scriptNode) => {
              targetPositions[scriptNode.id] = {
                x: scriptX,
                y: scriptCursorY,
              };
              clusterBottom = Math.max(clusterBottom, scriptCursorY + scriptDim.height);
              scriptCursorY += scriptDim.height + SCRIPT_ATTACHMENT_Y_GAP;
            });
          }
        }

        cursorY = clusterBottom + ATTACHMENT_Y_GAP;
      });
    }

    // ── Handle orphan attachment nodes (not connected to any agent) ──
    for (const node of attachmentNodes) {
      if (!targetPositions[node.id]) {
        // Place it near its current position as fallback
        targetPositions[node.id] = { ...node.position };
      }
    }

    const start = performance.now();
    const startPositions: Record<string, { x: number; y: number }> = {};
    currentNodes.forEach((node) => {
      startPositions[node.id] = { ...node.position };
    });

    const animate = (now: number) => {
      const t = Math.min((now - start) / LAYOUT_DURATION, 1);
      const eased = 1 - Math.pow(1 - t, 3);

      setNodes((prev) => {
        const next = prev.map((node) => {
          const from = startPositions[node.id];
          const to = targetPositions[node.id];
          if (!from || !to) return node;
          return {
            ...node,
            position: {
              x: from.x + (to.x - from.x) * eased,
              y: from.y + (to.y - from.y) * eased,
            },
          };
        });
        if (t >= 1) onComplete?.(next);
        return next;
      });

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        setTimeout(() => fitView({ duration: 300, padding: 0.55 }), 50);
      }
    };

    requestAnimationFrame(animate);
  }, [getNodes, getEdges, setNodes, onComplete, fitView]);
}
