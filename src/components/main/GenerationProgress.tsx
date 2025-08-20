import React from "react";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";

interface GenerationProgressProps {
  busy: boolean;
  generationProgress: number;
}

export const GenerationProgress: React.FC<GenerationProgressProps> = ({ busy, generationProgress }) => {
  if (!busy) return null;

  return (
    <div className="col-span-3 bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/30 rounded-xl p-8 flex flex-col items-center justify-center space-y-6">
      <Spinner className="w-12 h-12 text-purple-400" />
      <div className="text-center space-y-4 w-full max-w-md">
        <h3 className="text-2xl font-bold text-white">Creating Your Song</h3>
        <p className="text-purple-200">
          {generationProgress < 25 && "Analyzing your style and lyrics..."}
          {generationProgress >= 25 && generationProgress < 50 && "Composing the music..."}
          {generationProgress >= 50 && generationProgress < 75 && "Generating vocals..."}
          {generationProgress >= 75 && generationProgress < 95 && "Adding final touches..."}
          {generationProgress >= 95 && "Almost ready..."}
        </p>
        <div className="w-full">
          <Progress value={generationProgress} className="h-3 bg-purple-900/30" />
          <p className="text-sm text-purple-300 mt-2 text-center">
            {Math.round(generationProgress)}% complete
          </p>
        </div>
        <p className="text-xs text-gray-400">
          This usually takes 1-2 minutes. Your song will appear here when ready.
        </p>
      </div>
    </div>
  );
};