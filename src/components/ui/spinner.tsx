import React from "react";
import { cn } from "@/lib/utils";

interface SpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const Spinner: React.FC<SpinnerProps> = ({ className, size = "md" }) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6", 
    lg: "w-8 h-8"
  };

  return (
    <div
      className={cn(
        "animate-spin rounded-full border-2 border-transparent border-t-white",
        "shadow-[0_0_10px_rgba(255,255,255,0.6)]",
        sizeClasses[size],
        className
      )}
      style={{
        filter: "drop-shadow(0 0 4px rgba(255, 255, 255, 0.8))"
      }}
    />
  );
};