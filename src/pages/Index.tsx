import { useEffect, useMemo, useRef, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { api, type SongDetails } from "@/lib/api";
import { FileAttachment } from "@/types";
import { sanitizeStyle } from "@/lib/styleSanitizer";
import { toast } from "sonner";

// Components
import { CyberHeader } from "@/components/cyber/CyberHeader";
import { MainContent } from "@/components/main/MainContent";
import { FullscreenKaraoke } from "@/components/karaoke/FullscreenKaraoke";
import { AudioPlayer } from "@/components/audio/AudioPlayer";

// Hooks
import { useChat } from "@/hooks/use-chat";
import { useGeneration } from "@/hooks/use-generation";
import { useAudioPlayer } from "@/hooks/use-audio-player";

// Types
import { type ChatMessage } from "@/types";

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
  const [details, setDetails] = useState<SongDetails>({});
  const [styleTags, setStyleTags] = useState<string[]>([]);
  const [chatHeight, setChatHeight] = useState(500);
  const [isResizing, setIsResizing] = useState(false);
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
  const [attachedFiles, setAttachedFiles] = useState<FileAttachment[]>([]);
  
  const lastDiceAt = useRef<number>(0);

  // Custom hooks
  const {
    messages,
    input,
    setInput,
    busy: chatBusy,
    isAnalyzingImage,
    isReadingText,
    sendMessage
  } = useChat(systemPrompt);

  const {
    versions,
    busy: generationBusy,
    generationProgress,
    generate
  } = useGeneration();

  const {
    currentTime,
    isPlaying,
    currentAudioIndex,
    audioRefs,
    handleAudioPlay,
    handleAudioPause,
    handleTimeUpdate,
    handleSeek
  } = useAudioPlayer();

  const busy = chatBusy || generationBusy;
  const canGenerate = useMemo(() => !!details.lyrics, [details]);
  const currentVersion = versions[currentAudioIndex];

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

  const handleFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*,.txt,.md,.doc,.docx,.pdf,.rtf,.odt,.json';
    
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      const newAttachments: FileAttachment[] = [];
      
      for (const file of files) {
        if (file.size > 20 * 1024 * 1024) {
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
            data: base64.split(',')[1]
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

  const onSend = async () => {
    const content = input.trim();
    if (!content && attachedFiles.length === 0) return;
    
    const fileAttachments = attachedFiles.length > 0 ? [...attachedFiles] : undefined;
    
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
      toast.error("Error processing attached files");
    }

    const fullContent = appendedText ? `${content}\n\n[Extracted from attachments:]\n${appendedText}` : content;
    
    setInput("");
    setAttachedFiles([]);
    
    const response = await sendMessage(fullContent, fileAttachments);
    if (response) {
      const extractedDetails = extractDetails(response);
      if (extractedDetails) {
        console.log("[Chat] Extracted song details:", extractedDetails);
        const merged = mergeNonEmpty(details, extractedDetails);
        merged.style = sanitizeStyleSafe(merged.style);
        setDetails(merged);
        toast.success("Song details updated!");
      }
    }
  };

  const handleRandomize = () => {
    const now = Date.now();
    if (now - lastDiceAt.current < 1000) return;
    lastDiceAt.current = now;

    const randomDetails = {
      title: generateRandomTitle(),
      style: generateRandomStyle(),
      lyrics: generateRandomLyrics()
    };
    
    setDetails(randomDetails);
    toast.success("Random song generated!");
  };

  const handleGenerateCovers = async () => {
    if (!details.title && !details.style && !details.lyrics) {
      toast.error("Please provide song details first");
      return;
    }

    setIsGeneratingCovers(true);
    try {
      const result = await api.generateAlbumCovers(details);
      if (result.cover1 && result.cover2) {
        setAlbumCovers(result);
        toast.success("Album covers generated!");
      } else {
        throw new Error("Failed to generate album covers");
      }
    } catch (error: any) {
      console.error("[Covers] Error:", error);
      toast.error(error?.message || "Failed to generate album covers");
    } finally {
      setIsGeneratingCovers(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5">
      <CyberHeader />
      
      <MainContent
        details={details}
        setDetails={setDetails}
        styleTags={styleTags}
        onStyleTagsChange={handleStyleTagsChange}
        messages={messages}
        input={input}
        setInput={setInput}
        onSend={onSend}
        busy={busy}
        isAnalyzingImage={isAnalyzingImage}
        isReadingText={isReadingText}
        attachedFiles={attachedFiles}
        onFileUpload={handleFileUpload}
        removeFile={removeFile}
        onRandomize={handleRandomize}
        onGenerate={() => generate(details)}
        canGenerate={canGenerate}
        chatHeight={chatHeight}
        onMouseDown={handleMouseDown}
        isResizing={isResizing}
        versions={versions}
        onAudioPlay={handleAudioPlay}
        currentAudioIndex={currentAudioIndex}
        isPlaying={isPlaying}
        currentTime={currentTime}
        onSeek={handleSeek}
        onAudioPause={handleAudioPause}
        audioRefs={audioRefs}
        onTimeUpdate={handleTimeUpdate}
        showFullscreenKaraoke={showFullscreenKaraoke}
        setShowFullscreenKaraoke={setShowFullscreenKaraoke}
        albumCovers={albumCovers}
        isGeneratingCovers={isGeneratingCovers}
        onGenerateCovers={handleGenerateCovers}
        generationProgress={generationProgress}
      />

      {/* Global Audio Player */}
      {versions.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40">
          <div className="max-w-7xl mx-auto px-6">
            <div 
              className="h-[50px] bg-background/95 backdrop-blur-sm border border-border/50 rounded-t-lg shadow-lg"
              style={{ width: 'calc(500px + 1fr + 351px + 48px)' }} // Form + Chat + Template + gaps
            >
              <AudioPlayer
                audioRef={audioRefs.current[currentAudioIndex]}
                isPlaying={isPlaying}
                onPlayPause={() => isPlaying ? handleAudioPause() : handleAudioPlay(currentAudioIndex)}
                currentTime={currentTime}
                onSeek={handleSeek}
                trackTitle={`Version ${currentAudioIndex + 1}`}
                className="h-full px-4"
              />
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Karaoke Modal */}
      {showFullscreenKaraoke && currentVersion?.words && (
        <FullscreenKaraoke
          words={currentVersion.words}
          currentTime={currentTime}
          isPlaying={isPlaying}
          onPlayPause={() => isPlaying ? handleAudioPause() : handleAudioPlay(currentAudioIndex)}
          onClose={() => setShowFullscreenKaraoke(false)}
          onSeek={handleSeek}
          duration={audioRefs.current[currentAudioIndex]?.duration || 0}
        />
      )}
    </div>
  );
};

// Helper functions for randomization
function generateRandomTitle(): string {
  const adjectives = ["Electric", "Midnight", "Golden", "Neon", "Crystal", "Shadow", "Cosmic", "Velvet"];
  const nouns = ["Dreams", "Nights", "Hearts", "Stars", "Waves", "Fire", "Storm", "Light"];
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;
}

function generateRandomStyle(): string {
  const genres = ["pop", "rock", "jazz", "electronic", "folk", "blues"];
  const moods = ["uplifting", "melancholic", "energetic", "dreamy", "intense"];
  const tempos = ["120 BPM", "90 BPM", "140 BPM", "100 BPM"];
  const vocals = ["male vocals", "female vocals", "duet"];
  
  const genre = genres[Math.floor(Math.random() * genres.length)];
  const mood = moods[Math.floor(Math.random() * moods.length)];
  const tempo = tempos[Math.floor(Math.random() * tempos.length)];
  const vocal = vocals[Math.floor(Math.random() * vocals.length)];
  
  return `${genre}, ${mood}, ${tempo}, English, ${vocal}`;
}

function generateRandomLyrics(): string {
  return `[Intro]
The world is spinning faster tonight
Everything's changing in the light

[Verse 1]
Walking down these empty streets
Searching for what I can't see
Every step takes me further away
From who I used to be yesterday

[Pre-Chorus]
But I won't look back
No, I won't look back

[Chorus]
I'm breaking free from yesterday
Finding my own way
No more chains to hold me down
I'm reaching for the sky
Breaking free, learning how to fly
This is my time now

[Verse 2]
Mirror shows a different face
Someone I can finally embrace
All the fears that held me tight
Disappearing in the light

[Chorus]
I'm breaking free from yesterday
Finding my own way
No more chains to hold me down
I'm reaching for the sky
Breaking free, learning how to fly
This is my time now

[Bridge]
Every scar tells a story
Every tear led to glory
I am stronger than before
Ready to open every door

[Outro]
The world is spinning with me now
I've learned to fly somehow`;
}

export default Index;