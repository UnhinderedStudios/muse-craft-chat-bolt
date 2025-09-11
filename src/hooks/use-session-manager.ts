import { useState, useEffect, useCallback } from 'react';
import { ChatMessage, TrackItem } from '@/types';

export interface SessionData {
  id: string;
  title: string;
  tracks: TrackItem[];
  chatMessages: ChatMessage[];
  createdAt: number;
  lastModified: number;
}

const STORAGE_KEY = 'session_manager_data';
const GLOBAL_SESSION_ID = 'global';

export function useSessionManager() {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>(GLOBAL_SESSION_ID);

  // Initialize global session function
  const initializeGlobalSession = useCallback(() => {
    const globalSession: SessionData = {
      id: GLOBAL_SESSION_ID,
      title: 'Global',
      tracks: [
        {
          id: "placeholder-track-1",
          url: "",
          title: "Neon Dreams",
          coverUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300",
          createdAt: Date.now() - 3600000, // 1 hour ago
          params: ["synthpop", "uplifting", "120 BPM", "English", "female vocals", "bright synths"],
          words: [],
          hasTimestamps: false
        },
        {
          id: "placeholder-track-2", 
          url: "",
          title: "Coffee Shop Moments",
          coverUrl: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=300",
          createdAt: Date.now() - 7200000, // 2 hours ago
          params: ["indie folk", "mellow", "95 BPM", "English", "male vocals", "acoustic guitar"],
          words: [],
          hasTimestamps: false
        }
      ],
      chatMessages: [
        { role: "assistant", content: "Hey! I can help write and generate a song. What vibe are you going for?" }
      ],
      createdAt: Date.now(),
      lastModified: Date.now()
    };
    setSessions([globalSession]);
    setCurrentSessionId(GLOBAL_SESSION_ID);
  }, []);

  // Load sessions from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        if (data.sessions && data.sessions.length > 0) {
          setSessions(data.sessions);
          setCurrentSessionId(data.currentSessionId || GLOBAL_SESSION_ID);
        } else {
          initializeGlobalSession();
        }
      } catch (error) {
        console.error('Failed to load sessions:', error);
        initializeGlobalSession();
      }
    } else {
      initializeGlobalSession();
    }
  }, [initializeGlobalSession]);

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    if (sessions.length > 0) { // Only save if we have sessions to avoid overwriting
      const data = {
        sessions,
        currentSessionId
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }, [sessions, currentSessionId]);

  // Get current session
  const getCurrentSession = useCallback(() => {
    return sessions.find(s => s.id === currentSessionId) || sessions.find(s => s.id === GLOBAL_SESSION_ID);
  }, [sessions, currentSessionId]);

  // Get global session (aggregates all tracks from other sessions)
  const getGlobalSession = useCallback(() => {
    const globalSession = sessions.find(s => s.id === GLOBAL_SESSION_ID);
    if (!globalSession) return null;

    // Aggregate tracks from all non-global sessions
    const allTracks: TrackItem[] = [];
    sessions.forEach(session => {
      if (session.id !== GLOBAL_SESSION_ID) {
        allTracks.push(...session.tracks);
      }
    });

    // Sort by creation date (newest first)
    allTracks.sort((a, b) => b.createdAt - a.createdAt);

    return {
      ...globalSession,
      tracks: allTracks
    };
  }, [sessions]);

  // Get all sessions for display (with Global at top)
  const getDisplaySessions = useCallback(() => {
    const globalSession = getGlobalSession();
    const otherSessions = sessions.filter(s => s.id !== GLOBAL_SESSION_ID);
    
    // Sort other sessions by last modified (newest first)
    otherSessions.sort((a, b) => b.lastModified - a.lastModified);

    return globalSession ? [globalSession, ...otherSessions] : otherSessions;
  }, [sessions, getGlobalSession]);

  // Create new session
  const createSession = useCallback((title?: string) => {
    const newSession: SessionData = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: title || `Session ${sessions.filter(s => s.id !== GLOBAL_SESSION_ID).length + 1}`,
      tracks: [],
      chatMessages: [
        { role: "assistant", content: "Hey! I can help write and generate a song. What vibe are you going for?" }
      ],
      createdAt: Date.now(),
      lastModified: Date.now()
    };

    setSessions(prev => [...prev, newSession]);
    return newSession.id;
  }, [sessions]);

  // Switch to session
  const switchToSession = useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setCurrentSessionId(sessionId);
      return session;
    }
    return null;
  }, [sessions]);

  // Update session data
  const updateSession = useCallback((sessionId: string, updates: Partial<SessionData>) => {
    setSessions(prev => prev.map(session => 
      session.id === sessionId 
        ? { ...session, ...updates, lastModified: Date.now() }
        : session
    ));
  }, []);

  // Add track to current session
  const addTrackToCurrentSession = useCallback((track: TrackItem) => {
    const currentSession = getCurrentSession();
    if (currentSession && currentSession.id !== GLOBAL_SESSION_ID) {
      updateSession(currentSession.id, {
        tracks: [...currentSession.tracks, track]
      });
    }
  }, [getCurrentSession, updateSession]);

  // Remove track from session
  const removeTrackFromSession = useCallback((sessionId: string, trackId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session && session.id !== GLOBAL_SESSION_ID) {
      updateSession(sessionId, {
        tracks: session.tracks.filter(t => t.id !== trackId)
      });
    }
  }, [sessions, updateSession]);

  // Update chat messages for current session
  const updateCurrentSessionChat = useCallback((messages: ChatMessage[]) => {
    const currentSession = getCurrentSession();
    if (currentSession) {
      updateSession(currentSession.id, { chatMessages: messages });
    }
  }, [getCurrentSession, updateSession]);

  // Delete session (except Global)
  const deleteSession = useCallback((sessionId: string) => {
    if (sessionId === GLOBAL_SESSION_ID) return false;
    
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    
    // If deleting current session, switch to Global
    if (currentSessionId === sessionId) {
      setCurrentSessionId(GLOBAL_SESSION_ID);
    }
    
    return true;
  }, [currentSessionId]);

  // Rename session
  const renameSession = useCallback((sessionId: string, newTitle: string) => {
    if (sessionId === GLOBAL_SESSION_ID) return false; // Can't rename Global
    
    updateSession(sessionId, { title: newTitle });
    return true;
  }, [updateSession]);

  // Duplicate session
  const duplicateSession = useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session || session.id === GLOBAL_SESSION_ID) return null;

    const duplicatedSession: SessionData = {
      ...session,
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: `${session.title} (Copy)`,
      createdAt: Date.now(),
      lastModified: Date.now()
    };

    setSessions(prev => [...prev, duplicatedSession]);
    return duplicatedSession.id;
  }, [sessions]);

  return {
    // State
    sessions: getDisplaySessions(),
    currentSessionId,
    currentSession: getCurrentSession(),
    
    // Actions
    createSession,
    switchToSession,
    updateSession,
    deleteSession,
    renameSession,
    duplicateSession,
    addTrackToCurrentSession,
    removeTrackFromSession,
    updateCurrentSessionChat
  };
}