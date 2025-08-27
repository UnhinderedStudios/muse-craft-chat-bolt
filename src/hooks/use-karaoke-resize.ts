import { useState } from "react";

export function useKaraokeResize() {
  const [karaokeHeight, setKaraokeHeight] = useState(500); // Default 500px like chat
  const [isKaraokeResizing, setIsKaraokeResizing] = useState(false);

  const handleKaraokeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsKaraokeResizing(true);
    
    const startY = e.clientY;
    const startHeight = karaokeHeight;
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - startY;
      const newHeight = Math.max(300, Math.min(800, startHeight + deltaY)); // Min 300px, Max 800px
      setKaraokeHeight(newHeight);
    };
    
    const handleMouseUp = () => {
      setIsKaraokeResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return {
    karaokeHeight,
    isKaraokeResizing,
    handleKaraokeMouseDown
  };
}