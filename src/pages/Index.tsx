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
import { Dice5 } from "lucide-react";

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
  const [timestampedWords, setTimestampedWords] = useState<TimestampedWord[]>([]);
  const [timestampedWordsV2, setTimestampedWordsV2] = useState<TimestampedWord[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentAudioIndex, setCurrentAudioIndex] = useState<number>(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const audioRefs = useRef<HTMLAudioElement[]>([]);
  const lastDiceAt = useRef<number>(0);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    // reset audio refs when result list changes
    audioRefs.current = [];
  }, [audioUrls, audioUrl]);

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
    setBusy(true);
    try {
const payload = { ...details, style: sanitizeStyle(details.style || "") };
const { jobId } = await api.startSong(payload);
      setJobId(jobId);
      toast.success("Song requested. Composing...");
      // poll
      let attempts = 0;
      const maxAttempts = 50;
      while (attempts++ < maxAttempts) {
        await new Promise((r) => setTimeout(r, Math.min(1500 + attempts * 200, 5000)));
        const status = await api.pollSong(jobId);
        if (status.status === "ready") {
          if (status.audioUrls?.length) setAudioUrls(status.audioUrls);
          if (status.audioUrl) setAudioUrl(status.audioUrl);
          else if (status.audioUrls?.[0]) setAudioUrl(status.audioUrls[0]);
          
          // Fetch timestamped lyrics for both versions with unique IDs
          try {
            const [lyricsResult1, lyricsResult2] = await Promise.all([
              api.getTimestampedLyrics(`${jobId}-v1`, status.audioUrls![0], details.lyrics, 0),
              api.getTimestampedLyrics(`${jobId}-v2`, status.audioUrls![1], details.lyrics, 1)
            ]);
            
            if (lyricsResult1.alignedWords) {
              setTimestampedWords(lyricsResult1.alignedWords);
            }
            if (lyricsResult2.alignedWords) {
              setTimestampedWordsV2(lyricsResult2.alignedWords);
            }
          } catch (e) {
            console.warn("Could not fetch timestamped lyrics:", e);
          }
          
          toast.success("Your song is ready!");
          break;
        }
        if (status.status === "error") {
          throw new Error(status.error || "Generation failed");
        }
      }
    } catch (e: any) {
      toast.error(e.message || "Suno generation error");
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
            <Button onClick={startGeneration} disabled={busy || !canGenerate} variant="hero">
              {busy ? "Working..." : jobId ? "Generating..." : "Generate with Suno"}
            </Button>
          </Card>

          <Card className="p-4 space-y-3">
            <h2 className="text-lg font-medium">Output</h2>
            {audioUrls && audioUrls.length > 0 ? (
              <div className="space-y-4">
                {audioUrls.map((url, idx) => (
                  <div key={url} className="space-y-2">
                    <p className="text-sm text-muted-foreground">Version {idx + 1}</p>
                     <audio
                       src={url}
                       controls
                       className="w-full"
                       preload="none"
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
          
          {(timestampedWords.length > 0 || timestampedWordsV2.length > 0) && (
            <Card className="p-4 space-y-3">
              <h2 className="text-lg font-medium">Karaoke Lyrics</h2>
              <KaraokeLyrics 
                words={currentAudioIndex === 0 ? timestampedWords : timestampedWordsV2}
                currentTime={currentTime}
                isPlaying={isPlaying}
              />
            </Card>
          )}
        </aside>
      </main>

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
