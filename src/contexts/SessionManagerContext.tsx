import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { ChatMessage, TrackItem } from "@/types";

export interface SessionData {
  id: string;
  title: string;
  tracks: TrackItem[];
  chatMessages: ChatMessage[];
  createdAt: number;
  lastModified: number;
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
  removeTrackFromSession: (sessionId: string, trackId: string) => void;
  updateCurrentSessionChat: (messages: ChatMessage[]) => void;
}

export const SessionManagerContext = createContext<SessionManagerContextValue | null>(null);

const STORAGE_KEY = "session_manager_data";
const GLOBAL_SESSION_ID = "global";

function getMockTracks(): TrackItem[] {
  const now = Date.now();
  return [
    {
      id: "placeholder-track-1",
      url: "",
      title: "Neon Dreams",
      coverUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300",
      createdAt: now - 3600000,
      params: ["synthpop", "uplifting", "120 BPM", "English", "female vocals", "bright synths"],
      words: [],
      hasTimestamps: false,
    },
    {
      id: "placeholder-track-2",
      url: "",
      title: "Coffee Shop Moments",
      coverUrl: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=300",
      createdAt: now - 7200000,
      params: ["indie folk", "mellow", "95 BPM", "English", "male vocals", "acoustic guitar"],
      words: [],
      hasTimestamps: false,
    },
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
    };
    setSessions([globalSession]);
    setCurrentSessionId(GLOBAL_SESSION_ID);
  }, []);

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data?.sessions?.length) {
          setSessions(data.sessions);
          setCurrentSessionId(data.currentSessionId || GLOBAL_SESSION_ID);
          return;
        }
      }
    } catch (e) {
      console.error("[SessionManager] Failed to load from storage", e);
    }
    initialize();
  }, [initialize]);

  // Persist to localStorage
  useEffect(() => {
    if (!sessions.length) return;
    const data = { sessions, currentSessionId };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [sessions, currentSessionId]);

  // Helpers
  const getCurrentSession = useCallback(() => {
    return sessions.find((s) => s.id === currentSessionId) || sessions.find((s) => s.id === GLOBAL_SESSION_ID) || null;
  }, [sessions, currentSessionId]);

  const getGlobalSession = useCallback((): SessionData | null => {
    const global = sessions.find((s) => s.id === GLOBAL_SESSION_ID);
    if (!global) return null;

    // Aggregate all tracks from non-global sessions
    const map = new Map<string, TrackItem>();
    for (const session of sessions) {
      if (session.id === GLOBAL_SESSION_ID) continue;
      for (const t of session.tracks) {
        if (!map.has(t.id)) map.set(t.id, t);
      }
    }
    // Include Global's own mock tracks
    for (const t of global.tracks) {
      if (!map.has(t.id)) map.set(t.id, t);
    }

    const allTracks = Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    return { ...global, tracks: allTracks };
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
      tracks: getMockTracks(), // ensure mock tracks in every session
      chatMessages: [
        { role: "assistant", content: "Hey! I can help write and generate a song. What vibe are you going for?" },
      ],
      createdAt: Date.now(),
      lastModified: Date.now(),
    };
    setSessions((prev) => [...prev, newSession]);
    return newSession.id;
  }, [sessions]);

  const switchToSession = useCallback((sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId) || null;
    if (session) setCurrentSessionId(sessionId);
    return session;
  }, [sessions]);

  const updateSession = useCallback((sessionId: string, updates: Partial<SessionData>) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, ...updates, lastModified: Date.now() } : s))
    );
  }, []);

  const addTrackToCurrentSession = useCallback((track: TrackItem) => {
    const current = getCurrentSession();
    if (!current || current.id === GLOBAL_SESSION_ID) return;
    updateSession(current.id, { tracks: [...current.tracks, track] });
  }, [getCurrentSession, updateSession]);

  const removeTrackFromSession = useCallback((sessionId: string, trackId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session || session.id === GLOBAL_SESSION_ID) return;
    updateSession(sessionId, { tracks: session.tracks.filter((t) => t.id !== trackId) });
  }, [sessions, updateSession]);

  const updateCurrentSessionChat = useCallback((messages: ChatMessage[]) => {
    const current = getCurrentSession();
    if (!current) return;
    updateSession(current.id, { chatMessages: messages });
  }, [getCurrentSession, updateSession]);

  const deleteSession = useCallback((sessionId: string) => {
    if (sessionId === GLOBAL_SESSION_ID) return false;
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (currentSessionId === sessionId) setCurrentSessionId(GLOBAL_SESSION_ID);
    return true;
  }, [currentSessionId]);

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
    };
    setSessions((prev) => [...prev, dup]);
    return dup.id;
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
    removeTrackFromSession,
    updateCurrentSessionChat,
  };

  return (
    <SessionManagerContext.Provider value={value}>
      {children}
    </SessionManagerContext.Provider>
  );
}
