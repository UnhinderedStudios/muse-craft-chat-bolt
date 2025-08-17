import React from "react";
import { cn } from "@/lib/utils";

interface CyberHeaderProps {
  className?: string;
}

export const CyberHeader: React.FC<CyberHeaderProps> = ({ className }) => {
  return (
    <header className={cn("h-16 bg-canvas border-b border-border-main flex items-center justify-between px-6", className)}>
      {/* Left: Brand */}
      <div className="text-text-primary font-bold text-lg tracking-wider">
        ITSOUNDSVIRAL
      </div>

      {/* Center-left: Mode Toggle */}
      <div className="flex items-center bg-card-alt rounded-pill p-1 border border-border-main">
        <button className="px-4 py-2 rounded-pill bg-accent-primary text-white text-sm font-medium">
          Song Creator
        </button>
        <button className="px-4 py-2 rounded-pill text-text-secondary text-sm font-medium hover:text-text-primary transition-colors">
          Artist Creator
        </button>
      </div>

      {/* Center-right: Simple Mode Toggle */}
      <div className="flex items-center gap-3">
        <span className="text-text-secondary text-sm">Simple Mode</span>
        <div className="relative">
          <input 
            type="checkbox" 
            className="sr-only" 
            id="simple-mode-toggle"
          />
          <label 
            htmlFor="simple-mode-toggle" 
            className="block w-12 h-6 bg-border-main rounded-pill cursor-pointer relative"
          >
            <div className="absolute top-1 left-1 w-4 h-4 bg-text-primary rounded-full transition-transform"></div>
          </label>
        </div>
      </div>

      {/* Right: Credits */}
      <div className="text-text-secondary text-sm">
        Credits available: <span className="text-text-primary">8,293</span> →
      </div>
    </header>
  );
};