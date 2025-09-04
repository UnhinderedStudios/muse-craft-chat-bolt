import React from "react";
import { cn } from "@/lib/utils";

interface PlaceholderOrbProps {
  className?: string;
}

export const PlaceholderOrb: React.FC<PlaceholderOrbProps> = ({ className }) => {
  return (
    <div className={cn("flex items-center justify-center w-full h-full -mt-4", className)}>
      <div className="relative w-14 h-14">
        {/* Spinning gradient orb with blur and glow */}
        <div 
          className="absolute inset-0 rounded-full animate-spin"
          style={{
            background: 'linear-gradient(45deg, rgb(236, 72, 153) 35%, rgb(244, 114, 182))',
            filter: 'blur(1px)',
            boxShadow: '0px -5px 20px 0px rgb(236, 72, 153), 0px 5px 20px 0px rgb(244, 114, 182)',
            animationDuration: '1.7s'
          }}
        />
        
        {/* Inner dark background */}
        <div 
          className="absolute inset-0 rounded-full"
          style={{
            backgroundColor: 'rgb(36, 36, 36)',
            filter: 'blur(10px)'
          }}
        />
      </div>
    </div>
  );
};