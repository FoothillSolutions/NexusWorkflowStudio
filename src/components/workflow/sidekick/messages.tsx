"use client";
import { ActionCard } from "./action-card";
import { AcpToolCard } from "./acp-tool-card";
import { PermissionCard } from "./permission-card";
import type { SidekickMessage } from "@/store/sidekick";
export function SidekickMessages({ messages }: { messages: SidekickMessage[] }) { return <div className="flex-1 space-y-3 overflow-auto p-3">{messages.length === 0 && <p className="rounded-xl border border-dashed border-zinc-700 p-4 text-sm text-zinc-400">Ask the AI side-kick about the current canvas or request a workflow edit.</p>}{messages.map((m) => { if (m.kind === "action") return <ActionCard key={m.id} message={m}/>; if (m.kind === "acp-tool") return <AcpToolCard key={m.id} message={m}/>; if (m.kind === "permission") return <PermissionCard key={m.id} message={m}/>; return <div key={m.id} className={`rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "ml-8 bg-violet-600 text-white" : "mr-8 bg-zinc-800 text-zinc-100"}`}><div className="whitespace-pre-wrap">{m.text}</div></div>; })}</div>; }
