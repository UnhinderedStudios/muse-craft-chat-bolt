import React from "react";
import EllipsisMarquee from "@/components/ui/EllipsisMarquee";

interface TrackLoadingShellProps {
  progress: number;
  trackNumber: number;
  coverUrl?: string;
  title?: string;
}

export function TrackLoadingShell({ progress, trackNumber, coverUrl, title }: TrackLoadingShellProps) {
  return (
    <div className="animate-fade-in">
      <div className="bg-[#1e1e1e] rounded-xl p-4 flex items-center gap-4 min-h-[56px] hover:bg-[#252525] transition-colors">
        {/* Album art placeholder with scanning animation */}
        <div className="relative shrink-0 w-10 h-10 rounded-md bg-black/30 overflow-hidden">
          {coverUrl ? (
            <>
              <img 
                src={coverUrl} 
                alt="Album cover" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent animate-scanning"></div>
            </>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent-primary/15 to-transparent animate-scanning"></div>
          )}
        </div>
        
        {/* Track info area */}
        <div className="flex-1 min-w-0 pr-2">
          {/* Title with marquee animation */}
          <div className="h-3 mb-1 flex items-center">
            <EllipsisMarquee
              text={`No Artist – ${title || "Loading..."}`}
              className="text-xs text-white/60 animate-pulse"
              speedPxPerSec={70}
              gapPx={32}
            />
          </div>
          
          {/* Progress bar */}
          <div className="relative h-1.5 bg-white/5 rounded overflow-hidden w-full">
            {/* Scanning animation background */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent-primary/15 to-transparent animate-scanning"></div>
            {/* Actual progress */}
            <div 
              className="h-full bg-gradient-to-r from-accent-primary to-accent-primary/80 rounded transition-all duration-300 ease-out relative"
              style={{ 
                width: `${progress}%`,
                boxShadow: '0 0 8px hsl(var(--accent-primary) / 0.6), 0 0 4px hsl(var(--accent-primary) / 0.4)'
              }}
            >
              <div className="absolute right-0 top-0 w-8 h-full bg-gradient-to-r from-transparent to-accent-primary/20 blur-sm"></div>
            </div>
          </div>
        </div>
        
        {/* Play button area - spinning ring loader */}
        <div className="shrink-0 w-8 h-8 flex items-center justify-center">
          <div className="relative w-4 h-4">
            {/* Background ring */}
            <div className="absolute inset-0 border-2 border-accent-primary/20 rounded-full"></div>
            {/* Spinning bright segment */}
            <div className="absolute inset-0 border-2 border-transparent border-t-accent-primary rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    </div>
  );
}