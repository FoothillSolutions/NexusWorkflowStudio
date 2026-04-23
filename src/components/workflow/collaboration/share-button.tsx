"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Share2, Copy, Check, Loader2, Users, X, UserX, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { buildCollabRoomUrl, buildCollabShareUrl, CollabDoc } from "@/lib/collaboration";
import { useCollabStore, createRoomId, useAwarenessStore } from "@/store/collaboration";
import { useWorkflowStore } from "@/store/workflow";
import { toast } from "sonner";
import { TEXT_MUTED } from "@/lib/theme";

interface ShareButtonProps {
  shareUrlOverride?: string;
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    if (!document.execCommand("copy")) {
      throw new Error("Copy command failed");
    }
  } finally {
    document.body.removeChild(textarea);
  }
}

export function ShareButton({ shareUrlOverride }: ShareButtonProps = {}) {
  const getWorkflowJSON = useWorkflowStore((s) => s.getWorkflowJSON);
  const roomId = useCollabStore((s) => s.roomId);
  const isConnected = useCollabStore((s) => s.isConnected);
  const isInitializing = useCollabStore((s) => s.isInitializing);
  const isOwner = useCollabStore((s) => s.isOwner);
  const peerCount = useCollabStore((s) => s.peerCount);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const isActive = roomId !== null;
  // When the socket is up, green. Reconnecting (had a socket, lost it,
  // not actively mid-handshake) is amber — makes it clear the session is
  // alive but degraded rather than "live".
  const isReconnecting = isActive && !isInitializing && !isConnected;

  const collabUrl = shareUrlOverride ?? (isActive && roomId ? buildCollabShareUrl(roomId) : "");

  const handleShare = useCallback(() => {
    const id = createRoomId();
    const url = buildCollabShareUrl(id);
    window.history.pushState({}, "", buildCollabRoomUrl(id));
    CollabDoc.getOrCreate().start(id, getWorkflowJSON(), { asOwner: true });
    toast.success("Collaboration started");
    void copyText(url).catch(() => {
      toast.error("Could not copy the collaboration link — copy it manually from the dialog");
    });
    setOpen(true);
  }, [getWorkflowJSON]);

  const handleStop = useCallback(() => {
    CollabDoc.getInstance()?.destroy();
    window.history.pushState({}, "", window.location.pathname);
    setOpen(false);
    toast("Collaboration stopped");
  }, []);

  const handleLeave = useCallback(() => {
    CollabDoc.getInstance()?.destroy();
    window.history.pushState({}, "", window.location.pathname);
    setOpen(false);
    toast("You left the session");
  }, []);

  const handleCopy = useCallback(async () => {
    await copyText(collabUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [collabUrl]);

  // Workspace mode: share button always copies workspace URL
  if (shareUrlOverride) {
    const activeToneClass = isReconnecting
      ? "text-amber-400 hover:text-amber-300"
      : "text-emerald-400 hover:text-emerald-300";
    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
          className={`${isActive ? activeToneClass : TEXT_MUTED} h-8 rounded-lg px-2.5 text-xs hover:bg-zinc-800/80 hover:text-zinc-100`}
        >
          {isInitializing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin sm:mr-1" />
          ) : isConnected ? (
            <LivePulseDot />
          ) : isReconnecting ? (
            <AmberPulseDot />
          ) : (
            <Share2 className="h-3.5 w-3.5 sm:mr-1" />
          )}
          <span className="hidden sm:inline">
            {isInitializing
              ? "Connecting…"
              : isConnected
              ? `Live${peerCount > 0 ? ` · ${peerCount + 1}` : ""}`
              : isReconnecting
              ? "Reconnecting…"
              : "Share"}
          </span>
          <Users className="ml-1 h-3.5 w-3.5 sm:hidden" />
        </Button>

        <ShareDialog
          open={open}
          onOpenChange={setOpen}
          collabUrl={shareUrlOverride}
          copied={copied}
          onCopy={handleCopy}
          isOwner={false}
          hasOwnership={false}
          showStop={false}
          onStop={() => { /* workspace mode has no owner */ }}
          onLeave={handleLeave}
          isConnected={isConnected}
          isInitializing={isInitializing}
          isReconnecting={isReconnecting}
        />
      </>
    );
  }

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

  const activeToneClass = isReconnecting
    ? "text-amber-400 hover:text-amber-300"
    : "text-emerald-400 hover:text-emerald-300";

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className={`h-8 rounded-lg px-2.5 text-xs ${activeToneClass} hover:bg-zinc-800/80`}
      >
        {isInitializing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin sm:mr-1" />
        ) : isReconnecting ? (
          <AmberPulseDot />
        ) : (
          <LivePulseDot />
        )}
        <span className="hidden sm:inline">
          {isInitializing
            ? "Connecting…"
            : isConnected
            ? `Live${peerCount > 0 ? ` · ${peerCount + 1}` : ""}`
            : "Reconnecting…"}
        </span>
        <Users className="ml-1 h-3.5 w-3.5 sm:hidden" />
      </Button>

      <ShareDialog
        open={open}
        onOpenChange={setOpen}
        collabUrl={collabUrl}
        copied={copied}
        onCopy={handleCopy}
        isOwner={isOwner}
        hasOwnership
        showStop={isOwner}
        onStop={handleStop}
        onLeave={handleLeave}
        isConnected={isConnected}
        isInitializing={isInitializing}
        isReconnecting={isReconnecting}
      />
    </>
  );
}

