import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { api, type ChatMessage, type SongDetails } from "@/lib/api";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { KaraokeLyrics, type TimestampedWord } from "@/components/KaraokeLyrics";
import { sanitizeStyle } from "@/lib/styleSanitizer";
import { Progress } from "@/components/ui/progress";
import { Dice5, Mic, Star, Sparkles, Download, Play, Pause, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const scrollerRef = useRef<HTMLDivElement>(null);
  const audioRefs = useRef<HTMLAudioElement[]>([]);
  const lastDiceAt = useRef<number>(0);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
                  
                  console.log(`[Timestamps] Fetching for version ${index + 1} (audioId: ${version.audioId})`);
                  const timestampData = await api.getTimestampedLyrics({ 
                    taskId: jobId, 
                    audioId: version.audioId, 
                    musicIndex: version.musicIndex 
                  });
                  const rawWords = timestampData.alignedWords || [];
                  
                  // Transform API response to match TimestampedWord interface
                  const words: TimestampedWord[] = rawWords.map(w => ({
                    word: w.word,
                    success: w.success,
                    start: w.start_s,  // Transform start_s to start
                    end: w.end_s,      // Transform end_s to end
                    p_align: w.p_align
                  }));
                  
                  console.log(`[Timestamps] Success for version ${index + 1}:`, words.length, "words");
                  
                  return {
                    ...version,
                    words,
                    hasTimestamps: words.length > 0,
                  };
                } catch (error: any) {
                  console.warn(`[Timestamps] Version ${index + 1}, attempt ${retryAttempts} failed:`, error.message);
                  
                  if (retryAttempts >= maxRetryAttempts) {
                    console.error(`[Timestamps] Max retries exceeded for version ${index + 1}`);
                    return {
                      ...version,
                      words: [],
                      hasTimestamps: false,
                      timestampError: `Failed after ${maxRetryAttempts} attempts: ${error.message}`
                    };
                  }
                }
              }
              
              // This should never be reached, but TypeScript safety
              return version;
            })
          );
          
          console.log("[Generation] All timestamp fetching completed");
          setVersions(updatedVersions);
          
          // Phase C: Generate album covers after lyrics are ready
          console.log("[Generation] Phase C: Generating album covers...");
          try {
            const coverResult = await api.generateAlbumCovers(details);
            console.log("[Generation] Album covers generated:", coverResult);
            setAlbumCovers(coverResult);
            toast.success("Album covers generated!");
          } catch (coverError: any) {
            console.warn("[Generation] Album cover generation failed:", coverError.message);
            // Don't fail the whole process if covers fail
          }
          
          setGenerationProgress(100);
          setLastProgressUpdate(Date.now());
          break;
        }
        
        if (status.status === "failed") {
          throw new Error(status.error || "Generation failed");
        }
      }
      
      if (!audioUrls) {
        throw new Error("Audio generation timed out");
      }
    } catch (e: any) {
      console.error("[Generation] Error:", e);
      toast.error(e.message || "Generation failed");
      setGenerationProgress(0);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-surface-primary/50 backdrop-blur-sm">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-bold text-primary">ITSOUNDSVIRAL</h1>
            
            {/* Toggle Switches */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-text-secondary">Song Creator</span>
                <div className="w-10 h-5 bg-primary rounded-full relative">
                  <div className="w-4 h-4 bg-white rounded-full absolute top-0.5 right-0.5"></div>
                </div>
                <span className="text-text-primary">Artist Creator</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <span className="text-text-secondary">Simple Mode</span>
                <div className="w-10 h-5 bg-muted rounded-full relative">
                  <div className="w-4 h-4 bg-white rounded-full absolute top-0.5 left-0.5"></div>
                </div>
                <span className="text-text-primary">Studio Mode</span>
              </div>
            </div>
          </div>
          
          {/* Credits */}
          <div className="text-sm text-text-secondary">
            Credits available: <span className="text-text-primary font-semibold">2,847</span>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Chat Section */}
          <div className="lg:col-span-1">
            <Card className="h-[600px] flex flex-col bg-surface-primary border-border">
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold text-text-primary">AI Assistant</h3>
              </div>
              
              {/* Chat Messages */}
              <ScrollArea className="flex-1 p-4" ref={scrollerRef}>
                <div className="space-y-4">
                  {messages.map((message, i) => (
                    <ChatBubble key={i} role={message.role} content={message.content} />
                  ))}
                </div>
              </ScrollArea>
              
              {/* Chat Input */}
              <div className="p-4 border-t border-border">
                <div className="flex gap-2">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Describe your song idea..."
                    className="flex-1 min-h-[60px] bg-input border-border text-text-primary placeholder:text-text-muted resize-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        onSend();
                      }
                    }}
                  />
                  <div className="flex flex-col gap-2">
                    <Button 
                      onClick={onSend} 
                      disabled={busy || !input.trim()}
                      size="sm"
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      <Mic className="w-4 h-4" />
                    </Button>
                    <Button 
                      onClick={randomizeAll} 
                      disabled={busy}
                      variant="outline"
                      size="sm"
                      className="border-border text-text-secondary hover:text-text-primary"
                    >
                      <Dice5 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Tools Section 1 - Empty Pillar */}
          <div className="lg:col-span-1">
            <Card className="h-[300px] bg-surface-primary border-border border-dashed">
              <div className="flex items-center justify-center h-full text-text-muted">
                <div className="text-center">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Coming Soon</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Tools Section 2 - Empty Pillar */}
          <div className="lg:col-span-1">
            <Card className="h-[300px] bg-surface-primary border-border border-dashed">
              <div className="flex items-center justify-center h-full text-text-muted">
                <div className="text-center">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Coming Soon</p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Song Details Section */}
        <div className="max-w-7xl mx-auto mt-6">
          <Card className="bg-surface-primary border-border">
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Left Column - Song Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-text-primary mb-4">Song Details</h3>
                  
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Title</label>
                    <input
                      type="text"
                      value={details.title || ""}
                      onChange={(e) => setDetails(d => ({ ...d, title: e.target.value }))}
                      className="w-full px-3 py-2 bg-input border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="Enter song title..."
                    />
                  </div>
                  
                  {/* Lyrics */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Lyrics</label>
                    <Textarea
                      value={details.lyrics || ""}
                      onChange={(e) => setDetails(d => ({ ...d, lyrics: e.target.value }))}
                      className="w-full h-32 bg-input border border-border text-text-primary placeholder:text-text-muted resize-none"
                      placeholder="Enter your lyrics here..."
                    />
                  </div>
                </div>

                {/* Right Column - Parameters & Generate */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-text-primary mb-4">Song Parameters</h3>
                  
                  {/* Style Input */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Style & Parameters</label>
                    <Textarea
                      value={details.style || ""}
                      onChange={(e) => setDetails(d => ({ ...d, style: e.target.value }))}
                      className="w-full h-20 bg-input border border-border text-text-primary placeholder:text-text-muted resize-none"
                      placeholder="e.g., pop, upbeat, 120 BPM, female vocals..."
                    />
                  </div>

                  {/* Parameter Pills */}
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-primary/20 text-primary text-xs rounded-full">Female Voice</span>
                    <span className="px-3 py-1 bg-accent/20 text-accent-foreground text-xs rounded-full">125 BPM</span>
                    <span className="px-3 py-1 bg-secondary text-secondary-foreground text-xs rounded-full">Pop</span>
                  </div>

                  {/* Generate Button */}
                  <div className="pt-4">
                    <Button
                      onClick={startGeneration}
                      disabled={!canGenerate || busy}
                      className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-lg"
                    >
                      <Star className="w-6 h-6 mr-2" />
                      {busy ? "Generating..." : "Generate Song"}
                    </Button>
                    
                    {/* Test Art Button */}
                    <Button
                      onClick={testAlbumCoverWithLyrics}
                      disabled={busy || isGeneratingCovers}
                      variant="outline"
                      className="w-full mt-2 border-border text-text-secondary hover:text-text-primary"
                    >
                      {isGeneratingCovers ? "Generating Art..." : "Test Art"}
                    </Button>
                  </div>

                  {/* Progress */}
                  {busy && (
                    <div className="pt-2">
                      <Progress value={generationProgress} className="h-2" />
                      <p className="text-xs text-text-muted mt-1">{Math.round(generationProgress)}% complete</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Results Section */}
        {versions.length > 0 && (
          <div className="max-w-7xl mx-auto mt-6">
            <Card className="bg-surface-primary border-border">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-text-primary mb-4">Generated Songs</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {versions.map((version, index) => (
                    <Card key={index} className="bg-surface-secondary border-border">
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-text-primary">Version {index + 1}</h4>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowFullscreenKaraoke(true)}
                              disabled={!version.hasTimestamps}
                              className="border-border"
                            >
                              <Maximize2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              asChild
                              className="border-border"
                            >
                              <a href={version.url} download>
                                <Download className="w-4 h-4" />
                              </a>
                            </Button>
                          </div>
                        </div>
                        
                        <audio
                          ref={(el) => { if (el) audioRefs.current[index] = el; }}
                          src={version.url}
                          controls
                          className="w-full"
                          onPlay={() => handleAudioPlay(index)}
                          onPause={handleAudioPause}
                          onTimeUpdate={(e) => handleTimeUpdate(e.currentTarget)}
                        />
                        
                        {version.hasTimestamps && (
                          <div className="mt-3">
                            <KaraokeLyrics
                              words={version.words}
                              currentTime={currentAudioIndex === index ? currentTime : 0}
                              isPlaying={isPlaying && currentAudioIndex === index}
                            />
                          </div>
                        )}
                        
                        {version.timestampError && (
                          <p className="text-xs text-destructive mt-2">{version.timestampError}</p>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Album Covers */}
        {albumCovers && (
          <div className="max-w-7xl mx-auto mt-6">
            <Card className="bg-surface-primary border-border">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-text-primary mb-4">Album Covers</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative group">
                    <img 
                      src={albumCovers.cover1} 
                      alt="Album Cover 1" 
                      className="w-full aspect-square object-cover rounded-lg border border-border"
                    />
                  </div>
                  <div className="relative group">
                    <img 
                      src={albumCovers.cover2} 
                      alt="Album Cover 2" 
                      className="w-full aspect-square object-cover rounded-lg border border-border"
                    />
                  </div>
                </div>

                {/* Debug Info */}
                {albumCovers.debug && (
                  <details className="mt-4">
                    <summary className="text-sm text-text-muted cursor-pointer hover:text-text-secondary">
                      Debug Information
                    </summary>
                    <div className="mt-2 p-3 bg-surface-elevated rounded-lg text-xs text-text-muted space-y-1">
                      <p><strong>Input Source:</strong> {albumCovers.debug.inputSource}</p>
                      <p><strong>Content:</strong> {albumCovers.debug.inputContent.substring(0, 100)}...</p>
                      <p><strong>ChatGPT Prompt:</strong> {albumCovers.debug.chatPrompt.substring(0, 100)}...</p>
                      <p><strong>Imagen Prompt:</strong> {albumCovers.debug.imagenPrompt}</p>
                    </div>
                  </details>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Fullscreen Karaoke */}
      {showFullscreenKaraoke && versions[currentAudioIndex]?.hasTimestamps && (
        <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
          <div className="text-center max-w-4xl mx-auto p-8">
            <Button
              onClick={() => setShowFullscreenKaraoke(false)}
              className="absolute top-4 right-4 bg-surface-secondary border-border"
              variant="outline"
              size="sm"
            >
              ✕
            </Button>
            
            <h2 className="text-3xl font-bold text-text-primary mb-8">{details.title || "Untitled Song"}</h2>
            
            <KaraokeLyrics
              words={versions[currentAudioIndex]?.words || []}
              currentTime={currentTime}
              isPlaying={isPlaying}
              className="text-2xl"
            />
            
            <div className="mt-8">
              <audio
                src={versions[currentAudioIndex]?.url}
                controls
                className="mx-auto"
                onTimeUpdate={(e) => handleTimeUpdate(e.currentTarget)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
