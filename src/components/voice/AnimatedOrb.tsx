import React from "react";
import { cn } from "@/lib/utils";

interface AnimatedOrbProps {
  state: "idle" | "listening" | "speaking" | "processing";
}

export const AnimatedOrb: React.FC<AnimatedOrbProps> = ({ state }) => {
  const getGlowClasses = () => {
    switch (state) {
      case "listening":
        return "shadow-[0_0_80px_hsl(var(--accent-primary)_/_0.6)] animate-glow-spin";
      case "speaking":
        return "shadow-[0_0_120px_hsl(var(--accent-primary)_/_0.9)] animate-pulse";
      case "processing":
        return "shadow-[0_0_80px_hsl(var(--accent-primary)_/_0.7)] animate-breathe-intense";
      default:
        return "shadow-[0_0_40px_hsl(var(--foreground)_/_0.3)] animate-breathe";
    }
  };

  const getInnerContent = () => {
    if (state === "speaking") {
      return (
        <div className="absolute inset-8 rounded-full overflow-hidden">
          {/* Wave visualization */}
          <div className="absolute inset-0 bg-gradient-to-r from-accent-primary/20 to-accent-primary/40 animate-wave-flow rounded-full" />
          <div className="absolute inset-2 bg-gradient-to-l from-accent-primary/30 to-accent-primary/10 animate-wave-flow rounded-full" style={{ animationDelay: '0.3s' }} />
          <div className="absolute inset-4 bg-gradient-to-r from-accent-primary/40 to-accent-primary/20 animate-wave-flow rounded-full" style={{ animationDelay: '0.6s' }} />
        </div>
      );
    }
    return null;
  };

  return (
    <div className="relative">
      {/* Glow Layer */}
      <div
        className={cn(
          "w-64 h-64 rounded-full transition-all duration-500 ease-in-out",
          "absolute inset-0",
          getGlowClasses()
        )}
      />
      
      {/* Base Orb */}
      <div className="relative w-64 h-64 rounded-full bg-card border border-border/30 backdrop-blur-sm transition-all duration-500">
        {/* Inner Content */}
        {getInnerContent()}
        
        {/* Core Orb */}
        <div
          className={cn(
            "absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2",
            "w-16 h-16 rounded-full transition-all duration-300",
            state === "speaking" 
              ? "bg-accent-primary animate-pulse" 
              : "bg-foreground/80"
          )}
        />
      </div>
    </div>
  );
};