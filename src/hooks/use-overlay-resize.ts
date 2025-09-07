import { useState } from "react";

interface OverlayResizeLimits {
  DEFAULT: number;
  MIN: number;
  MAX: number;
}

const OVERLAY_HEIGHT_LIMITS: OverlayResizeLimits = {
  DEFAULT: 400,
  MIN: 200,
  MAX: window.innerHeight * 0.8
};

export function useOverlayResize() {
  const [overlayHeight, setOverlayHeight] = useState(OVERLAY_HEIGHT_LIMITS.DEFAULT);
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent overlay from closing
    setIsResizing(true);
    
    const startY = e.clientY;
    const startHeight = overlayHeight;
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - startY;
      const proposedHeight = startHeight + deltaY;
      
      // Block upward drag when already at minimum
      if (overlayHeight <= OVERLAY_HEIGHT_LIMITS.MIN && deltaY < 0) {
        return;
      }
      
      // Block downward drag when already at maximum
      const maxHeight = Math.min(OVERLAY_HEIGHT_LIMITS.MAX, window.innerHeight * 0.8);
      if (overlayHeight >= maxHeight && deltaY > 0) {
        return;
      }
      
      // Enforce strict boundaries
      const newHeight = Math.max(
        OVERLAY_HEIGHT_LIMITS.MIN, 
        Math.min(maxHeight, proposedHeight)
      );
      
      // Only update if height actually changed
      if (newHeight !== overlayHeight) {
        setOverlayHeight(newHeight);
      }
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const resetHeight = () => {
    setOverlayHeight(OVERLAY_HEIGHT_LIMITS.DEFAULT);
    setIsResizing(false);
  };

  return {
    overlayHeight,
    isResizing,
    handleMouseDown,
    resetHeight
  };
}