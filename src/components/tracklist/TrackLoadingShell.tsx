import React from "react";

interface TrackLoadingShellProps {
  progress: number;
  trackNumber: number;
}

export function TrackLoadingShell({ progress, trackNumber }: TrackLoadingShellProps) {
  return (
    <div className="animate-fade-in">
      <div className="bg-[#1e1e1e] rounded-xl p-4 flex items-center gap-4 h-[88px] hover:bg-[#252525] transition-colors">
        {/* Album art placeholder with scanning animation */}
        <div className="relative w-12 h-12 bg-[#2a2a2a] rounded-lg overflow-hidden flex-shrink-0">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-scanning"></div>
        </div>
        
        {/* Play button area - small pink spinning loader */}
        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-transparent border-t-accent-primary rounded-full animate-spin"></div>
        </div>
        
        {/* Track info area */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Title placeholder - thick pill shape */}
          <div className="h-4 bg-white/15 rounded-full animate-pulse w-48"></div>
          
          {/* Progress bar in controls area */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-accent-primary to-accent-primary/80 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="text-xs text-white/40 font-mono">#{trackNumber}</div>
          </div>
        </div>
        
        {/* Parameters placeholder */}
        <div className="flex gap-1.5 flex-shrink-0">
          <div className="h-6 w-12 bg-white/10 rounded-full animate-pulse"></div>
          <div className="h-6 w-16 bg-white/10 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
          <div className="h-6 w-14 bg-white/10 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
        </div>
      </div>
    </div>
  );
}