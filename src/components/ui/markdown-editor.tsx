"use client";

import dynamic from "next/dynamic";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

interface MarkdownEditorProps {
  value: string;
  onChange: (val: string) => void;
  height?: number;
}

export function MarkdownEditor({
  value,
  onChange,
  height = 200,
}: MarkdownEditorProps) {
  return (
    <div data-color-mode="dark" className="rounded-xl overflow-hidden border border-zinc-700/60">
      <MDEditor
        value={value}
        onChange={(val) => onChange(val ?? "")}
        height={height}
        preview="edit"
        hideToolbar={true}
        visibleDragbar={false}
        textareaProps={{
          placeholder: "Write your prompt in Markdown…",
          style: { fontFamily: "var(--font-mono, monospace)", fontSize: 13 },
        }}
        style={{
          background: "transparent",
        }}
      />
    </div>
  );
}

