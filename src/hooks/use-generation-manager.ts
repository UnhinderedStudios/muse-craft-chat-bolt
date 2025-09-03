import { useState, useCallback, useRef } from "react";
import { SongDetails, TrackItem } from "@/types";
import { ActiveGeneration, GenerationManagerState, MAX_CONCURRENT_GENERATIONS } from "@/types/generation";
import { api } from "@/lib/api";
import { GENERATION_STEPS } from "@/utils/constants";
import { toast } from "sonner";

export function useGenerationManager() {
  const [state, setState] = useState<GenerationManagerState>({
    activeGenerations: new Map(),
    completedQueue: [],
    totalProgress: 0,
    activeCount: 0,
    canGenerate: true
  });

  const pollingRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const generateId = () => `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const updateGeneration = useCallback((id: string, updates: Partial<ActiveGeneration>) => {
    setState(prev => {
      const newGenerations = new Map(prev.activeGenerations);
      const existing = newGenerations.get(id);
      if (existing) {
        newGenerations.set(id, { ...existing, ...updates });
      }
      
      const activeCount = newGenerations.size;
      const totalProgress = activeCount > 0 
        ? Array.from(newGenerations.values())
            .reduce((sum, gen) => sum + gen.progress, 0) / activeCount
        : 0;

      return {
        ...prev,
        activeGenerations: newGenerations,
        activeCount,
        totalProgress,
        canGenerate: activeCount < MAX_CONCURRENT_GENERATIONS
      };
    });
  }, []);

  const removeGeneration = useCallback((id: string) => {
    const pollTimeout = pollingRefs.current.get(id);
    if (pollTimeout) {
      clearTimeout(pollTimeout);
      pollingRefs.current.delete(id);
    }

    setState(prev => {
      const newGenerations = new Map(prev.activeGenerations);
      newGenerations.delete(id);
      
      const activeCount = newGenerations.size;
      const totalProgress = activeCount > 0 
        ? Array.from(newGenerations.values()).reduce((sum, gen) => sum + gen.progress, 0) / activeCount
        : 0;

      return {
        ...prev,
        activeGenerations: newGenerations,
        activeCount,
        totalProgress,
        canGenerate: activeCount < MAX_CONCURRENT_GENERATIONS
      };
    });
  }, []);

  const addToCompletedQueue = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      completedQueue: [...prev.completedQueue, id]
    }));
  }, []);

  const getNextCompleted = useCallback(() => {
    const nextId = state.completedQueue[0];
    if (nextId) {
      setState(prev => ({
        ...prev,
        completedQueue: prev.completedQueue.slice(1)
      }));
      return state.activeGenerations.get(nextId);
    }
    return null;
  }, [state.completedQueue, state.activeGenerations]);

  const startSingleGeneration = useCallback(async (
    details: SongDetails,
    onComplete: (tracks: TrackItem[], generation: ActiveGeneration) => void
  ) => {
    if (!state.canGenerate) {
      toast.error(`Maximum ${MAX_CONCURRENT_GENERATIONS} generations reached`);
      return null;
    }

    const generationId = generateId();
    const generation: ActiveGeneration = {
      id: generationId,
      jobId: '',
      progress: 0,
      status: 'starting',
      details,
      startTime: Date.now(),
      progressText: "Starting generation..."
    };

    setState(prev => {
      const newGenerations = new Map(prev.activeGenerations);
      newGenerations.set(generationId, generation);
      
      return {
        ...prev,
        activeGenerations: newGenerations,
        activeCount: newGenerations.size,
        canGenerate: newGenerations.size < MAX_CONCURRENT_GENERATIONS
      };
    });

    try {
      const { jobId } = await api.startSong(details);
      updateGeneration(generationId, { 
        jobId, 
        progressText: GENERATION_STEPS[0],
        progress: 5 
      });

      pollGeneration(generationId, jobId, onComplete);
      return generationId;
    } catch (error) {
      console.error(`[Generation ${generationId}] Start failed:`, error);
      updateGeneration(generationId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Generation failed',
        progressText: "Generation failed"
      });
      toast.error("Failed to start generation");
      
      setTimeout(() => removeGeneration(generationId), 3000);
      return null;
    }
  }, [state.canGenerate, updateGeneration, removeGeneration]);

  const pollGeneration = async (
    generationId: string,
    jobId: string,
    onComplete: (tracks: TrackItem[], generation: ActiveGeneration) => void
  ) => {
    const pollStep = async () => {
      try {
        const generation = state.activeGenerations.get(generationId);
        if (!generation || generation.status === 'complete' || generation.status === 'failed') {
          return;
        }

        const result = await api.pollSong(jobId);
        const elapsed = Date.now() - generation.startTime;
        const timeProgress = Math.min((elapsed / (10 * 60 * 1000)) * 80, 80);
        
        let statusProgress = 5;
        if (result.status === "pending") statusProgress = 15;
        else if (result.status === "processing") statusProgress = 35;
        else if (result.status === "ready") statusProgress = 75;
        
        const newProgress = Math.max(timeProgress, statusProgress);
        const stepIndex = Math.floor((newProgress / 80) * (GENERATION_STEPS.length - 1));
        
        updateGeneration(generationId, {
          progress: newProgress,
          progressText: GENERATION_STEPS[stepIndex] || "Processing..."
        });

        if (result.status === "ready" && result.audioUrls) {
          updateGeneration(generationId, {
            status: 'complete',
            progress: 100,
            progressText: "Complete!",
            audioUrls: result.audioUrls
          });

          const tracks = await createTracksFromGeneration(generationId, result.audioUrls, generation.details);
          
          onComplete(tracks, generation);
          addToCompletedQueue(generationId);
          toast.success("Song generated successfully!");
          
          setTimeout(() => removeGeneration(generationId), 1000);
          return;
        }

        if (result.status === "error") {
          throw new Error(result.error || "Generation failed");
        }

        const timeout = setTimeout(pollStep, 5000);
        pollingRefs.current.set(generationId, timeout);
        
      } catch (error) {
        console.error(`[Generation ${generationId}] Polling error:`, error);
        updateGeneration(generationId, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Polling failed',
          progressText: "Failed"
        });
        toast.error("Generation failed");
        
        setTimeout(() => removeGeneration(generationId), 3000);
      }
    };

    pollStep();
  };

  const createTracksFromGeneration = async (
    generationId: string,
    audioUrls: string[],
    details: SongDetails
  ): Promise<TrackItem[]> => {
    const createdAt = Date.now();
    
    return audioUrls.map((url, index) => ({
      id: `${generationId}_${index}`,
      url,
      title: details.title || "Generated Song",
      createdAt,
      params: details.style ? [details.style] : [],
      words: [],
      hasTimestamps: false
    }));
  };

  const cancelGeneration = useCallback((id: string) => {
    const pollTimeout = pollingRefs.current.get(id);
    if (pollTimeout) {
      clearTimeout(pollTimeout);
      pollingRefs.current.delete(id);
    }
    
    updateGeneration(id, {
      status: 'failed',
      progressText: "Cancelled",
      error: "Cancelled by user"
    });
    
    setTimeout(() => removeGeneration(id), 1000);
    toast.info("Generation cancelled");
  }, [updateGeneration, removeGeneration]);

  const cancelAllGenerations = useCallback(() => {
    Array.from(state.activeGenerations.keys()).forEach(cancelGeneration);
  }, [state.activeGenerations, cancelGeneration]);

  return {
    state,
    startSingleGeneration,
    cancelGeneration,
    cancelAllGenerations,
    getNextCompleted,
    removeGeneration
  };
}