import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Dice5, Mic, Upload, Grid3X3, Plus, List, X } from "lucide-react";

// Components
import { CyberHeader } from "@/components/cyber/CyberHeader";
import { CyberCard } from "@/components/cyber/CyberCard";
import { CyberButton } from "@/components/cyber/CyberButton";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { ChatInput } from "@/components/chat/ChatInput";
import { FullscreenKaraoke } from "@/components/karaoke/FullscreenKaraoke";
import { KaraokeRightPanel } from "@/components/karaoke/KaraokeRightPanel";
import { ResizableContainer } from "@/components/layout/ResizableContainer";
import { FormSection } from "@/components/main/FormSection";
import { TemplateSection } from "@/components/main/TemplateSection";
import { GenerationProgress } from "@/components/main/GenerationProgress";
import { TrackList } from "@/components/main/TrackList";

// Hooks
import { useChat } from "@/hooks/use-chat";
import { useResize } from "@/hooks/use-resize";
import { useGeneration } from "@/hooks/use-generation";
import { useAudioPlayer } from "@/hooks/use-audio-player";

// Types and Utils
import { FileAttachment, type ChatMessage } from "@/types";
import { type SongDetails } from "@/lib/api";
import { sanitizeStyle } from "@/lib/styleSanitizer";
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
  // UI State
  const [details, setDetails] = useState<SongDetails>({});
  const [styleTags, setStyleTags] = useState<string[]>([]);
  const [showFullscreenKaraoke, setShowFullscreenKaraoke] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<FileAttachment[]>([]);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [isReadingText, setIsReadingText] = useState(false);
  
  // Refs
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const lastDiceAt = useRef<number>(0);

  // Hooks
  const chat = useChat();
  const resize = useResize();
  const generation = useGeneration();
  const audioPlayer = useAudioPlayer();

  // Computed values
  const canGenerate = useMemo(() => !!details.lyrics, [details]);

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

  const onSend = async () => {
    const content = chat.input.trim();
    if (!content && attachedFiles.length === 0) return;
    
    // Clear attached files after sending
    const fileAttachments = attachedFiles.length > 0 ? [...attachedFiles] : undefined;
    setAttachedFiles([]);
    
    await chat.sendMessage(content, systemPrompt, fileAttachments);
    
    // Process assistant response for song details
    const lastMessage = chat.messages[chat.messages.length - 1];
    if (lastMessage?.role === "assistant") {
      const parsed = extractDetails(lastMessage.content);
      if (parsed) {
        const merged = mergeNonEmpty(details, parsed);
        merged.style = sanitizeStyleSafe(merged.style) || merged.style;
        setDetails(merged);
      }
    }
  };

  const onRandomize = () => {
    const now = Date.now();
    if (now - lastDiceAt.current < 1000) return;
    lastDiceAt.current = now;
    
    const randomTemplates = [
      { title: "Midnight Drive", style: "Alternative rock, moody, 95 BPM, English, male vocals" },
      { title: "Summer Anthem", style: "Electronic dance, uplifting, 128 BPM, English, mixed vocals" },
      { title: "Love Ballad", style: "Pop ballad, emotional, 70 BPM, English, female vocals" }
    ];
    
    const template = randomTemplates[Math.floor(Math.random() * randomTemplates.length)];
    setDetails(prev => ({ ...prev, ...template }));
  };

  const onApplyTemplate = (template: any) => {
    setDetails({ ...details, ...template });
  };

  const onGenerate = () => {
    if (!canGenerate) return;
    generation.generate(details);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <CyberHeader />
      
      <main className="container mx-auto px-4 py-8">
        <ResizableContainer
          isResizing={resize.isResizing}
          handleMouseDown={resize.handleMouseDown}
        >
          {/* Left: Form and Templates */}
          <div className="space-y-8">
            <FormSection
              details={details}
              setDetails={setDetails}
              styleTags={styleTags}
              onStyleTagsChange={handleStyleTagsChange}
              onRandomize={onRandomize}
              onGenerate={onGenerate}
              canGenerate={canGenerate}
              busy={generation.busy}
            />
            
            <TemplateSection
              onApplyTemplate={onApplyTemplate}
              lastDiceAt={lastDiceAt}
            />
            
            {/* Chat Section */}
            <CyberCard className="relative">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">AI Assistant</h2>
                <div className="flex gap-2">
                  <CyberButton variant="icon" onClick={handleFileUpload}>
                    <Upload className="w-4 h-4" />
                  </CyberButton>
                  <CyberButton variant="icon">
                    <Mic className="w-4 h-4" />
                  </CyberButton>
                </div>
              </div>
              
              {/* File attachments */}
              {attachedFiles.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {attachedFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 bg-white/10 rounded px-2 py-1">
                      <span className="text-sm">{file.name}</span>
                      <button onClick={() => removeFile(index)}>
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <ChatContainer
                chatHeight={resize.chatHeight}
                scrollTop={chat.scrollTop}
                setScrollTop={chat.setScrollTop}
                messages={chat.messages}
                scrollerRef={chat.scrollerRef}
              />
              
              <ChatInput
                input={chat.input}
                setInput={chat.setInput}
                onSend={onSend}
                onRandomize={onRandomize}
                disabled={generation.busy}
              />
            </CyberCard>
          </div>
          
          {/* Right: Results */}
          <div className="space-y-6">
            {generation.busy ? (
              <GenerationProgress
                busy={generation.busy}
                generationProgress={generation.generationProgress}
              />
            ) : generation.versions.length > 0 ? (
              <TrackList
                versions={generation.versions}
                currentAudioIndex={audioPlayer.currentAudioIndex}
                isPlaying={audioPlayer.isPlaying}
                currentTime={audioPlayer.currentTime}
                details={details}
                albumCovers={generation.albumCovers}
                onAudioPlay={(index) => audioPlayer.handleAudioPlay(index, generation.busy)}
                onAudioPause={audioPlayer.handleAudioPause}
                onTimeUpdate={audioPlayer.handleTimeUpdate}
                onSeek={audioPlayer.handleSeek}
                onShowFullscreen={() => setShowFullscreenKaraoke(true)}
                audioRefs={audioPlayer.audioRefs}
              />
            ) : (
              <CyberCard className="p-8 text-center">
                <h3 className="text-xl font-semibold text-white mb-4">Ready to Create</h3>
                <p className="text-gray-400 mb-6">
                  Add lyrics and style details, then click Generate Song to create your music.
                </p>
                <div className="flex justify-center">
                  <CyberButton onClick={onGenerate} disabled={!canGenerate}>
                    Generate Song
                  </CyberButton>
                </div>
              </CyberCard>
            )}
          </div>
        </ResizableContainer>
      </main>
      
      {/* Fullscreen Karaoke */}
      {showFullscreenKaraoke && generation.versions.length > 0 && (
        <FullscreenKaraoke
          words={generation.versions[audioPlayer.currentAudioIndex]?.words || []}
          currentTime={audioPlayer.currentTime}
          isPlaying={audioPlayer.isPlaying}
          onClose={() => setShowFullscreenKaraoke(false)}
          albumCoverUrl={generation.albumCovers?.cover1}
        />
      )}
      
      {/* Karaoke Right Panel */}
      {generation.versions.length > 0 && generation.versions[audioPlayer.currentAudioIndex]?.hasTimestamps && (
        <KaraokeRightPanel
          versions={generation.versions}
          currentAudioIndex={audioPlayer.currentAudioIndex}
          currentTime={audioPlayer.currentTime}
          isPlaying={audioPlayer.isPlaying}
          albumCovers={generation.albumCovers}
          isGeneratingCovers={generation.isGeneratingCovers}
          audioRefs={audioPlayer.audioRefs}
          onPlayPause={(index) => audioPlayer.handleAudioPlay(index, generation.busy)}
          onAudioPause={audioPlayer.handleAudioPause}
          onFullscreenKaraoke={() => setShowFullscreenKaraoke(true)}
          onSeek={audioPlayer.handleSeek}
        />
      )}
    </div>
  );
};

export default Index;