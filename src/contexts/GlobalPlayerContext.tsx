import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { TrackItem } from '@/types';
import { useSessionManager } from '@/hooks/use-session-manager';

interface GlobalPlayerState {
  currentTrack: TrackItem | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  queue: TrackItem[];
  currentIndex: number;
  originatingSessionId: string | null;
  isRadioMode: boolean;
}

interface GlobalPlayerContextValue {
  state: GlobalPlayerState;
  audioRef: React.RefObject<HTMLAudioElement>;
  playGlobalTrack: (track: TrackItem, queue: TrackItem[], sessionId: string) => void;
  pauseGlobalPlayer: () => void;
  resumeGlobalPlayer: () => void;
  stopGlobalPlayer: () => void;
  seekGlobal: (time: number) => void;
  playNext: () => void;
  playPrevious: () => void;
  setGlobalQueue: (tracks: TrackItem[], currentIndex?: number) => void;
}

const GlobalPlayerContext = createContext<GlobalPlayerContextValue | null>(null);

export function GlobalPlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Access session manager to add tracks to Global session
  const sessionManager = useSessionManager();
  
  const [state, setState] = useState<GlobalPlayerState>({
    currentTrack: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    queue: [],
    currentIndex: 0,
    originatingSessionId: null,
    isRadioMode: false,
  });

  // Update current time and duration
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      setState(prev => ({
        ...prev,
        currentTime: audio.currentTime,
        duration: audio.duration || 0,
      }));
    };

    const handleEnded = () => {
      playNext();
    };

    const handleLoadedMetadata = () => {
      setState(prev => ({
        ...prev,
        duration: audio.duration || 0,
      }));
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, []);

  const playGlobalTrack = useCallback((track: TrackItem, queue: TrackItem[], sessionId: string) => {
    const audio = audioRef.current;
    if (!audio) return;

    const trackIndex = queue.findIndex(t => t.id === track.id);
    
    setState(prev => ({
      ...prev,
      currentTrack: track,
      queue,
      currentIndex: trackIndex >= 0 ? trackIndex : 0,
      originatingSessionId: sessionId,
      isRadioMode: true,
    }));

    // Add the current track to Global session if it doesn't exist there
    try {
      const globalSession = sessionManager.sessions.find(s => s.id === 'global');
      const trackExistsInGlobal = globalSession?.tracks.some(t => t.id === track.id);
      
      if (!trackExistsInGlobal) {
        // Switch to global session temporarily to add the track
        const currentSessionId = sessionManager.currentSessionId;
        sessionManager.switchToSession('global');
        sessionManager.addTrackToCurrentSession(track);
        // Switch back to original session
        if (currentSessionId) {
          sessionManager.switchToSession(currentSessionId);
        }
        console.log('[GlobalPlayer] Added track to Global session:', track.title);
      }
    } catch (error) {
      console.error('[GlobalPlayer] Failed to add track to Global session:', error);
    }

    audio.src = track.url;
    audio.load();
    
    const playPromise = audio.play();
    if (playPromise) {
      playPromise
        .then(() => {
          setState(prev => ({ ...prev, isPlaying: true }));
          console.log('[GlobalPlayer] Started playing:', track.title);
        })
        .catch(err => {
          console.error('[GlobalPlayer] Play failed:', err);
        });
    }
  }, [sessionManager]);

  const pauseGlobalPlayer = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      setState(prev => ({ ...prev, isPlaying: false }));
    }
  }, []);

  const resumeGlobalPlayer = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      const playPromise = audio.play();
      if (playPromise) {
        playPromise
          .then(() => {
            setState(prev => ({ ...prev, isPlaying: true }));
          })
          .catch(err => {
            console.error('[GlobalPlayer] Resume failed:', err);
          });
      }
    }
  }, []);

  const stopGlobalPlayer = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    
    setState({
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      queue: [],
      currentIndex: 0,
      originatingSessionId: null,
      isRadioMode: false,
    });
  }, []);

  const seekGlobal = useCallback((time: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = time;
      setState(prev => ({ ...prev, currentTime: time }));
    }
  }, []);

  const playNext = useCallback(() => {
    const nextIndex = state.currentIndex + 1;
    if (nextIndex < state.queue.length) {
      const nextTrack = state.queue[nextIndex];
      playGlobalTrack(nextTrack, state.queue, state.originatingSessionId || '');
    } else {
      // End of queue
      stopGlobalPlayer();
    }
  }, [state.currentIndex, state.queue, state.originatingSessionId, playGlobalTrack, stopGlobalPlayer]);

  const playPrevious = useCallback(() => {
    const prevIndex = state.currentIndex - 1;
    if (prevIndex >= 0) {
      const prevTrack = state.queue[prevIndex];
      playGlobalTrack(prevTrack, state.queue, state.originatingSessionId || '');
    }
  }, [state.currentIndex, state.queue, state.originatingSessionId, playGlobalTrack]);

  const setGlobalQueue = useCallback((tracks: TrackItem[], currentIndex = 0) => {
    setState(prev => ({
      ...prev,
      queue: tracks,
      currentIndex,
    }));
  }, []);

  const value: GlobalPlayerContextValue = {
    state,
    audioRef,
    playGlobalTrack,
    pauseGlobalPlayer,
    resumeGlobalPlayer,
    stopGlobalPlayer,
    seekGlobal,
    playNext,
    playPrevious,
    setGlobalQueue,
  };

  return (
    <GlobalPlayerContext.Provider value={value}>
      {children}
      <audio ref={audioRef} preload="metadata" />
    </GlobalPlayerContext.Provider>
  );
}

export function useGlobalPlayer(): GlobalPlayerContextValue {
  const context = useContext(GlobalPlayerContext);
  if (!context) {
    throw new Error('useGlobalPlayer must be used within a GlobalPlayerProvider');
  }
  return context;
}