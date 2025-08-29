import { useState } from "react";
import { CHAT_HEIGHT_LIMITS } from "@/utils/constants";

export function useResize() {
  const [chatHeight, setChatHeight] = useState(CHAT_HEIGHT_LIMITS.DEFAULT);
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startY = e.clientY;
    const startHeight = chatHeight;
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - startY;
      const proposedHeight = startHeight + deltaY;
      
      // Enforce strict boundaries - clamp the height but keep resize operation active
      const newHeight = Math.max(
        CHAT_HEIGHT_LIMITS.MIN, 
        Math.min(CHAT_HEIGHT_LIMITS.MAX, proposedHeight)
      );
      
      // Only update if height actually changed
      if (newHeight !== chatHeight) {
        setChatHeight(newHeight);
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

  return {
    chatHeight,
    isResizing,
    handleMouseDown
  };
}