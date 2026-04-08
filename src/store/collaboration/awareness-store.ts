"use client";

import { create } from "zustand";

export interface PeerAwareness {
  clientId: number;
  user: {
    name: string;
    color: string;
    colorLight: string;
  };
  selectedNodeId: string | null;
}

export interface AwarenessStoreState {
  selfName: string;
  selfColor: string;
  selfColorLight: string;
  peers: PeerAwareness[];
  _setSelf: (name: string, color: string, colorLight: string) => void;
  _setPeers: (peers: PeerAwareness[]) => void;
}

export const useAwarenessStore = create<AwarenessStoreState>()((set) => ({
  selfName: "",
  selfColor: "#7c3aed",
  selfColorLight: "#ede9fe",
  peers: [],
  _setSelf: (name, color, colorLight) => set({ selfName: name, selfColor: color, selfColorLight: colorLight }),
  _setPeers: (peers) => set({ peers }),
}));
