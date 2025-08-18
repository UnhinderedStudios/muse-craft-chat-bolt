import { useEffect, useMemo, useRef, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, type SongDetails } from "@/lib/api";
import { sanitizeStyle } from "@/lib/styleSanitizer";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Dice5, Mic, Upload, Grid3X3, Plus, List } from "lucide-react";

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
import { KaraokeRightPanel } from "@/components/karaoke/KaraokeRightPanel";
import { ResizableContainer } from "@/components/layout/ResizableContainer";
import { TagInput } from "@/components/song/TagInput";

// Hooks
import { useChat } from "@/hooks/use-chat";
import { useResize } from "@/hooks/use-resize";
import { useSongGeneration } from "@/hooks/use-song-generation";

// Types
import { type TimestampedWord, type ChatMessage } from "@/types";
import { SYSTEM_PROMPT } from "@/utils/constants";

const systemPrompt = `You are Melody Muse, a friendly creative assistant for songwriting.
Your goal is to chat naturally and quickly gather two things only: (1) a unified Style description and (2) Lyrics.
IMPORTANT: Never include artist names in Style. If the user mentions an artist (e.g., "like Ed Sheeran"), translate that into neutral descriptors (timbre, instrumentation, tempo/BPM, mood, era) and DO NOT name the artist. Style must combine: genre/subgenre, mood/energy, tempo or BPM, language, vocal type (male/female/duet/none), and production notes.
Ask concise questions one at a time. When you have enough info, output a compact JSON between triple backticks with the key song_request containing fields: title, style, lyrics. The style must not contain artist names. Example:

\`\`\`
{"song_request": {"title": "Neon Skies", "style": "synthpop, uplifting, 120 BPM, English, female vocals, bright analog synths, sidechain bass, shimmering pads", "lyrics": "short verse/chorus here"}}
\`\`\`

Continue the conversation after the JSON if needed.`;

