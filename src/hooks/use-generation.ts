import { useState, useRef, useEffect } from "react";
import { api, type SongDetails } from "@/lib/api";
import { type TimestampedWord } from "@/types";
import { toast } from "sonner";

export const useGeneration = () => {
  const [jobId, setJobId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioUrls, setAudioUrls] = useState<string[] | null>(null);
  const [versions, setVersions] = useState<Array<{
    url: string;
    audioId: string;
    musicIndex: number;
    words: TimestampedWord[];
    hasTimestamps?: boolean;
    timestampError?: string;
  }>>([]);
  const [busy, setBusy] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [lastProgressUpdate, setLastProgressUpdate] = useState<number>(Date.now());
  const [albumCovers, setAlbumCovers] = useState<{ 
    cover1: string; 
    cover2: string; 
    debug?: {
      inputSource: string;
      inputContent: string;
      chatPrompt: string;
      imagenPrompt: string;
      imagenParams: any;
      rawResponse: any;
    }
  } | null>(null);
  const [isGeneratingCovers, setIsGeneratingCovers] = useState(false);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Smooth progress system that never goes backward and handles stagnation
  useEffect(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    if (busy) {
      progressIntervalRef.current = setInterval(() => {
        setGenerationProgress(current => {
          const now = Date.now();
          const timeSinceUpdate = now - lastProgressUpdate;
          
          // If stuck for more than 3 seconds, start organic creeping
          if (timeSinceUpdate > 3000 && current < 98) {
            let creepRate = 0.5; // Base creep rate
            
            // Accelerate creeping if stuck longer
            if (timeSinceUpdate > 15000) {
              creepRate = 1.5; // Faster creep after 15s
            } else if (timeSinceUpdate > 5000) {
              creepRate = 1; // Medium creep after 5s
            }
            
            // Slow down creeping as we approach 98%
            if (current > 85) {
              creepRate *= (98 - current) / 13; // Gradual slowdown
            }
            
            // Apply organic creep with slight randomness
            const organicIncrement = creepRate + (Math.random() * 0.3 - 0.15);
            return Math.min(current + organicIncrement, 98);
          }
          
          return current;
        });
      }, 3000 + Math.random() * 2000); // Check every 3-5 seconds
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [busy, lastProgressUpdate]);

  const generate = async (details: SongDetails) => {
    if (!details.lyrics) {
      toast.error("Please add lyrics before generating");
      return;
    }

    setBusy(true);
    setGenerationProgress(5);
    setLastProgressUpdate(Date.now());
    
    try {
      console.log("[Generate] Starting generation with details:", details);
      const result = await api.startSong(details);
      console.log("[Generate] API result:", result);
      
      setJobId(result.jobId);
      // Note: startSong API only returns jobId, not audioUrl/audioUrls
      
      setGenerationProgress(15);
      setLastProgressUpdate(Date.now());
      
      // Poll for completion
      await pollForCompletion(result.jobId);
      
    } catch (error) {
      console.error("[Generate] Error:", error);
      toast.error("Failed to generate song");
      setBusy(false);
      setGenerationProgress(0);
    }
  };

  const pollForCompletion = async (jobId: string) => {
    const maxAttempts = 180; // 3 minutes with 1-second intervals
    let attempts = 0;
    
    const poll = async () => {
      try {
        attempts++;
        console.log(`[Poll] Attempt ${attempts}/${maxAttempts} for job ${jobId}`);
        
        const result = await api.pollSong(jobId);
        console.log(`[Poll] Status result:`, result);
        
        if (result.status === "complete" && result.audioUrls) {
          console.log("[Poll] Generation complete!");
          
          // Update progress to show completion
          setGenerationProgress(85);
          setLastProgressUpdate(Date.now());
          
          // Process each audio URL and get timestamped lyrics
          const processedVersions = await Promise.all(
            result.audioUrls.map(async (url: string, index: number) => {
              try {
                console.log(`[Poll] Processing timestamped lyrics for audio ${index}`);
                const timestampResult = await api.getTimestampedLyrics({ taskId: url });
                console.log(`[Poll] Timestamp result for audio ${index}:`, timestampResult);
                
                // Map API response format to TimestampedWord format
                const words = timestampResult.alignedWords?.map(w => ({
                  word: w.word,
                  start: w.start_s,
                  end: w.end_s,
                  success: w.success,
                  p_align: w.p_align
                })) || [];
                
                return {
                  url,
                  audioId: `${jobId}-${index}`,
                  musicIndex: index,
                  words,
                  hasTimestamps: words.length > 0,
                  timestampError: words.length === 0 ? "Failed to align words" : undefined
                };
              } catch (error) {
                console.error(`[Poll] Error getting timestamps for audio ${index}:`, error);
                return {
                  url,
                  audioId: `${jobId}-${index}`,
                  musicIndex: index,
                  words: [],
                  hasTimestamps: false,
                  timestampError: "Failed to process timestamps"
                };
              }
            })
          );
          
          setVersions(processedVersions);
          setAudioUrls(result.audioUrls);
          
          setGenerationProgress(95);
          setLastProgressUpdate(Date.now());
          
          // Generate album covers
          await generateAlbumCovers(result.audioUrls);
          
          setGenerationProgress(100);
          setTimeout(() => {
            setBusy(false);
            setGenerationProgress(0);
          }, 1000);
          
        } else if (result.status === "failed") {
          console.error("[Poll] Generation failed:", result.error);
          toast.error(`Generation failed: ${result.error || "Unknown error"}`);
          setBusy(false);
          setGenerationProgress(0);
        } else {
          // Still processing
          const progressValue = Math.min(15 + (attempts / maxAttempts) * 70, 80);
          setGenerationProgress(progressValue);
          setLastProgressUpdate(Date.now());
          
          if (attempts < maxAttempts) {
            setTimeout(poll, 1000);
          } else {
            console.error("[Poll] Max attempts reached");
            toast.error("Generation timed out");
            setBusy(false);
            setGenerationProgress(0);
          }
        }
      } catch (error) {
        console.error("[Poll] Polling error:", error);
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000); // Retry after 2 seconds on error
        } else {
          toast.error("Failed to check generation status");
          setBusy(false);
          setGenerationProgress(0);
        }
      }
    };
    
    poll();
  };

  const generateAlbumCovers = async (audioUrls: string[]) => {
    if (!audioUrls || audioUrls.length === 0) return;
    
    setIsGeneratingCovers(true);
    try {
      console.log("[AlbumCovers] Generating covers for audio URLs:", audioUrls);
      // Pass empty SongDetails as API doesn't use the audio URL directly
      const coverResult = await api.generateAlbumCovers({});
      console.log("[AlbumCovers] Cover result:", coverResult);
      
      setAlbumCovers({
        cover1: coverResult.cover1,
        cover2: coverResult.cover2,
        debug: coverResult.debug
      });
    } catch (error) {
      console.error("[AlbumCovers] Error generating covers:", error);
    } finally {
      setIsGeneratingCovers(false);
    }
  };

  return {
    jobId,
    audioUrl,
    audioUrls,
    versions,
    busy,
    generationProgress,
    albumCovers,
    isGeneratingCovers,
    generate,
    setVersions,
    setAudioUrls,
    setAlbumCovers
  };
};