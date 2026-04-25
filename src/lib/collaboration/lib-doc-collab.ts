"use client";

import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { getCollabServerUrl } from "./config";
import { getColorForClientId, getOrCreateUserName } from "./awareness-names";
import type { LibraryScope } from "@/types/library";

export interface OpenLibraryDocOptions {
  workspaceId: string;
  scope: LibraryScope;
  packId: string;
  docId: string;
  initialContent?: string;
}

export interface LibraryDocRoom {
  provider: HocuspocusProvider;
  ydoc: Y.Doc;
  yText: Y.Text;
  roomId: string;
  destroy: () => void;
}

const activeRooms = new Map<string, LibraryDocRoom>();

export function buildLibraryRoomId(workspaceId: string, scope: LibraryScope, packId: string, docId: string): string {
  return `lib:${workspaceId}:${scope}:${packId}:${docId}`;
}

export function openLibraryDocRoom(options: OpenLibraryDocOptions): LibraryDocRoom {
  const roomId = buildLibraryRoomId(options.workspaceId, options.scope, options.packId, options.docId);
  const existing = activeRooms.get(roomId);
  if (existing) return existing;

  const ydoc = new Y.Doc();
  const yText = ydoc.getText("content");

  const provider = new HocuspocusProvider({
    url: getCollabServerUrl(),
    name: roomId,
    document: ydoc,
    onSynced: ({ state }) => {
      if (state && options.initialContent && yText.length === 0) {
        ydoc.transact(() => {
          yText.insert(0, options.initialContent ?? "");
        });
      }
    },
  });

  const selfName = getOrCreateUserName();
  const colors = getColorForClientId(ydoc.clientID);
  provider.setAwarenessField("user", {
    name: selfName,
    color: colors.color,
    colorLight: colors.colorLight,
  });

  const room: LibraryDocRoom = {
    provider,
    ydoc,
    yText,
    roomId,
    destroy: () => {
      provider.destroy();
      ydoc.destroy();
      activeRooms.delete(roomId);
    },
  };
  activeRooms.set(roomId, room);
  return room;
}

export function closeLibraryDocRoom(roomId: string): void {
  const room = activeRooms.get(roomId);
  if (room) room.destroy();
}

export function getActiveLibraryDocRoom(roomId: string): LibraryDocRoom | undefined {
  return activeRooms.get(roomId);
}
