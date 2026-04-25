import type { LibraryScope } from "@/types/library";

export interface DocumentsPanelProps {
  open: boolean;
  onClose: () => void;
}

export interface DocumentsPanelControllerState {
  scope: LibraryScope;
}
