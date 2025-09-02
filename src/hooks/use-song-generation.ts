import { useState, useRef } from "react";
import { SongDetails, GenerationState, TimestampedWord } from "@/types";
import { api } from "@/lib/api";
import { GENERATION_STEPS, RANDOM_STYLES, RANDOM_TITLES, RANDOM_LYRICS } from "@/utils/constants";
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
  
  // Loading shells state
  const [loadingShells, setLoadingShells] = useState<{
    id: string;
    progress: number;
    title: string;
  }[]>([]);
  
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const randomizeAll = () => {
    const randomStyle = RANDOM_STYLES[Math.floor(Math.random() * RANDOM_STYLES.length)];
    const randomTitle = RANDOM_TITLES[Math.floor(Math.random() * RANDOM_TITLES.length)];
    const randomLyrics = RANDOM_LYRICS[Math.floor(Math.random() * RANDOM_LYRICS.length)];
    
    return {
      title: randomTitle,
      style: randomStyle,
      lyrics: randomLyrics
    };
  };

  const startGeneration = async (details: SongDetails) => {
    setGenerationState(prev => ({ ...prev, busy: true, progress: 0, progressText: GENERATION_STEPS[0] }));
    
    // Immediately create loading shells for 2 songs
    const shells = [
      {
        id: `shell-${Date.now()}-1`,
        progress: 0,
        title: details.title || "Generating Song..."
      },
      {
        id: `shell-${Date.now()}-2`,
        progress: 0,
        title: details.title || "Generating Song..."
      }
    ];
    setLoadingShells(shells);
    
    try {
      // Start song generation
      const { jobId } = await api.startSong(details);
      setGenerationState(prev => ({ ...prev, jobId }));

      // Poll for completion
      let result;
      let attempts = 0;
      const POLL_INTERVAL_MS = 5000;
      const MAX_WAIT_MS = 10 * 60 * 1000; // 10 minutes
      const maxAttempts = Math.ceil(MAX_WAIT_MS / POLL_INTERVAL_MS);

      const phaseStart = Date.now();
      do {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        result = await api.pollSong(jobId);
        attempts++;
        
        const elapsed = Date.now() - phaseStart;
        const progress = Math.min((elapsed / MAX_WAIT_MS) * 100, 100);
        const stepIndex = Math.floor((progress / 100) * (GENERATION_STEPS.length - 1));
        
        // Update both main generation progress and loading shells
        setGenerationState(prev => ({ 
          ...prev, 
          progress,
          progressText: GENERATION_STEPS[stepIndex] || "Processing..."
        }));
        
        // Sync loading shells with main progress
        setLoadingShells(prev => prev.map(shell => ({
          ...shell,
          progress: progress
        })));
        
      } while (result.status !== "complete" && attempts < maxAttempts);

      if (result.status === "complete" && result.audioUrls) {
        setGenerationState(prev => ({ 
          ...prev, 
          audioUrls: result.audioUrls,
          progress: 100,
          progressText: "Song generation complete!"
        }));

        // Final progress for loading shells
        setLoadingShells(prev => prev.map(shell => ({
          ...shell,
          progress: 100
        })));
        
        // Clear loading shells after showing completion
        setTimeout(() => {
          setLoadingShells([]);
        }, 1500);

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
      setLoadingShells([]);
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
    loadingShells,
    randomizeAll,
    startGeneration,
    setTimestampedLyrics,
    setLyricsUrls
  };
}