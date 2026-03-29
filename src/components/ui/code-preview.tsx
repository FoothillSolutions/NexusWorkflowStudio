"use client";

import "prismjs/themes/prism-tomorrow.css";
import { cn } from "@/lib/utils";
import { highlightCode, resolveCodeLanguage } from "./code-highlighting";

interface CodePreviewProps {
  value: string;
  language?: string;
  className?: string;
  emptyMessage?: string;
}

export function CodePreview({
  value,
  language = "typescript",
  className,
  emptyMessage,
}: CodePreviewProps) {
  const prismLanguage = resolveCodeLanguage(language);
  const hasContent = value.trim().length > 0;

  if (!hasContent && emptyMessage) {
    return <div className={cn("px-3 py-2 text-xs italic text-zinc-600", className)}>{emptyMessage}</div>;
  }

  return (
    <pre className={cn("nexus-code-block m-0 overflow-x-auto bg-transparent p-3", className)}>
      <code
        className={`language-${prismLanguage}`}
        dangerouslySetInnerHTML={{ __html: highlightCode(value, prismLanguage) }}
      />
    </pre>
  );
}

