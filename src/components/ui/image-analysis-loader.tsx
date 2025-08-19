import React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageAnalysisLoaderProps {
  className?: string;
}

export const ImageAnalysisLoader: React.FC<ImageAnalysisLoaderProps> = ({ className }) => {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] px-4 py-3 rounded-[16px] bg-[#000000] border border-accent-primary shadow-[0_0_20px_rgba(202,36,116,0.4)] flex items-center gap-3">
        <div className="relative">
          <Search
            className={cn(
              "w-5 h-5 text-accent-primary animate-bounce",
              "drop-shadow-[0_0_8px_rgba(202,36,116,0.8)]",
              className
            )}
            style={{
              filter: "drop-shadow(0 0 6px rgba(202, 36, 116, 0.9))"
            }}
          />
          <div 
            className="absolute inset-0 w-5 h-5 border border-accent-primary/30 rounded-full animate-ping"
            style={{
              filter: "drop-shadow(0 0 4px rgba(202, 36, 116, 0.6))"
            }}
          />
        </div>
        <span className="text-white/90 text-sm font-medium">
          Analyzing Image...
        </span>
      </div>
    </div>
  );
};