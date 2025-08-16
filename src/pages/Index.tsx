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
import { Dice5, Mic } from "lucide-react";

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
  const [albumCovers, setAlbumCovers] = useState<{ cover1: string; cover2: string } | null>(null);
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
        toast.message("Couldn’t parse random song", { description: "Try again in a moment." });
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

      if (completionAttempts >= maxCompletionAttempts) {
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

          // Generate album covers in background if we have lyrics
          if (details.lyrics && !isGeneratingCovers && !albumCovers) {
            console.log("Starting album cover generation");
            setIsGeneratingCovers(true);
            api.generateAlbumCovers(details.lyrics)
              .then((covers) => {
                console.log("Album covers generated successfully");
                setAlbumCovers(covers);
                setIsGeneratingCovers(false);
              })
              .catch((error) => {
                console.error("Failed to generate album covers:", error);
                setIsGeneratingCovers(false);
              });
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
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <header className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">AI Song Studio</h1>
              <p className="text-sm text-muted-foreground">Chat to craft lyrics and generate music with Suno.</p>
            </div>
            <Button variant="hero" size="lg" onClick={() => window.location.reload()}>New session</Button>
          </div>
        </div>
      </header>

      <main className="container py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2">
          <Card className="p-0">
            <div className="h-[60vh] sm:h-[65vh] md:h-[70vh]">
              <ScrollArea className="h-full" ref={scrollerRef as any}>
                <div className="p-4 space-y-4">
                  {messages.map((m, i) => (
                    <ChatBubble key={i} role={m.role} content={m.content} />
                  ))}
                </div>
              </ScrollArea>
            </div>
            <Separator />
            <div className="p-3 sm:p-4">
              <div className="flex items-end gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Describe your song idea..."
                  className="min-h-[52px]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      onSend();
                    }
                  }}
                  disabled={busy}
                />
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={randomizeAll}
                  type="button"
                  disabled={busy}
                  aria-label="Randomize song"
                  title="Randomize song"
                >
                  <Dice5 />
                </Button>
                <Button onClick={onSend} type="button" disabled={busy} className="shrink-0">Send</Button>
              </div>
            </div>
          </Card>
        </section>

        <aside className="space-y-4">
          <Card className="p-4 space-y-3">
            <h2 className="text-lg font-medium">Song details</h2>
            <p className="text-sm text-muted-foreground">These auto-fill from the chat. Provide Style + Lyrics.</p>
            <div className="grid grid-cols-1 gap-3">
              <input className="hidden" />
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Title</label>
                <input
                  className="w-full h-10 rounded-md border bg-background px-3"
                  value={details.title || ""}
                  onChange={(e) => setDetails({ ...details, title: e.target.value })}
                  placeholder="e.g. Neon Skies"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Style</label>
              <Textarea
                value={details.style || ""}
                onChange={(e) => setDetails({ ...details, style: e.target.value })}
                placeholder="Combine genre, mood, tempo/BPM, language, vocal type, ref artists, production notes"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Lyrics (optional)</label>
              <Textarea
                value={details.lyrics || ""}
                onChange={(e) => setDetails({ ...details, lyrics: e.target.value })}
                placeholder="Paste a short verse/chorus or let AI help in chat"
                className="min-h-[120px]"
              />
            </div>
            {busy && generationProgress > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Generating...</span>
                  <span className="font-medium text-primary">{Math.round(generationProgress)}%</span>
                </div>
                <Progress 
                  value={generationProgress} 
                  className="h-2 bg-gradient-to-r from-primary/20 to-accent/20"
                />
                <div className="text-xs text-center text-muted-foreground">
                  {generationProgress < 25 ? "Starting generation..." :
                   generationProgress < 50 ? "Composing music..." :
                   generationProgress < 75 ? "Finalizing tracks..." :
                   generationProgress < 90 ? "Processing audio..." :
                   "Adding karaoke lyrics..."}
                </div>
              </div>
            )}
            <Button onClick={startGeneration} disabled={busy || !canGenerate} variant="hero">
              {busy ? "Working..." : jobId ? "Generating..." : "Generate with Suno"}
            </Button>
          </Card>

          <Card className="p-4 space-y-3">
            <h2 className="text-lg font-medium">Output</h2>
            {audioUrls && audioUrls.length > 0 ? (
              <div className="space-y-4">
                {audioUrls.map((url, idx) => (
                  <div key={`${url}-${idx}`} className="relative overflow-hidden rounded-lg border border-border bg-background/50 hover:bg-background/80 transition-all duration-300">
                    <div className="p-4">
                      <div className="flex items-start gap-4">
                        {/* Album covers on the left */}
                        <div className="flex-shrink-0">
                          {albumCovers ? (
                            <div className="flex gap-2">
                              <img
                                src={albumCovers.cover1}
                                alt="Album Cover 1"
                                className="w-16 h-16 rounded-md object-cover border border-border"
                              />
                              <img
                                src={albumCovers.cover2}
                                alt="Album Cover 2"
                                className="w-16 h-16 rounded-md object-cover border border-border"
                              />
                            </div>
                          ) : isGeneratingCovers ? (
                            <div className="flex gap-2">
                              <div className="w-16 h-16 rounded-md bg-muted animate-pulse border border-border" />
                              <div className="w-16 h-16 rounded-md bg-muted animate-pulse border border-border" />
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <div className="w-16 h-16 rounded-md bg-muted/50 border border-border" />
                              <div className="w-16 h-16 rounded-md bg-muted/50 border border-border" />
                            </div>
                          )}
                        </div>

                        {/* Song content */}
                        <div className="flex-1 space-y-2">
                          <p className="text-sm text-muted-foreground">Version {idx + 1}</p>
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
                          <a
                            href={url}
                            download
                            className="inline-flex h-10 items-center rounded-md bg-secondary px-4 text-sm"
                          >
                            Download version {idx + 1}
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : audioUrl ? (
              <div className="space-y-3">
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
                <a
                  href={audioUrl}
                  download
                  className="inline-flex h-10 items-center rounded-md bg-secondary px-4 text-sm"
                >
                  Download track
                </a>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Your song will appear here once it’s ready.</p>
            )}
          </Card>
          
          {versions.length > 0 && (
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">Karaoke Lyrics</h2>
                {versions[currentAudioIndex]?.words?.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFullscreenKaraoke(true)}
                    className="flex items-center gap-2"
                  >
                    <Mic className="w-4 h-4" />
                    Fullscreen
                  </Button>
                )}
              </div>
              {versions[currentAudioIndex]?.words?.length > 0 ? (
                <KaraokeLyrics 
                  words={versions[currentAudioIndex].words}
                  currentTime={currentTime}
                  isPlaying={isPlaying}
                />
              ) : versions[currentAudioIndex]?.hasTimestamps === false ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Timestamped lyrics not available</p>
                  {versions[currentAudioIndex]?.timestampError && (
                    <p className="text-sm mt-2">Error: {versions[currentAudioIndex].timestampError}</p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Loading timestamped lyrics...</p>
                </div>
              )}
            </Card>
          )}
        </aside>
      </main>

      {/* Full-screen Karaoke Overlay */}
      {showFullscreenKaraoke && versions[currentAudioIndex]?.words?.length > 0 && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8 cursor-pointer"
          onClick={() => setShowFullscreenKaraoke(false)}
        >
          <div className="w-full max-w-4xl">
            <KaraokeLyrics 
              words={versions[currentAudioIndex].words}
              currentTime={currentTime}
              isPlaying={isPlaying}
              className="min-h-[300px] max-h-[70vh] bg-transparent border-0 text-white text-2xl leading-relaxed"
            />
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
