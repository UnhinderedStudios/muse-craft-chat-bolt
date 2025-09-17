import React, { useState, useEffect } from "react";
import { X, ChevronUp, ChevronDown, Loader2, Sparkles, RotateCcw, Check } from "lucide-react";
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
          aspectRatio: "1:1",
          n: 1
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.images && data.images.length > 0) {
        const newCovers = [...generatedCovers, ...data.images];
        setGeneratedCovers(newCovers);
        setSelectedCoverIndex(newCovers.length - 1); // Select the newly generated cover
        
        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: "Great! I've generated a new album cover for you. You can see it in the preview and select it to apply to your song."
        };
        setChatMessages(prev => [...prev, assistantMessage]);
        toast.success("Album cover generated successfully!");
      } else {
        throw new Error("No images were generated");
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
        setSelectedCoverIndex(updatedCovers.length - newCovers.length); // Select first new cover
        
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

  const canNavigate = generatedCovers.length > 5;
  const visibleCovers = generatedCovers.slice(0, 5);
  const hasMoreCovers = generatedCovers.length > 5;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogOverlay className="bg-black/80" />
      <DialogContent className="max-w-4xl h-[600px] bg-[#0a0a0a] border border-border-main p-0 overflow-hidden">
        <div className="flex h-full">
          {/* Left Section - Image Preview */}
          <div className="flex-1 p-6 border-r border-border-main">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-text-primary">Album Cover Generator</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Main Preview */}
            <div className="mb-6">
              <div className="aspect-square w-full max-w-[300px] mx-auto bg-card-alt rounded-lg overflow-hidden border border-border-main">
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

            {/* Navigation Arrows */}
            <div className="flex justify-center mb-4">
              <div className="flex flex-col gap-2">
                <button
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                    canNavigate 
                      ? "text-text-primary hover:bg-card-alt" 
                      : "text-text-secondary/30 cursor-not-allowed"
                  )}
                  disabled={!canNavigate}
                >
                  <ChevronUp className="w-5 h-5" />
                </button>
                <button
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                    canNavigate 
                      ? "text-text-primary hover:bg-card-alt" 
                      : "text-text-secondary/30 cursor-not-allowed"
                  )}
                  disabled={!canNavigate}
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Thumbnail Grid */}
            <div className="flex flex-col items-center gap-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => visibleCovers[index] && setSelectedCoverIndex(index)}
                  className={cn(
                    "w-16 h-16 rounded-lg border transition-all",
                    selectedCoverIndex === index
                      ? "border-accent-primary shadow-[0_0_12px_rgba(202,36,116,0.4)]"
                      : "border-border-main hover:border-accent-primary/50",
                    !visibleCovers[index] && "opacity-30"
                  )}
                >
                  {visibleCovers[index] ? (
                    <img
                      src={visibleCovers[index]}
                      alt={`Album cover option ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-full h-full bg-card-alt rounded-lg flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-dashed border-border-main rounded" />
                    </div>
                  )}
                </button>
              ))}
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

            {/* Action Buttons */}
            <div className="p-4 border-t border-border-main">
              <div className="flex gap-3">
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