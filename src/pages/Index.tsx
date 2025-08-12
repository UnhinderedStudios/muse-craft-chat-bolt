import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { api, type ChatMessage, type SongDetails } from "@/lib/api";
import { ChatBubble } from "@/components/chat/ChatBubble";

const systemPrompt = `You are Melody Muse, a friendly creative assistant for songwriting.
Your goal is to chat naturally and quickly gather what the user wants for a song:
- genre / style, mood, tempo, language
- vocal type (male/female/duet/none), reference artists
- theme/storyline and any lyrics snippets
Ask concise questions one at a time. When you believe you have enough info, output a compact JSON between triple backticks with the key song_request containing fields: title, genre, mood, tempo, language, vocals, lyrics. Example:\n\n\`\`\`\n{"song_request": {"title": "Neon Skies", "genre": "synthpop", "mood": "uplifting", "tempo": "120 BPM", "language": "English", "vocals": "female", "lyrics": "short verse/chorus here"}}\n\`\`\`\nContinue the conversation after the JSON if needed.`;

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
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const canGenerate = useMemo(() => !!(details.genre || details.lyrics || details.title), [details]);

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
      if (extracted) setDetails((d) => ({ ...d, ...extracted }));
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
    setJobId(null);
    setBusy(true);
    try {
      const { jobId } = await api.startSong(details);
      setJobId(jobId);
      toast.success("Song requested. Composing...");
      // poll
      let attempts = 0;
      const maxAttempts = 50;
      while (attempts++ < maxAttempts) {
        await new Promise((r) => setTimeout(r, Math.min(1500 + attempts * 200, 5000)));
        const status = await api.pollSong(jobId);
        if (status.status === "ready" && status.audioUrl) {
          setAudioUrl(status.audioUrl);
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
            <p className="text-sm text-muted-foreground">These auto-fill from the chat. You can tweak them.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Genre</label>
                <input
                  className="w-full h-10 rounded-md border bg-background px-3"
                  value={details.genre || ""}
                  onChange={(e) => setDetails({ ...details, genre: e.target.value })}
                  placeholder="e.g. Synthpop"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Mood</label>
                <input
                  className="w-full h-10 rounded-md border bg-background px-3"
                  value={details.mood || ""}
                  onChange={(e) => setDetails({ ...details, mood: e.target.value })}
                  placeholder="e.g. Uplifting"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Tempo</label>
                <input
                  className="w-full h-10 rounded-md border bg-background px-3"
                  value={details.tempo || ""}
                  onChange={(e) => setDetails({ ...details, tempo: e.target.value })}
                  placeholder="e.g. 120 BPM"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Language</label>
                <input
                  className="w-full h-10 rounded-md border bg-background px-3"
                  value={details.language || ""}
                  onChange={(e) => setDetails({ ...details, language: e.target.value })}
                  placeholder="e.g. English"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Vocals</label>
                <input
                  className="w-full h-10 rounded-md border bg-background px-3"
                  value={details.vocals || ""}
                  onChange={(e) => setDetails({ ...details, vocals: e.target.value })}
                  placeholder="e.g. female"
                />
              </div>
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
            {audioUrl ? (
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
