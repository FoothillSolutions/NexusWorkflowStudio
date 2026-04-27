"use client";

import { create } from "zustand";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 21);

export interface CollabState {
  roomId: string | null;
  isConnected: boolean;
  isInitializing: boolean;
  isOwner: boolean;
  peerCount: number;
  // Internal setters — used by CollabDoc
  _setRoomId: (id: string | null) => void;
  _setConnected: (v: boolean) => void;
  _setInitializing: (v: boolean) => void;
  _setIsOwner: (v: boolean) => void;
  _setPeerCount: (n: number) => void;
}

export const useCollabStore = create<CollabState>()((set) => ({
  roomId: null,
  isConnected: false,
  isInitializing: false,
  isOwner: false,
  peerCount: 0,
  _setRoomId: (id) => set({ roomId: id }),
  _setConnected: (v) => set({ isConnected: v }),
  _setInitializing: (v) => set({ isInitializing: v }),
  _setIsOwner: (v) => set({ isOwner: v }),
  _setPeerCount: (n) => set({ peerCount: n }),
}));

/** Generate a new room ID and push it to the URL. Returns the room ID. */
export function createRoomId(): string {
  return nanoid();
}
