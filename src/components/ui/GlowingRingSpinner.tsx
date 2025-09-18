import React from "react";
import { cn } from "@/lib/utils";

interface GlowingRingSpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const GlowingRingSpinner: React.FC<GlowingRingSpinnerProps> = ({ 
  className, 
  size = "md" 
}) => {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12", 
    lg: "w-16 h-16"
  };

  return (
    <div className={cn("relative", sizeClasses[size], className)}>
      {/* Outer spinning ring with pink glow */}
      <div 
        className="absolute inset-0 rounded-full animate-spin"
        style={{
          background: 'conic-gradient(from 0deg, rgb(236, 72, 153), rgb(244, 114, 182), rgb(236, 72, 153))',
          filter: 'blur(1px)',
          boxShadow: '0px -2px 10px 0px rgb(236, 72, 153), 0px 2px 10px 0px rgb(244, 114, 182)',
          animationDuration: '1.7s'
        }}
      />
      
      {/* Inner dark background with white border */}
      <div 
        className="absolute inset-1 rounded-full border border-white/20"
        style={{
          backgroundColor: 'rgb(36, 36, 36)'
        }}
      />
    </div>
  );
};