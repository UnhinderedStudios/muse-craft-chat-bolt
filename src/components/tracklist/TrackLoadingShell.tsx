import React from "react";
import { Progress } from "@/components/ui/progress";

interface TrackLoadingShellProps {
  progress: number;
  trackNumber: number;
}

export function TrackLoadingShell({ progress, trackNumber }: TrackLoadingShellProps) {
  return (
    <div className="animate-fade-in">
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4 mb-3 h-[120px] flex items-center gap-4">
        {/* Album art placeholder with pink spinning loader */}
        <div className="relative w-16 h-16 bg-white/10 rounded-lg flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-pink-500/20 to-purple-500/20 animate-pulse"></div>
          <div className="relative w-8 h-8 border-2 border-pink-400/30 border-t-pink-400 rounded-full animate-spin"></div>
        </div>
        
        {/* Track info placeholder */}
        <div className="flex-1 space-y-3">
          {/* Title placeholder */}
          <div className="flex items-center gap-2">
            <div className="h-5 bg-white/20 rounded animate-pulse" style={{ width: `${120 + Math.random() * 80}px` }}></div>
            <div className="text-xs text-white/40 font-mono">#{trackNumber}</div>
          </div>
          
          {/* Progress bar - thin pink line */}
          <div className="space-y-1">
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-pink-400 to-pink-500 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="text-xs text-white/40">Generating...</div>
          </div>
          
          {/* Parameters placeholder */}
          <div className="flex gap-1.5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-5 bg-white/10 rounded-full animate-pulse"
                style={{ 
                  width: `${40 + Math.random() * 30}px`,
                  animationDelay: `${i * 0.2}s`
                }}
              ></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}