function LivePulseDot() {
  return (
    <span className="relative mr-1.5 flex h-2 w-2 shrink-0">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
    </span>
  );
}

function AmberPulseDot() {
  return (
    <span className="relative mr-1.5 flex h-2 w-2 shrink-0">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
    </span>
  );
}

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  collabUrl: string;
  copied: boolean;
  onCopy: () => void;
  isOwner: boolean;
  /** Whether this session has a meaningful owner/guest concept. Workspace
   *  mode passes false because ownership doesn't apply there. */
  hasOwnership: boolean;
  showStop: boolean;
  onStop: () => void;
  onLeave: () => void;
  isConnected: boolean;
  isInitializing: boolean;
  isReconnecting: boolean;
}

function ShareDialog({
  open,
  onOpenChange,
  collabUrl,
  copied,
  onCopy,
  isOwner,
  hasOwnership,
  showStop,
  onStop,
  onLeave,
  isConnected,
  isInitializing,
  isReconnecting,
}: ShareDialogProps) {
  const peers = useAwarenessStore((s) => s.peers);
  const selfClientId = useAwarenessStore((s) => s.selfClientId);
  const selfName = useAwarenessStore((s) => s.selfName);
  const selfColor = useAwarenessStore((s) => s.selfColor);

  const handleKick = useCallback((clientId: number, name: string) => {
    if (!isOwner) return;
    CollabDoc.getInstance()?.kick(clientId);
    toast.success(`Removed ${name} from the session`);
  }, [isOwner]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-100">
            <Users className="h-4 w-4" />
            Live collaboration
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <ConnectionStatusRow
            isConnected={isConnected}
            isInitializing={isInitializing}
            isReconnecting={isReconnecting}
          />

          {hasOwnership && !isOwner && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-[11px] text-zinc-400">
              You joined as a guest.
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Invite link
            </label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={collabUrl}
                className="h-9 flex-1 bg-zinc-900 border-zinc-800 text-xs text-zinc-300 font-mono"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 border border-zinc-800 bg-zinc-900 hover:bg-zinc-800"
                onClick={onCopy}
                title="Copy link"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                In this session
              </label>
              <span className="text-[11px] text-zinc-500">
                {peers.length + 1} connected
              </span>
            </div>

            <div className="max-h-64 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/40 divide-y divide-zinc-800/80">
              <SelfRow
                name={selfName || "You"}
                color={selfColor}
                clientId={selfClientId ?? 0}
                isOwner={isOwner}
              />
              {peers.map((peer) => (
                <UserRow
                  key={peer.clientId}
                  name={peer.user.name}
                  color={peer.user.color}
                  isSelf={false}
                  clientId={peer.clientId}
                  onKick={
                    isOwner ? () => handleKick(peer.clientId, peer.user.name) : undefined
                  }
                />
              ))}
              {peers.length === 0 && (
                <div className="px-3 py-3 text-center text-[11px] text-zinc-500">
                  Waiting for others to join…
                </div>
              )}
            </div>
          </div>

          {isOwner && showStop && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onStop}
              className="h-8 w-full border border-zinc-800 text-xs text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-200"
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Stop sharing
            </Button>
          )}
          {hasOwnership && !isOwner && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onLeave}
              className="h-8 w-full border border-zinc-800 text-xs text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-200"
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Leave session
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConnectionStatusRow({
  isConnected,
  isInitializing,
  isReconnecting,
}: {
  isConnected: boolean;
  isInitializing: boolean;
  isReconnecting: boolean;
}) {
  let label: string;
  let dotClass: string;
  let pingClass: string | null = null;
  if (isInitializing) {
    label = "Connecting to collaboration server…";
    dotClass = "bg-amber-500";
  } else if (isConnected) {
    label = "Connected";
    dotClass = "bg-emerald-500";
    pingClass = "bg-emerald-400";
  } else if (isReconnecting) {
    label = "Reconnecting — retrying in the background";
    dotClass = "bg-amber-500";
    pingClass = "bg-amber-400";
  } else {
    label = "Disconnected";
    dotClass = "bg-rose-500";
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-300">
      <span className="relative flex h-2 w-2 shrink-0">
        {pingClass && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${pingClass}`} />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dotClass}`} />
      </span>
      <span className="flex-1">{label}</span>
    </div>
  );
}

function UserRow({
  name,
  color,
  isSelf,
  clientId,
  onKick,
}: {
  name: string;
  color: string;
  isSelf: boolean;
  clientId: number;
  onKick?: () => void;
}) {
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 group">
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white select-none"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      >
        {initials}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-xs font-medium text-zinc-100">
          {name}
          {isSelf && (
            <span className="ml-1.5 text-[10px] font-normal text-zinc-500">(you)</span>
          )}
        </span>
        <span className="text-[10px] text-zinc-500">
          {isSelf ? "Host controls" : `ID · ${clientId}`}
        </span>
      </div>
      {!isSelf && onKick && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onKick}
          title={`Remove ${name}`}
          className="h-7 w-7 shrink-0 rounded-md text-zinc-500 opacity-0 transition-opacity hover:bg-rose-500/10 hover:text-rose-400 group-hover:opacity-100 focus-visible:opacity-100"
        >
          <UserX className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

function SelfRow({
  name,
  color,
  clientId,
  isOwner,
}: {
  name: string;
  color: string;
  clientId: number;
  isOwner: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const editing = draft !== null;
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEditing = useCallback(() => setDraft(name), [name]);
  const cancel = useCallback(() => setDraft(null), []);

  const commit = useCallback(() => {
    if (draft === null) return;
    const next = draft.trim();
    if (next && next !== name) {
      CollabDoc.getInstance()?.setUserName(next);
    }
    setDraft(null);
  }, [draft, name]);

  const initials = name.slice(0, 2).toUpperCase();

  return (
    <div className="flex items-center gap-2.5 px-3 py-2 group">
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white select-none"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      >
        {initials}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {editing ? (
          <Input
            ref={inputRef}
            value={draft ?? ""}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              }
            }}
            maxLength={32}
            aria-label="Your display name"
            className="h-6 bg-zinc-900 border-zinc-700 px-1.5 text-xs text-zinc-100 focus-visible:ring-1 focus-visible:ring-zinc-600"
          />
        ) : (
          <button
            type="button"
            onClick={startEditing}
            title="Rename yourself"
            className="flex items-center gap-1.5 truncate text-left text-xs font-medium text-zinc-100 hover:text-white"
          >
            <span className="truncate">{name}</span>
            <span className="text-[10px] font-normal text-zinc-500">(you)</span>
            {isOwner && (
              <span className="rounded-sm bg-emerald-500/10 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-emerald-300">
                owner
              </span>
            )}
          </button>
        )}
        <span className="text-[10px] text-zinc-500">
          {editing ? "Enter to save · Esc to cancel" : isOwner ? "Host controls" : `ID · ${clientId}`}
        </span>
      </div>

      {!editing && (
        <Button
          variant="ghost"
          size="icon"
          onClick={startEditing}
          title="Rename"
          className="h-7 w-7 shrink-0 rounded-md text-zinc-500 opacity-0 transition-opacity hover:bg-zinc-800 hover:text-zinc-200 group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
