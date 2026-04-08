"use client";

import { useState, useCallback } from "react";
import { Share2, Copy, Check, Loader2, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CollabDoc } from "@/lib/collaboration";
import { useCollabStore, createRoomId } from "@/store/collaboration";
import { useWorkflowStore } from "@/store/workflow";
import { toast } from "sonner";
import { TEXT_MUTED } from "@/lib/theme";

export function ShareButton() {
  const getWorkflowJSON = useWorkflowStore((s) => s.getWorkflowJSON);
  const roomId = useCollabStore((s) => s.roomId);
  const isConnected = useCollabStore((s) => s.isConnected);
  const isInitializing = useCollabStore((s) => s.isInitializing);
  const peerCount = useCollabStore((s) => s.peerCount);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const isActive = roomId !== null;

  const collabUrl = isActive
    ? `${typeof window !== "undefined" ? window.location.origin : ""}${typeof window !== "undefined" ? window.location.pathname : ""}?room=${roomId}`
    : "";

  const handleShare = useCallback(() => {
    const id = createRoomId();
    const url = `${window.location.origin}${window.location.pathname}?room=${id}`;
    window.history.pushState({}, "", `?room=${id}`);
    CollabDoc.getOrCreate().start(id, getWorkflowJSON());
    toast.success("Collaboration started — share the link with others");
    void navigator.clipboard.writeText(url).catch(() => {/* ignore */});
    setOpen(true);
  }, [getWorkflowJSON]);

  const handleStop = useCallback(() => {
    CollabDoc.getInstance()?.destroy();
    window.history.pushState({}, "", window.location.pathname);
    setOpen(false);
    toast("Collaboration stopped");
  }, []);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(collabUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [collabUrl]);

  if (!isActive) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={handleShare}
        className={`${TEXT_MUTED} h-8 rounded-lg px-2.5 text-xs hover:bg-zinc-800/80 hover:text-zinc-100`}
      >
        <Share2 className="h-3.5 w-3.5 sm:mr-1" />
        <span className="hidden sm:inline">Share</span>
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 rounded-lg px-2.5 text-xs text-emerald-400 hover:bg-zinc-800/80 hover:text-emerald-300"
      >
        {isInitializing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin sm:mr-1" />
        ) : (
          <span className="relative mr-1.5 flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
        )}
        <span className="hidden sm:inline">
          {isInitializing
            ? "Connecting…"
            : isConnected
            ? `Live${peerCount > 0 ? ` · ${peerCount + 1}` : ""}`
            : "Sharing"}
        </span>
        <Users className="ml-1 h-3.5 w-3.5 sm:hidden" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Collaboration link</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-1">
            <p className="text-sm text-zinc-400">
              Share this link — anyone who opens it joins your live session.
            </p>

            <div className="flex gap-2">
              <Input
                readOnly
                value={collabUrl}
                className="h-8 flex-1 bg-zinc-800 border-zinc-700 text-xs text-zinc-300 font-mono"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 border border-zinc-700 hover:bg-zinc-700"
                onClick={handleCopy}
                title="Copy link"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>

            <p className="text-[11px] text-zinc-500">
              Peer-to-peer — data stays between you and your collaborators.
            </p>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleStop}
              className="h-7 w-full border border-zinc-700 text-xs text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Stop sharing
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
