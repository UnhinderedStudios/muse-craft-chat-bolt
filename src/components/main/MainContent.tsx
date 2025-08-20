import { useState } from "react";
import { SongDetailsForm } from "@/components/song/SongDetailsForm";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { ResizableContainer } from "@/components/layout/ResizableContainer";
import { TemplateGrid } from "@/components/templates/TemplateGrid";
import { TrackListView } from "@/components/track/TrackListView";
import { type SongDetails, type ChatMessage } from "@/types";

interface MainContentProps {
  details: SongDetails;
  setDetails: (details: SongDetails) => void;
  styleTags: string[];
  onStyleTagsChange: (tags: string[]) => void;
  messages: ChatMessage[];
  input: string;
  setInput: (input: string) => void;
  onSend: () => void;
  busy: boolean;
  isAnalyzingImage: boolean;
  isReadingText: boolean;
  attachedFiles: any[];
  onFileUpload: () => void;
  removeFile: (index: number) => void;
  onRandomize: () => void;
  onGenerate: () => void;
  canGenerate: boolean;
  chatHeight: number;
  onMouseDown: (e: React.MouseEvent) => void;
  isResizing: boolean;
  versions: any[];
  onAudioPlay: (index: number) => void;
  currentAudioIndex: number;
  isPlaying: boolean;
  currentTime: number;
  onSeek: (time: number) => void;
  onAudioPause: () => void;
  audioRefs: React.MutableRefObject<HTMLAudioElement[]>;
  onTimeUpdate: (audio: HTMLAudioElement) => void;
  showFullscreenKaraoke: boolean;
  setShowFullscreenKaraoke: (show: boolean) => void;
  albumCovers: any;
  isGeneratingCovers: boolean;
  onGenerateCovers: () => void;
  generationProgress: number;
}

export function MainContent({
  details,
  setDetails,
  styleTags,
  onStyleTagsChange,
  messages,
  input,
  setInput,
  onSend,
  busy,
  isAnalyzingImage,
  isReadingText,
  attachedFiles,
  onFileUpload,
  removeFile,
  onRandomize,
  onGenerate,
  canGenerate,
  chatHeight,
  onMouseDown,
  isResizing,
  versions,
  onAudioPlay,
  currentAudioIndex,
  isPlaying,
  currentTime,
  onSeek,
  onAudioPause,
  audioRefs,
  onTimeUpdate,
  showFullscreenKaraoke,
  setShowFullscreenKaraoke,
  albumCovers,
  isGeneratingCovers,
  onGenerateCovers,
  generationProgress,
}: MainContentProps) {
  const [selectedView, setSelectedView] = useState<"grid" | "list">("grid");

  return (
    <main className="flex-1 p-6 bg-background/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto">
        {/* Main Grid Layout */}
        <div className="grid grid-cols-[500px_1fr_351px] gap-6 h-full">
          {/* Left: Song Details Form */}
          <div className="min-h-0">
            <SongDetailsForm
              details={details}
              setDetails={setDetails}
              styleTags={styleTags}
              onStyleTagsChange={onStyleTagsChange}
              onRandomize={onRandomize}
              onGenerate={onGenerate}
              canGenerate={canGenerate}
              busy={busy}
              generationProgress={generationProgress}
            />
          </div>

          {/* Center: Resizable Chat Container */}
          <div className="min-h-0">
            <ResizableContainer
              chatHeight={chatHeight}
              onMouseDown={onMouseDown}
              isResizing={isResizing}
            >
              <ChatContainer
                messages={messages}
                input={input}
                setInput={setInput}
                onSend={onSend}
                busy={busy}
                isAnalyzingImage={isAnalyzingImage}
                isReadingText={isReadingText}
                attachedFiles={attachedFiles}
                onFileUpload={onFileUpload}
                removeFile={removeFile}
                chatHeight={chatHeight}
              />
            </ResizableContainer>
          </div>

          {/* Right: Template Grid or Track List */}
          <div className="min-h-0">
            {versions.length > 0 ? (
              <TrackListView
                versions={versions}
                onAudioPlay={onAudioPlay}
                currentAudioIndex={currentAudioIndex}
                isPlaying={isPlaying}
                currentTime={currentTime}
                onSeek={onSeek}
                onAudioPause={onAudioPause}
                audioRefs={audioRefs}
                onTimeUpdate={onTimeUpdate}
                showFullscreenKaraoke={showFullscreenKaraoke}
                setShowFullscreenKaraoke={setShowFullscreenKaraoke}
                selectedView={selectedView}
                setSelectedView={setSelectedView}
              />
            ) : (
              <TemplateGrid
                albumCovers={albumCovers}
                isGeneratingCovers={isGeneratingCovers}
                onGenerateCovers={onGenerateCovers}
                busy={busy}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}