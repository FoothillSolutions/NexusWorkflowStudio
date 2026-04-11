"use client";

import { create } from "zustand";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 21);

export type SyncBackend = "yjs" | "spacetimedb" | null;

export interface CollabState {
  roomId: string | null;
  isConnected: boolean;
  isInitializing: boolean;
  peerCount: number;
  syncBackend: SyncBackend;
  // Internal setters — used by CollabDoc and SpacetimeDB sync bridges
  _setRoomId: (id: string | null) => void;
  _setConnected: (v: boolean) => void;
  _setInitializing: (v: boolean) => void;
  _setPeerCount: (n: number) => void;
  _setSyncBackend: (backend: SyncBackend) => void;
}

export const useCollabStore = create<CollabState>()((set) => ({
  roomId: null,
  isConnected: false,
  isInitializing: false,
  peerCount: 0,
  syncBackend: null,
  _setRoomId: (id) => set({ roomId: id }),
  _setConnected: (v) => set({ isConnected: v }),
  _setInitializing: (v) => set({ isInitializing: v }),
  _setPeerCount: (n) => set({ peerCount: n }),
  _setSyncBackend: (backend) => set({ syncBackend: backend }),
}));

/** Generate a new room ID and push it to the URL. Returns the room ID. */
export function createRoomId(): string {
  return nanoid();
}
