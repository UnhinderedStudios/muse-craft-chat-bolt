import React, { useEffect } from 'react';
import { useDrag } from '@/contexts/DragContext';
import { DragTrackClone } from './DragTrackClone';

export const DragOverlay: React.FC = () => {
  const { dragState, updateDragPosition, endDrag } = useDrag();

  useEffect(() => {
    if (!dragState.isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      updateDragPosition(e.clientX, e.clientY);
    };

    const handleMouseUp = () => {
      endDrag();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        endDrag();
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);

    // Prevent text selection during drag
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.userSelect = '';
    };
  }, [dragState.isDragging, updateDragPosition, endDrag]);

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