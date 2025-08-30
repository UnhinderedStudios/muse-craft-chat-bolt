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

  const getLoadingBar = () => {
    if (state === "processing") {
      return (
        <div className="absolute inset-0 rounded-full animate-loading-spin" />
      );
    }
    return null;
  };

  const getInnerContent = () => {
    if (state === "speaking") {
      return (
        <div className="absolute inset-0 rounded-full overflow-hidden">
          {/* Lava lamp energy orb */}
          <div className="absolute inset-4 rounded-full">
            {/* Multiple floating energy blobs */}
            <div className="absolute top-1/4 left-1/3 w-8 h-12 bg-accent-primary/60 rounded-full animate-lava-blob-1" />
            <div className="absolute top-1/2 right-1/4 w-6 h-10 bg-accent-primary/40 rounded-full animate-lava-blob-2" />
            <div className="absolute bottom-1/3 left-1/2 w-10 h-8 bg-accent-primary/50 rounded-full animate-lava-blob-3" />
            <div className="absolute top-2/3 left-1/4 w-7 h-9 bg-accent-primary/35 rounded-full animate-lava-blob-4" />
            <div className="absolute bottom-1/4 right-1/3 w-5 h-7 bg-accent-primary/45 rounded-full animate-lava-blob-5" />
            {/* Energy particles */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-accent-primary rounded-full animate-ping" />
            <div className="absolute top-1/3 right-1/3 w-2 h-2 bg-accent-primary/80 rounded-full animate-pulse" />
            <div className="absolute bottom-1/3 left-1/3 w-2 h-2 bg-accent-primary/60 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
          </div>
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
        {/* Loading Bar for Processing */}
        {getLoadingBar()}
        {/* Inner Content */}
        {getInnerContent()}
      </div>
    </div>
  );
};