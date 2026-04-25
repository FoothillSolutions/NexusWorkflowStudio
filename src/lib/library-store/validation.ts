import { skillFrontmatterSchema } from "./schemas";
import type {
  LibraryDocumentRecord,
  PackRecord,
  SkillRecord,
  ValidationWarning,
} from "./types";

export interface ParsedFrontmatter {
  data: Record<string, unknown> | null;
  body: string;
  raw: string;
}

const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;

function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let currentKey: string | null = null;
  let currentObj: Record<string, unknown> | null = null;
  for (const rawLine of yaml.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, "");
    if (!line.trim() || line.trim().startsWith("#")) continue;

    const indented = /^\s+/.test(rawLine);
    if (!indented) {
      currentObj = null;
      const m = /^([A-Za-z0-9_\-]+)\s*:\s*(.*)$/.exec(line);
      if (!m) continue;
      const key = m[1];
      const value = m[2].trim();
      currentKey = key;
      if (value === "") {
        const nested: Record<string, unknown> = {};
        result[key] = nested;
        currentObj = nested;
      } else {
        result[key] = stripQuotes(value);
      }
    } else if (currentKey && currentObj) {
      const m = /^\s+([A-Za-z0-9_\-]+)\s*:\s*(.*)$/.exec(rawLine);
      if (m) {
        currentObj[m[1]] = stripQuotes(m[2].trim());
      }
    }
  }
  return result;
}

function stripQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

export function parseFrontmatter(content: string): ParsedFrontmatter {
  const match = FRONTMATTER_REGEX.exec(content);
  if (!match) {
    return { data: null, body: content, raw: "" };
  }
  return {
    data: parseSimpleYaml(match[1]),
    body: match[2],
    raw: match[1],
  };
}

export function parseSkillFrontmatter(content: string): {
  data: ReturnType<typeof skillFrontmatterSchema.safeParse>;
  body: string;
} {
  const parsed = parseFrontmatter(content);
  if (!parsed.data) {
    return {
      data: skillFrontmatterSchema.safeParse({}),
      body: parsed.body,
    };
  }
  return {
    data: skillFrontmatterSchema.safeParse(parsed.data),
    body: parsed.body,
  };
}

export interface ValidatePackInput {
  pack: PackRecord;
  skills: SkillRecord[];
  documents: LibraryDocumentRecord[];
  documentContents: Map<string, string>;
  unresolvedMergeIds?: string[];
}

const RELATIVE_LINK_REGEX = /(?:!?\[[^\]]*\]\(\s*)([^)\s]+)(?:[^)]*\))/g;

export function validatePack(input: ValidatePackInput): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const { pack, skills, documents, documentContents, unresolvedMergeIds = [] } = input;
  const docById = new Map(documents.map((d) => [d.id, d]));
  const docByPath = new Map(documents.filter((d) => d.deletedAt === null).map((d) => [d.path, d]));

  const skillKeys = new Set<string>();
  for (const skill of skills.filter((s) => s.deletedAt === null)) {
    if (skillKeys.has(skill.skillKey)) {
      warnings.push({
        level: "error",
        code: "duplicate_skill_id",
        message: `Duplicate skill key: ${skill.skillKey}`,
        skillId: skill.id,
      });
    }
    skillKeys.add(skill.skillKey);

    const entry = docById.get(skill.entrypointDocId);
    if (!entry || entry.deletedAt !== null) {
      warnings.push({
        level: "error",
        code: "missing_entrypoint",
        message: `Skill "${skill.name}" is missing its SKILL.md entrypoint document`,
        skillId: skill.id,
      });
      continue;
    }

    const content = documentContents.get(entry.id) ?? "";
    const fm = parseSkillFrontmatter(content);
    if (!fm.data.success) {
      warnings.push({
        level: "error",
        code: "invalid_frontmatter",
        message: `Skill "${skill.name}" has invalid SKILL.md frontmatter: ${fm.data.error.issues[0]?.message ?? "unknown"}`,
        skillId: skill.id,
        docId: entry.id,
        path: entry.path,
      });
    } else if (!fm.data.data.description?.trim()) {
      warnings.push({
        level: "warning",
        code: "missing_description",
        message: `Skill "${skill.name}" has no description in frontmatter`,
        skillId: skill.id,
        docId: entry.id,
        path: entry.path,
      });
    }
  }

  const docPaths = new Set<string>();
  for (const doc of documents.filter((d) => d.deletedAt === null)) {
    if (docPaths.has(doc.path)) {
      warnings.push({
        level: "warning",
        code: "duplicate_document_path",
        message: `Duplicate document path: ${doc.path}`,
        docId: doc.id,
        path: doc.path,
      });
    }
    docPaths.add(doc.path);

    const content = documentContents.get(doc.id) ?? "";
    let m: RegExpExecArray | null;
    RELATIVE_LINK_REGEX.lastIndex = 0;
    while ((m = RELATIVE_LINK_REGEX.exec(content)) !== null) {
      const target = m[1];
      if (/^https?:/i.test(target) || target.startsWith("#") || target.startsWith("data:")) continue;
      const normalized = target.replace(/^\.\//, "");
      if (!docByPath.has(normalized)) {
        warnings.push({
          level: "warning",
          code: "broken_reference",
          message: `Document "${doc.path}" references missing path "${target}"`,
          docId: doc.id,
          path: doc.path,
        });
      }
    }
  }

  if (!pack.packKey) {
    warnings.push({
      level: "error",
      code: "missing_pack_key",
      message: "Pack has no packKey",
    });
  }

  for (const skill of skills.filter((s) => s.deletedAt === null)) {
    const entry = docById.get(skill.entrypointDocId);
    if (entry?.deletedAt) {
      warnings.push({
        level: "error",
        code: "deleted_doc_referenced",
        message: `Skill "${skill.name}" references deleted document`,
        skillId: skill.id,
        docId: entry.id,
      });
    }
  }

  for (const mergeId of unresolvedMergeIds) {
    warnings.push({
      level: "error",
      code: "unresolved_merge",
      message: `Pack has unresolved merge ${mergeId}`,
    });
  }

  return warnings;
}
