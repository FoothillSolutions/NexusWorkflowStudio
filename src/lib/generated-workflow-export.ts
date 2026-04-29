import type { WorkflowJSON } from "@/types/workflow";
import {
  getGenerationTarget,
  sanitizeGeneratedName,
  type GenerationTargetId,
} from "@/lib/generation-targets";
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

export function getGeneratedWorkflowBundleName(
  workflow: WorkflowJSON,
  target: GenerationTargetId,
): string {
  const workflowName = sanitizeGeneratedName(workflow.name);
  const targetInfo = getGenerationTarget(target);
  return `${workflowName}-${targetInfo.id}-export`;
}

function prefixFiles(files: GeneratedFile[], prefix: string): GeneratedFile[] {
  return files.map((file) => ({
    ...file,
    path: `${prefix}/${file.path}`,
  }));
}

async function resolveBundleDirectory(
  root: FileSystemDirectoryHandle,
  bundleName: string,
): Promise<FileSystemDirectoryHandle> {
  if (root.name === bundleName) {
    return root;
  }

  return root.getDirectoryHandle(bundleName, { create: true });
}

export async function exportGeneratedWorkflowToDirectory(
  root: FileSystemDirectoryHandle,
  workflow: WorkflowJSON,
  target: GenerationTargetId,
): Promise<GeneratedFile[]> {
  const files = generateWorkflowFiles(workflow, target);
  const bundleName = getGeneratedWorkflowBundleName(workflow, target);
  const destination = await resolveBundleDirectory(root, bundleName);
  await writeGeneratedFilesToDirectory(destination, files);
  return files;
}

export async function downloadGeneratedWorkflowZip(
  workflow: WorkflowJSON,
  target: GenerationTargetId,
): Promise<GeneratedFile[]> {
  const JSZip = (await import("jszip")).default;
  const files = generateWorkflowFiles(workflow, target);
  const bundleName = getGeneratedWorkflowBundleName(workflow, target);
  const filesInBundle = [
    ...files,
    {
      path: getWorkflowExportFileName(workflow),
      content: getWorkflowExportContent(workflow),
    },
  ];
  const filesInZip = prefixFiles(filesInBundle, bundleName);
  const zip = new JSZip();

  for (const file of filesInZip) {
    zip.file(file.path, file.content);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const targetInfo = getGenerationTarget(target);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeGeneratedName(workflow.name)}-${targetInfo.id}-export.zip`;
  a.click();
  URL.revokeObjectURL(url);

  return filesInZip;
}

