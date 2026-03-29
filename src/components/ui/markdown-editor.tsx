"use client";

import dynamic from "next/dynamic";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";
const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

interface MarkdownEditorProps {
  value: string;
  onChange: (val: string) => void;
  height?: number;
  placeholder?: string;
  hideToolbar?: boolean;
}

export function MarkdownEditor({
  value,
  onChange,
  height = 200,
  placeholder = "Write your prompt in Markdown…",
  hideToolbar = true,
}: MarkdownEditorProps) {
  return (
    <div data-color-mode="dark" className="nexus-md-editor rounded-xl overflow-hidden border border-zinc-700/60">
      <MDEditor
        className="nexus-md-editor"
        value={value}
        onChange={(val) => onChange(val ?? "")}
        height={height}
        preview="edit"
        hideToolbar={hideToolbar}
        visibleDragbar={false}
        textareaProps={{
          placeholder,
        }}
        style={{
          background: "transparent",
        }}
      />
    </div>
  );
}