function extractDetails(text: string): SongDetails | null {
  // Look for a JSON fenced block and parse it
  const fenceMatch = text.match(/```[\s\S]*?```/);
  const candidate = fenceMatch ? fenceMatch[0].replace(/```/g, "").trim() : text.trim();
  try {
    const obj = JSON.parse(candidate);
    if (obj.song_request && typeof obj.song_request === "object") {
      return obj.song_request as SongDetails;
    }
  } catch {}
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
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hey! I can help write and generate a song. What vibe are you going for?" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState<SongDetails>({});
  const [styleTags, setStyleTags] = useState<string[]>([]);
  const [chatHeight, setChatHeight] = useState(500);
  const [isResizing, setIsResizing] = useState(false);

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
    audioRefs.current.forEach((a, i) => {
      if (i !== index && a && !a.paused) {
        try { a.pause(); a.currentTime = 0; } catch {}
      }
    });
    setIsPlaying(true);
    setCurrentAudioIndex(index);
  }

  const handleAudioPause = () => {
    setIsPlaying(false);
  };

  const handleTimeUpdate = (audio: HTMLAudioElement) => {
    // Only update time for the currently active audio
    const activeIndex = audioRefs.current.findIndex(ref => ref === audio);
    if (activeIndex === currentAudioIndex) {
      setCurrentTime(audio.currentTime);
    }
  };

  async function onSend() {
    const content = input.trim();
    if (!content) return;
    const next = [...messages, { role: "user", content } as ChatMessage];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await api.chat(next, systemPrompt);
      const assistantMsg = res.content;
setMessages((m) => [...m, { role: "assistant", content: assistantMsg }]);
const extracted = extractDetails(assistantMsg);
if (extracted) {
  const now = Date.now();
  if (now - lastDiceAt.current >= 4000) {
    const finalStyle = sanitizeStyleSafe(extracted.style);
    const cleaned: SongDetails = { ...extracted, ...(finalStyle ? { style: finalStyle } : {}) };
    setDetails((d) => mergeNonEmpty(d, cleaned));
  }
}

    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }
  async function randomizeAll() {
    if (busy) return;
    const content = "Please generate a completely randomized song_request and output ONLY the JSON in a fenced code block as specified. No extra text.";
    setBusy(true);
    try {
      // Use a minimal, stateless prompt so we don't get follow-ups that could override fields
      const minimal: ChatMessage[] = [{ role: "user", content }];
      const [r1, r2] = await Promise.allSettled([
        api.chat(minimal, systemPrompt),
        api.chat(minimal, systemPrompt),
      ]);
      const msgs: string[] = [];
      if (r1.status === "fulfilled") msgs.push(r1.value.content);
      if (r2.status === "fulfilled") msgs.push(r2.value.content);
      const extractions = msgs.map(extractDetails).filter(Boolean) as SongDetails[];
      if (extractions.length === 0) {
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
      let completionAttempts = 0;
      const maxCompletionAttempts = 40; // ~60-90s max
      let statusRaw = "PENDING";
      let sunoData: any[] = [];
      let generationComplete = false;

      while (completionAttempts++ < maxCompletionAttempts) {
        // More conservative real progress updates
        const baseProgress = Math.min((completionAttempts / maxCompletionAttempts) * 40, 40);
        let statusProgress = 5;
        if (statusRaw === "PENDING") statusProgress = 15;
        else if (statusRaw === "FIRST_SUCCESS") statusProgress = 35;
        else if (statusRaw === "TEXT_SUCCESS") statusProgress = 55;
        else if (statusRaw === "SUCCESS") statusProgress = 70;
        
        const newProgress = Math.max(baseProgress, statusProgress);
        // Update progress only if it's higher (never go backward)
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
        throw new Error("Generation timed out waiting for completion");
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
    <div className="min-h-screen bg-[#0c0c0c]">
      {/* Cyber Header */}
      <CyberHeader />

      {/* Two Column Layout - Chat + Form Left, New Container Right */}
      <main className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-12 gap-[1.066rem]">
          {/* Left Column - Chat + Form (75% width) */}
          <div className="col-span-9 space-y-5">
        {/* Chat Container with #151515 background - extended to bottom */}
        <div className="bg-[#151515] rounded-2xl relative overflow-hidden">
          {/* Fade gradient overlay - only shows when scrolled */}
          {scrollTop > 0 && (
            <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-[#151515] via-[#151515]/95 via-[#151515]/70 to-transparent z-30 pointer-events-none" />
          )}
          
          {/* Chat Conversation - dynamic height */}
          <div 
            className="overflow-y-auto custom-scrollbar pl-8 pr-6 pt-8"
            ref={scrollerRef}
            style={{ height: `${chatHeight}px` }}
            onScroll={(e) => {
              const target = e.target as HTMLDivElement;
              setScrollTop(target.scrollTop);
            }}
          >
            <div className="space-y-4 pr-4 pl-4 pt-4 pb-32">
              {/* Chat messages */}
              {messages.map((m, i) => (
                <ChatBubble key={i} role={m.role} content={m.content} />
              ))}
              {busy && (
                <Spinner />
              )}
            </div>
          </div>

          {/* Tools Section - positioned absolute at bottom with fade background */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#151515] via-[#151515]/98 via-[#151515]/90 to-transparent pt-8 pb-8 px-8">
            <div className="flex items-end gap-3">
            {/* Chat Input - DEBUG: Should be 56px height (p-3 = 12px*2 + 32px icon height) */}
            <div className="flex-1 relative bg-[#040404] rounded-xl p-3 min-h-[56px] flex items-center hover:shadow-[0_0_5px_rgba(255,255,255,0.25)] focus-within:shadow-[0_0_5px_rgba(255,255,255,0.5)] focus-within:hover:shadow-[0_0_5px_rgba(255,255,255,0.5)] transition-shadow duration-200">
              <textarea
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  // Auto-resize functionality
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                }}
                placeholder="Type out your question here..."
                className="w-full bg-transparent border-0 pr-2 text-white placeholder-gray-500 focus:outline-none resize-none min-h-[32px] max-h-[120px] overflow-y-auto chat-input-scrollbar"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSend();
                  }
                }}
                disabled={busy}
                rows={1}
              />
              <button
                onClick={onSend}
                disabled={busy || !input.trim()}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 p-1 text-white hover:text-accent-primary transition-colors disabled:opacity-50"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#ffffff" stroke="none">
                  <path d="M12 19V5M5 12l7-7 7 7" stroke="#ffffff" strokeWidth="2" fill="none"/>
                </svg>
              </button>
            </div>
            {/* Icons Container - DEBUG: Should be 56px height (p-3 = 12px*2 + p-2*2 = 8px*2 + 20px icon = 56px) */}
            <div className="bg-[#040404] rounded-xl p-3 flex gap-2 min-h-[56px] items-center hover:shadow-[0_0_5px_rgba(255,255,255,0.25)] transition-shadow duration-200">
              <button className="p-2 text-white hover:text-accent-primary transition-colors" disabled={busy}>
                <Upload size={20} />
              </button>
              <button className="p-2 text-white hover:text-accent-primary transition-colors" disabled={busy}>
                <Grid3X3 size={20} />
              </button>
              <button className="p-2 text-white hover:text-accent-primary transition-colors" onClick={randomizeAll} disabled={busy}>
                <Dice5 size={20} />
              </button>
              <button className="p-2 text-white hover:text-accent-primary transition-colors" disabled={busy}>
                <List size={20} />
              </button>
            </div>
            </div>
          </div>
          
          {/* Resize Handle */}
          <div 
            className={`absolute bottom-0 right-0 w-4 h-4 cursor-nw-resize group ${isResizing ? 'bg-accent-primary/50' : 'bg-white/20 hover:bg-white/40'} transition-colors duration-200`}
            onMouseDown={handleMouseDown}
            style={{ 
              clipPath: 'polygon(100% 0%, 0% 100%, 100% 100%)',
              borderBottomRightRadius: '16px' 
            }}
          >
            <div className="absolute bottom-1 right-1 w-1 h-1 bg-white/60 rounded-full"></div>
            <div className="absolute bottom-1 right-2.5 w-1 h-1 bg-white/40 rounded-full"></div>
            <div className="absolute bottom-2.5 right-1 w-1 h-1 bg-white/40 rounded-full"></div>
          </div>
        </div>

        {/* Form Section - Main container matching chat interface */}
        <div className="bg-[#151515] rounded-xl p-4 space-y-4 mt-5">
          {/* Two-column layout: Left (Title + Song Parameters stacked), Right (Lyrics tall) */}
          <div className="grid grid-cols-12 gap-4 h-auto">
            {/* Left column: Title and Song Parameters stacked */}
            <div className="col-span-5 space-y-3">
              {/* Title section - external label */}
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
              
              {/* Song Parameters section - external label */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/80">Song Parameters</label>
                <div className="bg-[#2d2d2d] rounded-lg p-4 border border-transparent hover:border-white/50 focus-within:border-white focus-within:hover:border-white transition-colors duration-200">
                  <TagInput
                    tags={styleTags}
                    onChange={handleStyleTagsChange}
                    placeholder='Add song parameters such as "Pop", "128bpm", "female vocals" and separate them by comma'
                    className="bg-transparent border-0 text-white placeholder:text-white/40 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 min-h-[120px] resize-none"
                  />
                </div>
              </div>
            </div>
            
            {/* Right column: Lyrics section - external label */}
            <div className="col-span-7 space-y-2 flex flex-col">
              <label className="text-sm font-medium text-white/80">Lyrics</label>
              <div className="bg-[#2d2d2d] rounded-lg p-4 flex-1 border border-transparent hover:border-white/50 focus-within:border-white focus-within:hover:border-white transition-colors duration-200">
                <Textarea
                  value={details.lyrics || ""}
                  onChange={(e) => setDetails({ ...details, lyrics: e.target.value })}
                  placeholder="Enter your lyrics here..."
                  className="bg-transparent border-0 text-white placeholder:text-white/40 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 pr-3 resize-none w-full h-full lyrics-scrollbar"
                />
              </div>
            </div>
          </div>

          {/* Progress bar inside the container */}
          {busy && generationProgress > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Generating...</span>
                <span className="font-medium text-pink-400">{Math.round(generationProgress)}%</span>
              </div>
              <Progress 
                value={generationProgress} 
                className="h-2"
              />
            </div>
          )}

          {/* Generate Button - Styled like the reference */}
          <div className="pt-2">
            <CyberButton 
              onClick={startGeneration} 
              disabled={busy || !canGenerate}
              className="w-full bg-[#f92c8f] hover:bg-[#e02681] text-white font-medium h-12 rounded-lg"
            >
              ✦ Generate
            </CyberButton>
          </div>
        </div>
          </div>

          {/* Right Column - Karaoke Panel (25% width) */}
          <div className="col-span-3">
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
            />
          </div>
        </div>

        {/* Output Sections */}
        {(audioUrls?.length || audioUrl || versions.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
            {/* Audio Output */}
            <CyberCard className="space-y-3">
              <h2 className="text-lg font-medium text-text-primary">Output</h2>
              {audioUrls && audioUrls.length > 0 ? (
                <div className="space-y-4">
                  {audioUrls.map((url, idx) => (
                    <div key={`${url}-${idx}`} className="space-y-2">
                      <p className="text-sm text-text-secondary">Version {idx + 1}</p>
                      <audio
                        src={url}
                        controls
                        className="w-full"
                        preload="auto"
                        onPlay={() => handleAudioPlay(idx)}
                        onPause={handleAudioPause}
                        onTimeUpdate={(e) => handleTimeUpdate(e.currentTarget)}
                        onEnded={handleAudioPause}
                        ref={(el) => { if (el) audioRefs.current[idx] = el; }}
                      />
                    </div>
                  ))}
                </div>
              ) : audioUrl ? (
                <div className="space-y-2">
                  <audio
                    src={audioUrl}
                    controls
                    className="w-full"
                    preload="none"
                    onPlay={() => handleAudioPlay(0)}
                    onPause={handleAudioPause}
                    onTimeUpdate={(e) => handleTimeUpdate(e.currentTarget)}
                    onEnded={handleAudioPause}
                    ref={(el) => { if (el) audioRefs.current[0] = el; }}
                  />
                </div>
              ) : null}
            </CyberCard>

          </div>
        )}
      </main>

      {/* Full-screen Karaoke Overlay */}
      {showFullscreenKaraoke && versions[currentAudioIndex]?.words?.length > 0 && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8 cursor-pointer"
          onClick={() => setShowFullscreenKaraoke(false)}
        >
          <div className="w-full max-w-4xl flex flex-col items-center">
            {/* Album Cover */}
            <div className="mb-8">
              {isGeneratingCovers ? (
                <div className="w-48 h-48 bg-muted/20 rounded-lg flex items-center justify-center">
                  <div className="text-white/60">Generating cover...</div>
                </div>
              ) : albumCovers ? (
                <img 
                  src={currentAudioIndex === 1 ? albumCovers.cover2 : albumCovers.cover1}
                  alt="Album Cover"
                  className="w-48 h-48 object-cover rounded-lg shadow-2xl border border-white/10"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : null}
            </div>
            
            {/* Karaoke Lyrics */}
            <div className="w-full">
              <KaraokeLyrics 
                words={versions[currentAudioIndex].words}
                currentTime={currentTime}
                isPlaying={isPlaying}
                className="min-h-[300px] max-h-[50vh] bg-transparent border-0 text-white text-2xl leading-relaxed"
              />
            </div>
          </div>
        </div>
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
    </div>
  );
};

export default Index;