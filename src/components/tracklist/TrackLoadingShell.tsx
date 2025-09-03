import React from "react";

interface TrackLoadingShellProps {
  progress: number;
  trackNumber: number;
}

export function TrackLoadingShell({ progress, trackNumber }: TrackLoadingShellProps) {
  return (
    <div className="animate-fade-in">
      <div className="bg-[#1e1e1e] rounded-xl p-4 flex items-center gap-4 min-h-[56px] hover:bg-[#252525] transition-colors">
        {/* Album art placeholder with scanning animation */}
        <div className="relative shrink-0 w-10 h-10 rounded-md bg-black/30 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-scanning"></div>
        </div>
        
        {/* Track info area */}
        <div className="flex-1 min-w-0">
          {/* Title placeholder - pill shape */}
          <div className="h-3 bg-white/15 rounded-full animate-pulse w-32 mb-1"></div>
          
          {/* Progress bar */}
          <div className="h-1.5 bg-white/5 rounded overflow-hidden">
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
        
        {/* Play button area - small pink spinning loader */}
        <div className="shrink-0 w-8 h-8 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-transparent border-t-accent-primary rounded-full animate-spin"></div>
        </div>
      </div>
    </div>
  );
}