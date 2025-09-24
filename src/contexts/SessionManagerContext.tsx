import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { ChatMessage, TrackItem } from "@/types";

export interface SessionData {
  id: string;
  title: string;
  tracks: TrackItem[];
  chatMessages: ChatMessage[];
  createdAt: number;
  lastModified: number;
  activeGenerations: Array<{
    id: string;
    sunoJobId?: string;
    startTime: number;
    progress: number;
    details: any;
    covers?: { cover1: string; cover2: string } | null;
    isCompleting?: boolean;
  }>;
}

export interface SessionManagerContextValue {
  // State
  sessions: SessionData[];
  currentSessionId: string;
  currentSession: SessionData | undefined | null;

  // Actions
  createSession: (title?: string) => string;
  switchToSession: (sessionId: string) => SessionData | null;
  updateSession: (sessionId: string, updates: Partial<SessionData>) => void;
  deleteSession: (sessionId: string) => boolean;
  renameSession: (sessionId: string, newTitle: string) => boolean;
  duplicateSession: (sessionId: string) => string | null;
  addTrackToCurrentSession: (track: TrackItem) => void;
  addTracksToCurrentSession: (tracks: TrackItem[]) => void;
  removeTrackFromSession: (sessionId: string, trackId: string) => void;
  updateCurrentSessionChat: (messages: ChatMessage[]) => void;
  updateTrackCover: (trackId: string, coverUrl: string, albumCoverIds?: string[]) => void;
  
  // Generation management
  addActiveGeneration: (generation: { id: string; sunoJobId?: string; startTime: number; progress: number; details: any; covers?: { cover1: string; cover2: string } | null; isCompleting?: boolean }) => void;
  updateActiveGeneration: (id: string, updates: Partial<{ sunoJobId?: string; progress: number; details: any; covers?: { cover1: string; cover2: string } | null; isCompleting?: boolean }>) => void;
  removeActiveGeneration: (id: string) => void;
  getActiveGenerations: () => Array<{ id: string; sunoJobId?: string; startTime: number; progress: number; details: any; covers?: { cover1: string; cover2: string } | null; isCompleting?: boolean }>;
  findActiveGenerationById: (id: string) => { id: string; sunoJobId?: string; startTime: number; progress: number; details: any; covers?: { cover1: string; cover2: string } | null; isCompleting?: boolean } | null;
}

export const SessionManagerContext = createContext<SessionManagerContextValue | null>(null);

const STORAGE_KEY = "session_manager_data";
const GLOBAL_SESSION_ID = "global";

function getMockTracks(): TrackItem[] {
  return [
    {
      id: "mock1",
      url: "https://www.soundjay.com/misc/sounds/magic-chime-02.mp3",
      title: "Ethereal Dreams",
      coverUrl: "/lovable-uploads/92dd2dde-eb4e-44a1-a2a3-b24829727f7a.png",
      createdAt: Date.now() - 3600000, // 1 hour ago
      params: ["ambient", "dreamy", "ethereal"],
      hasTimestamps: false,
      words: [],
    },
    {
      id: "mock2", 
      url: "https://www.soundjay.com/misc/sounds/magic-chime-02.mp3",
      title: "Neon Nights",
      coverUrl: "/lovable-uploads/b1f7ab9f-3051-49c9-ace1-0331224addae.png", 
      createdAt: Date.now() - 1800000, // 30 minutes ago
      params: ["synthwave", "retro", "electronic"],
      hasTimestamps: false,
      words: [],
    }
  ];
}

