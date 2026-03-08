"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  Activity,
  Bot,
  ChevronRight,
  Clock3,
  Eraser,
  GitBranch,
  Layers3,
  Play,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import type { WorkflowJSON, WorkflowNodeData } from "@/types/workflow";
import { useWorkflowStore } from "@/store/workflow-store";
import { demoWorkflow } from "@/lib/demo-workflow";
import {
  createWorkflowRunRecord,
  formatRunClock,
  formatRunDuration,
  getNodeStatusMap,
  type RunNodeStatus,
  type WorkflowRunRecord,
  type WorkflowRunStep,
} from "@/lib/workflow-runner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const HISTORY_STORAGE_KEY = "nexus-workflow-studio:run-history";
const PLAYBACK_INTERVAL_MS = 700;

interface StudioPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface StudioNodeData extends Record<string, unknown> {
  label: string;
  type: WorkflowNodeData["type"];
  status: RunNodeStatus;
  isActive: boolean;
}

function nodeTypeLabel(type: WorkflowNodeData["type"]): string {
  return type.replace(/-/g, " ");
}

function nodeDetailRows(nodeData: WorkflowNodeData): Array<{ label: string; value: string }> {
  switch (nodeData.type) {
    case "prompt":
      return [
        { label: "Prompt", value: nodeData.promptText || "No prompt configured" },
        { label: "Variables", value: nodeData.detectedVariables.length ? nodeData.detectedVariables.join(", ") : "None" },
      ];
    case "agent":
      return [
        { label: "Description", value: nodeData.description || "No description configured" },
        { label: "Model", value: nodeData.model },
        { label: "Memory", value: nodeData.memory },
        { label: "Temperature", value: String(nodeData.temperature) },
      ];
    case "switch":
      return [
        { label: "Evaluation Target", value: nodeData.evaluationTarget || "Not set" },
        { label: "Branches", value: nodeData.branches.map((branch) => `${branch.label}: ${branch.condition}`).join(" | ") || "None" },
      ];
    case "if-else":
      return [
        { label: "Evaluation Target", value: nodeData.evaluationTarget || "Not set" },
        { label: "Branches", value: nodeData.branches.map((branch) => `${branch.label}: ${branch.condition}`).join(" | ") || "None" },
      ];
    case "ask-user":
      return [
        { label: "Question", value: nodeData.questionText || "No question configured" },
        { label: "Options", value: nodeData.options.map((option) => option.label).join(", ") || "None" },
      ];
    case "sub-workflow":
      return [
        { label: "Mode", value: nodeData.mode },
        { label: "Nested Nodes", value: String(nodeData.nodeCount) },
        { label: "Description", value: nodeData.description || "No description configured" },
      ];
    case "mcp-tool":
      return [
        { label: "Tool", value: nodeData.toolName || "No tool configured" },
        { label: "Params", value: nodeData.paramsText || "No parameters configured" },
      ];
    case "document":
      return [
        { label: "Document", value: nodeData.docName || "Untitled document" },
        { label: "Mode", value: nodeData.contentMode },
        { label: "Extension", value: nodeData.fileExtension },
      ];
    case "skill":
      return [
        { label: "Skill", value: nodeData.skillName || "No skill configured" },
        { label: "Project", value: nodeData.projectName || "No project configured" },
        { label: "Description", value: nodeData.description || "No description configured" },
      ];
    case "start":
      return [{ label: "Behavior", value: "Entry point for workflow execution." }];
    case "end":
      return [{ label: "Behavior", value: "Terminal node that completes the workflow." }];
    default:
      return [];
  }
}

function statusTone(status: RunNodeStatus) {
  switch (status) {
    case "running":
      return "border-amber-400 bg-amber-500/15 shadow-[0_0_0_1px_rgba(251,191,36,0.4)]";
    case "success":
      return "border-emerald-500 bg-emerald-500/10";
    case "skipped":
      return "border-zinc-700 bg-zinc-900/80";
    default:
      return "border-zinc-800 bg-zinc-950/80";
  }
}

