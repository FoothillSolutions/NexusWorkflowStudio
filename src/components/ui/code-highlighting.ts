import Prism from "prismjs";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-tsx";

export type SupportedCodeLanguage = "javascript" | "jsx" | "typescript" | "tsx";

const FALLBACK_LANGUAGE: SupportedCodeLanguage = "typescript";

export function resolveCodeLanguage(language?: string): SupportedCodeLanguage {
  switch (language?.toLowerCase()) {
    case "js":
    case "javascript":
    case "mjs":
    case "cjs":
      return "javascript";
    case "jsx":
      return "jsx";
    case "ts":
    case "typescript":
      return "typescript";
    case "tsx":
      return "tsx";
    default:
      return FALLBACK_LANGUAGE;
  }
}

export function highlightCode(value: string, language?: string): string {
  const prismLanguage = resolveCodeLanguage(language);
  const grammar = Prism.languages[prismLanguage] ?? Prism.languages[FALLBACK_LANGUAGE];
  return Prism.highlight(value.length > 0 ? value : " ", grammar, prismLanguage);
}

