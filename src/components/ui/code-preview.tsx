"use client";

import type { Ref } from "react";
import "prismjs/themes/prism-tomorrow.css";
import { cn } from "@/lib/utils";
import { highlightCode, resolveCodeLanguage } from "./code-highlighting";

interface CodePreviewProps {
  value: string;
  language?: string;
  className?: string;
  emptyMessage?: string;
  scrollElementRef?: (element: HTMLElement | null) => void;
}

export function CodePreview({
  value,
  language = "typescript",
  className,
  emptyMessage,
  scrollElementRef,
}: CodePreviewProps) {
  const prismLanguage = resolveCodeLanguage(language);
  const hasContent = value.trim().length > 0;

  if (!hasContent && emptyMessage) {
    return (
      <div
        ref={scrollElementRef as Ref<HTMLDivElement> | undefined}
        className={cn("px-3 py-2 text-xs italic text-zinc-600", className)}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <pre
      ref={scrollElementRef as Ref<HTMLPreElement> | undefined}
      className={cn("nexus-code-block m-0 overflow-x-auto bg-transparent p-3", className)}
    >
      <code
        className={`language-${prismLanguage}`}
        dangerouslySetInnerHTML={{ __html: highlightCode(value, prismLanguage) }}
      />
    </pre>
  );
}

