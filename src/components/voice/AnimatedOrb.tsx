import React from "react";
import { cn } from "@/lib/utils";

interface AnimatedOrbProps {
  state: "idle" | "listening" | "speaking" | "processing";
}

export const AnimatedOrb: React.FC<AnimatedOrbProps> = ({ state }) => {
  const getGlowClasses = () => {
    switch (state) {
      case "listening":
        return "shadow-[0_0_120px_hsl(var(--accent-primary)_/_0.9)] animate-glow-spin";
      case "speaking":
        return "shadow-[0_0_160px_hsl(var(--accent-primary)_/_1)] animate-pulse";
      case "processing":
        return "shadow-[0_0_120px_hsl(var(--accent-primary)_/_0.8)] animate-breathe-intense";
      default:
        return "shadow-[0_0_80px_hsl(var(--foreground)_/_0.6)] animate-breathe";
    }
  };

  const getInnerContent = () => {
    if (state === "speaking") {
      return (
        <div className="absolute inset-0 rounded-full overflow-hidden">
          {/* Wave visualization rings */}
          <div className="absolute inset-8 border-4 border-accent-primary/30 rounded-full animate-wave-flow" />
          <div className="absolute inset-12 border-3 border-accent-primary/40 rounded-full animate-wave-flow" style={{ animationDelay: '0.3s' }} />
          <div className="absolute inset-16 border-2 border-accent-primary/50 rounded-full animate-wave-flow" style={{ animationDelay: '0.6s' }} />
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
      
      {/* Base Ring */}
      <div className="relative w-64 h-64 rounded-full border-4 border-border/40 backdrop-blur-sm transition-all duration-500">
        {/* Inner Content */}
        {getInnerContent()}
      </div>
    </div>
  );
};