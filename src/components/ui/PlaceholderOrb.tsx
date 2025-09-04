import React from "react";
import { cn } from "@/lib/utils";

interface PlaceholderOrbProps {
  className?: string;
}

export const PlaceholderOrb: React.FC<PlaceholderOrbProps> = ({ className }) => {
  return (
    <div className={cn("flex items-center justify-center w-full h-full", className)}>
      {/* Outer glow ring */}
      <div className="relative w-16 h-16">
        {/* Rotating glow ring */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-pink-500/20 to-purple-500/20 animate-spin" 
             style={{ animationDuration: '3s' }} />
        
        {/* Inner orb */}
        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-pink-400/30 to-pink-600/30 shadow-lg shadow-pink-500/20 animate-pulse" />
        
        {/* Core dot */}
        <div className="absolute inset-6 rounded-full bg-pink-400/50 animate-pulse" 
             style={{ animationDelay: '0.5s' }} />
      </div>
    </div>
  );
};