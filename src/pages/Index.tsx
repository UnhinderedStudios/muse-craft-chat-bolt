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
import { Dice5, Mic, Upload, Grid3X3, Plus, List, Play, Pause, X, SkipBack, SkipForward, Shuffle, Repeat, Volume2, VolumeX } from "lucide-react";

// Components
import { CyberHeader } from "@/components/cyber/CyberHeader";
import { CyberCard } from "@/components/cyber/CyberCard";
import { CyberButton } from "@/components/cyber/CyberButton";
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

// Hooks
import { useChat } from "@/hooks/use-chat";
import { useResize } from "@/hooks/use-resize";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useSongGeneration } from "@/hooks/use-song-generation";

// Types
import { type TimestampedWord, type ChatMessage, type TrackItem } from "@/types";

import { parseSongRequest, convertToSongDetails } from "@/lib/parseSongRequest";

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



const Index = () => {
  const DOCK_H = 80; // px — reduced height to make container more compact
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hey! I can help write and generate a song. What vibe are you going for?" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [isReadingText, setIsReadingText] = useState(false);
  const [details, setDetails] = useState<SongDetails>({});
  const [styleTags, setStyleTags] = useState<string[]>([]);
  const [chatHeight, setChatHeight] = useState(500);
  const [isResizing, setIsResizing] = useState(false);
  
  // Ref for chat input to maintain focus
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

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

  // Handle chat resize functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startY = e.clientY;
    const startHeight = chatHeight;
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - startY;
      const newHeight = Math.max(300, Math.min(800, startHeight + deltaY)); // Min 300px, Max 800px
      setChatHeight(newHeight);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);


  useEffect(() => {
    // reset audio refs when result list changes
    audioRefs.current = [];
  }, [audioUrls, audioUrl]);

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
    
    // Prevent multiple rapid calls
    if (busy) {
      console.log(`[AudioPlay] Blocked - generation is busy`);
      return;
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
    // Actually pause the current audio
    const audioElement = audioRefs.current[currentTrackIndex];
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
    // Only update time for the currently active track
    const activeIndex = audioRefs.current.findIndex(ref => ref === audio);
    if (activeIndex === currentTrackIndex) {
      const newTime = audio.currentTime;
      setCurrentTime(newTime);
      console.log('[Audio Debug] Time update:', newTime.toFixed(2), 'for track', activeIndex);
    }
  };

  const handleSeek = (time: number) => {
    const audioElement = audioRefs.current[currentTrackIndex];
    if (audioElement) {
      try {
        audioElement.currentTime = time;
        setCurrentTime(time);
      } catch (error) {
        console.error('Error seeking audio:', error);
      }
    }
  };

  const playPrev = () => tracks.length && handleAudioPlay(Math.max(0, currentTrackIndex - 1));
  const playNext = () => tracks.length && handleAudioPlay(Math.min(tracks.length - 1, currentTrackIndex + 1));

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
    
    // Display original user content in chat (without extracted text)
    const displayMessage = { role: "user", content, attachments: fileAttachments } as ChatMessage;
    const next = [...messages, displayMessage];
    setMessages(next);
    
    // But send combined content to API (user content + extracted text)
    const apiContent = appendedText ? `${content}\n\n${appendedText}` : content;
    const apiMessages = [...messages, { role: "user", content: apiContent, attachments: fileAttachments } as ChatMessage];
    setInput("");
    setAttachedFiles([]); // Clear attachments after sending

    setBusy(true);
    
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
      console.debug("[Chat] Using systemPrompt (first 160 chars):", systemPrompt.slice(0, 160));
      const res = await api.chat(apiMessages, systemPrompt);
      const assistantMsg = res.content;
      setMessages((m) => [...m, { role: "assistant", content: assistantMsg }]);
      
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

    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
    } finally {
      setBusy(false);
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
    if (busy) return;
    const content = "Please generate a completely randomized song_request and output ONLY the JSON in a JSON fenced code block (```json ... ```). The lyrics must be a complete song containing Intro, Verse 1, Pre-Chorus, Chorus, Verse 2, Chorus, Bridge, and Outro. No extra text.";
    setBusy(true);
    try {
      // Use a minimal, stateless prompt so we don't get follow-ups that could override fields
      const minimal: ChatMessage[] = [{ role: "user", content }];
      console.debug("[Dice] Sending randomize prompt. systemPrompt snippet:", systemPrompt.slice(0,120));
      const [r1, r2] = await Promise.allSettled([
        api.chat(minimal, systemPrompt),
        api.chat(minimal, systemPrompt),
      ]);
      const msgs: string[] = [];
      if (r1.status === "fulfilled") msgs.push(r1.value.content);
      if (r2.status === "fulfilled") msgs.push(r2.value.content);
      console.debug("[Dice] Received responses:", msgs.map(m => m.slice(0, 160)));
      const extractions = msgs.map((m) => {
        const parsed = parseSongRequest(m);
        if (parsed) return convertToSongDetails(parsed);
        return extractDetails(m);
      }).filter(Boolean) as SongDetails[];
      if (extractions.length === 0) {
        console.debug("[Dice] Failed to parse any random song. First response preview:", msgs[0]?.slice(0, 300));
        toast.message("Couldn't parse random song", { description: "Try again in a moment." });
      } else {
        const cleanedList = extractions.map((ex) => {
          const finalStyle = sanitizeStyleSafe(ex.style);
          return { ...ex, ...(finalStyle ? { style: finalStyle } : {}) } as SongDetails;
        });
        const merged = mergeNonEmpty(...cleanedList);
        lastDiceAt.current = Date.now();
        setDetails((d) => mergeNonEmpty(d, merged));
        toast.success("Randomized song details ready");
      }
      // Do not alter chat history for the dice action
    } catch (e: any) {
      toast.error(e.message || "Randomize failed");
    } finally {
      setBusy(false);
    }
  }

  async function testAlbumCoverWithLyrics() {
    if (busy) return;
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
    if (!canGenerate) {
      toast.message("Add a few details first", { description: "Chat a bit more until I extract a song request." });
      return;
    }
    setAudioUrl(null);
    setAudioUrls(null);
    setJobId(null);
    setVersions([]);
    setGenerationProgress(0);
    setLastProgressUpdate(Date.now());
    setAlbumCovers(null);
    setIsGeneratingCovers(false);
    setBusy(true);
    
    // Start album cover generation immediately in parallel
    if (details.title || details.lyrics || details.style) {
      setIsGeneratingCovers(true);
      api.generateAlbumCovers(details)
        .then(covers => {
          console.log("Album covers generated:", covers);
          setAlbumCovers(covers);
        })
        .catch(error => {
          console.error("Album cover generation failed:", error);
          toast.error("Failed to generate album covers");
        })
        .finally(() => {
          setIsGeneratingCovers(false);
        });
    }
    
    try {
      const payload = { ...details, style: sanitizeStyle(details.style || "") };
      const { jobId } = await api.startSong(payload);
      setJobId(jobId);
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
        setGenerationProgress(current => {
          if (newProgress > current) {
            setLastProgressUpdate(Date.now());
            return newProgress;
          }
          return current;
        });
        
        const backoffDelay = Math.min(1500 + completionAttempts * 300, 4000);
        await new Promise((r) => setTimeout(r, backoffDelay));
        
        try {
          const details = await api.getMusicGenerationDetails(jobId);
          statusRaw = details.statusRaw;
          sunoData = details.response?.sunoData || [];
          
          console.log(`[Generation] Attempt ${completionAttempts}: Status=${statusRaw}, Tracks=${sunoData.length}`);
          
          // Check for completion - accept SUCCESS but not intermediate states
          if (statusRaw === "SUCCESS" || statusRaw === "COMPLETE" || statusRaw === "ALL_SUCCESS") {
            console.log("[Generation] Phase A: Generation completed!");
            setGenerationProgress(current => {
              setLastProgressUpdate(Date.now());
              return Math.max(current, 75);
            });
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
        const status = await api.pollSong(jobId);
        
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
          setVersions(newVersions);
          toast.success("Audio ready! Fetching karaoke lyrics...");
          
      // Phase B: Fetch timestamped lyrics for each version with retry logic
      console.log("[Generation] Phase B: Fetching timestamped lyrics...");
      console.log("[Generation] Using newVersions for timestamp fetching:", newVersions);
      console.log("[Generation] newVersions.length:", newVersions.length);
          setGenerationProgress(current => {
            setLastProgressUpdate(Date.now());
            return Math.max(current, 85);
          });
          
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
                    taskId: jobId,
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
          setVersions(updatedVersions);
          
          // Add tracks to the track list (newest first)
          const batchCreatedAt = Date.now();
          setTracks(prev => {
            const existing = new Set(prev.map(t => t.id));
            const fresh = updatedVersions.map((v, i) => ({
              id: v.audioId || `${jobId}-${i}`,
              url: v.url,
              title: details.title || "Song Title",
              coverUrl: albumCovers ? (i === 1 ? albumCovers.cover2 : albumCovers.cover1) : undefined,
              createdAt: batchCreatedAt,
              params: styleTags,
              words: v.words,
              hasTimestamps: v.hasTimestamps,
            })).filter(t => !existing.has(t.id));
            
            return [...fresh, ...prev]; // newest first
          });
          
          // Set active track to first of new batch
          setCurrentTrackIndex(0);
          setCurrentTime(0);
          setIsPlaying(false);
          
          // Reset all audio elements to start position
          setTimeout(() => {
            audioRefs.current.forEach((audio) => {
              if (audio) {
                audio.currentTime = 0;
              }
            });
          }, 100);
          
          const successCount = updatedVersions.filter(v => v.hasTimestamps).length;
          setGenerationProgress(100);
          setLastProgressUpdate(Date.now());
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
      setBusy(false);
    }
  }

  return (
    <div
      className="h-screen bg-[#0c0c0c] overflow-hidden"
      style={{
        ["--dock-h" as any]: `${DOCK_H}px`,
        // match Tailwind gap-5 (1.25rem) so spacing is seamless when docked
        ["--page-gap" as any]: "1.25rem",
      }}
    >
      {/* Cyber Header */}
      <CyberHeader />

      {/* Three Column Layout - Sessions, Chat + Form, Karaoke + Template */}
      <main className="w-full px-5 pt-6 pb-0 min-h-0 h-[calc(100vh-80px)]">
        {/* 1 col on mobile, 8 cols on iPad, 12 cols on desktop */}
        <div
          className="
            grid grid-cols-1 md:grid-cols-8
            lg:grid-cols-[minmax(0,1.62fr)_minmax(0,6.93fr)_minmax(0,1.98fr)_minmax(0,2.42fr)]
            xl:grid-cols-[minmax(0,1.62fr)_minmax(0,5.94fr)_minmax(0,1.98fr)_minmax(0,2.42fr)]
            gap-5 lg:items-stretch
            lg:grid-rows-[1fr_320px]
            lg:h-[calc(100%-var(--dock-h)-var(--page-gap))]
            lg:min-h-0
            lg:overflow-hidden
          ">

          {/* Row 1 - Left: Sessions */}
          <div className="order-1 md:col-span-2 lg:col-span-1 xl:col-span-1 bg-[#151515] rounded-2xl p-6">
            <h3 className="text-white font-semibold mb-4">Sessions</h3>
            <p className="text-gray-400 text-sm">Session management coming soon...</p>
          </div>

          {/* Row 1 - Center: Chat */}
          <div className="order-2 md:col-span-6 lg:col-span-1 xl:col-span-1 min-w-0 min-h-0 bg-[#151515] rounded-2xl relative overflow-hidden">
            {/* top fade */}
            {scrollTop > 0 && (
              <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-[#151515] via-[#151515]/95 via-[#151515]/70 to-transparent z-30 pointer-events-none" />
            )}

            {/* chat scroll area: fixed height on desktop, capped height on mobile/tablet */}
            <div
              ref={scrollerRef}
              className={`overflow-y-auto custom-scrollbar pl-6 lg:pl-8 pr-4 lg:pr-6 pt-6 lg:pt-8 ${isDesktop ? '' : 'max-h-[56vh]'}`}
              style={isDesktop ? { height: `${chatHeight}px` } : undefined}
              onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
            >
              <div className="space-y-4 pr-4 pl-4 pt-4 pb-4 lg:pb-32">
                {messages.map((m, i) => (
                  <ChatBubble key={i} role={m.role} content={m.content} />
                ))}
                {busy && (
                  <div className="space-y-3">
                    {isAnalyzingImage && <ImageAnalysisLoader text="Analyzing Image..." />}
                    {isReadingText && <ImageAnalysisLoader text="Reading Document..." />}
                    {!isAnalyzingImage && !isReadingText && <Spinner />}
                  </div>
                )}
              </div>
            </div>

            {/* tools footer: absolute on desktop, sticky on smaller screens */}
            <div
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
      disabled={busy}
      rows={1}
    />
    <button
      onClick={onSend}
      disabled={busy || !input.trim()}
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
      onClick={startGeneration}
      disabled={busy || !canGenerate}
      className="h-9 w-full rounded-lg text-[13px] font-medium text-white bg-[#f92c8f] hover:bg-[#e02681] disabled:opacity-50 disabled:saturate-75 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
      aria-disabled={busy || !canGenerate}
    >
      <span className="text-sm leading-none">✦</span>
      <span>Generate</span>
    </button>

    {/* Icon tray — perfectly centered icons */}
    <div className="bg-[#040404] rounded-lg h-9 w-full grid grid-cols-4 place-items-center px-2 hover:shadow-[0_0_5px_rgba(255,255,255,0.25)] transition-shadow">
      <button onClick={handleFileUpload} className="w-8 h-8 grid place-items-center text-white hover:text-accent-primary disabled:opacity-50" disabled={busy} aria-label="Upload"><Upload size={18} /></button>
      <button className="w-8 h-8 grid place-items-center text-white hover:text-accent-primary disabled:opacity-50" disabled={busy} aria-label="Grid"><Grid3X3 size={18} /></button>
      <button onClick={randomizeAll} className="w-8 h-8 grid place-items-center text-white hover:text-accent-primary disabled:opacity-50" disabled={busy} aria-label="Randomize"><Dice5 size={18} /></button>
      <button className="w-8 h-8 grid place-items-center text-white hover:text-accent-primary disabled:opacity-50" disabled={busy} aria-label="List"><List size={18} /></button>
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
          <div className="order-3 md:col-span-8 lg:col-span-1 xl:col-span-1 min-w-0 min-h-0">
            <KaraokeRightPanel
              versions={versions}
              currentAudioIndex={currentAudioIndex}
              currentTime={currentTime}
              isPlaying={isPlaying}
              albumCovers={albumCovers}
              isGeneratingCovers={isGeneratingCovers}
              audioRefs={audioRefs}
              onPlayPause={handleAudioPlay}
              onAudioPause={handleAudioPause}
              onFullscreenKaraoke={() => setShowFullscreenKaraoke(true)}
              onSeek={handleSeek}
            />
          </div>

          {/* Far-right Track List: spans both rows, bleeds to the right, sticky inner */}
          <div className="order-4 lg:order-3 md:col-span-8 lg:col-span-1 xl:col-span-1 lg:row-span-2 lg:self-stretch min-h-0 overflow-hidden">
            <TrackListPanel
              tracks={tracks}
              currentIndex={currentTrackIndex}
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
                  setCurrentTrackIndex(idx);
                  setCurrentTime(0);
                }
              }}
              onTimeUpdate={handleTimeUpdate}
            />
          </div>

          {/* Row 2 - Left: Sessions 2 */}
          <div className="order-5 md:col-span-2 lg:col-span-1 xl:col-span-1 bg-[#151515] rounded-2xl p-6 h-full">
            <h3 className="text-white font-semibold mb-4">Session 2</h3>
            <p className="text-gray-400 text-sm">Additional session functionality...</p>
          </div>

          {/* Row 2 - Center: Form */}
          <div className="order-6 md:col-span-6 lg:col-span-1 xl:col-span-1 min-w-0 bg-[#151515] rounded-xl p-4 space-y-4 h-full">
            {/* Two-column layout: Left (Title + Song Parameters), Right (Lyrics) */}
            <div className="grid grid-cols-12 gap-4 h-full max-h-[280px]">
              {/* Left column */}
              <div className="col-span-5 space-y-3">
                {/* Title */}
                <div className="space-y-2">
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
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/80">Song Parameters</label>
                  <div className="bg-[#2d2d2d] rounded-lg p-4 border border-transparent hover:border-white/50 focus-within:border-white focus-within:hover:border-white transition-colors duration-200">
                    <div className="max-h-[260px] overflow-y-auto lyrics-scrollbar">
                      <TagInput
                        tags={styleTags}
                        onChange={handleStyleTagsChange}
                        placeholder='Add song parameters such as "Pop", "128bpm", "female vocals" and separate them by comma'
                        className="bg-transparent border-0 text-white placeholder:text-white/40 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 min-h-[120px] resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right column: Lyrics */}
              <div className="col-span-7 space-y-2 flex flex-col h-full">
                <label className="text-sm font-medium text-white/80">Lyrics</label>
                <div className="bg-[#2d2d2d] rounded-lg p-4 flex-1 border border-transparent hover:border-white/50 focus-within:border-white focus-within:hover:border-white transition-colors duration-200 overflow-hidden">
                  <Textarea
                    value={details.lyrics || ""}
                    onChange={(e) => setDetails({ ...details, lyrics: e.target.value })}
                    placeholder="Enter your lyrics here..."
                    className="bg-transparent border-0 text-white placeholder:text-white/40 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 pr-3 resize-none w-full h-full lyrics-scrollbar"
                  />
                </div>
              </div>
            </div>

            {/* Progress bar */}
            {busy && generationProgress > 0 && (
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
          <div className="order-7 md:col-span-8 lg:col-span-1 xl:col-span-1 bg-[#151515] rounded-2xl flex items-center justify-center h-full">
            <span className="text-text-secondary">TEMPLATE</span>
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
          <PlayerDock
            title={tracks[currentTrackIndex]?.title || "No track yet"}
            audioRefs={audioRefs}
            currentAudioIndex={currentTrackIndex}
            isPlaying={isPlaying}
            currentTime={currentTime}
            onPrev={playPrev}
            onNext={playNext}
            onPlay={() => handleAudioPlay(currentTrackIndex)}
            onPause={handleAudioPause}
            onSeek={(t) => handleSeek(t)}
            accent="#f92c8f"
            disabled={!tracks[currentTrackIndex]}
            albumCoverUrl={tracks[currentTrackIndex]?.coverUrl}
            onFullscreenKaraoke={() => setShowFullscreenKaraoke(true)}
          />
        </div>
      </footer>
    </div>
  );
};

export default Index;