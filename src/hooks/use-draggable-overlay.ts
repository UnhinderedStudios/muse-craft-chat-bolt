import { useState, useCallback } from "react";

export function useDraggableOverlay() {
  const [isDragging, setIsDragging] = useState(false);
  const [overlayPosition, setOverlayPosition] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [insertPosition, setInsertPosition] = useState<number | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(true);
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newPosition = {
        x: moveEvent.clientX - dragOffset.x,
        y: moveEvent.clientY - dragOffset.y
      };
      
      setOverlayPosition(newPosition);
      
      // Calculate insert position based on y coordinate
      // This will be used to determine where to insert the overlay in the track list
      const trackHeight = 80; // Approximate track height
      const insertIndex = Math.floor((moveEvent.clientY - 200) / trackHeight);
      setInsertPosition(Math.max(0, insertIndex));
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [dragOffset.x, dragOffset.y]);

  const resetPosition = useCallback(() => {
    setOverlayPosition({ x: 0, y: 0 });
    setInsertPosition(null);
    setIsDragging(false);
  }, []);

  return {
    isDragging,
    overlayPosition,
    insertPosition,
    handleMouseDown,
    resetPosition
  };
}