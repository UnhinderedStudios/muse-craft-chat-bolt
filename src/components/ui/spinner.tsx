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
    <div className="flex justify-start">
      <div className="max-w-[85%] px-4 py-3 rounded-[16px] bg-[#000000] border border-accent-primary shadow-[0_0_20px_rgba(202,36,116,0.4)] flex items-center justify-center">
        <div
          className={cn(
            "animate-spin rounded-full border-2 border-transparent border-t-accent-primary",
            "shadow-[0_0_10px_rgba(202,36,116,0.6)]",
            sizeClasses[size],
            className
          )}
          style={{
            filter: "drop-shadow(0 0 4px rgba(202, 36, 116, 0.8))"
          }}
        />
      </div>
    </div>
  );
};