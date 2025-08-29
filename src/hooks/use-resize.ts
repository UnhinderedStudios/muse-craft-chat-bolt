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
      
      // Completely stop resize operation when hitting boundaries
      if (proposedHeight < CHAT_HEIGHT_LIMITS.MIN || proposedHeight > CHAT_HEIGHT_LIMITS.MAX) {
        setIsResizing(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        return;
      }
      
      // Enforce strict boundaries with additional validation
      const newHeight = Math.max(
        CHAT_HEIGHT_LIMITS.MIN, 
        Math.min(CHAT_HEIGHT_LIMITS.MAX, proposedHeight)
      );
      
      // Only update if the new height is actually different and within practical bounds
      // Ensure we don't exceed limits that would break scrolling (account for the 140px offset)
      const maxPracticalHeight = Math.min(CHAT_HEIGHT_LIMITS.MAX, window.innerHeight - 200);
      const clampedHeight = Math.min(newHeight, maxPracticalHeight);
      
      // Only update if height actually changed
      if (clampedHeight !== chatHeight) {
        setChatHeight(clampedHeight);
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