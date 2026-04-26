"use client";
import { ShieldAlert } from "lucide-react";
import type { SidekickMessage } from "@/store/sidekick";
import { useSidekickStore } from "@/store/sidekick";
export function ActionCard({ message }: { message: Extract<SidekickMessage, { kind: "action" }> }) {
  const approve = useSidekickStore((s) => s.approve); const deny = useSidekickStore((s) => s.deny); const awaiting = message.call.status === "awaiting-approval";
  return <div className="rounded-xl border border-zinc-700/70 bg-zinc-900/80 p-3 text-xs text-zinc-200"><div className="flex items-center gap-2"><ShieldAlert size={14}/><b>{message.call.name}</b><span className="ml-auto rounded bg-zinc-800 px-2 py-0.5">{message.call.status}</span></div><pre className="mt-2 max-h-24 overflow-auto text-[11px] text-zinc-400">{JSON.stringify(message.call.args, null, 2)}</pre>{message.result?.error && <p className="mt-2 text-red-300">{message.result.error.code}: {message.result.error.message}</p>}{awaiting && <div className="mt-3 flex gap-2"><button className="rounded bg-emerald-600 px-2 py-1" onClick={() => approve(false)}>Allow once</button><button className="rounded bg-emerald-700 px-2 py-1" onClick={() => approve(true)}>Allow always</button><button className="rounded bg-red-700 px-2 py-1" onClick={deny}>Deny</button></div>}</div>;
}
