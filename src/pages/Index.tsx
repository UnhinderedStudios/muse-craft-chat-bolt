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
import { Dice5, Mic, Upload, Grid3X3, Plus, List, Play, Pause, X } from "lucide-react";

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

// Organized sections
import { ChatSection } from "@/components/sections/ChatSection";
import { FormSection } from "@/components/sections/FormSection";
import { TrackListSection } from "@/components/sections/TrackListSection";

// Hooks
import { useChat } from "@/hooks/use-chat";
import { useResize } from "@/hooks/use-resize";
import { useSongGeneration } from "@/hooks/use-song-generation";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useFileUpload } from "@/hooks/useFileUpload";
import { useProgressTracking } from "@/hooks/useProgressTracking";

// Types
import { type TimestampedWord, type ChatMessage } from "@/types";

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
  try {
    const parsed = parseSongRequest(text);
    if (parsed) {
      return convertToSongDetails(parsed);
    }
  } catch (e) {
    console.debug("[Parse] parseSongRequest failed:", e);
  }

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

  // Use organized hooks
  const audioPlayer = useAudioPlayer();
  const fileUpload = useFileUpload();
  const progressTracking = useProgressTracking(busy);

  // Sync styleTags with details.style
  useEffect(() => {
    if (details.style && details.style !== styleTags.join(", ")) {
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
  const [showFullscreenKaraoke, setShowFullscreenKaraoke] = useState(false);
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
  const lastDiceAt = useRef<number>(0);

  // Handle chat resize functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startY = e.clientY;
    const startHeight = chatHeight;
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - startY;
      const newHeight = Math.max(300, Math.min(800, startHeight + deltaY));
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

  const canGenerate = useMemo(() => !!details.lyrics, [details]);

  async function onSend() {
    const content = input.trim();
    if (!content && fileUpload.attachedFiles.length === 0) return;
    const fileAttachments = fileUpload.attachedFiles.length > 0 ? [...fileUpload.attachedFiles] : undefined;
    
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
    } catch (error) {
      console.error("[Chat] Error extracting text from attachments:", error);
    }

    const fullContent = [content, appendedText].filter(Boolean).join("\n\n");
    const messageWithAttachments: ChatMessage = {
      role: "user",
      content: fullContent,
      attachments: fileAttachments
    };

    setMessages(prev => [...prev, messageWithAttachments]);
    setInput("");
    fileUpload.setAttachedFiles([]);
    setBusy(true);

    if (fileAttachments?.some(f => f.type.startsWith('image/'))) {
      setIsAnalyzingImage(true);
    }
    if (fileAttachments?.some(f => !f.type.startsWith('image/'))) {
      setIsReadingText(true);
    }

    try {
      const response = await api.chat(
        [...messages, messageWithAttachments],
        systemPrompt
      );
      
      setMessages(prev => [...prev, { role: "assistant", content: response.content }]);
      
      const extracted = extractDetails(response.content);
      if (extracted) {
        console.log("[Extracted Details]", extracted);
        const merged = mergeNonEmpty(details, extracted);
        setDetails(merged);
      }
    } catch (error) {
      console.error("Chat error:", error);
      toast.error("Failed to send message. Please try again.");
    } finally {
      setBusy(false);
      setIsAnalyzingImage(false);
      setIsReadingText(false);
    }
  }

  const randomizeAll = () => {
    const now = Date.now();
    if (now - lastDiceAt.current < 2000) return;
    lastDiceAt.current = now;

    const genres = ["pop", "rock", "electronic", "folk", "jazz", "hip-hop", "country", "classical"];
    const moods = ["upbeat", "melancholic", "energetic", "chill", "dramatic", "romantic", "mysterious"];
    const tempos = ["slow", "moderate", "fast", "120 BPM", "140 BPM", "80 BPM"];
    const vocals = ["male vocals", "female vocals", "duet"];
    
    const randomGenre = genres[Math.floor(Math.random() * genres.length)];
    const randomMood = moods[Math.floor(Math.random() * moods.length)];
    const randomTempo = tempos[Math.floor(Math.random() * tempos.length)];
    const randomVocals = vocals[Math.floor(Math.random() * vocals.length)];
    
    const randomStyle = `${randomGenre}, ${randomMood}, ${randomTempo}, ${randomVocals}`;
    
    setDetails(prev => ({
      ...prev,
      style: randomStyle,
      title: `Random Song ${Math.floor(Math.random() * 1000)}`
    }));
    
    setStyleTags(randomStyle.split(",").map(tag => tag.trim()));
  };

  const testAlbumCoverWithLyrics = async () => {
    if (!details.lyrics || isGeneratingCovers) return;

    setIsGeneratingCovers(true);
    
    try {
      const albumCoverResponse = await api.generateAlbumCovers({
        title: details.title || "Untitled Song",
        style: details.style || "modern",
        lyrics: details.lyrics
      });
      
      if (albumCoverResponse.success && albumCoverResponse.covers) {
        setAlbumCovers(albumCoverResponse.covers);
        toast.success("Album covers generated!");
      } else {
        toast.error("Failed to generate album covers");
      }
    } catch (error) {
      console.error("Album cover generation error:", error);
      toast.error("Failed to generate album covers");
    } finally {
      setIsGeneratingCovers(false);
    }
  };

  const startGeneration = async () => {
    if (!canGenerate || busy) return;

    setBusy(true);
    progressTracking.setGenerationProgress(0);
    progressTracking.setLastProgressUpdate(Date.now());

    const safeStyle = sanitizeStyleSafe(details.style) || "modern pop";

    try {
      console.log("[Generation] Starting with details:", {
        title: details.title,
        style: safeStyle,
        lyrics: details.lyrics?.substring(0, 100) + "..."
      });

      const response = await api.startSong({
        title: details.title || "Untitled Song",
        style: safeStyle,
        lyrics: details.lyrics!
      });

      if (response.success && response.audioUrls) {
        progressTracking.setGenerationProgress(75);
        progressTracking.setLastProgressUpdate(Date.now());

        setAudioUrls(response.audioUrls);
        console.log("[Generation] Audio URLs received:", response.audioUrls);

        const newVersions = response.audioUrls.map((url, index) => ({
          url,
          audioId: `generated-${Date.now()}-${index}`,
          musicIndex: index,
          words: [] as TimestampedWord[],
          hasTimestamps: false
        }));

        setVersions(newVersions);

        try {
          console.log("[Generation] Fetching karaoke lyrics...");
          const karaokeResponse = await api.getTimestampedLyrics({ taskId: response.jobId! });
          
          if (karaokeResponse.alignedWords) {
            console.log("[Generation] Karaoke data received, applying to all versions");
            
            setVersions(prev => prev.map(version => ({
              ...version,
              words: karaokeResponse.alignedWords!.map(w => ({ word: w.word, start: w.start_s, end: w.end_s, success: w.success })),
              hasTimestamps: true
            })));
            
            progressTracking.setGenerationProgress(100);
            toast.success("Song and karaoke lyrics generated!");
          } else {
            console.log("[Generation] No karaoke data available");
            setVersions(prev => prev.map(version => ({
              ...version,
              timestampError: "Karaoke sync not available"
            })));
            progressTracking.setGenerationProgress(100);
            toast.success("Song generated! (Karaoke sync not available)");
          }
        } catch (karaokeError) {
          console.error("[Generation] Karaoke error:", karaokeError);
          setVersions(prev => prev.map(version => ({
            ...version,
            timestampError: "Failed to load karaoke sync"
          })));
          progressTracking.setGenerationProgress(100);
          toast.success("Song generated! (Karaoke sync failed)");
        }
      } else {
        throw new Error(response.error || "Unknown generation error");
      }
    } catch (error) {
      console.error("[Generation] Error:", error);
      toast.error("Failed to generate song. Please try again.");
      progressTracking.setGenerationProgress(0);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-text-primary">
      <CyberHeader />
      
      <main className="container mx-auto px-6 py-8">
        {/* Main 4-Column Grid Layout */}
        <div className="grid grid-cols-4 gap-6 h-[600px] mb-8">
          {/* Chat Section - spans 2 columns */}
          <div className="col-span-2">
            <ChatSection
              messages={messages}
              input={input}
              setInput={setInput}
              busy={busy}
              isAnalyzingImage={isAnalyzingImage}
              isReadingText={isReadingText}
              attachedFiles={fileUpload.attachedFiles}
              chatHeight={chatHeight}
              isResizing={isResizing}
              handleMouseDown={handleMouseDown}
              onSend={onSend}
              handleFileUpload={fileUpload.handleFileUpload}
              removeFile={fileUpload.removeFile}
              randomizeAll={randomizeAll}
              scrollerRef={scrollerRef}
            />
          </div>

          {/* Form Section */}
          <div className="col-start-3 row-start-1">
            <FormSection
              details={details}
              setDetails={setDetails}
              styleTags={styleTags}
              handleStyleTagsChange={handleStyleTagsChange}
              randomizeAll={randomizeAll}
            />
          </div>

          {/* Template Section */}
          <div className="col-start-3 row-start-2 bg-[#151515] rounded-2xl flex items-center justify-center h-full">
            <span className="text-text-secondary">TEMPLATE</span>
          </div>

          {/* Track List Section - Full height spanning both rows */}
          <div className="row-span-2 col-start-4">
            <TrackListSection
              canGenerate={canGenerate}
              busy={busy}
              generationProgress={progressTracking.generationProgress}
              details={details}
              versions={versions}
              albumCovers={albumCovers}
              isGeneratingCovers={isGeneratingCovers}
              currentTime={audioPlayer.currentTime}
              isPlaying={audioPlayer.isPlaying}
              currentAudioIndex={audioPlayer.currentAudioIndex}
              audioRefs={audioPlayer.audioRefs}
              startGeneration={startGeneration}
              testAlbumCoverWithLyrics={testAlbumCoverWithLyrics}
              handleAudioPlay={(index) => audioPlayer.handleAudioPlay(index, busy)}
              handleAudioPause={audioPlayer.handleAudioPause}
              handleTimeUpdate={audioPlayer.handleTimeUpdate}
              handleSeek={audioPlayer.handleSeek}
              setShowFullscreenKaraoke={setShowFullscreenKaraoke}
            />
          </div>
        </div>
      </main>

      {/* Full-screen Karaoke Overlay */}
      {showFullscreenKaraoke && versions[audioPlayer.currentAudioIndex]?.words?.length > 0 && (
        <FullscreenKaraoke
          words={versions[audioPlayer.currentAudioIndex].words}
          currentTime={audioPlayer.currentTime}
          isPlaying={audioPlayer.isPlaying}
          albumCoverUrl={albumCovers ? (audioPlayer.currentAudioIndex === 1 ? albumCovers.cover2 : albumCovers.cover1) : undefined}
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
    </div>
  );
};

export default Index;
