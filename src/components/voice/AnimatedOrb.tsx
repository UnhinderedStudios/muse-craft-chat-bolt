import React from "react";
import { cn } from "@/lib/utils";

interface AnimatedOrbProps {
  state: "idle" | "listening" | "speaking" | "processing";
}

export const AnimatedOrb: React.FC<AnimatedOrbProps> = ({ state }) => {
  const getGlowClasses = () => {
    switch (state) {
      case "listening":
        return "animate-glow-spin";
      case "speaking":
        return "shadow-[0_0_160px_hsl(var(--accent-primary)_/_1)] animate-pulse";
      case "processing":
        return "animate-breathe-intense";
      default:
        return "animate-breathe";
    }
  };

  const getInnerContent = () => {
    if (state === "speaking") {
      return (
        <div className="absolute inset-0 rounded-full overflow-hidden">
          {/* Futuristic wave visualization */}
          <div className="absolute inset-8 rounded-full">
            {/* Animated gradient rings */}
            <div className="absolute inset-0 rounded-full bg-gradient-conic from-accent-primary/60 via-transparent to-accent-primary/60 animate-spin" style={{ animationDuration: '3s' }} />
            <div className="absolute inset-4 rounded-full bg-gradient-conic from-transparent via-accent-primary/40 to-transparent animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }} />
            <div className="absolute inset-8 rounded-full bg-gradient-radial from-accent-primary/30 to-transparent animate-pulse" />
          </div>
          {/* Pulsing center */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-accent-primary rounded-full animate-ping" />
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
      <div className="relative w-64 h-64 rounded-full border border-white/80 backdrop-blur-sm transition-all duration-500">
        {/* Inner Content */}
        {getInnerContent()}
      </div>
    </div>
  );
};