export function SessionManagerProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>(GLOBAL_SESSION_ID);

  // Initialize with a default Global session containing mock tracks
  const initialize = useCallback(() => {
    const globalSession: SessionData = {
      id: GLOBAL_SESSION_ID,
      title: "Global",
      tracks: getMockTracks(),
      chatMessages: [
        { role: "assistant", content: "Hey! I can help write and generate a song. What vibe are you going for?" },
      ],
      createdAt: Date.now(),
      lastModified: Date.now(),
      activeGenerations: [],
    };
    setSessions([globalSession]);
    setCurrentSessionId(GLOBAL_SESSION_ID);
  }, []);

  // Emergency localStorage cleanup function
  const emergencyCleanup = useCallback(() => {
    try {
      console.log("[SessionManager] Emergency cleanup: localStorage quota exceeded");
      // Remove all session data and reinitialize
      localStorage.removeItem(STORAGE_KEY);
      initialize();
      console.log("[SessionManager] Emergency cleanup completed");
    } catch (error) {
      console.error("[SessionManager] Emergency cleanup failed:", error);
      // If even cleanup fails, just initialize in memory
      initialize();
    }
  }, [initialize]);

  // Load from localStorage and clear all tracks except mock ones
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      console.log("[SessionManager] Raw localStorage data:", raw);
      if (raw) {
        const data = JSON.parse(raw);
        console.log("[SessionManager] Parsed localStorage data:", data);
        if (data?.sessions?.length) {
          // Preserve existing tracks and add mock tracks only if Global session is empty
              const mockTracks = getMockTracks();
          const preservedSessions = data.sessions.map((session: SessionData) => {
            if (session.id === GLOBAL_SESSION_ID) {
              // Always ensure mock tracks are present alongside real tracks
              const existingTracks = session.tracks || [];
              console.log("[SessionManager] Existing tracks from storage:", existingTracks);
              
              // Combine existing tracks with any missing mock tracks
              const allTracks = [...existingTracks];
              mockTracks.forEach(mockTrack => {
                if (!allTracks.find(t => t.id === mockTrack.id)) {
                  allTracks.push(mockTrack);
                }
              });
              
              console.log("[SessionManager] Final tracks after adding mocks:", allTracks);
              return {
                ...session,
                tracks: allTracks,
                activeGenerations: []
              };
            }
            return { ...session, activeGenerations: [] };
          });
          setSessions(preservedSessions);
          console.log("[SessionManager] Loaded sessions:", preservedSessions);
          return;
        }
      }
    } catch (e) {
      console.error("[SessionManager] Failed to load from storage", e);
      // Check if it's a quota error
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        emergencyCleanup();
      } else {
        initialize();
      }
    }
    if (!sessions || sessions.length === 0) {
      initialize();
    }
  }, [initialize, emergencyCleanup]);

  // Persist to localStorage with pruning and quota guards
  useEffect(() => {
    if (!sessions.length) return;

    // Create a pruned, storage-safe snapshot to avoid exceeding localStorage quota
    const buildSnapshot = (level: 0 | 1 | 2) => {
      return {
        sessions: sessions.map((s) => {
          const safeTracks = (s.tracks ?? []).map((t: any) => ({
            id: t.id,
            url: t.url,
            title: t.title,
            // Only persist coverUrl if it's not a data URL (base64)
            coverUrl: t.coverUrl && !t.coverUrl.startsWith('data:') ? t.coverUrl : undefined,
            albumCoverIds: t.albumCoverIds,
            createdAt: t.createdAt,
            // keep light metadata only
            params: level < 2 ? t.params : undefined,
            hasTimestamps: t.hasTimestamps,
            hasBeenPlayed: t.hasBeenPlayed,
            jobId: t.jobId,
            audioId: t.audioId,
            // Don't persist words - karaoke data now stored in Supabase
            words: undefined,
            // Remove generatedCovers entirely - don't persist base64 covers
          }));

          const safeActive = (s.activeGenerations ?? []).map((g: any) => ({
            id: g.id,
            sunoJobId: g.sunoJobId,
            startTime: g.startTime,
            progress: g.progress,
            // Don't persist covers - they contain base64 data
            // covers: g.covers ?? null,
            // drop details to keep small
          }));

          let safeChat = s.chatMessages ?? [];
          // Strip base64 data from attachments to prevent quota issues
          safeChat = safeChat.map(msg => ({
            ...msg,
            // Remove attachments entirely to avoid quota issues with base64 data
            attachments: undefined
          }));
          if (level >= 1) {
            safeChat = safeChat.slice(-50);
          }
          if (level >= 2) {
            safeChat = safeChat.slice(-10);
          }

          return {
            id: s.id,
            title: s.title,
            createdAt: s.createdAt,
            lastModified: s.lastModified,
            tracks: safeTracks,
            chatMessages: safeChat,
            activeGenerations: safeActive,
          };
        }),
        currentSessionId,
      };
    };

    let level: 0 | 1 | 2 = 0;
    for (;;) {
      try {
        const snapshot = buildSnapshot(level);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
        break;
      } catch (err: any) {
        const isQuota =
          (typeof DOMException !== "undefined" && err instanceof DOMException && err.name === "QuotaExceededError") ||
          (err && String(err).includes("QuotaExceededError"));
        if (isQuota && level < 2) {
          level = (level + 1) as 0 | 1 | 2;
          console.log(`[SessionManager] Quota exceeded, trying level ${level} pruning`);
          continue;
        }
        console.error("[SessionManager] Failed to persist sessions", err);
        // If all pruning levels fail, try emergency cleanup
        if (isQuota) {
          console.log("[SessionManager] All pruning levels failed, attempting emergency cleanup");
          emergencyCleanup();
        }
        break;
      }
    }
  }, [sessions, currentSessionId, emergencyCleanup]);

  // Auto-prune stale or replaced active generations (safety net)
  useEffect(() => {
    const MAX_AGE_MS = 20 * 60 * 1000; // 20 minutes
    const prune = () => {
      setSessions((prev) => {
        let changed = false;
        const next = prev.map((session) => {
          const filtered = (session.activeGenerations || []).filter((g) => {
            const tooOld = Date.now() - (g.startTime || 0) > MAX_AGE_MS;
            const jobTracks = (session.tracks || []).filter((t) => t.jobId === g.id).length;
            if (tooOld || jobTracks >= 2) {
              console.debug('[SessionManager] prune activeGeneration', { sessionId: session.id, jobId: g.id, tooOld, jobTracks });
              changed = true;
              return false;
            }
            return true;
          });
          return filtered.length !== session.activeGenerations.length
            ? { ...session, activeGenerations: filtered }
            : session;
        });
        return changed ? next : prev;
      });
    };
    prune();
    const id = window.setInterval(prune, 15000);
    return () => window.clearInterval(id);
  }, []);

  // Helpers
  const getCurrentSession = useCallback(() => {
    return sessions.find((s) => s.id === currentSessionId) || sessions.find((s) => s.id === GLOBAL_SESSION_ID) || null;
  }, [sessions, currentSessionId]);

  const getGlobalSession = useCallback((): SessionData | null => {
    const global = sessions.find((s) => s.id === GLOBAL_SESSION_ID);
    if (!global) return null;

    // Aggregate all tracks from all sessions (including global itself)
    const map = new Map<string, TrackItem>();
    for (const session of sessions) {
      for (const t of session.tracks) {
        const key = `${t.id}|${t.url}`; // avoid accidental collisions by id-only
        if (!map.has(key)) map.set(key, t);
      }
    }

    const allTracks = Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    // Aggregate all active generations from all sessions for Global view
    const allActiveGenerations: Array<{
      id: string;
      sunoJobId?: string;
      startTime: number;
      progress: number;
      details: any;
      covers?: { cover1: string; cover2: string } | null;
      isCompleting?: boolean;
    }> = [];
    
    for (const session of sessions) {
      allActiveGenerations.push(...session.activeGenerations);
    }

    // Sort active generations by startTime (newest first) for consistent ordering
    allActiveGenerations.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));

    return { ...global, tracks: allTracks, activeGenerations: allActiveGenerations };
  }, [sessions]);

  const displaySessions = useMemo(() => {
    const globalAgg = getGlobalSession();
    const others = sessions.filter((s) => s.id !== GLOBAL_SESSION_ID).sort((a, b) => b.lastModified - a.lastModified);
    return globalAgg ? [globalAgg, ...others] : others;
  }, [sessions, getGlobalSession]);

  // Actions
  const createSession = useCallback((title?: string) => {
    const count = sessions.filter((s) => s.id !== GLOBAL_SESSION_ID).length;
    const newSession: SessionData = {
      id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      title: title || `Session ${count + 1}`,
      tracks: [], // Start with empty tracks
      chatMessages: [
        { role: "assistant", content: "Hey! I can help write and generate a song. What vibe are you going for?" },
      ],
      createdAt: Date.now(),
      lastModified: Date.now(),
      activeGenerations: [],
    };
    setSessions((prev) => [...prev, newSession]);
    // Immediately switch to the newly created session
    setCurrentSessionId(newSession.id);
    return newSession.id;
  }, [sessions]);

  const switchToSession = useCallback((sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId) || null;
    // Set target session ID immediately to avoid race conditions with createSession
    setCurrentSessionId(sessionId);
    return session;
  }, [sessions]);

  const updateSession = useCallback((sessionId: string, updates: Partial<SessionData>) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, ...updates, lastModified: Date.now() } : s))
    );
  }, []);

  const addTrackToCurrentSession = useCallback((track: TrackItem) => {
    setSessions(prev => {
      return prev.map(s => {
        if (s.id !== currentSessionId) return s;
        const nextTracks = [...s.tracks, track];
        return { ...s, tracks: nextTracks, lastModified: Date.now() };
      });
    });
  }, [currentSessionId]);

  const updateTrackCover = useCallback((trackId: string, coverUrl: string, albumCoverIds?: string[]) => {
    if (!currentSessionId) return;
    
    setSessions(prev => prev.map(session => 
      session.id === currentSessionId 
        ? { 
            ...session, 
            tracks: session.tracks.map(track => 
              track.id === trackId 
                ? { ...track, coverUrl, albumCoverIds: albumCoverIds || track.albumCoverIds }
                : track
            ),
            lastModified: Date.now()
          }
        : session
    ));
  }, [currentSessionId]);

  const addTracksToCurrentSession = useCallback((newTracks: TrackItem[]) => {
    setSessions(prev => {
      return prev.map(s => {
        if (s.id !== currentSessionId) return s;
        // Prevent accidental duplicates by id|url during concurrent appends
        const seen = new Set<string>();
        const key = (t: TrackItem) => `${t.id}|${t.url}`;
        const base = s.tracks;
        base.forEach(t => seen.add(key(t)));
        const merged: TrackItem[] = [...base];
        for (const t of newTracks) {
          const k = key(t);
          if (!seen.has(k)) {
            seen.add(k);
            merged.push(t);
          }
        }
        return { ...s, tracks: merged, lastModified: Date.now() };
      });
    });
  }, [currentSessionId]);

  const removeTrackFromSession = useCallback((sessionId: string, trackId: string) => {
    if (sessionId === GLOBAL_SESSION_ID) return;
    setSessions(prev => prev.map(s => {
      if (s.id !== sessionId) return s;
      return {
        ...s,
        tracks: s.tracks.filter(t => t.id !== trackId),
        lastModified: Date.now(),
      };
    }));
  }, []);

  const updateCurrentSessionChat = useCallback((messages: ChatMessage[]) => {
    const current = getCurrentSession();
    if (!current) return;
    updateSession(current.id, { chatMessages: messages });
  }, [getCurrentSession, updateSession]);

  const deleteSession = useCallback((sessionId: string) => {
    if (sessionId === GLOBAL_SESSION_ID) return false;
    
    // Before deleting, move real tracks and active generations to Global session
    const sessionToDelete = sessions.find(s => s.id === sessionId);
    if (sessionToDelete) {
      const globalSession = sessions.find(s => s.id === GLOBAL_SESSION_ID);
      if (globalSession) {
        // Move all tracks to Global (no more filtering needed)
        if (sessionToDelete.tracks.length > 0) {
          updateSession(GLOBAL_SESSION_ID, { 
            tracks: [...globalSession.tracks, ...sessionToDelete.tracks]
          });
        }
        
        // Move active generations to Global
        if (sessionToDelete.activeGenerations.length > 0) {
          updateSession(GLOBAL_SESSION_ID, { 
            activeGenerations: [...globalSession.activeGenerations, ...sessionToDelete.activeGenerations]
          });
        }
      }
    }
    
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (currentSessionId === sessionId) setCurrentSessionId(GLOBAL_SESSION_ID);
    return true;
  }, [currentSessionId, sessions, updateSession]);

  const renameSession = useCallback((sessionId: string, newTitle: string) => {
    if (sessionId === GLOBAL_SESSION_ID) return false;
    updateSession(sessionId, { title: newTitle });
    return true;
  }, [updateSession]);

  const duplicateSession = useCallback((sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session || session.id === GLOBAL_SESSION_ID) return null;

    const dup: SessionData = {
      ...session,
      id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      title: `${session.title} (Copy)`,
      createdAt: Date.now(),
      lastModified: Date.now(),
      activeGenerations: [], // Don't copy active generations
    };
    setSessions((prev) => [...prev, dup]);
    return dup.id;
  }, [sessions]);

  // Generation management functions
  const addActiveGeneration = useCallback((generation: { id: string; sunoJobId?: string; startTime: number; progress: number; details: any; covers?: { cover1: string; cover2: string } | null; isCompleting?: boolean }) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== currentSessionId) return s;
      // Ensure uniqueness by generation id
      const exists = s.activeGenerations.some(g => g.id === generation.id);
      const next = exists ? s.activeGenerations.map(g => g.id === generation.id ? { ...g, ...generation } : g)
                          : [generation, ...s.activeGenerations];
      return { ...s, activeGenerations: next, lastModified: Date.now() };
    }));
  }, [currentSessionId]);

  const updateActiveGeneration = useCallback((id: string, updates: Partial<{ sunoJobId?: string; progress: number; details: any; covers?: { cover1: string; cover2: string } | null; isCompleting?: boolean }>) => {
    setSessions(prevSessions => {
      // Find which session contains this generation and update it
      return prevSessions.map(session => {
        const hasGeneration = session.activeGenerations.some(gen => gen.id === id);
        if (hasGeneration) {
          return {
            ...session,
            activeGenerations: session.activeGenerations.map(gen => 
              gen.id === id ? { ...gen, ...updates } : gen
            )
          };
        }
        return session;
      });
    });
  }, []);

  const removeActiveGeneration = useCallback((id: string) => {
    setSessions(prevSessions => {
      // Find which session contains this generation and remove it
      return prevSessions.map(session => {
        const hasGeneration = session.activeGenerations.some(gen => gen.id === id);
        if (hasGeneration) {
          return {
            ...session,
            activeGenerations: session.activeGenerations.filter(gen => gen.id !== id)
          };
        }
        return session;
      });
    });
  }, []);

  const getActiveGenerations = useCallback(() => {
    const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes safety TTL

    if (currentSessionId === GLOBAL_SESSION_ID) {
      // In Global view, aggregate all active generations from all sessions
      const allActiveGenerations: Array<{
        id: string;
        sunoJobId?: string;
        startTime: number;
        progress: number;
        details: any;
        covers?: { cover1: string; cover2: string } | null;
      }> = [];

      const aggregatedTracks: TrackItem[] = [];
      for (const session of sessions) {
        allActiveGenerations.push(...session.activeGenerations);
        aggregatedTracks.push(...session.tracks);
      }

      // Sort active generations by startTime (newest first) for consistent ordering
      allActiveGenerations.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));

      // Hide jobs that are too old or that have produced their expected 2 tracks
      const filtered = allActiveGenerations.filter((g) => {
        const ageOk = Date.now() - (g.startTime || 0) <= MAX_AGE_MS;
        // Only count tracks that belong to THIS specific job
        const jobTracks = aggregatedTracks.filter((t) => t.jobId === g.id).length;
        console.log(`[ActiveGen Filter] Job ${g.id}: age=${ageOk}, tracks=${jobTracks}/2`);
        return ageOk && jobTracks < 2;
      });

      return filtered;
    }

    const current = getCurrentSession();
    if (!current) return [];

    const filtered = (current.activeGenerations || []).filter((g) => {
      const ageOk = Date.now() - (g.startTime || 0) <= MAX_AGE_MS;
      // Only count tracks that belong to THIS specific job
      const jobTracks = (current.tracks || []).filter((t) => t.jobId === g.id).length;
      console.log(`[ActiveGen Filter] Job ${g.id}: age=${ageOk}, tracks=${jobTracks}/2`);
      return ageOk && jobTracks < 2;
    });

    return filtered;
  }, [getCurrentSession, currentSessionId, sessions]);

  const findActiveGenerationById = useCallback((id: string) => {
    // Find generation by ID across all sessions without filtering
    for (const session of sessions) {
      const generation = session.activeGenerations.find(g => g.id === id);
      if (generation) return generation;
    }
    return null;
  }, [sessions]);

  // Compute current session (use aggregated Global when selected)
  const currentSession = useMemo(() => {
    if (currentSessionId === GLOBAL_SESSION_ID) return getGlobalSession();
    return getCurrentSession();
  }, [currentSessionId, getCurrentSession, getGlobalSession]);

  const value: SessionManagerContextValue = {
    sessions: displaySessions,
    currentSessionId,
    currentSession,
    createSession,
    switchToSession,
    updateSession,
    deleteSession,
    renameSession,
    duplicateSession,
    addTrackToCurrentSession,
    addTracksToCurrentSession,
    removeTrackFromSession,
    updateCurrentSessionChat,
    updateTrackCover,
    addActiveGeneration,
    updateActiveGeneration,
    removeActiveGeneration,
    getActiveGenerations,
    findActiveGenerationById,
  };

  return (
    <SessionManagerContext.Provider value={value}>
      {children}
    </SessionManagerContext.Provider>
  );
}
