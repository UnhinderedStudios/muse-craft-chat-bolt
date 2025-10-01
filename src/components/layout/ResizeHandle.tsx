import React from "react";
import { cn } from "@/lib/utils";

type ResizeHandleProps = {
  direction: "top" | "right" | "bottom" | "left" | "corner";
  onMouseDown: (e: React.MouseEvent) => void;
  isResizing: boolean;
  className?: string;
};

export const ResizeHandle: React.FC<ResizeHandleProps> = ({
  direction,
  onMouseDown,
  isResizing,
  className,
}) => {
  const getPositionClasses = () => {
    switch (direction) {
      case "top":
        return "top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-accent-primary/30";
      case "right":
        return "top-0 right-0 bottom-0 w-1 cursor-ew-resize hover:bg-accent-primary/30";
      case "bottom":
        return "bottom-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-accent-primary/30";
      case "left":
        return "top-0 left-0 bottom-0 w-1 cursor-ew-resize hover:bg-accent-primary/30";
      case "corner":
        return "bottom-0 right-0 w-4 h-4 cursor-nw-resize";
      default:
        return "";
    }
  };

  const getResizingClasses = () => {
    if (!isResizing) return "";
    return "bg-accent-primary/50";
  };

  if (direction === "corner") {
    return (
      <div
        className={cn(
          "absolute transition-colors duration-200 z-50",
          getPositionClasses(),
          getResizingClasses(),
          isResizing ? "bg-accent-primary/50" : "bg-white/20 hover:bg-white/40",
          className
        )}
        onMouseDown={onMouseDown}
        style={{
          clipPath: "polygon(100% 0%, 0% 100%, 100% 100%)",
          borderBottomRightRadius: "16px",
        }}
      >
        <div className="absolute bottom-1 right-1 w-1 h-1 bg-white/60 rounded-full"></div>
        <div className="absolute bottom-1 right-2.5 w-1 h-1 bg-white/40 rounded-full"></div>
        <div className="absolute bottom-2.5 right-1 w-1 h-1 bg-white/40 rounded-full"></div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "absolute transition-colors duration-200 z-50",
        getPositionClasses(),
        getResizingClasses(),
        className
      )}
      onMouseDown={onMouseDown}
    />
  );
};
