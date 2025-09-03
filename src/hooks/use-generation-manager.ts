import { useState, useCallback, useRef, useEffect } from "react";
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

  // Always have the latest state available to polling loops
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

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

  const pollGeneration = useCallback((
    generationId: string,
    jobId: string,
    onComplete: (tracks: TrackItem[], generation: ActiveGeneration) => void
  ) => {
    console.log(`🟢 [${generationId}] Starting polling for jobId: ${jobId}`);
    
    const pollStep = async () => {
      try {
        // Get current generation from state
        const currentGeneration = stateRef.current.activeGenerations.get(generationId);
        
        if (!currentGeneration) {
          console.log(`⚠️ [${generationId}] Generation not found, stopping poll`);
          return;
        }
        
        if (currentGeneration.status === 'complete' || currentGeneration.status === 'failed') {
          console.log(`⚠️ [${generationId}] Generation already ${currentGeneration.status}, stopping poll`);
          return;
        }

        console.log(`🔄 [${generationId}] Polling step - current progress: ${currentGeneration.progress}%`);
        
        const result = await api.pollSong(jobId);
        console.log(`📡 [${generationId}] API result:`, { status: result.status, hasAudio: !!result.audioUrls });
        
        // Calculate time-based progress (smoother progression)
        const elapsed = Date.now() - currentGeneration.startTime;
        const timeProgressRatio = elapsed / (8 * 60 * 1000); // 8 minutes expected duration
        const timeProgress = Math.min(timeProgressRatio * 85, 85); // Max 85% from time
        
        // Calculate status-based progress (discrete jumps)
        let statusProgress = 5;
        switch (result.status) {
          case "pending":
            statusProgress = 20;
            break;
          case "processing":
            statusProgress = 45;
            break;
          case "ready":
            statusProgress = 90;
            break;
          default:
            statusProgress = 10;
        }
        
        // Use the higher of time-based or status-based progress for smooth progression
        const baseProgress = Math.max(timeProgress, statusProgress, currentGeneration.progress);
        
        // Add small random increment for visual smoothness (1-3%)
        const smoothProgress = Math.min(baseProgress + Math.random() * 2 + 1, 99);
        
        const stepIndex = Math.floor((smoothProgress / 100) * (GENERATION_STEPS.length - 1));
        const progressText = GENERATION_STEPS[stepIndex] || "Processing...";
        
        console.log(`📊 [${generationId}] Progress calculation:`, {
          elapsed: `${(elapsed / 1000).toFixed(1)}s`,
          timeProgress: timeProgress.toFixed(1),
          statusProgress,
          baseProgress: baseProgress.toFixed(1),
          finalProgress: smoothProgress.toFixed(1),
          progressText
        });
        
        // Update generation progress
        updateGeneration(generationId, {
          progress: smoothProgress,
          progressText,
          status: 'polling'
        });

        // Handle completion
        if (result.status === "ready" && result.audioUrls) {
          console.log(`✅ [${generationId}] Generation complete! Audio URLs:`, result.audioUrls.length);
          
          updateGeneration(generationId, {
            status: 'complete',
            progress: 100,
            progressText: "Complete!",
            audioUrls: result.audioUrls
          });

          const tracks = await createTracksFromGeneration(generationId, result.audioUrls, currentGeneration.details);
          
          onComplete(tracks, currentGeneration);
          addToCompletedQueue(generationId);
          toast.success("Song generated successfully!");
          
          setTimeout(() => removeGeneration(generationId), 1000);
          return;
        }

        // Handle errors
        if (result.status === "error") {
          throw new Error(result.error || "Generation failed");
        }

        // Continue polling
        const timeout = setTimeout(pollStep, 3000);
        pollingRefs.current.set(generationId, timeout);
        
      } catch (error) {
        console.error(`❌ [${generationId}] Polling error:`, error);
        updateGeneration(generationId, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Polling failed',
          progressText: "Failed"
        });
        toast.error("Generation failed");
        
        setTimeout(() => removeGeneration(generationId), 3000);
      }
    };

    // Start polling with slight delay to ensure state is committed
    const initialTimeout = setTimeout(pollStep, 250);
    pollingRefs.current.set(generationId, initialTimeout);
  }, [updateGeneration, addToCompletedQueue, removeGeneration]);

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
      params: details.style ? details.style.split(',').map(p => p.trim()) : [],
      words: [],
      hasTimestamps: false,
      coverUrl: '' // Will be populated when album covers are generated
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