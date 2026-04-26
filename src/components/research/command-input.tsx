"use client";

import { useState } from "react";
import { Send } from "lucide-react";

export function CommandInput({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form onSubmit={(event) => { event.preventDefault(); const text = value.trim(); if (text) { onSubmit(text); setValue(""); } }} className="border-t border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2">
        <input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Add a tile, question, source URL, quote, or task…" className="flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600" />
        <button type="submit" className="rounded-lg bg-cyan-500 p-2 text-zinc-950 hover:bg-cyan-400"><Send className="h-4 w-4" /></button>
      </div>
    </form>
  );
}
