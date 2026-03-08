import type { WorkflowJSON, WorkflowNode, WorkflowEdge, WorkflowNodeData } from "@/types/workflow";
import { SubAgentMemory, SubAgentModel } from "@/types/workflow";

function edge(
  id: string,
  source: string,
  target: string,
  sourceHandle = "output",
  targetHandle = "input",
): WorkflowEdge {
  return { id, source, target, sourceHandle, targetHandle, type: "deletable" };
}

function node<T extends WorkflowNodeData>(
  id: string,
  type: WorkflowNode["type"],
  position: WorkflowNode["position"],
  data: T,
): WorkflowNode {
  return { id, type, position, data };
}

const subNodes: WorkflowNode[] = [
  node("sub-start", "start", { x: 80, y: 180 }, { type: "start", label: "Start", name: "sub-start" }),
  node("sub-prompt", "prompt", { x: 320, y: 180 }, {
    type: "prompt",
    label: "Summarize Incident",
    name: "sub-prompt",
    promptText: "Summarize the customer incident and capture key risks.",
    detectedVariables: ["ticketId", "severity"],
  }),
  node("sub-end", "end", { x: 600, y: 180 }, { type: "end", label: "Complete", name: "sub-end" }),
];

const subEdges: WorkflowEdge[] = [
  edge("sub-edge-1", "sub-start", "sub-prompt"),
  edge("sub-edge-2", "sub-prompt", "sub-end"),
];

export const demoWorkflow: WorkflowJSON = {
  name: "Incident Triage Demo",
  nodes: [
    node("start-default", "start", { x: 80, y: 240 }, { type: "start", label: "Start", name: "start-default" }),
    node("prompt-intake", "prompt", { x: 320, y: 240 }, {
      type: "prompt",
      label: "Collect Context",
      name: "prompt-intake",
      promptText: "Gather the latest ticket summary, logs, and current severity.",
      detectedVariables: ["ticketId", "customerName"],
    }),
    node("switch-severity", "switch", { x: 620, y: 240 }, {
      type: "switch",
      label: "Assess Severity",
      name: "switch-severity",
      evaluationTarget: "{{severity}}",
      branches: [
        { label: "critical", condition: 'value === "critical"' },
        { label: "standard", condition: 'value !== "critical"' },
      ],
    }),
    node("agent-escalation", "agent", { x: 940, y: 100 }, {
      type: "agent",
      label: "Escalation Agent",
      name: "agent-escalation",
      description: "Draft escalation notes and page the on-call owner.",
      promptText: "Create an escalation plan with owner, ETA, and mitigation.",
      detectedVariables: ["ticketId", "severity"],
      model: SubAgentModel.GPT5Mini,
      memory: SubAgentMemory.Default,
      temperature: 0.2,
      color: "#22c55e",
      disabledTools: [],
      parameterMappings: [],
      variableMappings: {},
    }),
    node("ask-user-approval", "ask-user", { x: 940, y: 380 }, {
      type: "ask-user",
      label: "Request Approval",
      name: "ask-user-approval",
      questionText: "Should we notify the customer before mitigation starts?",
      multipleSelection: false,
      aiSuggestOptions: false,
      options: [
        { label: "Notify now", description: "Send a customer-facing incident update immediately." },
        { label: "Hold update", description: "Wait until the mitigation owner confirms the timeline." },
      ],
    }),
    node("sub-workflow-summary", "sub-workflow", { x: 1260, y: 240 }, {
      type: "sub-workflow",
      label: "Compose Summary",
      name: "sub-workflow-summary",
      mode: "same-context",
      subNodes,
      subEdges,
      nodeCount: subNodes.length,
      description: "Generate the final ops summary in a nested workflow.",
      model: SubAgentModel.Inherit,
      memory: SubAgentMemory.Default,
      temperature: 0,
      color: "#a855f7",
      disabledTools: [],
    }),
    node("end-default", "end", { x: 1560, y: 240 }, { type: "end", label: "Done", name: "end-default" }),
  ],
  edges: [
    edge("edge-1", "start-default", "prompt-intake"),
    edge("edge-2", "prompt-intake", "switch-severity"),
    edge("edge-3", "switch-severity", "agent-escalation", "branch-critical"),
    edge("edge-4", "switch-severity", "ask-user-approval", "branch-standard"),
    edge("edge-5", "agent-escalation", "sub-workflow-summary"),
    edge("edge-6", "ask-user-approval", "sub-workflow-summary"),
    edge("edge-7", "sub-workflow-summary", "end-default"),
  ],
  ui: {
    sidebarOpen: true,
    minimapVisible: true,
    viewport: { x: 0, y: 0, zoom: 0.8 },
    canvasMode: "hand",
    edgeStyle: "bezier",
  },
};
