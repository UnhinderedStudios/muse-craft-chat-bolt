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
        return "animate-loading-spin";
      default:
        return "animate-breathe";
    }
  };

  const getInnerContent = () => {
    if (state === "speaking") {
      return (
        <div className="absolute inset-0 rounded-full overflow-hidden">
          {/* Waveform visualization */}
          <div className="absolute inset-8 rounded-full flex items-center justify-center">
            {/* Vertical bars like a waveform */}
            <div className="flex items-center gap-1 h-16">
              <div className="w-1 bg-accent-primary/60 animate-waveform-1 rounded-full" />
              <div className="w-1 bg-accent-primary/70 animate-waveform-2 rounded-full" />
              <div className="w-1 bg-accent-primary/50 animate-waveform-3 rounded-full" />
              <div className="w-1 bg-accent-primary/80 animate-waveform-4 rounded-full" />
              <div className="w-1 bg-accent-primary/60 animate-waveform-5 rounded-full" />
              <div className="w-1 bg-accent-primary/70 animate-waveform-6 rounded-full" />
              <div className="w-1 bg-accent-primary/55 animate-waveform-7 rounded-full" />
              <div className="w-1 bg-accent-primary/75 animate-waveform-8 rounded-full" />
              <div className="w-1 bg-accent-primary/65 animate-waveform-9 rounded-full" />
              <div className="w-1 bg-accent-primary/50 animate-waveform-10 rounded-full" />
            </div>
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
        {/* Inner Content */}
        {getInnerContent()}
      </div>
    </div>
  );
};