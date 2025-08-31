import { TrackItem } from "./index";

export interface DragState {
  isDragging: boolean;
  draggedTrack: TrackItem | null;
  mousePosition: { x: number; y: number };
  activeDropZone: string | null;
  dragStartPos: { x: number; y: number };
}

export interface DragContextType {
  dragState: DragState;
  startDrag: (track: TrackItem, event: React.MouseEvent) => void;
  endDrag: () => void;
  updateDragPosition: (x: number, y: number) => void;
  setActiveDropZone: (zoneId: string | null) => void;
}