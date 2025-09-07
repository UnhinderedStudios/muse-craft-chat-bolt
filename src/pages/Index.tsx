import { useEffect, useMemo, useRef, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, type SongDetails } from "@/lib/api";
import { FileAttachment } from "@/types";
import { sanitizeStyle } from "@/lib/styleSanitizer";
import { Spinner } from "@/components/ui/spinner";
import { ImageAnalysisLoader } from "@/components/ui/image-analysis-loader";
import { toast } from "sonner";
import { Dice5, Mic, Upload, Plus, List, Play, Pause, X, SkipBack, SkipForward, Shuffle, Repeat, Volume2, VolumeX, Music, Compass, Users, HelpCircle, BookOpen, MoreHorizontal } from "lucide-react";

// Components
import { CyberCard } from "@/components/cyber/CyberCard";
import { CyberButton } from "@/components/cyber/CyberButton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { ChatInput } from "@/components/chat/ChatInput";
import { SongDetailsForm } from "@/components/song/SongDetailsForm";
import { AudioPlayer } from "@/components/audio/AudioPlayer";
import { KaraokeLyrics } from "@/components/audio/KaraokeLyrics";
import { FullscreenKaraoke } from "@/components/karaoke/FullscreenKaraoke";
import { KaraokeRightPanel } from "@/components/karaoke/KaraokeRightPanel";
import { ResizableContainer } from "@/components/layout/ResizableContainer";
import { TagInput } from "@/components/song/TagInput";
import PlayerDock from "@/components/audio/PlayerDock";
import TrackListPanel from "@/components/tracklist/TrackListPanel";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { VoiceInterface } from "@/components/voice/VoiceInterface";
import { TemplatePanel } from "@/components/template/TemplatePanel";
import { SessionsPanel } from "@/components/sessions/SessionsPanel";
import { useVirtualizer } from "@tanstack/react-virtual";

// Hooks
import { useChat } from "@/hooks/use-chat";
import { useResize } from "@/hooks/use-resize";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useSongGeneration } from "@/hooks/use-song-generation";

// Types
import { type TimestampedWord, type ChatMessage, type TrackItem } from "@/types";

import { parseSongRequest, convertToSongDetails } from "@/lib/parseSongRequest";
import { RANDOM_MUSIC_FORGE_PROMPT } from "@/utils/prompts";
import { parseRandomMusicForgeOutput } from "@/lib/parseRandomMusicForge";
import { diceMemory } from "@/lib/diceMemory";
import { wavRegistry } from "@/lib/wavRegistry";

const systemPrompt = `You are Melody Muse, a friendly creative assistant for songwriting.
Your goal is to chat naturally and quickly gather two things only: (1) a unified Style description and (2) Lyrics.
IMPORTANT: Never include artist names in Style. If the user mentions an artist (e.g., "like Ed Sheeran"), translate that into neutral descriptors (timbre, instrumentation, tempo/BPM, mood, era) and DO NOT name the artist. Style must combine: genre/subgenre, mood/energy, tempo or BPM, language, vocal type (male/female/duet/none), and production notes.
If a message appears to be keyboard smashing or nonsensical (e.g., "fufeiuofhbeh"), respond with a lighthearted joke and a fitting emoji 😊, then immediately re-ask your last question clearly so the user can answer easily. Do not dismiss it or say you're moving on—always politely re-ask the exact question.

CRITICAL: When users provide multiple inputs (text, images, documents), you MUST analyze and incorporate ALL of them together when creating song requests. Use image analysis to understand visual themes, moods, colors, and combine this with text content and document information to create a cohesive song that reflects all provided inputs.

Ask concise questions one at a time. When you have enough info, output ONLY a compact JSON with key song_request and fields: title, style, lyrics. The style must not contain artist names. The lyrics MUST ALWAYS be a complete song with the following sections in order: Intro, Verse 1, Pre-Chorus, Chorus, Verse 2, Chorus, Bridge, Outro. Do not ask if the user wants more verses; always deliver the full structure.

Example JSON:
{"song_request": {"title": "Neon Skies", "style": "synthpop, uplifting, 120 BPM, English, female vocals, bright analog synths, sidechain bass, shimmering pads", "lyrics": "Full song with labeled sections: Intro, Verse 1, Pre-Chorus, Chorus, Verse 2, Chorus, Bridge, Outro"}}

Continue the conversation after the JSON if needed.`;

function extractDetails(text: string): SongDetails | null {
  // Prefer the shared robust parser first
  try {
    const parsed = parseSongRequest(text);
    if (parsed) {
      return convertToSongDetails(parsed);
    }
  } catch (e) {
    console.debug("[Parse] parseSongRequest failed:", e);
  }

  // Handle language-tagged fenced blocks like ```json { ... } ```
  try {
    const fenceJson = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i);
    if (fenceJson) {
      const obj = JSON.parse(fenceJson[1]);
      if (obj.song_request && typeof obj.song_request === "object") {
        return obj.song_request as SongDetails;
      }
    }
  } catch (e) {
    console.debug("[Parse] Fenced JSON parse failed:", e);
  }

  // Fallback: look for plain JSON object anywhere in the text
  try {
    const jsonMatch = text.match(/\{"song_request"[\s\S]*?\}\}/);
    if (jsonMatch) {
      const obj = JSON.parse(jsonMatch[0]);
      if (obj.song_request && typeof obj.song_request === "object") {
        return obj.song_request as SongDetails;
      }
    }
  } catch (e) {
    console.debug("[Parse] Inline JSON parse failed:", e);
  }

  return null;
}

function mergeNonEmpty(...items: (SongDetails | undefined)[]): SongDetails {
  const out: SongDetails = {};
  for (const item of items) {
    if (!item) continue;
    const t = typeof item.title === "string" ? item.title.trim() : "";
    const s = typeof item.style === "string" ? item.style.trim() : "";
    const l = typeof item.lyrics === "string" ? item.lyrics.trim() : "";
    if (t) out.title = t;
    if (s) out.style = s;
    if (l) out.lyrics = l;
  }
  return out;
}
function sanitizeStyleSafe(input?: string): string | undefined {
  if (!input) return undefined;
  const cleaned = sanitizeStyle(input);
  const finalVal = (cleaned || "").trim();
  return finalVal || input.trim();
}



// VirtualizedChat component for performance with large message lists
type VirtualizedChatProps = {
  chatFeed: any[];
  scrollerRef: React.RefObject<HTMLDivElement>;
  bottomPad: number;
};

const GAP_PX = 16; // tailwind space-y-4

const VirtualizedChat = ({ chatFeed, scrollerRef, bottomPad }: VirtualizedChatProps) => {
  try {
    const virtualizer = useVirtualizer({
      count: chatFeed.length,
      getScrollElement: () => scrollerRef.current,
      estimateSize: () => 100,
      overscan: 5,
    });

    return (
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
          paddingBottom: bottomPad,
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const m = chatFeed[virtualItem.index];
          return (
            <div
              key={virtualItem.key}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {m?.type === "status" && m?.id === "__status__" ? (
                <div className="space-y-3" role="status" aria-live="polite">
                  {m.isAnalyzingImage && <ImageAnalysisLoader text="Analyzing Image..." />}
                  {m.isReadingText && <ImageAnalysisLoader text="Reading Document..." />}
                  {!m.isAnalyzingImage && !m.isReadingText && <Spinner />}
                </div>
              ) : (
                <ChatBubble role={m.role} content={m.content} />
              )}
              {/* spacer to mimic space-y-4 */}
              <div style={{ height: GAP_PX }} />
            </div>
          );
        })}
      </div>
    );
  } catch (error) {
    // Fallback to non-virtualized rendering on any error
    console.warn('Virtualization failed, falling back to regular rendering:', error);
    return (
      <>
        {chatFeed.map((m: any, i: number) => {
          if (m?.type === "status" && m?.id === "__status__") {
            return (
              <div key="__status__" className="space-y-3" role="status" aria-live="polite">
                {m.isAnalyzingImage && <ImageAnalysisLoader text="Analyzing Image..." />}
                {m.isReadingText && <ImageAnalysisLoader text="Reading Document..." />}
                {!m.isAnalyzingImage && !m.isReadingText && <Spinner />}
              </div>
            );
          }
          return <ChatBubble key={i} role={m.role} content={m.content} />;
        })}
      </>
    );
  }
};

