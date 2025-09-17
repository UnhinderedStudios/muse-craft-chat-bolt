import React, { useState, useEffect } from "react";
import { X, ChevronUp, ChevronDown, Loader2, Sparkles, RotateCcw, Check, Send } from "lucide-react";
import { Dialog, DialogContent, DialogOverlay } from "@/components/ui/dialog";
import { CyberButton } from "@/components/cyber/CyberButton";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { cn } from "@/lib/utils";
import { api, type SongDetails } from "@/lib/api";
import { toast } from "sonner";

interface AlbumCoverGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  songDetails?: SongDetails;
  currentCover?: string;
  onApply: (coverUrl: string) => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const AlbumCoverGenerator: React.FC<AlbumCoverGeneratorProps> = ({
  isOpen,
  onClose,
  songDetails,
  currentCover,
  onApply
}) => {
  const [generatedCovers, setGeneratedCovers] = useState<string[]>([]);
  const [selectedCoverIndex, setSelectedCoverIndex] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hi! I can help you create custom album covers. Describe the style, mood, or visual elements you'd like to see, and I'll generate them for you."
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [scrollPosition, setScrollPosition] = useState(0);

  // Initialize with current cover if available
  useEffect(() => {
    if (isOpen && currentCover && generatedCovers.length === 0) {
      setGeneratedCovers([currentCover]);
      setSelectedCoverIndex(0);
    }
  }, [isOpen, currentCover, generatedCovers.length]);

  const handleGenerate = async () => {
    if (!inputValue.trim()) return;

    setIsGenerating(true);
    const userMessage: ChatMessage = { role: "user", content: inputValue };
    setChatMessages(prev => [...prev, userMessage]);
    setInputValue("");

    try {
      const response = await fetch("https://afsyxzxwxszujnsmukff.supabase.co/functions/v1/generate-album-cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: inputValue,
          model: "gemini-1.5-flash",
          aspectRatio: "1:1"
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.imageUrl) {
        const newCovers = [...generatedCovers, data.imageUrl];
        setGeneratedCovers(newCovers);
        setSelectedCoverIndex(newCovers.length - 1);
        
        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: "Great! I've generated a new album cover for you. You can see it in the preview and select it to apply to your song."
        };
        setChatMessages(prev => [...prev, assistantMessage]);
        toast.success("Album cover generated successfully!");
      } else {
        throw new Error("No image was generated");
      }
    } catch (error) {
      console.error("Error generating album cover:", error);
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: "Sorry, I couldn't generate that album cover. Please try again with a different description."
      };
      setChatMessages(prev => [...prev, errorMessage]);
      toast.error("Failed to generate album cover");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRetry = async () => {
    if (!songDetails) return;

    setIsRetrying(true);
    
    try {
      const covers = await api.generateAlbumCovers(songDetails);
      const newCovers = [covers.cover1, covers.cover2].filter(Boolean);
      
      if (newCovers.length > 0) {
        const updatedCovers = [...generatedCovers, ...newCovers];
        setGeneratedCovers(updatedCovers);
        setSelectedCoverIndex(updatedCovers.length - newCovers.length);
        
        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: "I've regenerated album covers based on your song's style and lyrics. Check out the new options!"
        };
        setChatMessages(prev => [...prev, assistantMessage]);
        toast.success("Album covers regenerated!");
      }
    } catch (error) {
      console.error("Error retrying album cover generation:", error);
      toast.error("Failed to regenerate album covers");
    } finally {
      setIsRetrying(false);
    }
  };

  const handleApply = () => {
    if (generatedCovers[selectedCoverIndex]) {
      onApply(generatedCovers[selectedCoverIndex]);
      toast.success("Album cover applied!");
      onClose();
    }
  };

  const navigateUp = () => {
    if (scrollPosition > 0) {
      setScrollPosition(scrollPosition - 1);
    }
  };

  const navigateDown = () => {
    if (scrollPosition < generatedCovers.length - 5) {
      setScrollPosition(scrollPosition + 1);
    }
  };

  const visibleCovers = generatedCovers.slice(scrollPosition, scrollPosition + 5);
  const canNavigateUp = scrollPosition > 0;
  const canNavigateDown = scrollPosition < generatedCovers.length - 5;
  const hasEnoughCovers = generatedCovers.length >= 3;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogOverlay className="bg-black/80" />
      <DialogContent className="max-w-6xl h-[700px] bg-[#0a0a0a] border border-border-main p-0 overflow-hidden">
        <div className="flex h-full">
          {/* Left Section - Image Preview and Placeholders */}
          <div className="w-[400px] p-6 border-r border-border-main flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-text-primary">Album Cover Generator</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Main Preview - Large Image */}
            <div className="mb-6">
              <div className="aspect-square w-[350px] bg-card-alt rounded-lg overflow-hidden border border-border-main">
                {generatedCovers[selectedCoverIndex] ? (
                  <img
                    src={generatedCovers[selectedCoverIndex]}
                    alt="Album cover preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-text-secondary">
                    <div className="text-center">
                      <Sparkles className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No covers generated yet</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Navigation Arrows - Above Placeholders */}
            <div className="flex justify-start mb-2">
              <div className="flex flex-col gap-1">
                <button
                  onClick={navigateUp}
                  className={cn(
                    "w-6 h-6 rounded flex items-center justify-center transition-all",
                    hasEnoughCovers && canNavigateUp
                      ? "text-text-primary hover:bg-card-alt opacity-100" 
                      : "text-text-secondary opacity-30 cursor-not-allowed"
                  )}
                  disabled={!canNavigateUp || !hasEnoughCovers}
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  onClick={navigateDown}
                  className={cn(
                    "w-6 h-6 rounded flex items-center justify-center transition-all",
                    hasEnoughCovers && canNavigateDown
                      ? "text-text-primary hover:bg-card-alt opacity-100" 
                      : "text-text-secondary opacity-30 cursor-not-allowed"
                  )}
                  disabled={!canNavigateDown || !hasEnoughCovers}
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Thumbnail Placeholders - Vertically underneath, left-aligned */}
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, index) => {
                const coverIndex = scrollPosition + index;
                const isSelected = selectedCoverIndex === coverIndex;
                const hasCover = generatedCovers[coverIndex];
                
                return (
                  <button
                    key={index}
                    onClick={() => hasCover && setSelectedCoverIndex(coverIndex)}
                    className={cn(
                      "w-16 h-16 rounded-lg border transition-all",
                      isSelected && hasCover
                        ? "border-accent-primary shadow-[0_0_12px_rgba(202,36,116,0.4)]"
                        : "border-border-main hover:border-accent-primary/50",
                      !hasCover && "opacity-30"
                    )}
                  >
                    {hasCover ? (
                      <img
                        src={generatedCovers[coverIndex]}
                        alt={`Album cover option ${coverIndex + 1}`}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-full h-full bg-card-alt rounded-lg flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-dashed border-border-main rounded" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Section - Chat Interface */}
          <div className="flex-1 flex flex-col">
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.map((message, index) => (
                <ChatBubble key={index} role={message.role} content={message.content} />
              ))}
              {isGenerating && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] px-4 py-3 rounded-[16px] bg-card-alt border border-border-main flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-accent-primary" />
                    <span className="text-text-secondary text-sm">Generating your album cover...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="p-4 border-t border-border-main">
              <ChatInput
                value={inputValue}
                onChange={setInputValue}
                onSend={handleGenerate}
                disabled={isGenerating}
                onFileAttach={() => {}}
                attachedFiles={[]}
                onRemoveAttachment={() => {}}
              />
            </div>

            {/* Action Buttons - Three separate buttons */}
            <div className="p-4 border-t border-border-main">
              <div className="flex gap-3">
                <CyberButton
                  variant="secondary"
                  onClick={handleGenerate}
                  disabled={isGenerating || !inputValue.trim()}
                  className="flex-1"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Generate
                    </>
                  )}
                </CyberButton>
                <CyberButton
                  variant="secondary"
                  onClick={handleRetry}
                  disabled={isRetrying || !songDetails}
                  className="flex-1"
                >
                  {isRetrying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4" />
                      Retry
                    </>
                  )}
                </CyberButton>
                <CyberButton
                  variant="primary"
                  onClick={handleApply}
                  disabled={!generatedCovers[selectedCoverIndex]}
                  className="flex-1"
                >
                  <Check className="w-4 h-4" />
                  Apply
                </CyberButton>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};