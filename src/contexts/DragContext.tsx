import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { DragState, DragContextType } from '@/types/drag';
import { TrackItem } from '@/types';

const initialDragState: DragState = {
  isDragging: false,
  draggedTrack: null,
  mousePosition: { x: 0, y: 0 },
  activeDropZone: null,
  dragStartPos: { x: 0, y: 0 },
};

const DragContext = createContext<DragContextType | undefined>(undefined);

export const useDrag = () => {
  const context = useContext(DragContext);
  if (!context) {
    throw new Error('useDrag must be used within a DragProvider');
  }
  return context;
};

interface DragProviderProps {
  children: React.ReactNode;
}

export const DragProvider: React.FC<DragProviderProps> = ({ children }) => {
  const [dragState, setDragState] = useState<DragState>(initialDragState);
  const dragThreshold = useRef({ distance: 5, time: 150 });
  const dragStartTime = useRef<number>(0);

  const updateDragPosition = useCallback((x: number, y: number) => {
    setDragState(prev => {
      if (!prev.draggedTrack) return prev;

      const deltaX = x - prev.dragStartPos.x;
      const deltaY = y - prev.dragStartPos.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const timeElapsed = Date.now() - dragStartTime.current;

      const shouldStartDragging = 
        !prev.isDragging && 
        distance > dragThreshold.current.distance && 
        timeElapsed > dragThreshold.current.time;

      if (shouldStartDragging) {
        console.log('✅ Drag threshold met, starting visual drag');
      }

      return {
        ...prev,
        isDragging: shouldStartDragging || prev.isDragging,
        mousePosition: { x, y },
      };
    });
  }, []);

  const endDrag = useCallback(() => {
    console.log('🏁 Ending drag operation');
    setDragState(prev => {
      // Idempotent cleanup - only clean up if we're actually dragging
      if (prev.isDragging || prev.draggedTrack) {
        // Remove any lingering event listeners
        document.body.style.userSelect = '';
        return initialDragState;
      }
      return prev;
    });
  }, []);

  const startDrag = useCallback((track: TrackItem, event: React.MouseEvent) => {
    const { clientX, clientY } = event;
    dragStartTime.current = Date.now();
    console.log('🚀 Starting drag for track:', track.title);
    
    setDragState(prev => ({
      ...prev,
      isDragging: false, // Start as candidate, not dragging yet
      draggedTrack: track,
      mousePosition: { x: clientX, y: clientY },
      dragStartPos: { x: clientX, y: clientY },
    }));

    // Add global listeners immediately when drag candidate is created
    const handleGlobalMouseMove = (e: MouseEvent) => {
      updateDragPosition(e.clientX, e.clientY);
    };

    const handleGlobalMouseUp = () => {
      endDrag();
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.body.style.userSelect = '';
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        endDrag();
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.userSelect = '';
      }
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.userSelect = 'none';
  }, [updateDragPosition, endDrag]);

  const setActiveDropZone = useCallback((zoneId: string | null) => {
    setDragState(prev => ({
      ...prev,
      activeDropZone: zoneId,
    }));
  }, []);

  const contextValue: DragContextType = {
    dragState,
    startDrag,
    endDrag,
    updateDragPosition,
    setActiveDropZone,
  };

  return (
    <DragContext.Provider value={contextValue}>
      {children}
    </DragContext.Provider>
  );
};