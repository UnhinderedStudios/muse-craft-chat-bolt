import { useState, useCallback } from "react";
import { SongDetails, TimestampedWord } from "@/types";
import { api } from "@/lib/api";
import { GENERATION_STEPS } from "@/utils/constants";
import { toast } from "sonner";

export interface GenerationJob {
  id: string;
  details: SongDetails;
  styleTags: string[];
  progress: number;
  status: 'pending' | 'generating' | 'fetching-audio' | 'complete' | 'error';
  jobId: string | null;
  albumCovers: { cover1: string; cover2: string } | null;
  versions: Array<{
    url: string;
    audioId: string;
    musicIndex: number;
    words: TimestampedWord[];
    hasTimestamps?: boolean;
    timestampError?: string;
  }>;
  createdAt: number;
  error?: string;
  progressText: string;
}

const MAX_CONCURRENT_JOBS = 10;

export function useConcurrentGeneration() {
  const [jobs, setJobs] = useState<GenerationJob[]>([]);

  const getActiveJobsCount = useCallback(() => {
    return jobs.filter(job => job.status === 'pending' || job.status === 'generating' || job.status === 'fetching-audio').length;
  }, [jobs]);

  const canStartNewJob = useCallback(() => {
    return getActiveJobsCount() < MAX_CONCURRENT_JOBS;
  }, [getActiveJobsCount]);

  const startJob = useCallback(async (details: SongDetails, styleTags: string[]) => {
    if (!canStartNewJob()) {
      toast.error(`Maximum ${MAX_CONCURRENT_JOBS} concurrent generations allowed`);
      return null;
    }

    const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newJob: GenerationJob = {
      id: jobId,
      details,
      styleTags,
      progress: 0,
      status: 'pending',
      jobId: null,
      albumCovers: null,
      versions: [],
      createdAt: Date.now(),
      progressText: "Starting generation..."
    };

    // Add job at the beginning (newest first)
    setJobs(prev => [newJob, ...prev]);

    // Start the actual generation process
    try {
      // Update status to generating
      setJobs(prev => prev.map(job => 
        job.id === jobId 
          ? { ...job, status: 'generating', progressText: GENERATION_STEPS[0] }
          : job
      ));

      // Start song generation
      const { jobId: sunoJobId } = await api.startSong(details);
      
      setJobs(prev => prev.map(job => 
        job.id === jobId 
          ? { ...job, jobId: sunoJobId }
          : job
      ));

      // Poll for completion
      let result;
      let attempts = 0;
      const POLL_INTERVAL_MS = 5000;
      const MAX_WAIT_MS = 10 * 60 * 1000; // 10 minutes
      const maxAttempts = Math.ceil(MAX_WAIT_MS / POLL_INTERVAL_MS);

      const phaseStart = Date.now();
      do {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        result = await api.pollSong(sunoJobId);
        attempts++;
        
        const elapsed = Date.now() - phaseStart;
        const progress = Math.min((elapsed / MAX_WAIT_MS) * 80, 80);
        const stepIndex = Math.floor((progress / 80) * (GENERATION_STEPS.length - 1));
        
        setJobs(prev => prev.map(job => 
          job.id === jobId 
            ? { 
                ...job, 
                progress,
                progressText: GENERATION_STEPS[stepIndex] || "Processing..."
              }
            : job
        ));
        
      } while (result.status !== "complete" && attempts < maxAttempts);

      if (result.status === "complete" && result.audioUrls) {
        setJobs(prev => prev.map(job => 
          job.id === jobId 
            ? { 
                ...job, 
                status: 'fetching-audio',
                progress: 85,
                progressText: "Fetching audio files..."
              }
            : job
        ));

        // Create versions array for this job
        const versions = result.audioUrls.map((url: string, index: number) => ({
          url,
          audioId: `${sunoJobId}-${index}`,
          musicIndex: index,
          words: [],
          hasTimestamps: false
        }));

        // Generate album covers in parallel
        let albumCovers = null;
        try {
          const coverResponse = await api.generateAlbumCovers(details);
          albumCovers = { cover1: coverResponse.cover1, cover2: coverResponse.cover2 };
        } catch (error) {
          console.error("Album cover generation failed for job:", jobId, error);
        }

        // Mark job as complete
        setJobs(prev => prev.map(job => 
          job.id === jobId 
            ? { 
                ...job, 
                status: 'complete',
                progress: 100,
                progressText: "Generation complete!",
                versions,
                albumCovers
              }
            : job
        ));

        toast.success("Song generated successfully!");
        return jobId;
      } else {
        throw new Error("Generation failed or timed out");
      }
    } catch (error) {
      console.error("Generation error for job:", jobId, error);
      toast.error("Failed to generate song");
      
      setJobs(prev => prev.map(job => 
        job.id === jobId 
          ? { 
              ...job, 
              status: 'error',
              progress: 0,
              progressText: "Generation failed",
              error: error instanceof Error ? error.message : "Unknown error"
            }
          : job
      ));
      return null;
    }
  }, [canStartNewJob]);

  const removeJob = useCallback((jobId: string) => {
    setJobs(prev => prev.filter(job => job.id !== jobId));
  }, []);

  const getJobProgress = useCallback((jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    return job ? job.progress : 0;
  }, [jobs]);

  const getCompletedTracks = useCallback(() => {
    const completedJobs = jobs.filter(job => job.status === 'complete');
    const tracks = [];
    
    for (const job of completedJobs) {
      for (let i = 0; i < job.versions.length; i++) {
        const version = job.versions[i];
        tracks.push({
          id: version.audioId,
          url: version.url,
          title: job.details.title || "Song Title",
          coverUrl: i < 2 && job.albumCovers ? (i === 0 ? job.albumCovers.cover1 : job.albumCovers.cover2) : undefined,
          createdAt: job.createdAt,
          params: job.styleTags,
          words: version.words,
          hasTimestamps: version.hasTimestamps
        });
      }
    }
    
    return tracks.sort((a, b) => b.createdAt - a.createdAt); // Newest first
  }, [jobs]);

  const getActiveJobs = useCallback(() => {
    return jobs.filter(job => job.status === 'pending' || job.status === 'generating' || job.status === 'fetching-audio');
  }, [jobs]);

  return {
    jobs,
    activeJobs: getActiveJobs(),
    completedTracks: getCompletedTracks(),
    activeJobsCount: getActiveJobsCount(),
    canStartNewJob: canStartNewJob(),
    startJob,
    removeJob,
    getJobProgress
  };
}