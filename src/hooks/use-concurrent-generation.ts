import { useState, useRef, useCallback } from "react";
import { SongDetails, TimestampedWord } from "@/types";
import { api } from "@/lib/api";
import { GENERATION_STEPS } from "@/utils/constants";
import { toast } from "sonner";

export interface ActiveGeneration {
  id: string;
  details: SongDetails;
  startTime: number;
  jobId?: string;
  progress: number;
  progressText: string;
  status: 'pending' | 'generating' | 'complete' | 'failed';
  audioUrls?: string[];
  covers?: string[];
  timestampedLyrics?: TimestampedWord[];
  error?: string;
}

export interface ConcurrentGenerationState {
  activeGenerations: Map<string, ActiveGeneration>;
  maxConcurrent: number;
  completedTracks: Array<{
    id: string;
    url: string;
    title?: string;
    coverUrl?: string;
    createdAt: number;
    params: string[];
    words?: TimestampedWord[];
    hasTimestamps?: boolean;
  }>;
}

export function useConcurrentGeneration() {
  const [state, setState] = useState<ConcurrentGenerationState>({
    activeGenerations: new Map(),
    maxConcurrent: 10,
    completedTracks: []
  });

  const pollIntervals = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const generateUniqueId = useCallback(() => {
    return `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const canStartNewGeneration = useCallback(() => {
    return state.activeGenerations.size < state.maxConcurrent;
  }, [state.activeGenerations.size, state.maxConcurrent]);

  const updateGeneration = useCallback((id: string, updates: Partial<ActiveGeneration>) => {
    setState(prev => {
      const newMap = new Map(prev.activeGenerations);
      const existing = newMap.get(id);
      if (existing) {
        newMap.set(id, { ...existing, ...updates });
      }
      return {
        ...prev,
        activeGenerations: newMap
      };
    });
  }, []);

  const removeGeneration = useCallback((id: string) => {
    setState(prev => {
      const newMap = new Map(prev.activeGenerations);
      newMap.delete(id);
      return {
        ...prev,
        activeGenerations: newMap
      };
    });
    
    // Clear any polling interval
    const interval = pollIntervals.current.get(id);
    if (interval) {
      clearInterval(interval);
      pollIntervals.current.delete(id);
    }
  }, []);

  const pollGeneration = useCallback(async (generation: ActiveGeneration) => {
    if (!generation.jobId) return;

    try {
      const result = await api.pollSong(generation.jobId);
      
      if (result.status === "complete" && result.audioUrls) {
        // Generation completed successfully
        updateGeneration(generation.id, {
          status: 'complete',
          progress: 100,
          progressText: "Generation complete!",
          audioUrls: result.audioUrls
        });

        // Generate album covers
        try {
          const coverResponse = await api.generateAlbumCovers(generation.details);
          updateGeneration(generation.id, {
            covers: [coverResponse.cover1, coverResponse.cover2]
          });
        } catch (error) {
          console.error("Album cover generation failed for", generation.id, error);
        }

        // Add to completed tracks (newest first)
        const newTrack = {
          id: generation.id,
          url: result.audioUrls[0],
          title: generation.details.title || "Untitled Song",
          coverUrl: undefined, // Will be set when covers are ready
          createdAt: Date.now(),
          params: generation.details.style ? generation.details.style.split(',').map(s => s.trim()) : [],
          words: [],
          hasTimestamps: false
        };

        setState(prev => ({
          ...prev,
          completedTracks: [newTrack, ...prev.completedTracks]
        }));

        // Stop polling and remove from active
        removeGeneration(generation.id);
        toast.success(`"${generation.details.title || 'Song'}" generated successfully!`);

      } else if (result.status === "error" || result.error) {
        // Generation failed
        updateGeneration(generation.id, {
          status: 'failed',
          error: result.error || "Generation failed",
          progressText: "Generation failed"
        });
        removeGeneration(generation.id);
        toast.error(`Generation failed: ${result.error || "Unknown error"}`);
        
      } else {
        // Still processing - update progress
        const elapsed = Date.now() - generation.startTime;
        const maxWaitMs = 10 * 60 * 1000; // 10 minutes
        const progress = Math.min((elapsed / maxWaitMs) * 80, 80);
        const stepIndex = Math.floor((progress / 80) * (GENERATION_STEPS.length - 1));
        
        updateGeneration(generation.id, {
          progress,
          progressText: GENERATION_STEPS[stepIndex] || "Processing..."
        });
      }
    } catch (error) {
      console.error("Polling error for generation", generation.id, error);
      updateGeneration(generation.id, {
        status: 'failed',
        error: "Polling failed",
        progressText: "Connection error"
      });
    }
  }, [updateGeneration, removeGeneration]);

  const startGeneration = useCallback(async (details: SongDetails) => {
    if (!canStartNewGeneration()) {
      toast.error(`Maximum of ${state.maxConcurrent} concurrent generations reached`);
      return null;
    }

    const generationId = generateUniqueId();
    
    // Add generation timestamp to make lyrics unique
    const uniqueDetails = {
      ...details,
      lyrics: details.lyrics ? `${details.lyrics}\n\n<!-- Generation ID: ${generationId} -->` : details.lyrics
    };

    const newGeneration: ActiveGeneration = {
      id: generationId,
      details: uniqueDetails,
      startTime: Date.now(),
      progress: 0,
      progressText: "Starting generation...",
      status: 'pending'
    };

    // Add to active generations
    setState(prev => {
      const newMap = new Map(prev.activeGenerations);
      newMap.set(generationId, newGeneration);
      return {
        ...prev,
        activeGenerations: newMap
      };
    });

    try {
      // Start the generation
      const { jobId } = await api.startSong(uniqueDetails);
      
      updateGeneration(generationId, {
        jobId,
        status: 'generating',
        progressText: GENERATION_STEPS[0]
      });

      // Start polling
      const pollInterval = setInterval(() => {
        setState(currentState => {
          const currentGen = currentState.activeGenerations.get(generationId);
          if (currentGen && currentGen.status === 'generating') {
            pollGeneration(currentGen);
          } else {
            // Clear interval if generation is no longer active
            clearInterval(pollInterval);
            pollIntervals.current.delete(generationId);
          }
          return currentState;
        });
      }, 5000);

      pollIntervals.current.set(generationId, pollInterval);

      toast.success("Generation started!");
      return generationId;

    } catch (error) {
      console.error("Failed to start generation:", error);
      updateGeneration(generationId, {
        status: 'failed',
        error: "Failed to start generation",
        progressText: "Start failed"
      });
      removeGeneration(generationId);
      toast.error("Failed to start generation");
      return null;
    }
  }, [canStartNewGeneration, generateUniqueId, updateGeneration, removeGeneration, pollGeneration, state.maxConcurrent, state.activeGenerations]);

  const getActiveGenerationsArray = useCallback(() => {
    return Array.from(state.activeGenerations.values())
      .sort((a, b) => b.startTime - a.startTime); // Newest first
  }, [state.activeGenerations]);

  const getActiveCount = useCallback(() => {
    return state.activeGenerations.size;
  }, [state.activeGenerations.size]);

  return {
    state,
    startGeneration,
    canStartNewGeneration,
    getActiveGenerationsArray,
    getActiveCount,
    removeGeneration,
    updateGeneration
  };
}