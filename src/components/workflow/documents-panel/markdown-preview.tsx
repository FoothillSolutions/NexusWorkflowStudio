"use client";

import dynamic from "next/dynamic";
import "@uiw/react-markdown-preview/markdown.css";

const MDPreview = dynamic(() => import("@uiw/react-md-editor").then((mod) => mod.default.Markdown as React.ComponentType<{ source: string }>), { ssr: false });

interface MarkdownPreviewProps {
  source: string;
}

export function MarkdownPreview({ source }: MarkdownPreviewProps) {
  return (
    <div data-color-mode="dark" className="h-full overflow-auto rounded-md border border-zinc-800 bg-zinc-950/40 p-3">
      <MDPreview source={source} />
    </div>
  );
}
