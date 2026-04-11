import { describe, expect, it } from "bun:test";
import {
  buildWorkspaceCollabShareUrl,
  buildWorkspaceRoomId,
  buildWorkspaceYjsShareUrl,
} from "../collaboration/config";

describe("collaboration config", () => {
  it("builds a deterministic workspace room id", () => {
    expect(buildWorkspaceRoomId("ws-1", "wf-2")).toBe("nexus-ws-ws-1-wf-2");
  });

  it("builds the stable workspace share URL", () => {
    expect(buildWorkspaceCollabShareUrl("ws-1", "wf-2")).toBe("/workspace/ws-1/workflow/wf-2");
  });

  it("builds the workspace Y.js share URL with the deterministic room query param", () => {
    expect(buildWorkspaceYjsShareUrl("ws-1", "wf-2")).toBe(
      "/workspace/ws-1/workflow/wf-2?room=nexus-ws-ws-1-wf-2",
    );
  });
});
