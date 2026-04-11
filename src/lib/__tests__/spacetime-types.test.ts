import { describe, expect, it } from "bun:test";
import {
  spacetimeNodeToWorkflowNode,
  spacetimeEdgeToWorkflowEdge,
  workflowNodeToOp,
  workflowEdgeToOp,
  spacetimeToWorkspaceRecord,
  spacetimeToWorkflowRecord,
  spacetimeToBrainDoc,
  brainDocToContentJson,
  spacetimeToChangeEvent,
} from "../spacetime/types";
import type {
  SpacetimeWorkflowNode,
  SpacetimeWorkflowEdge,
  SpacetimeWorkspace,
  SpacetimeWorkflow,
  SpacetimeBrainDoc,
  SpacetimeWorkflowChangeEvent,
} from "../spacetime/types";
import type { WorkflowNode, WorkflowEdge } from "@/types/workflow";

describe("SpacetimeDB type conversions", () => {
  describe("spacetimeNodeToWorkflowNode", () => {
    it("converts a SpacetimeDB node row to a WorkflowNode", () => {
      const row: SpacetimeWorkflowNode = {
        workflowId: "wf-1",
        nodeId: "node-1",
        type: "agent",
        positionJson: '{"x":100,"y":200}',
        dataJson: '{"type":"agent","name":"Test Agent"}',
        updatedAt: "2026-01-01T00:00:00.000Z",
        updatedBy: "user",
      };

      const result = spacetimeNodeToWorkflowNode(row);

      expect(result.id).toBe("node-1");
      expect(result.type).toBe("agent");
      expect(result.position).toEqual({ x: 100, y: 200 });
      expect(result.data).toHaveProperty("type", "agent");
      expect(result.data).toHaveProperty("name", "Test Agent");
    });
  });

  describe("workflowNodeToOp", () => {
    it("converts a WorkflowNode to an upsert operation", () => {
      const node = {
        id: "node-1",
        type: "agent",
        position: { x: 50, y: 75 },
        data: { type: "agent", name: "My Agent" },
      } as WorkflowNode;

      const op = workflowNodeToOp(node);

      expect(op.op).toBe("upsert_node");
      expect(op.nodeId).toBe("node-1");
      expect(op.type).toBe("agent");
      expect(JSON.parse(op.positionJson!)).toEqual({ x: 50, y: 75 });
      expect(JSON.parse(op.dataJson!)).toEqual({ type: "agent", name: "My Agent" });
    });
  });

  describe("spacetimeEdgeToWorkflowEdge", () => {
    it("converts a SpacetimeDB edge row to a WorkflowEdge", () => {
      const row: SpacetimeWorkflowEdge = {
        workflowId: "wf-1",
        edgeId: "edge-1",
        source: "node-1",
        target: "node-2",
        handlesJson: '{"sourceHandle":"right","targetHandle":"left"}',
        dataJson: "{}",
        updatedAt: "2026-01-01T00:00:00.000Z",
        updatedBy: "user",
      };

      const result = spacetimeEdgeToWorkflowEdge(row);

      expect(result.id).toBe("edge-1");
      expect(result.source).toBe("node-1");
      expect(result.target).toBe("node-2");
      expect(result.sourceHandle).toBe("right");
      expect(result.targetHandle).toBe("left");
    });

    it("handles null handles", () => {
      const row: SpacetimeWorkflowEdge = {
        workflowId: "wf-1",
        edgeId: "edge-2",
        source: "a",
        target: "b",
        handlesJson: "{}",
        dataJson: "{}",
        updatedAt: "2026-01-01T00:00:00.000Z",
        updatedBy: "user",
      };

      const result = spacetimeEdgeToWorkflowEdge(row);

      expect(result.sourceHandle).toBeNull();
      expect(result.targetHandle).toBeNull();
    });
  });

  describe("workflowEdgeToOp", () => {
    it("converts a WorkflowEdge to an upsert operation", () => {
      const edge = {
        id: "edge-1",
        source: "n1",
        target: "n2",
        sourceHandle: "out",
        targetHandle: "in",
      } as WorkflowEdge;

      const op = workflowEdgeToOp(edge);

      expect(op.op).toBe("upsert_edge");
      expect(op.edgeId).toBe("edge-1");
      expect(op.source).toBe("n1");
      expect(op.target).toBe("n2");
      expect(JSON.parse(op.handlesJson!)).toEqual({
        sourceHandle: "out",
        targetHandle: "in",
      });
    });
  });

  describe("spacetimeToWorkspaceRecord", () => {
    it("converts a SpacetimeDB workspace row to WorkspaceRecord", () => {
      const row: SpacetimeWorkspace = {
        id: "ws-1",
        name: "My Workspace",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      };

      const result = spacetimeToWorkspaceRecord(row);

      expect(result).toEqual({
        id: "ws-1",
        name: "My Workspace",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      });
    });
  });

  describe("spacetimeToWorkflowRecord", () => {
    it("converts a SpacetimeDB workflow row to WorkflowRecord", () => {
      const row: SpacetimeWorkflow = {
        id: "wf-1",
        workspaceId: "ws-1",
        name: "My Workflow",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        lastModifiedBy: "user",
      };

      const result = spacetimeToWorkflowRecord(row);

      expect(result).toEqual({
        id: "wf-1",
        workspaceId: "ws-1",
        name: "My Workflow",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        lastModifiedBy: "user",
      });
    });
  });

  describe("spacetimeToBrainDoc", () => {
    it("converts a SpacetimeDB brain doc row to KnowledgeDoc", () => {
      const row: SpacetimeBrainDoc = {
        id: "doc-1",
        workspaceId: "ws-1",
        title: "My Note",
        contentJson: JSON.stringify({
          summary: "A note",
          content: "body text",
          docType: "note",
          tags: ["test"],
          associatedWorkflowIds: [],
          createdBy: "user",
          status: "draft",
          metrics: { views: 0, lastViewedAt: null, feedback: [] },
        }),
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        deletedAt: null,
      };

      const result = spacetimeToBrainDoc(row);

      expect(result.id).toBe("doc-1");
      expect(result.title).toBe("My Note");
      expect(result.summary).toBe("A note");
      expect(result.docType).toBe("note");
      expect(result.createdAt).toBe("2026-01-01T00:00:00.000Z");
      expect(result.updatedAt).toBe("2026-01-02T00:00:00.000Z");
    });
  });

  describe("brainDocToContentJson", () => {
    it("strips id, title, createdAt, updatedAt from the doc", () => {
      const doc = {
        id: "doc-1",
        title: "Title",
        summary: "Sum",
        content: "Body",
        docType: "note" as const,
        tags: [],
        associatedWorkflowIds: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        createdBy: "user",
        status: "draft" as const,
        metrics: { views: 0, lastViewedAt: null, feedback: [] },
      };

      const json = brainDocToContentJson(doc);
      const parsed = JSON.parse(json);

      expect(parsed.id).toBeUndefined();
      expect(parsed.title).toBeUndefined();
      expect(parsed.createdAt).toBeUndefined();
      expect(parsed.updatedAt).toBeUndefined();
      expect(parsed.summary).toBe("Sum");
      expect(parsed.content).toBe("Body");
      expect(parsed.docType).toBe("note");
    });
  });

  describe("spacetimeToChangeEvent", () => {
    it("converts a SpacetimeDB change event to ChangeEvent", () => {
      const row: SpacetimeWorkflowChangeEvent = {
        workflowId: "wf-1",
        eventType: "node_added",
        nodeId: "node-1",
        details: JSON.stringify({ nodeName: "Agent", by: "user" }),
        timestamp: "2026-01-01T00:00:00.000Z",
      };

      const result = spacetimeToChangeEvent(row);

      expect(result.type).toBe("node_added");
      expect(result.nodeName).toBe("Agent");
      expect(result.by).toBe("user");
      expect(result.at).toBe("2026-01-01T00:00:00.000Z");
    });
  });
});
