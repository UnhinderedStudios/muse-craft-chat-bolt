import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { api, type ChatMessage, type SongDetails } from "@/lib/api";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { sanitizeStyle } from "@/lib/styleSanitizer";

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
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const canGenerate = useMemo(() => !!details.lyrics, [details]);

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
  const cleaned = extracted.style ? { ...extracted, style: sanitizeStyle(extracted.style) } : extracted;
  setDetails((d) => ({ ...d, ...cleaned }));
}
    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
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
                <Button onClick={onSend} disabled={busy} className="shrink-0">Send</Button>
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
                    <audio src={url} controls className="w-full" preload="none" />
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
                <audio src={audioUrl} controls className="w-full" preload="none" />
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