function StudioNode({ data }: NodeProps<Node<StudioNodeData>>) {
  return (
    <div
      className={cn(
        "min-w-[220px] rounded-xl border px-4 py-3 text-left transition-colors",
        statusTone(data.status),
        data.isActive && "ring-2 ring-sky-400/40",
      )}
      data-testid={`studio-node-${data.label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-zinc-100">{data.label}</div>
        <Badge variant="outline" className="border-zinc-700 text-[10px] uppercase tracking-[0.18em] text-zinc-300">
          {nodeTypeLabel(data.type)}
        </Badge>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
        <span className={cn("inline-block h-2.5 w-2.5 rounded-full", data.status === "running" ? "bg-amber-400" : data.status === "success" ? "bg-emerald-400" : "bg-zinc-600")} />
        {data.status}
      </div>
    </div>
  );
}

function buildGraph(
  workflow: WorkflowJSON,
  statuses: Record<string, RunNodeStatus>,
  selectedNodeId: string | null,
): { nodes: Array<Node<StudioNodeData>>; edges: Edge[] } {
  return {
    nodes: workflow.nodes.map((node) => ({
      id: node.id,
      type: "studio",
      position: node.position,
      data: {
        label: node.data.label,
        type: node.data.type,
        status: statuses[node.id] ?? "idle",
        isActive: selectedNodeId === node.id,
      },
      draggable: false,
      selectable: true,
    })),
    edges: workflow.edges.map((edge) => {
      const sourceStatus = statuses[edge.source];
      const targetStatus = statuses[edge.target];
      const isHot = sourceStatus === "success" && (targetStatus === "success" || targetStatus === "running");
      return {
        ...edge,
        markerEnd: { type: MarkerType.ArrowClosed, color: isHot ? "#22c55e" : "#52525b" },
        animated: targetStatus === "running",
        style: { stroke: isHot ? "#22c55e" : "#52525b", strokeWidth: isHot ? 3 : 2 },
      };
    }),
  };
}

function findStepForNode(steps: WorkflowRunStep[], nodeId: string): WorkflowRunStep | null {
  return steps.find((step) => step.nodeId === nodeId) ?? null;
}

function parseHistory(): WorkflowRunRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WorkflowRunRecord[]) : [];
  } catch {
    return [];
  }
}

function StudioCanvas({
  workflow,
  statuses,
  selectedNodeId,
  onSelectNode,
}: {
  workflow: WorkflowJSON;
  statuses: Record<string, RunNodeStatus>;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}) {
  const { nodes, edges } = useMemo(() => buildGraph(workflow, statuses, selectedNodeId), [workflow, statuses, selectedNodeId]);
  return (
    <ReactFlowProvider>
      <div className="h-full w-full rounded-2xl border border-zinc-800 bg-zinc-950">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          minZoom={0.2}
          maxZoom={1.2}
          nodeTypes={{ studio: StudioNode }}
          onNodeClick={(_, node) => onSelectNode(node.id)}
          nodesDraggable={false}
          elementsSelectable
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} color="#2a2a32" gap={18} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  );
}

export default function StudioPanel({ open, onOpenChange }: StudioPanelProps) {
  const loadWorkflow = useWorkflowStore((s) => s.loadWorkflow);
  const name = useWorkflowStore((s) => s.name);
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const sidebarOpen = useWorkflowStore((s) => s.sidebarOpen);
  const minimapVisible = useWorkflowStore((s) => s.minimapVisible);
  const viewport = useWorkflowStore((s) => s.viewport);
  const canvasMode = useWorkflowStore((s) => s.canvasMode);
  const edgeStyle = useWorkflowStore((s) => s.edgeStyle);
  const [history, setHistory] = useState<WorkflowRunRecord[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [playbackIndex, setPlaybackIndex] = useState(-1);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [graphStack, setGraphStack] = useState<WorkflowJSON[]>([]);
  const intervalRef = useRef<number | null>(null);
  const workflow = useMemo<WorkflowJSON>(() => ({
    name,
    nodes,
    edges,
    ui: {
      sidebarOpen,
      minimapVisible,
      viewport,
      canvasMode,
      edgeStyle,
    },
  }), [name, nodes, edges, sidebarOpen, minimapVisible, viewport, canvasMode, edgeStyle]);

  useEffect(() => {
    setHistory(parseHistory());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 12)));
  }, [history]);

  useEffect(() => {
    if (open) {
      setGraphStack([workflow]);
      setSelectedNodeId(workflow.nodes[0]?.id ?? null);
    }
  }, [open, workflow]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, []);

  const activeRun = useMemo(
    () => history.find((run) => run.id === activeRunId) ?? null,
    [activeRunId, history],
  );

  const currentGraph = graphStack[graphStack.length - 1] ?? workflow;
  const statuses = useMemo(
    () => getNodeStatusMap(activeRun?.steps ?? [], playbackIndex),
    [activeRun?.steps, playbackIndex],
  );
  const defaultSelectedStep = activeRun?.steps[Math.max(playbackIndex, 0)] ?? null;
  const selectedStep =
    (selectedStepId && activeRun?.steps.find((step) => step.id === selectedStepId)) ||
    (selectedNodeId && activeRun ? findStepForNode(activeRun.steps, selectedNodeId) : null) ||
    defaultSelectedStep;

  const selectedNodeMeta = currentGraph.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedRootNodeMeta = workflow.nodes.find((node) => node.id === selectedNodeId)
    ?? currentGraph.nodes.find((node) => node.id === selectedNodeId)
    ?? null;
  const isPlaying = activeRun !== null && playbackIndex < activeRun.steps.length - 1;

  const selectRun = (run: WorkflowRunRecord, newPlaybackIndex = run.steps.length - 1) => {
    setActiveRunId(run.id);
    setPlaybackIndex(newPlaybackIndex);
    const nextStep = run.steps[Math.max(newPlaybackIndex, 0)] ?? run.steps[0] ?? null;
    setSelectedNodeId(nextStep?.nodeId ?? workflow.nodes[0]?.id ?? null);
    setSelectedStepId(nextStep?.id ?? null);
    setGraphStack([workflow]);
  };

  const startPlayback = (run: WorkflowRunRecord) => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    selectRun(run, -1);
    intervalRef.current = window.setInterval(() => {
      setPlaybackIndex((current) => {
        const nextIndex = current + 1;
        const nextStep = run.steps[nextIndex];
        if (nextStep) {
          setSelectedNodeId(nextStep.nodeId);
          setSelectedStepId(nextStep.id);
        }
        if (nextIndex >= run.steps.length - 1) {
          if (intervalRef.current) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
        return nextIndex;
      });
    }, PLAYBACK_INTERVAL_MS);
  };

  const handleRun = () => {
    const run = createWorkflowRunRecord(workflow);
    setHistory((current) => [run, ...current.filter((entry) => entry.id !== run.id)].slice(0, 12));
    startPlayback(run);
  };

  const handleLoadDemo = () => {
    loadWorkflow(demoWorkflow);
    setGraphStack([demoWorkflow]);
    setSelectedNodeId("start-default");
    setSelectedStepId(null);
  };

  const showNestedGraph = () => {
    if (!selectedStep?.nestedWorkflow) return;
    setGraphStack((current) => [...current, selectedStep.nestedWorkflow!]);
    const nestedStart = selectedStep.nestedWorkflow.nodes.find((node) => node.data.type === "start");
    setSelectedNodeId(nestedStart?.id ?? selectedStep.nestedWorkflow.nodes[0]?.id ?? null);
  };

  const handleNodeSelect = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    const step = activeRun ? findStepForNode(activeRun.steps, nodeId) : null;
    setSelectedStepId(step?.id ?? null);
  };

  const clearHistory = () => {
    setHistory([]);
    setActiveRunId(null);
    setPlaybackIndex(-1);
    setSelectedStepId(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(HISTORY_STORAGE_KEY);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70" onClick={() => onOpenChange(false)} />
      <div className="fixed inset-3 z-50 flex flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-6 py-4">
          <div>
            <div className="flex items-center gap-2 text-xl font-semibold">
              <Sparkles className="h-5 w-5 text-sky-400" />
              Run Studio
            </div>
            <p className="mt-1 max-w-xl text-sm text-zinc-400">
              Local workflow execution playback modeled after the Mastra Studio graph experience.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="border-zinc-700 bg-zinc-900 text-zinc-100" onClick={handleLoadDemo} data-testid="studio-load-demo-button">
              <Layers3 className="mr-2 h-4 w-4" />
              Load Demo
            </Button>
            <Button className="bg-sky-600 text-white hover:bg-sky-500" onClick={handleRun} data-testid="run-workflow-button">
              <Play className="mr-2 h-4 w-4" />
              Run Workflow
            </Button>
            <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_260px] xl:grid-cols-[minmax(0,1fr)_360px] xl:grid-rows-1">
          <section className="grid min-h-0 grid-rows-[minmax(0,1fr)_220px] xl:border-r xl:border-zinc-800">
            <section className="flex min-w-0 flex-col bg-zinc-950" data-testid="studio-graph-panel">
              <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    {graphStack.map((item, index) => (
                      <button
                        key={`${item.name}-${index}`}
                        type="button"
                        onClick={() => setGraphStack(graphStack.slice(0, index + 1))}
                        className="inline-flex items-center gap-2 text-sm text-zinc-300 hover:text-white"
                      >
                        {index > 0 && <ChevronRight className="h-4 w-4 text-zinc-600" />}
                        <span>{item.name}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {isPlaying ? "Streaming run progress" : activeRun ? "Completed run playback" : "Idle graph"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-zinc-700 text-zinc-300">
                    <Activity className="mr-1 h-3.5 w-3.5" />
                    {activeRun ? activeRun.status : "idle"}
                  </Badge>
                  {activeRun && (
                    <Badge variant="outline" className="border-zinc-700 text-zinc-300">
                      {Math.max(playbackIndex + 1, 0)}/{activeRun.steps.length}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="min-h-0 flex-1 p-5">
                <StudioCanvas workflow={currentGraph} statuses={statuses} selectedNodeId={selectedNodeId} onSelectNode={handleNodeSelect} />
              </div>
            </section>

            <section className="border-t border-zinc-800 bg-zinc-950">
              <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold">Runs</div>
                  <div className="text-xs text-zinc-500">{workflow.name}</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-zinc-400 hover:text-white"
                  onClick={clearHistory}
                  data-testid="clear-history-button"
                >
                  <Eraser className="mr-1 h-4 w-4" />
                  Clear
                </Button>
              </div>
              <ScrollArea className="h-[calc(220px-57px)]">
                <div className="flex gap-3 p-3">
                  {history.length === 0 && (
                    <div className="rounded-xl border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">
                      No runs recorded yet. Load the demo workflow or run the current canvas.
                    </div>
                  )}
                  {history.map((run) => (
                    <button
                      key={run.id}
                      type="button"
                      onClick={() => selectRun(run)}
                      className={cn(
                        "min-w-[250px] rounded-xl border p-3 text-left transition-colors",
                        activeRunId === run.id ? "border-sky-500/60 bg-sky-500/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-700",
                      )}
                      data-testid={`run-history-${run.id}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{run.workflowName}</span>
                        <Badge className="bg-emerald-600/20 text-emerald-300">{run.status}</Badge>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                        <Clock3 className="h-3.5 w-3.5" />
                        {formatRunClock(run.startedAt)}
                        <span className="text-zinc-600">•</span>
                        {formatRunDuration(run.durationMs)}
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                        <span>
                          {run.topLevelStepCount} graph nodes
                          {run.nestedStepCount > 0 ? ` + ${run.nestedStepCount} nested` : ""}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <RefreshCw className="h-3.5 w-3.5" />
                          Replay
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </section>
          </section>

          <aside className="min-h-0 border-t border-zinc-800 bg-zinc-950 xl:border-t-0 xl:border-l xl:border-zinc-800">
            <Tabs defaultValue="details" className="h-full gap-0">
              <div className="border-b border-zinc-800 px-4 py-3">
                <TabsList variant="line" className="bg-transparent p-0">
                  <TabsTrigger value="details" className="text-zinc-300 data-[state=active]:text-white">
                    Step Detail
                  </TabsTrigger>
                  <TabsTrigger value="timeline" className="text-zinc-300 data-[state=active]:text-white">
                    Timeline
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="details" className="min-h-0">
                <ScrollArea className="h-[calc(260px-57px)] xl:h-[calc(100%-57px)]">
                  <div className="space-y-4 p-4">
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4" data-testid="studio-step-detail">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-zinc-500">
                        <Bot className="h-3.5 w-3.5" />
                        {selectedStep ? "Selected Step" : "Selected Node"}
                      </div>
                      <div className="mt-3 text-lg font-semibold text-white">
                        {selectedStep?.label ?? selectedNodeMeta?.data.label ?? "Nothing selected"}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="outline" className="border-zinc-700 text-zinc-300">
                          {selectedStep ? nodeTypeLabel(selectedStep.type) : selectedNodeMeta ? nodeTypeLabel(selectedNodeMeta.data.type) : "workflow"}
                        </Badge>
                        {selectedStep && (
                          <Badge className={cn(
                            selectedStep.nodeId === activeRun?.steps[playbackIndex]?.nodeId ? "bg-amber-500/20 text-amber-200" : "bg-emerald-500/20 text-emerald-200",
                          )}>
                            {selectedStep.nodeId === activeRun?.steps[playbackIndex]?.nodeId ? "running" : "completed"}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-4 text-sm leading-6 text-zinc-300">
                        {selectedStep?.summary ?? "Select a node on the graph or run the workflow to inspect execution details."}
                      </p>
                      {!selectedStep && selectedRootNodeMeta && (
                        <p className="mt-4 text-sm leading-6 text-zinc-300">
                          {selectedRootNodeMeta.data.label} is a {nodeTypeLabel(selectedRootNodeMeta.data.type)} node.
                        </p>
                      )}
                      {selectedStep && (
                        <div className="mt-4 grid gap-3 text-sm text-zinc-400">
                          <div className="flex items-center justify-between">
                            <span>Started</span>
                            <span>{formatRunClock(selectedStep.startedAt)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Duration</span>
                            <span>{formatRunDuration(selectedStep.durationMs)}</span>
                          </div>
                          {selectedStep.branchLabel && (
                            <div className="flex items-center justify-between">
                              <span>Branch</span>
                              <span className="capitalize">{selectedStep.branchLabel}</span>
                            </div>
                          )}
                        </div>
                      )}
                      {selectedRootNodeMeta && (
                        <div className="mt-5 space-y-3 border-t border-zinc-800 pt-4">
                          <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Node Configuration</div>
                          {nodeDetailRows(selectedRootNodeMeta.data).map((row) => (
                            <div key={row.label} className="grid gap-1">
                              <div className="text-xs text-zinc-500">{row.label}</div>
                              <div className="text-sm text-zinc-200 break-words">{row.value}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {selectedStep?.nestedWorkflow && (
                        <Button
                          variant="outline"
                          className="mt-4 w-full border-zinc-700 bg-zinc-950 text-zinc-100"
                          onClick={showNestedGraph}
                          data-testid="view-nested-graph-button"
                        >
                          <GitBranch className="mr-2 h-4 w-4" />
                          View Nested Graph
                        </Button>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="timeline" className="min-h-0">
                <ScrollArea className="h-[calc(260px-57px)] xl:h-[calc(100%-57px)]">
                  <div className="space-y-3 p-4" data-testid="studio-timeline">
                    {(activeRun?.steps ?? []).map((step, index) => (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => {
                          setSelectedStepId(step.id);
                          setSelectedNodeId(step.nodeId);
                        }}
                        className={cn(
                          "w-full rounded-xl border p-3 text-left",
                          selectedStep?.id === step.id ? "border-sky-500/60 bg-sky-500/10" : "border-zinc-800 bg-zinc-900",
                        )}
                        data-testid={`timeline-step-${step.nodeId}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium text-white">{step.label}</div>
                          <Badge className={cn(
                            index === playbackIndex ? "bg-amber-500/20 text-amber-200" : index < playbackIndex ? "bg-emerald-500/20 text-emerald-200" : "bg-zinc-800 text-zinc-400",
                          )}>
                            {index === playbackIndex ? "running" : index < playbackIndex ? "done" : "pending"}
                          </Badge>
                        </div>
                        <div className="mt-2 text-xs text-zinc-500">
                          {formatRunClock(step.startedAt)} • {nodeTypeLabel(step.type)}
                        </div>
                        <p className="mt-2 text-sm text-zinc-300">{step.summary}</p>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </aside>
        </div>
      </div>
    </>
  );
}
