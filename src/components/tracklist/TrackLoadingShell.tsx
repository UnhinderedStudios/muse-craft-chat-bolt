import React from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

interface TrackLoadingShellProps {
  progress: number;
  shellIndex: number;
  className?: string;
}

export const TrackLoadingShell: React.FC<TrackLoadingShellProps> = ({
  progress,
  shellIndex,
  className
}) => {
  return (
    <div
      className={cn(
        "rounded-xl bg-[#1e1e1e] p-3 animate-fade-in",
        "transition-all duration-500 ease-out",
        className
      )}
      style={{
        animationDelay: `${shellIndex * 150}ms`, // Stagger the shells
        animationFillMode: "both"
      }}
    >
      <div className="flex items-center gap-3">
        {/* Album Art Skeleton */}
        <div className="shrink-0 w-10 h-10 rounded-md bg-gradient-to-br from-accent-primary/20 to-accent-secondary/20 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse" 
               style={{
                 animation: `shimmer 2s infinite linear ${shellIndex * 0.3}s`
               }} />
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          {/* Title Skeleton */}
          <Skeleton className="h-3 w-32 bg-white/10" />
          
          {/* Progress Bar - thin pink line */}
          <div className="relative">
            <div className="h-0.5 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-accent-primary to-accent-secondary transition-all duration-500 ease-out"
                style={{ 
                  width: `${Math.max(0, Math.min(100, progress))}%`,
                  filter: "drop-shadow(0 0 4px rgba(202, 36, 116, 0.6))"
                }}
              />
            </div>
            {/* Subtle glow effect */}
            <div 
              className="absolute top-0 h-0.5 bg-gradient-to-r from-accent-primary/50 to-accent-secondary/50 blur-sm transition-all duration-500 ease-out"
              style={{ 
                width: `${Math.max(0, Math.min(110, progress + 10))}%`,
                opacity: progress > 0 ? 0.8 : 0
              }}
            />
          </div>
        </div>

        {/* Loading Indicator */}
        <div className="w-8 h-8 shrink-0 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
        </div>
      </div>
    </div>
  );
};

// Add shimmer keyframe to global styles
const shimmerStyle = `
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
`;

// Inject styles if not already present
if (typeof document !== 'undefined' && !document.getElementById('shimmer-styles')) {
  const style = document.createElement('style');
  style.id = 'shimmer-styles';
  style.textContent = shimmerStyle;
  document.head.appendChild(style);
}