const Index = () => {
  const DOCK_H = 80; // px — reduced height to make container more compact
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [input, setInput] = useState("");
  const [isChatBusy, setIsChatBusy] = useState(false);
  const [isMusicGenerating, setIsMusicGenerating] = useState(false);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [isReadingText, setIsReadingText] = useState(false);
  const [details, setDetails] = useState<SongDetails>({});
  const [styleTags, setStyleTags] = useState<string[]>([]);
  const { chatHeight, isResizing, handleMouseDown } = useResize();
  const [showMelodySpeech, setShowMelodySpeech] = useState(false);
  
  // Use the chat hook for both main chat and voice interface
  const { messages, sendMessage } = useChat();
  
  // Ref for chat input to maintain focus
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const [footerH, setFooterH] = useState(0);

  // utils
  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
  
  // Helper function to determine if we should auto-select a new track
  const shouldAutoSelectTrack = () => {
    console.log('[Auto-select] Checking conditions:', {
      isPlaying,
      currentTrackIndex,
      currentTrack: tracks[currentTrackIndex],
      hasRealTracks: tracks.some(t => !t.id.startsWith('placeholder-'))
    });
    
    // Don't auto-select if user is actively playing something
    if (isPlaying) {
      console.log('[Auto-select] Blocked: User is playing');
      return false;
    }
    
    // Don't auto-select if user has a real track selected (not placeholder)
    if (currentTrackIndex >= 0 && tracks[currentTrackIndex] && !tracks[currentTrackIndex].id.startsWith('placeholder-')) {
      console.log('[Auto-select] Blocked: User has real track selected');
      return false;
    }
    
    // Only auto-select if we're in a truly fresh state (no real tracks or only placeholders selected)
    const hasOnlyPlaceholders = tracks.every(t => t.id.startsWith('placeholder-'));
    const shouldSelect = hasOnlyPlaceholders || currentTrackIndex < 0;
    
    console.log('[Auto-select] Decision:', shouldSelect ? 'ALLOW' : 'BLOCK');
    return shouldSelect;
  };

  // constants that already exist visually in your layout
  const RESERVED = 144;     // header + grid gaps + card paddings (your existing comment)
  const MIN_FORM = 280;     // matches class min-h-[280px]
  const MIN_SCROLLER = 120; // hard stop for the chat scroll area

  // track viewport height for proper max calculations
  const [vh, setVh] = useState<number>(typeof window !== "undefined" ? window.innerHeight : 900);
  useEffect(() => {
    const onResize = () => setVh(window.innerHeight);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // measure footer height (desktop)
  useEffect(() => {
    if (!isDesktop) { setFooterH(0); return; }
    const el = footerRef.current;
    if (!el) return;

    const update = () => setFooterH(el.offsetHeight || 0);
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => { ro.disconnect(); window.removeEventListener('resize', update); };
  }, [isDesktop]);

  // always keep the bottom in view when things change
  // Type for synthetic status row
  type StatusRow = {
    id: "__status__";
    type: "status";
    isAnalyzingImage: boolean;
    isReadingText: boolean;
  };

  // Build chat feed with synthetic status row when busy
  const chatFeed = useMemo(() => {
    if (!isChatBusy) return messages;
    const statusRow: StatusRow = {
      id: "__status__",
      type: "status",
      isAnalyzingImage,
      isReadingText,
    };
    return [...messages, statusRow as any];
  }, [messages, isChatBusy, isAnalyzingImage, isReadingText]);

  // Consolidate scroll-to-bottom behavior
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: (!isChatBusy && messages.length > 0) ? "smooth" : "auto",
    });
  }, [chatFeed.length, chatHeight, footerH, isChatBusy, isAnalyzingImage, isReadingText]);

  // MAX the chat scroller can take while guaranteeing the form keeps MIN_FORM
  const MAX_SCROLLER = clamp(vh - MIN_FORM - RESERVED, MIN_SCROLLER, vh);

  // Keyboard shortcuts
  useEffect(() => {
    const onShortcut = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey;

      // Focus chat with '/'
      if (e.key === '/') {
        const ae = document.activeElement as HTMLElement | null;
        if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.getAttribute('contenteditable') === 'true')) return;
        e.preventDefault();
        chatInputRef.current?.focus();
        return;
      }

      // Cmd/Ctrl+K -> toggle Melody Speech
      if (meta && (e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        setShowMelodySpeech((v) => !v);
      }
    };

    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, [setShowMelodySpeech]);

  // height actually used by the chat scroller (clamped on both ends)
  const scrollerHeight = isDesktop
    ? clamp(chatHeight - footerH - 8, MIN_SCROLLER, MAX_SCROLLER)
    : undefined;

  // the form's height becomes the complement of the scroller (also clamped)
  const formHeightPx = isDesktop
    ? clamp(vh - scrollerHeight - RESERVED, MIN_FORM, vh)
    : undefined;

  // padding so the last message never hides under the input/footer
  const bottomPad = footerH + 24;

  // Sync styleTags with details.style
  useEffect(() => {
    if (details.style && details.style !== styleTags.join(", ")) {
      // Convert string to tags when details.style changes externally (like from chat or randomize)
      const tags = details.style.split(",").map(tag => tag.trim()).filter(tag => tag.length > 0);
      setStyleTags(tags);
    }
  }, [details.style]);

  const handleStyleTagsChange = (tags: string[]) => {
    setStyleTags(tags);
    setDetails({ ...details, style: tags.join(", ") });
  };
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
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentAudioIndex, setCurrentAudioIndex] = useState<number>(0);
  // Placeholder tracks for design development - remove when ready for production
  const [tracks, setTracks] = useState<TrackItem[]>([
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
  ]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  
  // Independent karaoke state - tracks what's displayed in karaoke panel
  const [karaokeTrackId, setKaraokeTrackId] = useState<string>("");
  const [karaokeAudioIndex, setKaraokeAudioIndex] = useState<number>(-1);
  
  // Track what's actually playing (independent of UI selection)
  const [playingTrackId, setPlayingTrackId] = useState<string>("");
  const [playingTrackIndex, setPlayingTrackIndex] = useState<number>(-1);
  
  // Sync karaoke version selection with karaoke track (smarter version dependency)
  useEffect(() => {
    if (!karaokeTrackId) {
      setKaraokeAudioIndex(versions.length ? 0 : -1);
      return;
    }
    
    const idx = versions.findIndex(v => v.audioId === karaokeTrackId);
    if (idx !== -1) {
      setKaraokeAudioIndex(idx);
    } else {
      // Keep existing karaoke audio index if track versions haven't updated yet
      setKaraokeAudioIndex(prev => prev >= 0 && prev < versions.length ? prev : -1);
    }
  }, [karaokeTrackId, versions]);
  const [showFullscreenKaraoke, setShowFullscreenKaraoke] = useState(false);
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
  const [scrollTop, setScrollTop] = useState<number>(0);
  const [activeGenerations, setActiveGenerations] = useState<Array<{
    id: string, 
    sunoJobId?: string,
    startTime: number,
    progress: number,
    details: SongDetails,
    covers?: { cover1: string; cover2: string } | null
  }>>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const audioRefs = useRef<HTMLAudioElement[]>([]);
  const lastDiceAt = useRef<number>(0);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<FileAttachment[]>([]);

  // Global spacebar controls for play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // Check if spacebar was pressed
        if (e.code === 'Space' || e.key === ' ') {
          // Don't interfere if user is typing in an input field
          const activeElement = document.activeElement;
          if (activeElement instanceof HTMLInputElement || 
              activeElement instanceof HTMLTextAreaElement || 
              activeElement?.hasAttribute('contenteditable')) {
            return;
          }
          
          // Prevent default behavior (page scrolling)
          e.preventDefault();
          
          // Toggle play/pause for current track
          if (tracks.length > 0) {
            if (isPlaying) {
              handleAudioPause();
            } else {
              handleAudioPlay(currentTrackIndex);
            }
          }
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, currentTrackIndex, tracks.length]);




  useEffect(() => {
    // Smart audio refs management - only adjust size, preserve existing elements
    if (audioRefs.current.length !== tracks.length) {
      // Only resize array if needed, preserving existing elements
      audioRefs.current.length = tracks.length;
    }
  }, [audioUrls, audioUrl, tracks.length]);

  // Smooth progress system that never goes backward and handles stagnation
  useEffect(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    if (isMusicGenerating) {
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
  }, [isMusicGenerating, lastProgressUpdate]);

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


  const canGenerate = useMemo(() => !!details.lyrics, [details]);

  function handleAudioPlay(index: number) {
    if (!tracks.length) return;
    console.log(`[AudioPlay] Attempting to play track ${index}, current index: ${currentTrackIndex}, isPlaying: ${isPlaying}`);
    
    // Allow playing tracks during generation - users should be able to listen while songs generate
    
    // Update both karaoke and playing track state when user actually starts playing
    const playingTrack = tracks[index];
    if (playingTrack) {
      setKaraokeTrackId(playingTrack.id);
      setPlayingTrackId(playingTrack.id);
      setPlayingTrackIndex(index);
      
      // Mark track as played
      setTracks(prevTracks => 
        prevTracks.map((track, i) => 
          i === index ? { ...track, hasBeenPlayed: true } : track
        )
      );
    }
    
    // If same track is already playing, just toggle pause/play
    if (currentTrackIndex === index && isPlaying) {
      console.log(`[AudioPlay] Track ${index} is already playing, pausing`);
      handleAudioPause();
      return;
    }

    const isSwitchingTracks = currentTrackIndex !== index;

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
          if (isSwitchingTracks && i !== index) {
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
    setCurrentTrackIndex(index);
    
    // STEP 3: Small delay to ensure state has updated before playing new audio
    setTimeout(() => {
      const audioElement = audioRefs.current[index];
      if (audioElement) {
        try {
          // Reset to start only when switching tracks or if audio already ended
          if (isSwitchingTracks || audioElement.ended) {
            audioElement.currentTime = 0;
          }
          console.log(`[AudioPlay] Starting playback for track ${index}`);
          
          // CRITICAL: Ensure no auto-play and explicit dual-player prevention
          audioElement.autoplay = false;
          
          // Start playing the new audio
          const playPromise = audioElement.play();
          if (playPromise) {
            playPromise.then(() => {
              console.log(`[AudioPlay] Successfully started track ${index}`);
              setIsPlaying(true);
            }).catch(error => {
              // Only log non-AbortError errors
              if (error.name !== 'AbortError') {
                console.error(`[AudioPlay] Error playing track ${index}:`, error);
              }
              setIsPlaying(false);
            });
          }
        } catch (error) {
          console.error(`[AudioPlay] Sync error playing track ${index}:`, error);
          setIsPlaying(false);
        }
      } else {
        console.log(`[AudioPlay] Audio element ${index} not ready`);
        setIsPlaying(false);
      }
    }, 50); // 50ms delay to ensure clean state transition
  }

  const handleAudioPause = () => {
    console.log(`[AUDIO DEBUG] Pausing playback, playingTrackIndex: ${playingTrackIndex}`);
    
    // Pause the actually playing audio, not just the selected one
    const audioElement = audioRefs.current[playingTrackIndex];
    if (audioElement && !audioElement.paused) {
      try {
        audioElement.pause();
      } catch (error) {
        console.error('Error pausing audio:', error);
      }
    }
    
    // Also pause any other potentially playing audio elements as safety measure
    audioRefs.current.forEach((audio, index) => {
      if (audio && !audio.paused) {
        console.log(`[AUDIO DEBUG] Safety pause for audio at index ${index}`);
        audio.pause();
      }
    });
    
    setIsPlaying(false);
  };

  const handleTimeUpdate = (audio: HTMLAudioElement) => {
    // CRITICAL: Only update if this is the currently playing audio AND actually playing
    const audioIndex = audioRefs.current.findIndex(ref => ref === audio);
    const isCurrentlyPlaying = playingTrackIndex >= 0 && audioIndex === playingTrackIndex && isPlaying && !audio.paused;
    
    if (isCurrentlyPlaying) {
      const newTime = audio.currentTime;
      setCurrentTime(newTime);
    } else if (audioIndex !== playingTrackIndex && !audio.paused) {
      // Safety: pause any non-current audio that's somehow playing
      console.log(`[AUDIO DEBUG] Safety pausing audio at index ${audioIndex} (current playing: ${playingTrackIndex})`);
      audio.pause();
    }
  };

  const handleSeek = (time: number) => {
    const audioElement = audioRefs.current[playingTrackIndex];
    if (audioElement) {
      try {
        audioElement.currentTime = time;
        setCurrentTime(time);
      } catch (error) {
        console.error('Error seeking audio:', error);
      }
    }
  };

  const playPrev = () => {
    if (tracks.length) {
      const targetIndex = playingTrackIndex >= 0 ? Math.max(0, playingTrackIndex - 1) : Math.max(0, currentTrackIndex - 1);
      handleAudioPlay(targetIndex);
    }
  };
  const playNext = () => {
    if (tracks.length) {
      const targetIndex = playingTrackIndex >= 0 ? Math.min(tracks.length - 1, playingTrackIndex + 1) : Math.min(tracks.length - 1, currentTrackIndex + 1);
      handleAudioPlay(targetIndex);
    }
  };

  // Handle retry timestamps for karaoke
  const handleRetryTimestamps = async (versionIndex: number) => {
    if (!jobId || !versions[versionIndex]) return;
    try {
      setIsMusicGenerating(true);
      const { audioId, musicIndex } = versions[versionIndex];

      const res = await api.getTimestampedLyrics({
        taskId: jobId,
        audioId,
        musicIndex,
      });

      const words = (res.alignedWords ?? []).map((w: any) => ({
        word: w.word,
        start: w.startS ?? w.start_s ?? w.start ?? 0,
        end:   w.endS   ?? w.end_s   ?? w.end   ?? 0,
        success: !!w.success,
        p_align: w.p_align ?? w.palign ?? 0,
      }));

      if (words.length) {
        setVersions(vs => vs.map((v, i) => i === versionIndex ? { ...v, words, hasTimestamps: true, timestampError: undefined } : v));
        setTracks(ts => ts.map(t => t.id === audioId ? { ...t, words, hasTimestamps: true, timestampError: undefined } : t));
        toast.success("Karaoke timestamps loaded!");
      } else {
        setVersions(vs => vs.map((v, i) => i === versionIndex ? { ...v, timestampError: "No timestamps available" } : v));
        toast.error("No timestamps available for this version");
      }
    } catch (e) {
      setVersions(vs => vs.map((v, i) => i === versionIndex ? { ...v, timestampError: "Failed to load timestamps" } : v));
      toast.error("Failed to load karaoke timestamps");
    } finally {
      setIsMusicGenerating(false);
    }
  };

  // Update track cover URLs when album covers are generated
  useEffect(() => {
    if (albumCovers && tracks.length > 0) {
      setTracks(prev => prev.map((track, index) => {
        // Only update if the track doesn't already have a cover URL
        if (!track.coverUrl) {
          return {
            ...track,
            coverUrl: index % 2 === 1 ? albumCovers.cover2 : albumCovers.cover1
          };
        }
        return track;
      }));
    }
  }, [albumCovers, tracks.length]);

  const handleFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*,.txt,.md,.doc,.docx,.pdf,.rtf,.odt,.json';
    
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      const newAttachments: FileAttachment[] = [];
      
      for (const file of files) {
        if (file.size > 20 * 1024 * 1024) { // 20MB limit
          console.error(`File ${file.name} is too large`);
          continue;
        }
        
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          newAttachments.push({
            name: file.name,
            type: file.type,
            size: file.size,
            data: base64.split(',')[1] // Remove data:type;base64, prefix
          });
          
          if (newAttachments.length === files.length) {
            setAttachedFiles(prev => [...prev, ...newAttachments]);
          }
        };
        reader.readAsDataURL(file);
      }
    };
    
    input.click();
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Helper functions for global player
  const playCurrent = () => handleAudioPlay(currentTrackIndex);
  const togglePlayPause = () => (isPlaying ? handleAudioPause() : handleAudioPlay(currentTrackIndex));

  async function onSend() {
    const content = input.trim();
    if (!content && attachedFiles.length === 0) return; // Allow attachments-only messages
    const fileAttachments = attachedFiles.length > 0 ? [...attachedFiles] : undefined;
    
    // Extract text from attachments on client side before sending
    let appendedText = "";
    try {
      if (fileAttachments && fileAttachments.length > 0) {
        console.log("[Chat] Extracting text from", fileAttachments.length, "attachments");
        const { extractTextFromAttachments } = await import("@/lib/extractTextFromFiles");
        appendedText = await extractTextFromAttachments(fileAttachments);
        if (appendedText) {
          console.log("[Chat] Extracted text length:", appendedText.length);
        }
      }
    } catch (e) {
      console.error("[Chat] Attachment text extraction failed:", e);
    }
    
    // Send combined content to API (user content + extracted text)
    const apiContent = appendedText ? `${content}\n\n${appendedText}` : content;
    setInput("");
    setAttachedFiles([]); // Clear attachments after sending

    setIsChatBusy(true);
    
    // Check attachment types to show appropriate loader
    const hasImageAttachments = fileAttachments?.some(file => file.type.startsWith('image/'));
    const hasTextAttachments = fileAttachments?.some(file => 
      file.type.startsWith('text/') || 
      file.name.endsWith('.txt') || 
      file.name.endsWith('.md') || 
      file.name.endsWith('.json') ||
      file.name.endsWith('.docx') ||
      file.name.endsWith('.doc') ||
      file.name.endsWith('.pdf') ||
      file.name.endsWith('.rtf') ||
      file.name.endsWith('.odt') ||
      file.name.endsWith('.xlsx') ||
      file.name.endsWith('.xls') ||
      file.name.endsWith('.pptx') ||
      file.name.endsWith('.ppt')
    );
    setIsAnalyzingImage(hasImageAttachments || false);
    setIsReadingText(hasTextAttachments || false);
    
    try {
      const chatSystemPrompt = systemPrompt;
      console.debug("[Chat] Using systemPrompt (first 160 chars):", chatSystemPrompt.slice(0, 160));
      
      // Use the shared sendMessage function
      const assistantMessage = await sendMessage(apiContent, chatSystemPrompt, fileAttachments);
      
      if (assistantMessage) {
        const assistantMsg = assistantMessage.content;
        
        // Try new parser first
        const songRequest = parseSongRequest(assistantMsg);
        if (songRequest) {
          const converted = convertToSongDetails(songRequest);
          const now = Date.now();
          if (now - lastDiceAt.current >= 4000) {
            const finalStyle = sanitizeStyleSafe(converted.style);
            const cleaned: SongDetails = { ...converted, ...(finalStyle ? { style: finalStyle } : {}) };
            setDetails((d) => mergeNonEmpty(d, cleaned));
          }
        } else {
          // Fallback to old extraction method
          const extracted = extractDetails(assistantMsg);
          if (extracted) {
            const now = Date.now();
            if (now - lastDiceAt.current >= 4000) {
              const finalStyle = sanitizeStyleSafe(extracted.style);
              const cleaned: SongDetails = { ...extracted, ...(finalStyle ? { style: finalStyle } : {}) };
              setDetails((d) => mergeNonEmpty(d, cleaned));
            }
          }
        }
      }

    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
    } finally {
      setIsChatBusy(false);
      setIsAnalyzingImage(false);
      setIsReadingText(false);
      
      // Refocus input after all state updates using nested requestAnimationFrame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (chatInputRef.current && document.activeElement !== chatInputRef.current) {
            try {
              chatInputRef.current.focus();
            } catch (error) {
              console.log('Focus error:', error);
            }
          }
        });
      });
    }
  }
  async function randomizeAll() {
    if (isChatBusy) return;
    
    // Generate diversity constraints based on recent rolls
    const constraints = diceMemory.generateConstraints();
    const content = "Dice roll: create a fresh, original song now." + constraints;
    
    setIsChatBusy(true);
    try {
      const minimal: ChatMessage[] = [{ role: "user", content }];
      console.debug("[Dice] Using RandomMusicForge v7 prompt with constraints:", constraints.slice(0, 100));
      const [r1, r2] = await Promise.allSettled([
        api.chat(minimal, { system: RANDOM_MUSIC_FORGE_PROMPT, temperature: 0.9, model: "gpt-4o-mini" }),
        api.chat(minimal, { system: RANDOM_MUSIC_FORGE_PROMPT, temperature: 0.9, model: "gpt-4o-mini" }),
      ]);
      const msgs: string[] = [];
      if (r1.status === "fulfilled") msgs.push(r1.value.content);
      if (r2.status === "fulfilled") msgs.push(r2.value.content);
      console.debug("[Dice] Received responses:", msgs.map(m => m.slice(0, 160)));
      const extractions = msgs.map((m) => {
        const rmf = parseRandomMusicForgeOutput(m);
        if (rmf) return rmf;
        const parsed = parseSongRequest(m);
        if (parsed) return convertToSongDetails(parsed);
        return extractDetails(m);
      }).filter(Boolean) as SongDetails[];
      
      if (extractions.length === 0) {
        console.debug("[Dice] Failed to parse any random song. First response preview:", msgs[0]?.slice(0, 300));
        toast.message("Couldn't parse random song", { description: "Try again in a moment." });
      } else {
        // Score extractions for diversity and pick the best one
        const scoredExtractions = extractions.map(ex => ({
          songDetails: ex,
          diversityScore: diceMemory.scoresDiversity(ex)
        }));
        
        // Sort by diversity score (higher is more diverse)
        scoredExtractions.sort((a, b) => b.diversityScore - a.diversityScore);
        let bestExtraction = scoredExtractions[0].songDetails;
        
        // First roll enforcement: if Rock is chosen, try to pick another option or re-roll
        if (diceMemory.history?.length === 0) {
          const currentGenre = diceMemory.extractGenre(bestExtraction.style || "");
          if (currentGenre && currentGenre.toLowerCase().includes("rock")) {
            // Try to find a non-Rock alternative
            const nonRockOption = scoredExtractions.find(ex => {
              const genre = diceMemory.extractGenre(ex.songDetails.style || "");
              return !genre || !genre.toLowerCase().includes("rock");
            });
            if (nonRockOption) {
              bestExtraction = nonRockOption.songDetails;
            } else {
              // If both are Rock, re-roll once with explicit constraint
              try {
                const retryContent = "Dice roll: create a fresh, original song now.\n\nDIVERSITY CONSTRAINTS:\nNever use Indie as a Main Genre (exclude the tag 'Indie' in Parameters).\nDo not choose Rock as the Main Genre.";
                const retryResponse = await api.chat([{ role: "user", content: retryContent }], { system: RANDOM_MUSIC_FORGE_PROMPT, temperature: 0.9, model: "gpt-4o-mini" });
                const retryExtraction = parseRandomMusicForgeOutput(retryResponse.content) || extractDetails(retryResponse.content);
                if (retryExtraction) {
                  bestExtraction = retryExtraction;
                }
              } catch (error) {
                console.log("Retry failed, proceeding with original:", error);
              }
            }
          }
        }
        
        const finalStyle = sanitizeStyleSafe(bestExtraction.style);
        const cleaned: SongDetails = { ...bestExtraction, ...(finalStyle ? { style: finalStyle } : {}) };
        
        // Add to memory for future diversity
        diceMemory.addRoll(cleaned);
        
        lastDiceAt.current = Date.now();
        setDetails((d) => mergeNonEmpty(d, cleaned));
        toast.success("Randomized song details ready");
      }
      // Do not alter chat history for the dice action
    } catch (e: any) {
      toast.error(e.message || "Randomize failed");
    } finally {
      setIsChatBusy(false);
    }
  }

  async function testAlbumCoverWithLyrics() {
    if (isMusicGenerating) return;
    setIsGeneratingCovers(true);
    setAlbumCovers(null);
    
    console.log("🧪 Test Art using song details:", details);
    try {
      const result = await api.testAlbumCover(details);
      console.log("Test album covers generated:", result);
      setAlbumCovers({
        cover1: result.cover1,
        cover2: result.cover2,
        debug: result.debug
      });
      toast.success("Test album covers generated!");
    } catch (error) {
      console.error("Test album cover generation failed:", error);
      toast.error("Failed to generate test album covers");
    } finally {
      setIsGeneratingCovers(false);
    }
  }

  async function startGeneration() {
    return startGenerationWithJobId(null);
  }

  async function startGenerationWithJobId(wrapperJobId: string | null, inputDetails?: SongDetails) {
    const songData = inputDetails || { ...details };
    
    if (!canGenerate) {
      toast.message("Add a few details first", { description: "Chat a bit more until I extract a song request." });
      return;
    }
    setAudioUrl(null);
    setAudioUrls(null);
    setJobId(null);
    if (!wrapperJobId) {
      setVersions([]);
    }
    if (!wrapperJobId) {
      setGenerationProgress(0);
      setLastProgressUpdate(Date.now());
    }
    setAlbumCovers(null);
    setIsGeneratingCovers(false);
    setIsMusicGenerating(true);
    
    // Individual album covers will be generated per track instead of batch generation
    
    try {
      const payload = { ...songData, style: sanitizeStyle(songData.style || "") };
      
      // Start both audio generation and cover generation in parallel
      const [sunoResult, coversResult] = await Promise.allSettled([
        api.startSong(payload),
        api.generateAlbumCovers(payload)
      ]);
      
      if (sunoResult.status === 'rejected') {
        throw sunoResult.reason;
      }
      
      const { jobId: sunoJobId } = sunoResult.value;
      setJobId(sunoJobId);
      
       // Store covers locally and in active generation
       const coverData = coversResult.status === 'fulfilled' ? coversResult.value : null;
       console.log(`[CoverGen] 🎨 Generated covers for job ${wrapperJobId}:`, coverData);
       
       if (wrapperJobId) {
         setActiveGenerations(prev => {
           const updated = prev.map(job => 
             job.id === wrapperJobId ? { 
               ...job, 
               sunoJobId,
               covers: coverData
             } : job
           );
           console.log(`[CoverGen] 📦 Updated activeGenerations:`, updated);
           return updated;
         });
       } else {
         console.warn(`[CoverGen] ⚠️ No wrapperJobId found, covers will not be stored!`);
       }
      
      toast.success("Song requested. Composing...");

      // Phase A: Wait for generation completion with status confirmation
      console.log("[Generation] Phase A: Waiting for completion...");
      // Phase A: Wait up to 10 minutes for generation completion (time-based)
      const PHASE_A_MAX_MS = 10 * 60 * 1000; // 10 minutes
      const PHASE_A_START = Date.now();
      let completionAttempts = 0;
      let statusRaw = "PENDING";
      let sunoData: any[] = [];
      let generationComplete = false;

      while (Date.now() - PHASE_A_START < PHASE_A_MAX_MS) {
        completionAttempts++;
        // Progress based on elapsed time (never goes backward)
        const elapsed = Date.now() - PHASE_A_START;
        const baseProgress = Math.min((elapsed / PHASE_A_MAX_MS) * 40, 40);
        let statusProgress = 5;
        if (statusRaw === "PENDING") statusProgress = 15;
        else if (statusRaw === "FIRST_SUCCESS") statusProgress = 35;
        else if (statusRaw === "TEXT_SUCCESS") statusProgress = 55;
        else if (statusRaw === "SUCCESS") statusProgress = 70;
        
        const newProgress = Math.max(baseProgress, statusProgress);
        if (wrapperJobId) {
          updateJobProgress(wrapperJobId, newProgress);
        } else {
          setGenerationProgress(current => {
            if (newProgress > current) {
              setLastProgressUpdate(Date.now());
              return newProgress;
            }
            return current;
          });
        }
        
        const backoffDelay = Math.min(1500 + completionAttempts * 300, 4000);
        await new Promise((r) => setTimeout(r, backoffDelay));
        
        try {
          const details = await api.getMusicGenerationDetails(sunoJobId);
          statusRaw = details.statusRaw;
          sunoData = details.response?.sunoData || [];
          
          console.log(`[Generation] Attempt ${completionAttempts}: Status=${statusRaw}, Tracks=${sunoData.length}`);
          
          // Check for completion - accept SUCCESS but not intermediate states
          if (statusRaw === "SUCCESS" || statusRaw === "COMPLETE" || statusRaw === "ALL_SUCCESS") {
            console.log("[Generation] Phase A: Generation completed!");
            if (wrapperJobId) {
              updateJobProgress(wrapperJobId, 75);
            } else {
              setGenerationProgress(current => {
                setLastProgressUpdate(Date.now());
                return Math.max(current, 75);
              });
            }
            generationComplete = true;
            break;
          }
          
          if (statusRaw.includes("FAIL") || statusRaw.includes("ERROR")) {
            throw new Error(`Generation failed with status: ${statusRaw}`);
          }
        } catch (e) {
          console.warn(`[Generation] Details polling error (attempt ${completionAttempts}):`, e);
          // Continue polling even if details call fails
        }
      }

      if (!generationComplete) {
        throw new Error("Generation timed out after 10 minutes");
      }

      // Get audio URLs via regular polling
      console.log("[Generation] Fetching audio URLs...");
      let audioAttempts = 0;
      const maxAudioAttempts = 15;
      
      while (audioAttempts++ < maxAudioAttempts) {
        await new Promise((r) => setTimeout(r, 2000));
        const status = await api.pollSong(sunoJobId);
        
        if (status.status === "ready" && status.audioUrls?.length) {
          console.log("[Generation] Audio URLs ready:", status.audioUrls);
          setAudioUrls(status.audioUrls);
          setAudioUrl(status.audioUrls[0]);
          
          // Create initial versions from audioUrls and sunoData with real IDs
          const newVersions = status.audioUrls.map((url, index) => {
            const trackData = sunoData[index];
            const realAudioId = trackData?.id;
            
            if (!realAudioId || realAudioId.startsWith('track_')) {
              console.warn(`[Generation] Version ${index}: Missing or invalid audioId, got: ${realAudioId}`);
            } else {
              console.log(`[Generation] Version ${index}: Using audioId: ${realAudioId}`);
            }
            
            return {
              url,
              audioId: realAudioId || `missing_id_${index}`,
              musicIndex: index,
              words: [] as TimestampedWord[],
              hasTimestamps: false
            };
          });
          
          console.log("[Generation] Created initial versions:", newVersions);
          if (wrapperJobId) {
            // For concurrent: don't overwrite existing versions
            setVersions(prev => [...newVersions, ...prev]);
          } else {
            setVersions(newVersions);
          }
          toast.success("Audio ready! Fetching karaoke lyrics...");
          
      // Phase B: Fetch timestamped lyrics for each version with retry logic
      console.log("[Generation] Phase B: Fetching timestamped lyrics...");
      console.log("[Generation] Using newVersions for timestamp fetching:", newVersions);
      console.log("[Generation] newVersions.length:", newVersions.length);
          if (wrapperJobId) {
            updateJobProgress(wrapperJobId, 85);
          } else {
            setGenerationProgress(current => {
              setLastProgressUpdate(Date.now());
              return Math.max(current, 85);
            });
          }
          
          if (newVersions.length === 0) {
            console.warn("[Generation] No versions available for timestamp fetching");
            return;
          }

          const updatedVersions = await Promise.all(
            newVersions.map(async (version, index) => {
              let retryAttempts = 0;
              const maxRetryAttempts = 8;
              
              while (retryAttempts++ < maxRetryAttempts) {
                try {
                  const exponentialBackoff = Math.min(1000 * Math.pow(1.5, retryAttempts - 1), 8000);
                  if (retryAttempts > 1) {
                    console.log(`[Timestamps] Version ${index + 1}, attempt ${retryAttempts}, waiting ${exponentialBackoff}ms`);
                    await new Promise(r => setTimeout(r, exponentialBackoff));
                  }

                  console.log(`[Timestamps] Version ${index + 1}, attempt ${retryAttempts}: Using audioId=${version.audioId}, musicIndex=${version.musicIndex}`);
                  
                  const result = await api.getTimestampedLyrics({
                    taskId: sunoJobId,
                    audioId: version.audioId,
                    musicIndex: version.musicIndex
                  });

                  if (result.alignedWords && result.alignedWords.length > 0) {
                    console.log(`[Timestamps] Version ${index + 1}: Success with ${result.alignedWords.length} words`);
                    return {
                      ...version,
                      words: result.alignedWords.map((word: any) => {
                        // Handle different API response formats
                        const start = word.startS || word.start_s || word.start || 0;
                        const end = word.endS || word.end_s || word.end || 0;
                        console.log(`[Word mapping] "${word.word}" -> start: ${start}, end: ${end}`);
                        return {
                          word: word.word,
                          start,
                          end,
                          success: !!word.success,
                          p_align: word.p_align || word.palign || 0
                        };
                      }),
                      hasTimestamps: true
                    };
                  } else {
                    console.log(`[Timestamps] Version ${index + 1}, attempt ${retryAttempts}: No aligned words yet`);
                  }
                } catch (e) {
                  console.warn(`[Timestamps] Version ${index + 1}, attempt ${retryAttempts} failed:`, e);
                }
              }

              // All retries exhausted
              console.warn(`[Timestamps] Version ${index + 1}: Failed after ${maxRetryAttempts} attempts`);
              return {
                ...version,
                hasTimestamps: false,
                timestampError: "Timestamped lyrics not available after retries"
              };
            })
          );

          console.log("[Generation] Final versions with timestamps:", updatedVersions);
          if (wrapperJobId) {
            // For concurrent: update only the new versions, preserve existing ones
            setVersions(prev => {
              const newIds = new Set(newVersions.map(v => v.audioId));
              const preserved = prev.filter(v => !newIds.has(v.audioId));
              return [...updatedVersions, ...preserved];
            });
          } else {
            setVersions(updatedVersions);
          }
          
          // Store currently selected track before adding new ones
          const currentlySelectedTrack = tracks[currentTrackIndex];
          const currentlySelectedTrackId = currentlySelectedTrack?.id;
          
          // Add tracks to the track list (newest first) and generate unique covers
          const batchCreatedAt = Date.now();
          console.log(`[Generation] ===== TRACK CREATION DEBUG =====`);
          console.log(`[Generation] Job ID: ${wrapperJobId || 'direct'}`);
          console.log(`[Generation] Updated versions count: ${updatedVersions.length}`);
          console.log(`[Generation] ActiveGenerations array:`, activeGenerations);
          console.log(`[Generation] ActiveGenerations length:`, activeGenerations.length);
          console.log(`[Index Preservation] Current track before insertion:`, currentlySelectedTrackId);
          
          setTracks(prev => {
            const existing = new Set(prev.map(t => t.id));
            
            // Get pre-generated covers for this job (use locally stored covers to avoid race condition)
            const targetJob = wrapperJobId ? activeGenerations.find(job => job.id === wrapperJobId) : undefined;
            const jobCovers = targetJob?.covers || coverData;
            
            console.log(`[Generation] Target job found:`, targetJob);
            console.log(`[Generation] Job covers extracted:`, jobCovers);
            console.log(`[Generation] Job covers type:`, typeof jobCovers);
            console.log(`[Generation] Cover1:`, jobCovers?.cover1?.substring(0, 100));
            console.log(`[Generation] Cover2:`, jobCovers?.cover2?.substring(0, 100));
            
            const fresh = updatedVersions.map((v, i) => {
              const assignedCover = jobCovers ? (i === 0 ? jobCovers.cover1 : jobCovers.cover2) : undefined;
              const trackId = v.audioId || `${sunoJobId}-${i}`;
              
              console.log(`[Generation] Track ${i}: 
                - ID: ${trackId}
                - URL: ${v.url?.substring(0, 50)}...
                - CoverURL: ${assignedCover ? assignedCover.substring(0, 50) + '...' : 'UNDEFINED'}
                - Title: ${songData.title || "Song Title"}`);
              
              const track = {
                id: trackId,
                url: v.url,
                title: songData.title || "Song Title",
                coverUrl: assignedCover,
                createdAt: batchCreatedAt,
                params: styleTags,
                words: v.words,
                hasTimestamps: v.hasTimestamps,
              };
              
              // Store WAV refs for potential future conversion
              wavRegistry.set(trackId, {
                audioId: v.audioId,
                taskId: sunoJobId,
                musicIndex: i
              });
              
              console.log(`[Generation] Created track object:`, track);
              console.log(`[WAV Registry] Stored refs for track ${trackId}:`, { audioId: v.audioId, taskId: sunoJobId, musicIndex: i });
              return track;
            }).filter(t => !existing.has(t.id));
            
            console.log(`[Generation] ===== FINAL TRACK SUMMARY =====`);
            console.log(`[Generation] Fresh tracks created: ${fresh.length}`);
            console.log(`[Generation] Fresh tracks with covers: ${fresh.filter(t => t.coverUrl).length}`);
            console.log(`[Generation] Fresh tracks coverUrls:`, fresh.map(t => ({ id: t.id, hasCover: !!t.coverUrl, coverPreview: t.coverUrl?.substring(0, 50) })));
            
            if (jobCovers) {
              console.log(`[CoverGen] ✅ Successfully assigned pre-generated covers during track creation`);
            } else {
              console.log(`[CoverGen] ❌ NO COVERS FOUND - tracks will have no covers!`);
            }
            
            const newTracks = [...prev, ...fresh]; // append new tracks, preserve existing indices
            
            // Store current state before making decisions
            const wasPlaying = isPlaying;
            const hadRealTrackSelected = currentlySelectedTrackId && !currentlySelectedTrackId.startsWith('placeholder-');
            const currentSelectedTrack = hadRealTrackSelected ? prev.find(t => t.id === currentlySelectedTrackId) : null;
            
            // With append order, indices stay stable - only need to handle new track selection
            if (!wasPlaying && hadRealTrackSelected) {
              // Current track index should remain the same since we append
              console.log(`[Index Preservation] Indices preserved due to append order, currentTrackIndex: ${currentTrackIndex}`);
            } else if (!wasPlaying && !hadRealTrackSelected) {
              // Only auto-select if no user activity - select first NEW track (at end of array)
              const hasOnlyPlaceholders = prev.every(t => t.id.startsWith('placeholder-'));
              if (hasOnlyPlaceholders || currentTrackIndex < 0) {
                console.log('[Auto-select] Selecting first new track at end of array');
                setCurrentTrackIndex(prev.length); // First new track position
              }
            } else {
              console.log('[Playback Preserved] User is playing - indices preserved due to append order');
              // CRITICAL: Prevent any automatic playback when new tracks are added
              // This ensures that new songs don't auto-play when generation completes
            }
            
            return newTracks;
          });
          
          // Clean up job after successful track creation (delayed to ensure covers are preserved)
          if (wrapperJobId) {
            console.log(`[Generation] Scheduling cleanup for job ${wrapperJobId} in 3 seconds to preserve covers`);
            setTimeout(() => {
              console.log(`[Generation] Cleaning up job ${wrapperJobId} after delay`);
              setActiveGenerations(prev => prev.filter(job => job.id !== wrapperJobId));
            }, 3000); // 3 second delay to ensure covers are properly transferred
          }
          
          // Audio elements reset naturally when src changes - no manual reset needed
          
          const successCount = updatedVersions.filter(v => v.hasTimestamps).length;
          if (wrapperJobId) {
            updateJobProgress(wrapperJobId, 100);
          } else {
            setGenerationProgress(100);
            setLastProgressUpdate(Date.now());
          }
          if (successCount > 0) {
            toast.success(`Song ready with karaoke lyrics! (${successCount}/${updatedVersions.length} versions)`);
          } else {
            toast.success("Song ready! (Karaoke lyrics unavailable)");
          }

          
          break;
        }
        
        if (status.status === "error") {
          throw new Error(status.error || "Audio generation failed");
        }
      }

      if (audioAttempts >= maxAudioAttempts) {
        throw new Error("Timed out waiting for audio URLs");
      }

    } catch (e: any) {
      console.error("[Generation] Error:", e);
      toast.error(e.message || "Generation failed");
    } finally {
      setIsMusicGenerating(false);
    }
  }

  // Update job progress helper
  const updateJobProgress = (jobId: string, newProgress: number) => {
    setActiveGenerations(prev => 
      prev.map(job => 
        job.id === jobId ? { ...job, progress: newProgress } : job
      )
    );
  };

  // Concurrent generation wrapper
  async function startConcurrentGeneration() {
    if (activeGenerations.length >= 10) {
      toast.message("Maximum concurrent generations reached", { description: "Please wait for some to complete." });
      return;
    }
    
    const jobId = Date.now().toString();
    console.log(`[Generation] 🆕 Creating new job ${jobId} and adding to activeGenerations`);
    setActiveGenerations(prev => {
      const updated = [{ 
        id: jobId, 
        startTime: Date.now(),
        progress: 0,
        details: { ...details }
      }, ...prev];
      console.log(`[Generation] 📋 ActiveGenerations after job creation:`, updated);
      return updated;
    });
    
    try {
      await startGenerationWithJobId(jobId, details);
    } catch (error) {
      // Keep failed jobs visible with error state for 5 seconds
      setTimeout(() => {
        setActiveGenerations(prev => prev.filter(job => job.id !== jobId));
      }, 5000);
      throw error;
    }
    // Note: Job cleanup now happens after successful track creation in startGenerationWithJobId
  }

  return (
    <div
      className="h-screen bg-[#0c0c0c] overflow-hidden flex flex-col"
      style={{
        ["--dock-h" as any]: `${DOCK_H}px`,
        // match Tailwind gap-3 (0.75rem) for consistent spacing
        ["--page-gap" as any]: "0.75rem",
      }}
    >
      {/* Three Column Layout - Sessions, Chat + Form, Karaoke + Template */}
      <main className="flex-1 w-full px-3 pt-3 pb-3 min-h-0 overflow-hidden">
        {/* 1 col on mobile, 8 cols on iPad, 12 cols on desktop */}
        <div
          className="
            grid grid-cols-1 md:grid-cols-8
            lg:grid-cols-[minmax(0,1.62fr)_minmax(0,6.93fr)_minmax(0,1.98fr)_minmax(0,2.42fr)]
            xl:grid-cols-[minmax(0,1.62fr)_minmax(0,5.94fr)_minmax(0,1.98fr)_minmax(0,2.42fr)]
            gap-3 lg:items-stretch
            lg:grid-rows-[20px_auto_1fr]
            h-full
            lg:min-h-0
            lg:overflow-hidden
          ">

          {/* Header Bar for Chat */}
          <div className="order-0 lg:col-start-2 lg:col-span-1 h-5 bg-[#1e1e1e] rounded-2xl" />

          {/* Header Bar for Karaoke + TrackList */}
          <div className="order-1 lg:col-start-3 lg:col-span-2 h-5 bg-[#1e1e1e] rounded-2xl" />

          {/* Row 1 - Left: Soundify Sidebar */}
          <div className="order-2 md:col-span-2 lg:col-span-1 lg:row-start-1 lg:row-span-2 xl:col-span-1 bg-[#1e1e1e] rounded-2xl p-4 flex flex-col h-full max-h-full overflow-hidden">
            {/* Soundify Logo - Minimal space */}
            <div className="mb-2 flex-shrink-0 flex justify-center items-center">
              <img 
                src="/lovable-uploads/92dd2dde-eb4e-44a1-a2a3-b24829727f7a.png" 
                alt="Soundify" 
                className="h-6 w-auto object-contain"
              />
            </div>
            
            {/* Navigation Buttons - Responsive and flexible */}
            <div className="flex-1 space-y-1.5 overflow-hidden min-h-0">
              {/* Generators - Active */}
              <button className="w-full flex items-center justify-between px-2.5 py-1.5 bg-[#2a2a2a] rounded-lg text-white hover:text-gray-200 transition-colors relative text-xs lg:text-sm lg:py-2">
                <div className="flex items-center min-w-0">
                  <Music className="w-3.5 h-3.5 lg:w-4 lg:h-4 mr-1.5 lg:mr-2 flex-shrink-0" />
                  <span className="font-medium truncate">Generators</span>
                </div>
                <div className="w-1.5 h-1.5 bg-accent-primary rounded-full shadow-[0_0_6px_hsl(var(--accent-primary))] flex-shrink-0"></div>
              </button>
              
              {/* Other Navigation Items - Compact and responsive */}
              <button className="w-full flex items-center px-2.5 py-1.5 bg-[#262626] rounded-lg text-gray-300 hover:text-white transition-colors text-xs lg:text-sm lg:py-2">
                <Compass className="w-3.5 h-3.5 lg:w-4 lg:h-4 mr-1.5 lg:mr-2 flex-shrink-0" />
                <span className="truncate">Explore</span>
              </button>
              
              <button className="w-full flex items-center px-2.5 py-1.5 bg-[#262626] rounded-lg text-gray-300 hover:text-white transition-colors text-xs lg:text-sm lg:py-2">
                <List className="w-3.5 h-3.5 lg:w-4 lg:h-4 mr-1.5 lg:mr-2 flex-shrink-0" />
                <span className="truncate">Playlists</span>
              </button>
              
              <button className="w-full flex items-center px-2.5 py-1.5 bg-[#262626] rounded-lg text-gray-300 hover:text-white transition-colors text-xs lg:text-sm lg:py-2">
                <Users className="w-3.5 h-3.5 lg:w-4 lg:h-4 mr-1.5 lg:mr-2 flex-shrink-0" />
                <span className="truncate">Artists</span>
              </button>
              
              <button className="w-full flex items-center px-2.5 py-1.5 bg-[#262626] rounded-lg text-gray-300 hover:text-white transition-colors text-xs lg:text-sm lg:py-2">
                <HelpCircle className="w-3.5 h-3.5 lg:w-4 lg:h-4 mr-1.5 lg:mr-2 flex-shrink-0" />
                <span className="truncate">Support</span>
              </button>
              
              <button className="w-full flex items-center px-2.5 py-1.5 bg-[#262626] rounded-lg text-gray-300 hover:text-white transition-colors text-xs lg:text-sm lg:py-2">
                <BookOpen className="w-3.5 h-3.5 lg:w-4 lg:h-4 mr-1.5 lg:mr-2 flex-shrink-0" />
                <span className="truncate">Learn</span>
              </button>
              
              <button className="w-full flex items-center px-2.5 py-1.5 bg-[#262626] rounded-lg text-gray-300 hover:text-white transition-colors text-xs lg:text-sm lg:py-2">
                <MoreHorizontal className="w-3.5 h-3.5 lg:w-4 lg:h-4 mr-1.5 lg:mr-2 flex-shrink-0" />
                <span className="truncate">More</span>
              </button>
            </div>
            
            {/* Profile Section - Anchored to absolute bottom */}
            <div className="flex-shrink-0 mt-2 space-y-2 pb-2">
              <button className="w-full flex items-center p-2 lg:p-2.5 bg-[#262626] rounded-lg hover:bg-[#2a2a2a] transition-colors">
                <Avatar className="w-6 h-6 lg:w-7 lg:h-7 mr-2 flex-shrink-0">
                  <AvatarImage src="/api/placeholder/32/32" alt="Sir Brom" />
                  <AvatarFallback className="bg-accent-primary text-white font-semibold text-xs">SB</AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left min-w-0">
                  <div className="text-white font-medium text-xs lg:text-sm truncate">Sir Brom</div>
                  <div className="text-gray-400 text-xs truncate">Pro Plan</div>
                  <div className="text-gray-400 text-xs truncate">Credits - 232,323</div>
                </div>
              </button>
              
              {/* Upgrade Link */}
              <div className="text-center">
                <button className="text-accent-primary hover:text-accent-primary/80 text-xs font-medium transition-colors">
                  Upgrade / Top Up
                </button>
              </div>
            </div>
          </div>

          {/* Row 1 - Center: Chat */}
          <div className="order-3 md:col-span-6 lg:col-span-1 xl:col-span-1 min-w-0 min-h-0 bg-[#151515] rounded-2xl relative overflow-hidden">
            {/* top fade */}
            {scrollTop > 0 && (
              <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-[#151515] via-[#151515]/95 via-[#151515]/70 to-transparent z-30 pointer-events-none" />
            )}

            {/* chat scroll area: fixed height on desktop, capped height on mobile/tablet */}
            <div
              ref={scrollerRef}
              className={`overflow-y-auto overscroll-y-contain custom-scrollbar pl-6 lg:pl-8 pr-4 lg:pr-6 pt-6 lg:pt-8 ${isDesktop ? '' : 'max-h-[50vh]'}`}
              style={isDesktop ? { height: `${scrollerHeight}px`, maxHeight: `${MAX_SCROLLER}px` } : undefined}
              onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
            >
              <div className="space-y-4 pr-4 pl-4 pt-4" style={{ paddingBottom: chatFeed.length > 80 ? 0 : bottomPad }}>
                {chatFeed.length > 80 ? (
                  <VirtualizedChat 
                    chatFeed={chatFeed}
                    scrollerRef={scrollerRef}
                    bottomPad={bottomPad}
                  />
                ) : (
                  chatFeed.map((m: any, i: number) => {
                    if (m?.type === "status" && m?.id === "__status__") {
                      return (
                        <div
                          key="__status__"
                          className="space-y-3"
                          role="status"
                          aria-live="polite"
                        >
                          {m.isAnalyzingImage && <ImageAnalysisLoader text="Analyzing Image..." />}
                          {m.isReadingText && <ImageAnalysisLoader text="Reading Document..." />}
                          {!m.isAnalyzingImage && !m.isReadingText && <Spinner />}
                        </div>
                      );
                    }
                    return <ChatBubble key={i} role={m.role} content={m.content} />;
                  })
                )}
              </div>
            </div>

            {/* tools footer: absolute on desktop, sticky on smaller screens */}
            <div
              ref={footerRef}
              className={`${isDesktop ? 'absolute bottom-0 pt-8 pb-8 px-8' : 'sticky bottom-0 pt-4 pb-4 px-4'} left-0 right-0 bg-gradient-to-t from-[#151515] via-[#151515]/98 via-[#151515]/90 to-transparent`}
            >
              <div className="space-y-4">
                {attachedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {attachedFiles.map((file, index) => (
                      <div key={index} className="bg-[#040404] rounded-lg p-2 flex items-center gap-2 text-sm text-white/80">
                        <div className="flex items-center gap-2">
                          {file.type.startsWith('image/') ? (
                            <div className="w-6 h-6 bg-accent-primary/20 rounded flex items-center justify-center">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
                            </div>
                          ) : (
                            <div className="w-6 h-6 bg-accent-primary/20 rounded flex items-center justify-center">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/></svg>
                            </div>
                          )}
                          <span className="truncate max-w-[100px]">{file.name}</span>
                        </div>
                        <button onClick={() => removeFile(index)} className="p-1 hover:bg-white/10 rounded text-white/60 hover:text-white">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

<div className="flex items-end gap-2">
  {/* Chat input — LEFT (taller + wider) */}
  <div className="relative bg-[#040404] rounded-xl p-4 min-h-[84px] flex-1 flex items-center hover:shadow-[0_0_5px_rgba(255,255,255,0.25)] focus-within:shadow-[0_0_5px_rgba(255,255,255,0.5)] transition-shadow">
    <textarea
      ref={chatInputRef}
      value={input}
      onChange={(e) => {
        setInput(e.target.value);
        e.target.style.height = "auto";
        e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
      }}
      placeholder="Type out your question here..."
      className="w-full bg-transparent border-0 pr-10 text-white placeholder-gray-500 focus:outline-none resize-none min-h-[48px] max-h-[200px] overflow-y-auto chat-input-scrollbar text-[15px] leading-6"
      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
      disabled={isChatBusy}
      rows={1}
    />
    <button
      onClick={onSend}
      disabled={isChatBusy || !input.trim()}
      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-white hover:text-accent-primary transition-colors disabled:opacity-50"
      aria-label="Send message"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#ffffff">
        <path d="M12 19V5M5 12l7-7 7 7" stroke="#ffffff" strokeWidth="2" fill="none"/>
      </svg>
    </button>
  </div>

  {/* Right column — Generate on top, Icon tray below */}
  <div className="shrink-0 w-[180px] flex flex-col gap-2">
    {/* Generate — same height as tray */}
    <button
      onClick={startConcurrentGeneration}
      disabled={activeGenerations.length >= 10 || !canGenerate}
      className="h-9 w-full rounded-lg text-[13px] font-medium text-white bg-accent-primary hover:bg-accent-primary/90 disabled:bg-accent-primary/60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
      aria-disabled={activeGenerations.length >= 10 || !canGenerate}
    >
      <span className="text-sm leading-none">✦</span>
      <span>Generate{activeGenerations.length > 0 ? ` (${activeGenerations.length}/10)` : ''}</span>
    </button>

    {/* Icon tray — perfectly centered icons */}
    <div className="bg-[#040404] rounded-lg h-9 w-full grid grid-cols-4 place-items-center px-2 hover:shadow-[0_0_5px_rgba(255,255,255,0.25)] transition-shadow">
      <button onClick={handleFileUpload} className="w-8 h-8 grid place-items-center text-white hover:text-accent-primary disabled:opacity-50" disabled={isChatBusy} aria-label="Upload"><Upload size={18} /></button>
      <button onClick={() => setShowMelodySpeech(true)} className="w-8 h-8 grid place-items-center text-white hover:text-accent-primary disabled:opacity-50" disabled={isChatBusy} aria-label="Microphone"><Mic size={18} /></button>
      <button onClick={randomizeAll} className="w-8 h-8 grid place-items-center text-white hover:text-accent-primary disabled:opacity-50" disabled={isChatBusy} aria-label="Randomize"><Dice5 size={18} /></button>
      <button className="w-8 h-8 grid place-items-center text-white hover:text-accent-primary disabled:opacity-50" disabled={isChatBusy} aria-label="List"><List size={18} /></button>
    </div>
  </div>
</div>
              </div>
            </div>

            {/* desktop-only resize handle */}
            <div
              className={`hidden lg:block absolute bottom-0 right-0 w-4 h-4 cursor-nw-resize group ${isResizing ? 'bg-accent-primary/50' : 'bg-white/20 hover:bg-white/40'} transition-colors`}
              onMouseDown={handleMouseDown}
              style={{ clipPath: 'polygon(100% 0%, 0% 100%, 100% 100%)', borderBottomRightRadius: '16px' }}
            >
              <div className="absolute bottom-1 right-1 w-1 h-1 bg-white/60 rounded-full"></div>
              <div className="absolute bottom-1 right-2.5 w-1 h-1 bg-white/40 rounded-full"></div>
              <div className="absolute bottom-2.5 right-1 w-1 h-1 bg-white/40 rounded-full"></div>
            </div>
          </div>

          {/* Row 1 - Right: Karaoke panel (wraps under chat on iPad) */}
          <div className="order-4 md:col-span-8 lg:col-span-1 xl:col-span-1 min-w-0 min-h-0">
            <KaraokeRightPanel
              versions={versions}
              currentAudioIndex={karaokeAudioIndex}
              currentTrackIndex={currentTrackIndex}
              currentTime={currentTime}
              isPlaying={isPlaying && karaokeTrackId === playingTrackId}
              albumCovers={albumCovers}
              currentTrackCoverUrl={(() => {
                const karaokeTrack = tracks.find(t => t.id === karaokeTrackId);
                return karaokeTrack?.coverUrl;
              })()}
              isGeneratingCovers={isGeneratingCovers}
              audioRefs={audioRefs}
              onPlayPause={handleAudioPlay}
              onAudioPause={handleAudioPause}
              onFullscreenKaraoke={() => setShowFullscreenKaraoke(true)}
              onSeek={handleSeek}
              onRetryTimestamps={handleRetryTimestamps}
            />
          </div>

          {/* Far-right Track List: spans both rows, bleeds to the right, sticky inner */}
          <div className="order-5 lg:order-4 md:col-span-8 lg:col-span-1 xl:col-span-1 lg:row-span-2 lg:self-stretch min-h-0 overflow-hidden">
            <TrackListPanel
              tracks={tracks}
              currentIndex={currentTrackIndex}
              playingTrackIndex={playingTrackIndex}
              isPlaying={isPlaying}
              audioRefs={audioRefs}
              onPlayPause={(idx) => {
                if (currentTrackIndex === idx && isPlaying) {
                  handleAudioPause();
                } else {
                  handleAudioPlay(idx);
                }
              }}
              onSeek={handleSeek}
              setCurrentIndex={(idx) => {
                if (idx !== currentTrackIndex) {
                  console.log('[Manual selection] User selected track:', idx, tracks[idx]);
                  setCurrentTrackIndex(idx);
                  setCurrentTime(0);
                }
              }}
              onTimeUpdate={handleTimeUpdate}
              onTrackTitleUpdate={(trackIndex, newTitle) => {
                setTracks(prevTracks => 
                  prevTracks.map((track, index) => 
                    index === trackIndex 
                      ? { ...track, title: newTitle }
                      : track
                  )
                );
              }}
              isGenerating={isMusicGenerating}
              generationProgress={generationProgress}
              activeJobCount={activeGenerations.length}
              activeGenerations={activeGenerations}
            />
          </div>

          {/* Row 2 - Left: Sessions */}
          <div 
            className="order-6 md:col-span-2 lg:col-span-1 xl:col-span-1"
            style={isDesktop ? { height: `${formHeightPx}px` } : { height: 'auto' }}
          >
            <SessionsPanel className="h-full" />
          </div>

          {/* Row 2 - Center: Form */}
          <div 
            className="order-7 md:col-span-6 lg:col-span-1 xl:col-span-1 min-w-0 bg-[#151515] rounded-xl p-4 space-y-4 min-h-[280px]"
            style={isDesktop ? { height: `${formHeightPx}px` } : { height: 'auto' }}
          >
            {/* Two-column layout: Left (Title + Song Parameters), Right (Lyrics) */}
            <div className="grid grid-cols-12 gap-4 h-full min-h-0">
              {/* Left column */}
              <div className="col-span-5 space-y-3 flex flex-col min-h-0 min-w-0">
                {/* Title */}
                <div className="space-y-2 flex-shrink-0">
                  <label className="text-sm font-medium text-white/80">Title</label>
                  <div className="bg-[#2d2d2d] rounded-lg p-4 border border-transparent hover:border-white/50 focus-within:border-white focus-within:hover:border-white transition-colors duration-200">
                    <Input
                      value={details.title || ""}
                      onChange={(e) => setDetails({ ...details, title: e.target.value })}
                      placeholder="Enter song title..."
                      className="bg-transparent border-0 text-white placeholder:text-white/40 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto"
                    />
                  </div>
                </div>
                {/* Song Parameters */}
                <div className="space-y-2 flex-1 flex flex-col min-h-[80px] min-h-0">
                  <label className="text-sm font-medium text-white/80 flex-shrink-0">Song Parameters</label>
                  {/* Outer box fills remaining height */}
                  <div className="bg-[#2d2d2d] rounded-lg border border-transparent hover:border-white/50 focus-within:border-white focus-within:hover:border-white transition-colors duration-200 flex-1 min-h-[100px] min-h-0">
                    {/* Inner scroll area mirrors Lyrics behavior */}
                    <div className="h-full overflow-y-auto song-params-scrollbar px-4 py-3">
                      <TagInput
                        tags={styleTags}
                        onChange={handleStyleTagsChange}
                        placeholder='Add song parameters such as "Pop", "128bpm", "female vocals" and separate them by comma'
                        className="max-h-full"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right column: Lyrics */}
              <div className="col-span-7 space-y-2 flex flex-col min-h-[140px]">
                <label className="text-sm font-medium text-white/80 flex-shrink-0">Lyrics</label>
                <div className="bg-[#2d2d2d] rounded-lg flex-1 border border-transparent hover:border-white/50 focus-within:border-white focus-within:hover:border-white transition-colors duration-200 min-h-[100px]">
                  <div className="h-full">
                    <Textarea
                      value={details.lyrics || ""}
                      onChange={(e) => setDetails({ ...details, lyrics: e.target.value })}
                      placeholder="Enter your lyrics here..."
                      className="bg-transparent border-0 text-white placeholder:text-white/40 focus-visible:ring-0 focus-visible:ring-offset-0 p-4 resize-none w-full h-full song-params-scrollbar"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            {isMusicGenerating && generationProgress > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Generating...</span>
                  <span className="font-medium text-pink-400">{Math.round(generationProgress)}%</span>
                </div>
                <Progress value={generationProgress} className="h-2" />
              </div>
            )}

          </div>

          {/* Row 2 - Right: Template */}
          <div 
            className="order-8 md:col-span-8 lg:col-span-1 xl:col-span-1"
            style={isDesktop ? { height: `${formHeightPx}px` } : { height: 'auto' }}
          >
            <TemplatePanel />
          </div>
        </div>

      </main>

      {/* Spacer so the fixed PlayerDock never covers content */}
      <div
        aria-hidden
        className="w-full"
        style={{
          // add one page gap on top of the dock height for perfect vertical rhythm
          height: `calc(var(--dock-h) + var(--page-gap) + env(safe-area-inset-bottom, 0px))`,
        }}
      />

      {/* Full-screen Karaoke Overlay */}
      {showFullscreenKaraoke && tracks[currentTrackIndex]?.words?.length > 0 && (
        <FullscreenKaraoke
          words={tracks[currentTrackIndex].words}
          currentTime={currentTime}
          isPlaying={isPlaying}
          albumCoverUrl={tracks[currentTrackIndex]?.coverUrl}
          onClose={() => setShowFullscreenKaraoke(false)}
        />
      )}

      {/* Melody Speech Overlay */}
      <Dialog open={showMelodySpeech} onOpenChange={setShowMelodySpeech}>
        <DialogContent 
          className="max-w-full max-h-full w-screen h-screen bg-black/20 backdrop-blur-md border-0 p-0 m-0 rounded-none"
          aria-describedby="melody-speech-description"
        >
          <div className="sr-only" id="melody-speech-description">
            Voice-powered AI chat interface with real-time speech recognition and text-to-speech
          </div>
        <VoiceInterface 
          onClose={() => setShowMelodySpeech(false)} 
          messages={messages}
          sendMessage={sendMessage}
        />
        </DialogContent>
      </Dialog>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "AI Song Studio",
            applicationCategory: "MultimediaApplication",
            description:
              "Chat with AI to craft lyrics and generate custom songs via Suno.",
            operatingSystem: "Web",
          }),
        }}
      />

      {/* Full-width fixed footer wrapper for PlayerDock */}
      <footer
        className="fixed inset-x-0 bottom-0 z-50"
        style={{ height: `calc(var(--dock-h) + env(safe-area-inset-bottom, 0px))` }}
      >
        <div
          className="
            w-full h-full relative
            bg-black/50 backdrop-blur-md
          "
          style={{ paddingBottom: `env(safe-area-inset-bottom, 0px)` }}
        >
        {tracks.length > 0 && currentTrackIndex >= 0 && (
          <PlayerDock
            title={tracks[playingTrackIndex >= 0 ? playingTrackIndex : currentTrackIndex]?.title || "No track yet"}
            audioRefs={audioRefs}
            currentAudioIndex={playingTrackIndex >= 0 ? playingTrackIndex : currentTrackIndex}
            isPlaying={isPlaying}
            currentTime={currentTime}
            onPrev={playPrev}
            onNext={playNext}
            onPlay={() => handleAudioPlay(playingTrackIndex >= 0 ? playingTrackIndex : currentTrackIndex)}
            onPause={handleAudioPause}
            onSeek={(t) => handleSeek(t)}
            accent="#f92c8f"
            disabled={!tracks[playingTrackIndex >= 0 ? playingTrackIndex : currentTrackIndex]}
            albumCoverUrl={tracks[playingTrackIndex >= 0 ? playingTrackIndex : currentTrackIndex]?.coverUrl}
            onFullscreenKaraoke={() => setShowFullscreenKaraoke(true)}
            onTitleUpdate={(newTitle) => {
              const targetIndex = playingTrackIndex >= 0 ? playingTrackIndex : currentTrackIndex;
              setTracks(prevTracks => 
                prevTracks.map((track, index) => 
                  index === targetIndex 
                    ? { ...track, title: newTitle }
                    : track
                )
              );
            }}
          />
        )}
        </div>
      </footer>
    </div>
  );
};

export default Index;