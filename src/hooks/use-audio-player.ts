import { useState, useRef, useEffect } from "react";

export const useAudioPlayer = () => {
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentAudioIndex, setCurrentAudioIndex] = useState<number>(0);
  const audioRefs = useRef<HTMLAudioElement[]>([]);

  // Ensure only one audio element plays at a time across the page
  useEffect(() => {
    const onAnyPlay = (e: Event) => {
      const target = e.target as HTMLMediaElement | null;
      if (!target || target.tagName !== "AUDIO") return;
      const audios = document.querySelectorAll<HTMLAudioElement>("audio");
      audios.forEach((audio) => {
        if (audio !== target && !audio.paused) {
          try { audio.pause(); } catch {}
        }
      });
    };
    document.addEventListener("play", onAnyPlay, true);
    return () => {
      document.removeEventListener("play", onAnyPlay, true);
    };
  }, []);

  // Reset audio refs when result list changes
  useEffect(() => {
    audioRefs.current = [];
  }, []);

  const handleAudioPlay = (index: number, busy: boolean) => {
    console.log(`[AudioPlay] Attempting to play audio ${index}, current index: ${currentAudioIndex}, isPlaying: ${isPlaying}`);
    
    // Prevent multiple rapid calls
    if (busy) {
      console.log(`[AudioPlay] Blocked - generation is busy`);
      return;
    }
    
    // If same audio is already playing, just toggle pause/play
    if (currentAudioIndex === index && isPlaying) {
      console.log(`[AudioPlay] Audio ${index} is already playing, pausing`);
      handleAudioPause();
      return;
    }

    const isSwitchingTracks = currentAudioIndex !== index;

    // STEP 1: Immediately pause ALL audio elements
    console.log(`[AudioPlay] Stopping all audio and switching to ${index}, isSwitchingTracks: ${isSwitchingTracks}`);
    audioRefs.current.forEach((audio, i) => {
      if (audio) {
        try {
          if (!audio.paused) {
            audio.pause();
            console.log(`[AudioPlay] Paused audio ${i}`);
          }
          // Only reset time when switching tracks, not when resuming the same track
          if (isSwitchingTracks) {
            audio.currentTime = 0;
          }
        } catch (e) {
          console.log(`[AudioPlay] Error stopping audio ${i}:`, e);
        }
      }
    });
    
    // STEP 2: Update state immediately
    setIsPlaying(false);
    // Only reset currentTime when switching tracks
    if (isSwitchingTracks) {
      setCurrentTime(0);
    }
    setCurrentAudioIndex(index);
    
    // STEP 3: Small delay to ensure state has updated before playing new audio
    setTimeout(() => {
      const audioElement = audioRefs.current[index];
      if (audioElement) {
        try {
          // Reset to start only when switching tracks or if audio already ended
          if (isSwitchingTracks || audioElement.ended) {
            audioElement.currentTime = 0;
          }
          console.log(`[AudioPlay] Starting playback for audio ${index}`);
          // Start playing the new audio
          const playPromise = audioElement.play();
          if (playPromise) {
            playPromise.then(() => {
              console.log(`[AudioPlay] Successfully started audio ${index}`);
              setIsPlaying(true);
            }).catch(error => {
              // Only log non-AbortError errors
              if (error.name !== 'AbortError') {
                console.error(`[AudioPlay] Error playing audio ${index}:`, error);
              }
              setIsPlaying(false);
            });
          }
        } catch (error) {
          console.error(`[AudioPlay] Sync error playing audio ${index}:`, error);
          setIsPlaying(false);
        }
      } else {
        console.log(`[AudioPlay] Audio element ${index} not ready`);
        setIsPlaying(false);
      }
    }, 50); // 50ms delay to ensure clean state transition
  };

  const handleAudioPause = () => {
    // Actually pause the current audio
    const audioElement = audioRefs.current[currentAudioIndex];
    if (audioElement && !audioElement.paused) {
      try {
        audioElement.pause();
      } catch (error) {
        console.error('Error pausing audio:', error);
      }
    }
    setIsPlaying(false);
  };

  const handleTimeUpdate = (audio: HTMLAudioElement) => {
    // Only update time for the currently active audio
    const activeIndex = audioRefs.current.findIndex(ref => ref === audio);
    if (activeIndex === currentAudioIndex) {
      const newTime = audio.currentTime;
      setCurrentTime(newTime);
      console.log('[Audio Debug] Time update:', newTime.toFixed(2), 'for audio', activeIndex);
    }
  };

  const handleSeek = (time: number) => {
    const audioElement = audioRefs.current[currentAudioIndex];
    if (audioElement) {
      try {
        audioElement.currentTime = time;
        setCurrentTime(time);
      } catch (error) {
        console.error('Error seeking audio:', error);
      }
    }
  };

  return {
    currentTime,
    isPlaying,
    currentAudioIndex,
    audioRefs,
    handleAudioPlay,
    handleAudioPause,
    handleTimeUpdate,
    handleSeek
  };
};