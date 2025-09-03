import { useState, useRef } from 'react';
import { api, type SongDetails } from '@/lib/api';
import { type TimestampedWord, type TrackItem } from '@/types';
import { toast } from 'sonner';

export type GenerationJob = {
  id: string;
  progress: number;
  status: 'pending' | 'generating' | 'complete' | 'error';
  tracks?: TrackItem[];
  error?: string;
};

export function useConcurrentGeneration() {
  const [activeJobs, setActiveJobs] = useState<GenerationJob[]>([]);
  const [jobCounter, setJobCounter] = useState(0);
  const [completedTracks, setCompletedTracks] = useState<TrackItem[]>([]);

  const startGeneration = async (details: SongDetails) => {
    if (activeJobs.length >= 10) {
      toast.error("Maximum 10 concurrent generations allowed");
      return;
    }

    const jobId = `job-${Date.now()}-${jobCounter}`;
    setJobCounter(prev => prev + 1);
    
    // Add new job at the beginning (newest first)
    const newJob: GenerationJob = {
      id: jobId,
      progress: 0,
      status: 'pending'
    };
    
    setActiveJobs(prev => [newJob, ...prev]);

    try {
      console.log(`[Job ${jobId}] Starting generation with details:`, details);
      
      // Update job status
      setActiveJobs(prev => prev.map(job => 
        job.id === jobId ? { ...job, status: 'generating' as const, progress: 5 } : job
      ));

      const resp = await api.startSong(details);
      const { jobId: sunoJobId } = resp;
      console.log(`[Job ${jobId}] Suno job started with ID:`, sunoJobId);

      // Progress simulation
      const progressInterval = setInterval(() => {
        setActiveJobs(prev => prev.map(job => {
          if (job.id === jobId && job.progress < 80) {
            return { ...job, progress: Math.min(80, job.progress + Math.random() * 3) };
          }
          return job;
        }));
      }, 1000);

      // Poll for completion
      let attempts = 0;
      const maxAttempts = 200;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        attempts++;
        
        try {
          const statusResp = await api.pollSong(sunoJobId);
          console.log(`[Job ${jobId}] Poll ${attempts}:`, statusResp);
          
          if (statusResp.status === "ready" && statusResp.audioUrls) {
            console.log(`[Job ${jobId}] Generation completed successfully`);
            clearInterval(progressInterval);
            
            // Update job to 100%
            setActiveJobs(prev => prev.map(job => 
              job.id === jobId ? { ...job, progress: 100 } : job
            ));
            
            // Get detailed information for timestamps
            try {
              const detailsResp = await api.getMusicGenerationDetails(sunoJobId);
              console.log(`[Job ${jobId}] Details response:`, detailsResp);
              
              if (detailsResp.response?.sunoData && Array.isArray(detailsResp.response.sunoData)) {
                const versions: Array<{
                  url: string;
                  audioId: string;
                  musicIndex: number;
                  words: TimestampedWord[];
                  hasTimestamps?: boolean;
                  timestampError?: string;
                }> = [];
                
                for (const track of detailsResp.response.sunoData) {
                  if (track.audioUrl && track.id) {
                    let words: TimestampedWord[] = [];
                    let hasTimestamps = false;
                    let timestampError;
                    
                    try {
                      console.log(`[Job ${jobId}] Fetching timestamps for track ${track.id}...`);
                      const timestampResp = await api.getTimestampedLyrics({
                        taskId: sunoJobId,
                        audioId: track.id,
                        musicIndex: track.musicIndex || 0
                      });
                      
                      if (timestampResp.alignedWords && Array.isArray(timestampResp.alignedWords)) {
                        words = timestampResp.alignedWords.map((w: any) => ({
                          word: w.word || '',
                          start: typeof w.start === 'number' ? w.start : 0,
                          end: typeof w.end === 'number' ? w.end : 0,
                          success: w.success || false,
                          p_align: w.p_align || 0
                        }));
                        hasTimestamps = words.length > 0;
                        console.log(`[Job ${jobId}] Successfully processed ${words.length} words for track ${track.id}`);
                      } else {
                        console.warn(`[Job ${jobId}] No aligned words for track ${track.id}`);
                      }
                    } catch (timestampErr) {
                      console.error(`[Job ${jobId}] Timestamp error for track ${track.id}:`, timestampErr);
                      timestampError = String(timestampErr);
                    }
                    
                    versions.push({
                      url: track.audioUrl,
                      audioId: track.id,
                      musicIndex: track.musicIndex || 0,
                      words,
                      hasTimestamps,
                      timestampError
                    });
                  }
                }
                
                // Generate album covers
                let covers: { cover1: string; cover2: string } | null = null;
                try {
                  console.log(`[Job ${jobId}] Generating album covers...`);
                  covers = await api.generateAlbumCovers(details);
                  console.log(`[Job ${jobId}] Album covers generated successfully`);
                } catch (coverError) {
                  console.error(`[Job ${jobId}] Album cover generation failed:`, coverError);
                }
                
                // Create tracks
                const newTracks: TrackItem[] = versions.map((version, index) => ({
                  id: version.audioId,
                  url: version.url,
                  title: details.title || `Generated Song ${Date.now()}`,
                  coverUrl: covers ? (index === 0 ? covers.cover1 : covers.cover2) : "",
                  createdAt: Date.now(),
                  params: details.style ? details.style.split(",").map(p => p.trim()) : [],
                  words: version.words,
                  hasTimestamps: version.hasTimestamps
                }));
                
                // Update job with completed tracks
                setActiveJobs(prev => prev.map(job => 
                  job.id === jobId ? { ...job, status: 'complete' as const, tracks: newTracks } : job
                ));
                
                // Add tracks to completed list (newest first)
                setCompletedTracks(prev => [...newTracks, ...prev]);
                console.log(`[Job ${jobId}] Added ${newTracks.length} tracks to completed list`);
                
                toast.success(`Job ${jobId.slice(-6)} completed! 🎵`);
                
                // Remove job after 2 seconds
                setTimeout(() => {
                  setActiveJobs(prev => prev.filter(job => job.id !== jobId));
                }, 2000);
                
                return;
              }
            } catch (detailsError) {
              console.error(`[Job ${jobId}] Failed to get track details:`, detailsError);
              // Fallback with basic tracks
              const newTracks: TrackItem[] = statusResp.audioUrls.map((url, index) => ({
                id: `${sunoJobId}-${index}`,
                url,
                title: details.title || `Generated Song ${Date.now()}`,
                coverUrl: "",
                createdAt: Date.now(),
                params: details.style ? details.style.split(",").map(p => p.trim()) : [],
                words: [],
                hasTimestamps: false
              }));
              
              setActiveJobs(prev => prev.map(job => 
                job.id === jobId ? { ...job, status: 'complete' as const, tracks: newTracks } : job
              ));
              setCompletedTracks(prev => [...newTracks, ...prev]);
              
              setTimeout(() => {
                setActiveJobs(prev => prev.filter(job => job.id !== jobId));
              }, 2000);
            }
            
            clearInterval(progressInterval);
            return;
          } else if (statusResp.status === "error") {
            throw new Error(statusResp.error || "Generation failed");
          }
          
          // Update progress based on polling
          if (statusResp.status === "processing") {
            setActiveJobs(prev => prev.map(job => 
              job.id === jobId ? { ...job, progress: Math.min(85, job.progress + 1) } : job
            ));
          }
        } catch (pollError) {
          console.error(`[Job ${jobId}] Poll ${attempts} failed:`, pollError);
          if (attempts >= maxAttempts - 10) {
            throw new Error(`Polling failed: ${pollError}`);
          }
        }
      }
      
      throw new Error("Generation timed out");
    } catch (error) {
      console.error(`[Job ${jobId}] Error:`, error);
      setActiveJobs(prev => prev.map(job => 
        job.id === jobId 
          ? { ...job, status: 'error' as const, error: error instanceof Error ? error.message : 'Generation failed' }
          : job
      ));
      
      // Remove failed job after 3 seconds
      setTimeout(() => {
        setActiveJobs(prev => prev.filter(job => job.id !== jobId));
      }, 3000);
      
      toast.error(`Job ${jobId.slice(-6)} failed: ${error instanceof Error ? error.message : 'Generation failed'}`);
    }
  };

  return {
    activeJobs,
    completedTracks,
    startGeneration,
    canStartNewJob: activeJobs.length < 10
  };
}