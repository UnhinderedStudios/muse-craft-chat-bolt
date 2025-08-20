import { useState, useRef, useEffect } from "react";
import { api, type SongDetails } from "@/lib/api";
import { toast } from "sonner";
import { type TimestampedWord } from "@/types";

export function useGeneration() {
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
      toast.error("Please provide lyrics to generate a song");
      return;
    }

    setBusy(true);
    setGenerationProgress(0);
    setLastProgressUpdate(Date.now());

    try {
      const result = await api.startSong(details);
      console.log("[Generation] Initial result:", result);

      if (result.error) {
        throw new Error(result.error);
      }

      if (result.audio_urls && Array.isArray(result.audio_urls)) {
        // Multiple URLs returned immediately
        console.log("[Generation] Got multiple audio URLs:", result.audio_urls);
        setAudioUrls(result.audio_urls);
        setGenerationProgress(100);
        setLastProgressUpdate(Date.now());

        // Process each URL for timestamps
        const newVersions = await Promise.all(
          result.audio_urls.map(async (url: string, index: number) => {
            let timestampData = { words: [], hasTimestamps: false, timestampError: undefined };
            
            try {
              const timestampResult = await api.getTimestampedLyrics({ taskId: result.jobId || '', audioId: `audio_${index}` });
              if (timestampResult.alignedWords && timestampResult.alignedWords.length > 0) {
                timestampData = {
                  words: timestampResult.alignedWords.map(w => ({
                    word: w.word,
                    start_s: w.start_s,
                    end_s: w.end_s,
                    success: w.success
                  })),
                  hasTimestamps: true,
                  timestampError: undefined
                };
              }
            } catch (timestampError) {
              console.warn(`[Timestamps] Failed for URL ${index}:`, timestampError);
              timestampData.timestampError = String(timestampError);
            }

            return {
              url,
              audioId: `audio_${Date.now()}_${index}`,
              musicIndex: index,
              ...timestampData
            };
          })
        );

        setVersions(newVersions);
        toast.success(`Generated ${result.audio_urls.length} song versions!`);
      } else if (result.job_id) {
        // Job-based generation
        setJobId(result.job_id);
        setGenerationProgress(15);
        setLastProgressUpdate(Date.now());
        toast.success("Song generation started! This may take a minute...");
        
        // Poll for completion
        pollJobStatus(result.job_id, details.lyrics || "");
      } else {
        throw new Error("Invalid response from generation API");
      }
    } catch (error: any) {
      console.error("[Generation] Error:", error);
      toast.error(error?.message || "Failed to generate song");
      setGenerationProgress(0);
    } finally {
      setBusy(false);
    }
  };

  const pollJobStatus = async (id: string, lyrics: string) => {
    const maxAttempts = 60; // 5 minutes with 5-second intervals
    let attempts = 0;

    const poll = async () => {
      try {
        attempts++;
        const status = await api.pollSong(id);
        
        // Update progress based on status
        if (status.status === "queued") {
          setGenerationProgress(Math.min(20, generationProgress + 2));
        } else if (status.status === "in_progress") {
          setGenerationProgress(Math.min(85, generationProgress + 3));
        }
        setLastProgressUpdate(Date.now());

        if (status.status === "completed" && status.audioUrls) {
          console.log("[Poll] Job completed with URLs:", status.audioUrls);
          setAudioUrls(status.audioUrls);
          setGenerationProgress(100);
          
          // Process timestamps for completed job
          const newVersions = await Promise.all(
            status.audioUrls.map(async (url: string, index: number) => {
              let timestampData = { words: [], hasTimestamps: false, timestampError: undefined };
              
              try {
                const timestampResult = await api.getTimestampedLyrics({ taskId: id, audioId: `audio_${index}` });
                if (timestampResult.alignedWords && timestampResult.alignedWords.length > 0) {
                  timestampData = {
                    words: timestampResult.alignedWords.map(w => ({
                      word: w.word,
                      start_s: w.start_s,
                      end_s: w.end_s,
                      success: w.success
                    })),
                    hasTimestamps: true,
                    timestampError: undefined
                  };
                }
              } catch (timestampError) {
                console.warn(`[Timestamps] Failed for completed job URL ${index}:`, timestampError);
                timestampData.timestampError = String(timestampError);
              }

              return {
                url,
                audioId: `audio_${Date.now()}_${index}`,
                musicIndex: index,
                ...timestampData
              };
            })
          );

          setVersions(newVersions);
          setBusy(false);
          toast.success(`Generated ${status.audio_urls.length} song versions!`);
          return;
        }

        if (status.status === "failed") {
          throw new Error(status.error || "Generation failed");
        }

        if (attempts < maxAttempts && (status.status === "queued" || status.status === "in_progress")) {
          setTimeout(poll, 5000);
        } else if (attempts >= maxAttempts) {
          throw new Error("Generation timed out");
        }
      } catch (error: any) {
        console.error("[Poll] Error:", error);
        setBusy(false);
        setGenerationProgress(0);
        toast.error(error?.message || "Failed to check generation status");
      }
    };

    poll();
  };

  return {
    jobId,
    audioUrl,
    audioUrls,
    versions,
    busy,
    generationProgress,
    generate
  };
}