import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type {
  IfElseNodeData,
  SkillNodeData,
  StartNodeData,
  EndNodeData,
  WorkflowEdge,
  WorkflowJSON,
  WorkflowNode,
} from "../../src/types/workflow";

const REPO_ROOT = process.cwd();
const TMP_ROOT = path.join(REPO_ROOT, ".tmp-tests");

async function loadGeneratePiExtensionFiles(): Promise<
  (workflow: WorkflowJSON) => Array<{ path: string; content: string }>
> {
  const mod = (await import("../../src/lib/pi-extension-generator")) as {
    generatePiExtensionFiles?: (workflow: WorkflowJSON) => Array<{ path: string; content: string }>;
    default?: { generatePiExtensionFiles?: (workflow: WorkflowJSON) => Array<{ path: string; content: string }> };
  };

  const generate = mod.generatePiExtensionFiles ?? mod.default?.generatePiExtensionFiles;
  if (!generate) {
    throw new Error("generatePiExtensionFiles export is unavailable");
  }
  return generate;
}

function baseWorkflow(name: string, nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowJSON {
  return {
    name,
    nodes,
    edges,
    ui: {
      sidebarOpen: false,
      minimapVisible: false,
      viewport: { x: 0, y: 0, zoom: 1 },
    },
  };
}

export function startNode(id: string, label = "Start"): WorkflowNode {
  const data: StartNodeData = {
    type: "start",
    label,
    name: id,
  };

  return {
    id,
    type: "workflow",
    position: { x: 0, y: 0 },
    data,
  } as WorkflowNode;
}

export function endNode(id: string, label = "End"): WorkflowNode {
  const data: EndNodeData = {
    type: "end",
    label,
    name: id,
  };

  return {
    id,
    type: "workflow",
    position: { x: 400, y: 0 },
    data,
  } as WorkflowNode;
}

export function ifElseNode(id: string, evaluationTarget: string, label = "Decision"): WorkflowNode {
  const data: IfElseNodeData = {
    type: "if-else",
    label,
    name: id,
    evaluationTarget,
    branches: [
      { label: "true", condition: "$target === 'yes' || $target === true" },
      { label: "false", condition: "" },
    ],
  };

  return {
    id,
    type: "workflow",
    position: { x: 200, y: 0 },
    data,
  } as WorkflowNode;
}

export function skillNode(id: string, label = "Unsupported Skill"): WorkflowNode {
  const data: SkillNodeData = {
    type: "skill",
    label,
    name: id,
    skillName: "demo-skill",
    projectName: "demo-project",
    description: "unsupported test node",
    promptText: "do work",
    detectedVariables: [],
    metadata: [],
  };

  return {
    id,
    type: "workflow",
    position: { x: 200, y: 0 },
    data,
  } as WorkflowNode;
}

export function edge(id: string, source: string, target: string, sourceHandle?: string): WorkflowEdge {
  return {
    id,
    source,
    target,
    sourceHandle,
  };
}

export function makeUnsupportedWorkflow(): WorkflowJSON {
  return baseWorkflow(
    "Unsupported Export",
    [startNode("start"), skillNode("skill"), endNode("end")],
    [edge("e1", "start", "skill"), edge("e2", "skill", "end")]
  );
}

export function makeMissingFalseHandleWorkflow(): WorkflowJSON {
  return baseWorkflow(
    "Missing False Handle",
    [startNode("start"), ifElseNode("decision", "flag"), endNode("end")],
    [edge("e1", "start", "decision"), edge("e2", "decision", "end", "true")]
  );
}

export function makeFullyWiredBranchWorkflow(): WorkflowJSON {
  return baseWorkflow(
    "Fully Wired Branch",
    [startNode("start"), ifElseNode("decision", "flag"), endNode("end")],
    [
      edge("e1", "start", "decision"),
      edge("e2", "decision", "end", "true"),
      edge("e3", "decision", "end", "false"),
    ]
  );
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function writeStubModules(rootDir: string): Promise<void> {
  const pkgDir = path.join(rootDir, "node_modules", "@mariozechner", "pi-tui");
  await ensureDir(pkgDir);
  await fs.writeFile(
    path.join(pkgDir, "package.json"),
    JSON.stringify(
      { name: "@mariozechner/pi-tui", type: "module", exports: "./index.js", main: "./index.js" },
      null,
      2
    ) + "\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(pkgDir, "index.js"),
    [
      "export class Text {",
      "  constructor(text = '') {",
      "    this.text = text;",
      "  }",
      "  setText(text) {",
      "    this.text = text;",
      "  }",
      "  render(_width) {",
      "    return String(this.text).split('\\n');",
      "  }",
      "  invalidate() {}",
      "}",
      "",
    ].join("\n"),
    "utf8"
  );

  const typeboxDir = path.join(rootDir, "node_modules", "@sinclair", "typebox");
  await ensureDir(typeboxDir);
  await fs.writeFile(
    path.join(typeboxDir, "package.json"),
    JSON.stringify(
      { name: "@sinclair/typebox", type: "module", exports: "./index.js", main: "./index.js" },
      null,
      2
    ) + "\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(typeboxDir, "index.js"),
    [
      "export const Type = {",
      "  Object(properties) {",
      "    return { type: 'object', properties };",
      "  },",
      "  Optional(schema) {",
      "    return { ...schema, optional: true };",
      "  },",
      "  String(options = {}) {",
      "    return { type: 'string', ...options };",
      "  },",
      "};",
      "",
    ].join("\n"),
    "utf8"
  );
}

export async function writeGeneratedPackage(workflow: WorkflowJSON, testName: string): Promise<string> {
  await ensureDir(TMP_ROOT);
  const rootDir = await fs.mkdtemp(path.join(TMP_ROOT, `${testName}-`));
  const generatePiExtensionFiles = await loadGeneratePiExtensionFiles();
  const files = generatePiExtensionFiles(workflow);

  for (const file of files) {
    const abs = path.join(rootDir, file.path);
    await ensureDir(path.dirname(abs));
    await fs.writeFile(abs, file.content, "utf8");
  }

  await writeStubModules(rootDir);
  return rootDir;
}

export async function cleanupGeneratedPackage(rootDir: string): Promise<void> {
  await fs.rm(rootDir, { recursive: true, force: true });
}

export async function importGeneratedModule<T>(rootDir: string, relativePath: string): Promise<T> {
  const url = pathToFileURL(path.join(rootDir, relativePath)).href;
  return import(`${url}?t=${Date.now()}-${Math.random()}`) as Promise<T>;
}

export interface MockNotification {
  level: string;
  message: string;
}

export function createMockContext(cwd: string) {
  const notifications: MockNotification[] = [];
  const widgets: string[] = [];

  const ctx = {
    cwd,
    model: undefined,
    ui: {
      notify(message: string, level: string) {
        notifications.push({ message, level });
      },
      setWidget(name: string) {
        widgets.push(name);
      },
      async input(): Promise<string | undefined> {
        return undefined;
      },
      async select(): Promise<string | undefined> {
        return undefined;
      },
    },
  };

  return { ctx, notifications, widgets };
}

export function createMockPi() {
  const commands = new Map<string, { handler: (args: string | undefined, ctx: unknown) => Promise<void> }>();
  const events = new Map<string, Array<(event: unknown, ctx: unknown) => Promise<unknown>>>();
  const tools = new Map<string, unknown>();
  const appendedEntries: Array<{ key: string; value: unknown }> = [];

  const pi = {
    registerCommand(name: string, definition: { handler: (args: string | undefined, ctx: unknown) => Promise<void> }) {
      commands.set(name, definition);
    },
    registerTool(definition: { name: string }) {
      tools.set(definition.name, definition);
    },
    on(eventName: string, handler: (event: unknown, ctx: unknown) => Promise<unknown>) {
      const existing = events.get(eventName) ?? [];
      existing.push(handler);
      events.set(eventName, existing);
    },
    appendEntry(key: string, value: unknown) {
      appendedEntries.push({ key, value });
    },
  };

  async function emit(eventName: string, event: unknown, ctx: unknown): Promise<unknown[]> {
    const handlers = events.get(eventName) ?? [];
    return Promise.all(handlers.map((handler) => handler(event, ctx)));
  }

  async function runCommand(name: string, args: string | undefined, ctx: unknown): Promise<void> {
    const command = commands.get(name);
    if (!command) {
      throw new Error(`Command '${name}' is not registered`);
    }
    await command.handler(args, ctx);
  }

  return { pi, commands, events, tools, appendedEntries, emit, runCommand };
}

export async function generateFilesForTest(workflow: WorkflowJSON) {
  const generatePiExtensionFiles = await loadGeneratePiExtensionFiles();
  return generatePiExtensionFiles(workflow);
}
