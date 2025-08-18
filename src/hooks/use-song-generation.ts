import { useState, useRef } from "react";
import { SongDetails, GenerationState, TimestampedWord } from "@/types";
import { api } from "@/lib/api";
import { GENERATION_STEPS, RANDOM_STYLES, RANDOM_TITLES } from "@/utils/constants";
import { toast } from "sonner";

export function useSongGeneration() {
  const [generationState, setGenerationState] = useState<GenerationState>({
    busy: false,
    progress: 0,
    progressText: "Ready to create music...",
    currentIndex: 0
  });
  
  const [timestampedLyrics, setTimestampedLyrics] = useState<TimestampedWord[]>([]);
  const [lyricsUrls, setLyricsUrls] = useState<{ url: string; audioId: string; musicIndex: number; words: TimestampedWord[]; hasTimestamps?: boolean; timestampError?: string; }[]>([]);
  const [covers, setCovers] = useState<string[]>([]);
  
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const randomizeAll = () => {
    const randomStyle = RANDOM_STYLES[Math.floor(Math.random() * RANDOM_STYLES.length)];
    const randomTitle = RANDOM_TITLES[Math.floor(Math.random() * RANDOM_TITLES.length)];
    
    return {
      title: randomTitle,
      style: randomStyle,
      lyrics: ""
    };
  };

  const startGeneration = async (details: SongDetails) => {
    setGenerationState(prev => ({ ...prev, busy: true, progress: 0 }));
    
    try {
      // Start song generation
      const { jobId } = await api.startSong(details);
      setGenerationState(prev => ({ ...prev, jobId, progressText: GENERATION_STEPS[0] }));

      // Poll for completion
      let result;
      let attempts = 0;
      const maxAttempts = 60;

      do {
        await new Promise(resolve => setTimeout(resolve, 5000));
        result = await api.pollSong(jobId);
        attempts++;
        
        const progress = Math.min((attempts / maxAttempts) * 80, 80);
        const stepIndex = Math.floor((progress / 80) * (GENERATION_STEPS.length - 1));
        
        setGenerationState(prev => ({ 
          ...prev, 
          progress,
          progressText: GENERATION_STEPS[stepIndex] || "Processing..."
        }));
        
      } while (result.status !== "complete" && attempts < maxAttempts);

      if (result.status === "complete" && result.audioUrls) {
        setGenerationState(prev => ({ 
          ...prev, 
          audioUrls: result.audioUrls,
          progress: 100,
          progressText: "Song generation complete!"
        }));

        // Generate album covers
        try {
          const coverResponse = await api.generateAlbumCovers(details);
          setCovers([coverResponse.cover1, coverResponse.cover2]);
        } catch (error) {
          console.error("Album cover generation failed:", error);
        }

        toast.success("Song generated successfully!");
      } else {
        throw new Error("Generation failed or timed out");
      }
    } catch (error) {
      console.error("Generation error:", error);
      toast.error("Failed to generate song");
      setGenerationState(prev => ({ 
        ...prev, 
        progress: 0,
        progressText: "Generation failed"
      }));
    } finally {
      setGenerationState(prev => ({ ...prev, busy: false }));
    }
  };

  return {
    generationState,
    timestampedLyrics,
    lyricsUrls,
    covers,
    randomizeAll,
    startGeneration,
    setTimestampedLyrics,
    setLyricsUrls
  };
}