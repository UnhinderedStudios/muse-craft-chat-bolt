import React from "react";
import { cn } from "@/lib/utils";

interface ResizableContainerProps {
  children: React.ReactNode;
  isResizing: boolean;
  handleMouseDown: (e: React.MouseEvent) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const ResizableContainer: React.FC<ResizableContainerProps> = ({
  children,
  isResizing,
  handleMouseDown,
  className,
  style
}) => {
  return (
    <div className={cn("relative", className)} style={style}>
      {children}
      
      {/* Resize Handle */}
      <div 
        className={cn(
          "absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 cursor-ew-resize group transition-colors duration-200",
          isResizing ? "bg-accent-primary/50" : "bg-white/20 hover:bg-white/40"
        )}
        onMouseDown={handleMouseDown}
        style={{ 
          borderRadius: '2px'
        }}
      >
        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white/60 rounded-full"></div>
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-1 h-1 bg-white/40 rounded-full"></div>
        <div className="absolute top-5 left-1/2 -translate-x-1/2 w-1 h-1 bg-white/40 rounded-full"></div>
      </div>
    </div>
  );
};