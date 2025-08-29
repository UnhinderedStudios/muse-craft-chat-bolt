import React from "react";
import { cn } from "@/lib/utils";

interface AnimatedOrbProps {
  state: "idle" | "listening" | "speaking" | "processing";
}

export const AnimatedOrb: React.FC<AnimatedOrbProps> = ({ state }) => {
  const getStateClasses = () => {
    switch (state) {
      case "listening":
        return "animate-spin shadow-[0_0_80px_rgba(34,197,94,0.8)] bg-gradient-to-r from-green-400 to-green-600";
      case "speaking":
        return "animate-pulse shadow-[0_0_100px_rgba(202,36,116,0.9)] bg-gradient-to-r from-accent-primary to-pink-500 scale-110";
      case "processing":
        return "animate-bounce shadow-[0_0_60px_rgba(59,130,246,0.7)] bg-gradient-to-r from-blue-400 to-blue-600";
      default:
        return "shadow-[0_0_40px_rgba(156,163,175,0.5)] bg-gradient-to-r from-surface-secondary to-surface-primary";
    }
  };

  const getInnerOrbClasses = () => {
    switch (state) {
      case "listening":
        return "bg-gradient-to-r from-green-300 to-green-500 animate-ping";
      case "speaking":
        return "bg-gradient-to-r from-pink-300 to-accent-primary animate-pulse";
      case "processing":
        return "bg-gradient-to-r from-blue-300 to-blue-500 animate-spin";
      default:
        return "bg-gradient-to-r from-surface-tertiary to-surface-secondary";
    }
  };

  return (
    <div className="relative">
      {/* Outer Orb */}
      <div
        className={cn(
          "w-64 h-64 rounded-full transition-all duration-500 ease-in-out",
          "border-2 border-white/20 backdrop-blur-sm",
          getStateClasses()
        )}
      >
        {/* Inner Orb */}
        <div
          className={cn(
            "absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2",
            "w-32 h-32 rounded-full transition-all duration-300",
            getInnerOrbClasses()
          )}
        />

        {/* Core Orb */}
        <div
          className={cn(
            "absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2",
            "w-16 h-16 rounded-full transition-all duration-200",
            state === "speaking" ? "bg-white animate-pulse" : "bg-white/80"
          )}
        />

        {/* Frequency Bars (when speaking) */}
        {state === "speaking" && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-end space-x-1">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-white/60 rounded-full animate-pulse"
                style={{
                  height: `${Math.random() * 20 + 10}px`,
                  animationDelay: `${i * 0.1}s`,
                  animationDuration: "0.5s"
                }}
              />
            ))}
          </div>
        )}

        {/* Ripple Effect */}
        {(state === "listening" || state === "speaking") && (
          <>
            <div className="absolute inset-0 rounded-full border-2 border-white/30 animate-ping" />
            <div 
              className="absolute inset-0 rounded-full border-2 border-white/20 animate-ping" 
              style={{ animationDelay: '0.5s' }}
            />
          </>
        )}
      </div>

      {/* Particle Effects */}
      {state !== "idle" && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-white/40 rounded-full animate-bounce"
              style={{
                left: `${50 + Math.cos((i * 30) * Math.PI / 180) * 150}px`,
                top: `${50 + Math.sin((i * 30) * Math.PI / 180) * 150}px`,
                animationDelay: `${i * 0.1}s`,
                animationDuration: "2s"
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};