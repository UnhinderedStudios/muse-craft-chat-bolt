import React, { useEffect } from 'react';
import { useDrag } from '@/contexts/DragContext';
import { DragTrackClone } from './DragTrackClone';

export const DragOverlay: React.FC = () => {
  const { dragState, updateDragPosition, endDrag } = useDrag();

  // DragContext already handles all global events, no need for duplicate listeners

  if (!dragState.isDragging || !dragState.draggedTrack) {
    return null;
  }

  return (
    <DragTrackClone
      track={dragState.draggedTrack}
      position={dragState.mousePosition}
    />
  );
};