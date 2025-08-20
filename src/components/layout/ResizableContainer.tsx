import React from "react";
import { cn } from "@/lib/utils";

interface ResizableContainerProps {
  children: React.ReactNode;
  chatHeight: number;
  onMouseDown: (e: React.MouseEvent) => void;
  isResizing: boolean;
  className?: string;
}

export const ResizableContainer: React.FC<ResizableContainerProps> = ({
  children,
  chatHeight,
  onMouseDown,
  isResizing,
  className
}) => {
  return (
    <div className={cn("relative", className)}>
      {children}
      
      {/* Resize Handle */}
      <div 
        className={cn(
          "absolute bottom-0 right-0 w-4 h-4 cursor-nw-resize group transition-colors duration-200",
          isResizing ? "bg-accent-primary/50" : "bg-white/20 hover:bg-white/40"
        )}
        onMouseDown={onMouseDown}
        style={{ 
          clipPath: 'polygon(100% 0%, 0% 100%, 100% 100%)',
          borderBottomRightRadius: '16px' 
        }}
      >
        <div className="absolute bottom-1 right-1 w-1 h-1 bg-white/60 rounded-full"></div>
        <div className="absolute bottom-1 right-2.5 w-1 h-1 bg-white/40 rounded-full"></div>
        <div className="absolute bottom-2.5 right-1 w-1 h-1 bg-white/40 rounded-full"></div>
      </div>
    </div>
  );
};