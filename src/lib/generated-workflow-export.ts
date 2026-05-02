import type { WorkflowJSON } from "@/types/workflow";
import {
  getGenerationTarget,
  sanitizeGeneratedName,
  type GenerationTargetId,
} from "@/lib/generation-targets";
import { buildClaudePluginName } from "@/lib/claude-plugin-export";
import {
  getWorkflowExportContent,
  getWorkflowExportFileName,
} from "@/lib/persistence";
import { generateWorkflowFiles, type GeneratedFile } from "@/lib/workflow-generator";

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
};

type PermissionStatus = "granted" | "denied" | "prompt";

type PermissionCapableDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission?: (descriptor?: { mode?: "read" | "readwrite" }) => Promise<PermissionStatus>;
  requestPermission?: (descriptor?: { mode?: "read" | "readwrite" }) => Promise<PermissionStatus>;
};

export function supportsDirectoryExport(): boolean {
  if (typeof window === "undefined") return false;
  return typeof (window as DirectoryPickerWindow).showDirectoryPicker === "function";
}

export async function pickExportDirectory(): Promise<FileSystemDirectoryHandle> {
  if (!supportsDirectoryExport()) {
    throw new Error("Direct folder export is not supported in this browser.");
  }

  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) {
    throw new Error("Directory picker is unavailable.");
  }

  return picker({ mode: "readwrite" });
}

async function ensureDirectoryPermission(handle: FileSystemDirectoryHandle): Promise<void> {
  const permissionHandle = handle as PermissionCapableDirectoryHandle;
  if (
    typeof permissionHandle.queryPermission !== "function" &&
    typeof permissionHandle.requestPermission !== "function"
  ) {
    return;
  }

  try {
    const permission = await permissionHandle.queryPermission?.({ mode: "readwrite" });
    if (permission === "granted") return;

    const requested = await permissionHandle.requestPermission?.({ mode: "readwrite" });
    if (requested === "granted") return;
  } catch {
    // Some browsers expose partial File System Access APIs but do not report
    // permissions reliably. Fall through and let the actual write attempt decide.
  }
}

async function getOrCreateDirectory(
  root: FileSystemDirectoryHandle,
  segments: string[],
): Promise<FileSystemDirectoryHandle> {
  let current = root;

  for (const segment of segments) {
    current = await current.getDirectoryHandle(segment, { create: true });
  }

  return current;
}

async function writeGeneratedFile(
  root: FileSystemDirectoryHandle,
  file: GeneratedFile,
): Promise<void> {
  const segments = file.path.split("/").filter(Boolean);
  const fileName = segments.pop();

  if (!fileName) {
    throw new Error(`Invalid generated file path: ${file.path}`);
  }

  const directory = await getOrCreateDirectory(root, segments);
  const fileHandle = await directory.getFileHandle(fileName, { create: true });
  if (typeof fileHandle.createWritable !== "function") {
    throw new Error("This browser does not support writing files into the selected directory.");
  }
  const writable = await fileHandle.createWritable();
  await writable.write(file.content);
  await writable.close();
}

export async function writeGeneratedFilesToDirectory(
  root: FileSystemDirectoryHandle,
  files: GeneratedFile[],
): Promise<void> {
  await ensureDirectoryPermission(root);

  for (const file of files) {
    await writeGeneratedFile(root, file);
  }
}

function partitionByRoot(
  files: GeneratedFile[],
  target: GenerationTargetId,
): { rootFiles: GeneratedFile[]; targetFiles: GeneratedFile[] } {
  const prefix = `${getGenerationTarget(target).rootDir}/`;
  const rootFiles = files.filter((f) => !f.path.startsWith(prefix));
  const targetFiles = files.filter((f) => f.path.startsWith(prefix));
  return { rootFiles, targetFiles };
}

function stripTargetRootFromFiles(
  files: GeneratedFile[],
  target: GenerationTargetId,
): GeneratedFile[] {
  const targetRootDir = getGenerationTarget(target).rootDir;
  return files.map((file) => {
    const prefix = `${targetRootDir}/`;
    if (!file.path.startsWith(prefix)) return file;
    return {
      ...file,
      path: file.path.slice(prefix.length),
    };
  });
}

async function resolveExportDirectory(
  root: FileSystemDirectoryHandle,
  target: GenerationTargetId,
  workflow: WorkflowJSON,
): Promise<FileSystemDirectoryHandle> {
  const targetRootDir = target === "claude-code"
    ? buildClaudePluginName(workflow.name)
    : getGenerationTarget(target).rootDir;

  if (root.name === targetRootDir) {
    return root;
  }

  return root.getDirectoryHandle(targetRootDir, { create: true });
}

export function getDirectoryExportDestinationLabel(
  selectedDirectoryName: string,
  workflow: Pick<WorkflowJSON, "name">,
  target: GenerationTargetId,
): string {
  const targetRootDir = target === "claude-code"
    ? buildClaudePluginName(workflow.name)
    : getGenerationTarget(target).rootDir;

  return selectedDirectoryName === targetRootDir
    ? selectedDirectoryName
    : `${selectedDirectoryName}/${targetRootDir}`;
}

export async function exportGeneratedWorkflowToDirectory(
  root: FileSystemDirectoryHandle,
  workflow: WorkflowJSON,
  target: GenerationTargetId,
): Promise<GeneratedFile[]> {
  const files = generateWorkflowFiles(workflow, target);

  if (target === "claude-code") {
    const destination = await resolveExportDirectory(root, target, workflow);
    await writeGeneratedFilesToDirectory(destination, files);
    return files;
  }

  const { rootFiles, targetFiles } = partitionByRoot(files, target);
  const destination = await resolveExportDirectory(root, target, workflow);
  await writeGeneratedFilesToDirectory(destination, stripTargetRootFromFiles(targetFiles, target));
  await writeGeneratedFilesToDirectory(root, rootFiles);
  return files;
}

export async function downloadGeneratedWorkflowZip(
  workflow: WorkflowJSON,
  target: GenerationTargetId,
): Promise<GeneratedFile[]> {
  const JSZip = (await import("jszip")).default;
  const files = generateWorkflowFiles(workflow, target);
  const filesInZip = target === "claude-code"
    ? files
    : [
        ...files,
        {
          path: getWorkflowExportFileName(workflow),
          content: getWorkflowExportContent(workflow),
        },
      ];
  const zip = new JSZip();

  for (const file of filesInZip) {
    zip.file(file.path, file.content);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const targetInfo = getGenerationTarget(target);
  const a = document.createElement("a");
  a.href = url;
  a.download = target === "claude-code"
    ? `${buildClaudePluginName(workflow.name)}.zip`
    : `${sanitizeGeneratedName(workflow.name)}-${targetInfo.id}.zip`;
  a.click();
  URL.revokeObjectURL(url);

  return filesInZip;
}



