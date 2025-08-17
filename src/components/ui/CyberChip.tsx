import React from "react";
import { cn } from "@/lib/utils";

interface CyberChipProps {
  children: React.ReactNode;
  variant: "purple" | "teal";
  className?: string;
}

export const CyberChip: React.FC<CyberChipProps> = ({ 
  children, 
  variant, 
  className 
}) => {
  return (
    <span 
      className={cn(
        "inline-flex items-center px-3 py-1 rounded-pill text-sm font-medium",
        variant === "purple" ? "chip-purple" : "chip-teal",
        className
      )}
    >
      {children}
    </span>
  );
};