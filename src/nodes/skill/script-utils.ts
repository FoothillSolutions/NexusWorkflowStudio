const SCRIPT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const SCRIPT_EDITOR_LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "tsx",
  ".js": "javascript",
  ".jsx": "jsx",
  ".mjs": "javascript",
  ".cjs": "javascript",
};
const SCRIPT_MARKDOWN_FENCE_BY_EXTENSION: Record<string, string> = {
  ".ts": "ts",
  ".tsx": "tsx",
  ".js": "js",
  ".jsx": "jsx",
  ".mjs": "js",
  ".cjs": "js",
};

type ScriptNameLike = string | Pick<{ label?: string; name?: string }, "label" | "name"> | undefined;

function sanitizeSegment(raw: string, fallback: string): string {
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

function splitNameAndExtension(raw: string): { baseName: string; extension: string } {
  const trimmed = raw.trim();
  const match = trimmed.match(/(\.[a-z0-9]+)$/i);
  const extension = match?.[1]?.toLowerCase() ?? "";

  if (!extension || !SCRIPT_EXTENSIONS.has(extension)) {
    return { baseName: trimmed, extension: ".ts" };
  }

  return {
    baseName: trimmed.slice(0, -extension.length),
    extension,
  };
}

function resolveScriptName(input: ScriptNameLike, fallback: string): string {
  if (typeof input === "string") {
    return input.trim() || fallback;
  }

  return input?.label?.trim() || input?.name?.trim() || fallback;
}

export function getScriptExtension(input: ScriptNameLike, fallback = "script.ts"): string {
  return splitNameAndExtension(resolveScriptName(input, fallback)).extension;
}

export function getScriptEditorLanguage(input: ScriptNameLike, fallback = "script.ts"): string {
  return SCRIPT_EDITOR_LANGUAGE_BY_EXTENSION[getScriptExtension(input, fallback)] ?? "typescript";
}

export function getScriptMarkdownFenceLanguage(input: ScriptNameLike, fallback = "script.ts"): string {
  return SCRIPT_MARKDOWN_FENCE_BY_EXTENSION[getScriptExtension(input, fallback)] ?? "ts";
}

export function getSkillScriptBaseName(
  data: Pick<{ label?: string; name?: string }, "label" | "name">,
  fallback = "script",
): string {
  const raw = data.label?.trim() || data.name?.trim() || fallback;
  return sanitizeSegment(splitNameAndExtension(raw).baseName, fallback);
}

export function getSkillScriptFileName(
  data: Pick<{ label?: string; name?: string }, "label" | "name">,
  fallback = "script",
): string {
  const raw = data.label?.trim() || data.name?.trim() || fallback;
  const { extension } = splitNameAndExtension(raw);
  return `${getSkillScriptBaseName(data, fallback)}${extension}`;
}

export function buildSkillScriptRelativePath(fileName: string): string {
  return `scripts/${fileName}`;
}

