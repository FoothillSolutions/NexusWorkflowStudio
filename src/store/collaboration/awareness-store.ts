"use client";

import { create } from "zustand";

export interface CursorPosition {
  x: number;
  y: number;
}

export interface PeerAwareness {
  clientId: number;
  user: {
    name: string;
    color: string;
    colorLight: string;
  };
  selectedNodeId: string | null;
  cursor: CursorPosition | null;
  /** Last activity timestamp (ms since epoch). Peers without recent
   *  activity are rendered as idle. `null` means unknown. */
  lastActiveAt: number | null;
}

export interface AwarenessStoreState {
  selfClientId: number | null;
  selfName: string;
  selfColor: string;
  selfColorLight: string;
  peers: PeerAwareness[];
  _setSelf: (clientId: number, name: string, color: string, colorLight: string) => void;
  _setPeers: (peers: PeerAwareness[]) => void;
}

export const useAwarenessStore = create<AwarenessStoreState>()((set) => ({
  selfClientId: null,
  selfName: "",
  selfColor: "#7c3aed",
  selfColorLight: "#ede9fe",
  peers: [],
  _setSelf: (clientId, name, color, colorLight) =>
    set({ selfClientId: clientId, selfName: name, selfColor: color, selfColorLight: colorLight }),
  _setPeers: (peers) => set({ peers }),
}));
