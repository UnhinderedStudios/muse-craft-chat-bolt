import { useState } from "react";

const WIDTH_LIMITS = {
  MIN: 300,
  DEFAULT: 400,
  MAX: 600
};

export function useWidthResize() {
  const [panelWidth, setPanelWidth] = useState(WIDTH_LIMITS.DEFAULT);
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startWidth = panelWidth;
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = startX - e.clientX; // Reversed for right-side resize
      const newWidth = Math.max(
        WIDTH_LIMITS.MIN, 
        Math.min(WIDTH_LIMITS.MAX, startWidth + deltaX)
      );
      setPanelWidth(newWidth);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return {
    panelWidth,
    isResizing,
    handleMouseDown
  };
}