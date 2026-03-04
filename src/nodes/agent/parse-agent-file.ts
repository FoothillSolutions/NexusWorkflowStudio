import { SubAgentModel, SubAgentMemory } from "./enums";

/** Result of parsing an agent `.md` file. Only non-undefined fields should be applied. */
export interface ParsedAgentFile {
  description?: string;
  model?: string;
  memory?: SubAgentMemory;
  temperature?: number;
  color?: string;
  disabledTools?: string[];
  variableMappings?: Record<string, string>;
  promptText?: string;
}


/** All known SubAgentMemory values keyed by their string representation */
const MEMORY_VALUES = new Set(Object.values(SubAgentMemory) as string[]);

/**
 * Parse an agent `.md` file (YAML frontmatter + markdown body) and extract
 * fields compatible with `SubAgentNodeData`.
 *
 * The expected format:
 * ```
 * ---
 * description: ...
 * model: ...
 * memory: ...
 * tools:
 *   bash: false
 * temperature: 0.5
 * color: "#abc123"
 * ---
 *
 * ## Variables
 * - `varName`: `.opencode/docs/file.md`
 *
 * Prompt content here...
 * ```
 */
export function parseAgentFile(raw: string): ParsedAgentFile {
  const result: ParsedAgentFile = {};

  // ── Split frontmatter from body ────────────────────────────────────
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) {
    // No frontmatter — treat entire content as prompt
    result.promptText = raw.trim();
    return result;
  }

  const frontmatter = fmMatch[1];
  const body = raw.slice(fmMatch[0].length).trim();

  // ── Parse frontmatter line-by-line ─────────────────────────────────
  const disabledTools: string[] = [];
  let inToolsBlock = false;

  for (const rawLine of frontmatter.split(/\r?\n/)) {
    const line = rawLine.trimEnd();

    // Detect indented sub-key (only relevant inside tools: block)
    if (inToolsBlock) {
      const subMatch = line.match(/^\s{2,}(\S+):\s*(false|true)\s*$/);
      if (subMatch) {
        if (subMatch[2] === "false") {
          disabledTools.push(subMatch[1]);
        }
        continue;
      }
      // No longer in tools block
      inToolsBlock = false;
    }

    // Top-level key: value
    const kvMatch = line.match(/^([a-zA-Z_-]+):\s*(.*?)\s*$/);
    if (!kvMatch) continue;

    const key = kvMatch[1].toLowerCase();
    const val = kvMatch[2].replace(/^["']|["']$/g, ""); // strip quotes

    switch (key) {
      case "description":
        result.description = val;
        break;
      case "model":
        // Accept "inherit" or any "providerID/modelID" format string
        if (val === SubAgentModel.Inherit || val.includes("/")) {
          result.model = val;
        }
        break;
      case "memory":
        if (MEMORY_VALUES.has(val)) {
          result.memory = val as SubAgentMemory;
        }
        break;
      case "temperature": {
        const num = parseFloat(val);
        if (!isNaN(num) && num >= 0 && num <= 1) {
          result.temperature = num;
        }
        break;
      }
      case "color":
        if (val) result.color = val;
        break;
      case "tools":
        // Start of tools block (values on subsequent indented lines)
        inToolsBlock = true;
        break;
      // Ignore mode, hidden, skills, docs — not directly editable or handled elsewhere
      default:
        break;
    }
  }

  if (disabledTools.length > 0) {
    result.disabledTools = disabledTools;
  }

  // ── Parse body: extract Variables section and prompt ────────────────
  if (body) {
    const variablesMatch = body.match(/^## Variables\s*\n([\s\S]*?)(?=\n## |\n---|\Z)/m);
    let promptStart = body;

    if (variablesMatch) {
      const varSection = variablesMatch[1];
      const mappings: Record<string, string> = {};

      // Parse lines like: - `varName`: `.opencode/docs/file.md`
      const varLineRe = /^-\s*`([^`]+)`:\s*`([^`]+)`/gm;
      let m;
      while ((m = varLineRe.exec(varSection)) !== null) {
        const varName = m[1];
        let ref = m[2];

        // Reverse-resolve paths back to resource references
        if (ref.startsWith(".opencode/docs/")) {
          const fileName = ref.slice(".opencode/docs/".length);
          ref = `doc:${fileName}`;
        } else if (ref.match(/^\.opencode\/skills\/(.+)\/SKILL\.md$/)) {
          const skillMatch = ref.match(/^\.opencode\/skills\/(.+)\/SKILL\.md$/);
          if (skillMatch) ref = `skill:${skillMatch[1]}`;
        }

        mappings[varName] = ref;
      }

      if (Object.keys(mappings).length > 0) {
        result.variableMappings = mappings;
      }

      // Remove the Variables section from prompt
      promptStart = body.replace(/## Variables\s*\n[\s\S]*?(?=\n## |\n---|\s*$)/, "").trim();
    }

    if (promptStart) {
      result.promptText = promptStart;
    }
  }

  return result;
}

