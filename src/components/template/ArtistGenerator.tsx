import React, { useState, useEffect, useMemo } from "react";
import { X, Download, User, Sparkles, RotateCw } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSessionManager } from "@/hooks/use-session-manager";
import { TrackItem } from "@/types";
import { toast } from "sonner";

interface ArtistGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  track: TrackItem | null;
}

export function ArtistGenerator({ isOpen, onClose, track }: ArtistGeneratorProps) {
  const [images, setImages] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  
  const { updateSession, currentSessionId, currentSession } = useSessionManager();

  // Load any existing artist images when modal opens
  useEffect(() => {
    if (isOpen && track) {
      const existingImages: string[] = [];
      
      // Add current cover image as placeholder artist image
      if (track.coverUrl) {
        existingImages.push(track.coverUrl);
      }
      
      setImages(existingImages);
      setSelectedIndex(0);
      setScrollOffset(0);
      setPrompt("");
    }
  }, [isOpen, track]);

  const displayThumbs = useMemo(() => {
    return images;
  }, [images]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt to generate artist images");
      return;
    }

    setLoading(true);
    try {
      // TODO: Replace with actual AI image generation API call
      console.log("Generating artist image with prompt:", prompt);
      
      // Simulated generation - in real implementation, call your AI service
      const mockGeneratedImages = [
        "/placeholder.svg", // Replace with actual generated image URLs
      ];
      
      const newImages = [...images, ...mockGeneratedImages];
      setImages(newImages);
      setSelectedIndex(newImages.length - 1);
      
      toast.success("Artist image generated successfully!");
    } catch (error) {
      console.error("Error generating artist image:", error);
      toast.error("Failed to generate artist image");
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    if (!track) return;
    
    const retryPrompt = `Create a portrait of an AI music artist for the song "${track.title || 'Untitled'}"${track.params?.length ? ` in ${track.params.join(', ')} style` : ''}. Professional, artistic, and engaging.`;
    setPrompt(retryPrompt);
    
    setLoading(true);
    try {
      // TODO: Replace with actual AI image generation API call
      console.log("Retrying artist generation with prompt:", retryPrompt);
      
      // Simulated generation
      const mockRetryImages = ["/placeholder.svg"];
      const newImages = [...images, ...mockRetryImages];
      setImages(newImages);
      setSelectedIndex(newImages.length - 1);
      
      toast.success("Artist image regenerated!");
    } catch (error) {
      console.error("Error regenerating artist image:", error);
      toast.error("Failed to regenerate artist image");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!track || !images[selectedIndex] || !currentSession) return;
    
    const selectedImage = images[selectedIndex];
    // Update the track by adding the artist image to generatedCovers array
    const updatedTracks = currentSession.tracks.map(t => 
      t.id === track.id 
        ? { ...t, generatedCovers: [selectedImage, ...(t.generatedCovers || [])] }
        : t
    );
    
    updateSession(currentSession.id, { tracks: updatedTracks });
    toast.success("Artist image applied successfully!");
    onClose();
  };

  const handleDownload = () => {
    if (!images[selectedIndex]) return;
    
    try {
      const link = document.createElement('a');
      link.href = images[selectedIndex];
      link.download = `artist-${track?.title || 'untitled'}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Artist image downloaded!");
    } catch (error) {
      console.error("Error downloading image:", error);
      toast.error("Failed to download image");
    }
  };

  if (!isOpen || !track) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[80vw] xl:w-[1200px] max-w-[1400px] h-[90vh] max-h-[900px] bg-black/90 border border-white/20 text-white flex flex-col gap-0 p-0">
        <DialogTitle className="sr-only">Artist Generator</DialogTitle>
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Artist Generator</h2>
              <p className="text-sm text-white/60">Generate artist portraits for "{track.title || 'Untitled'}"</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white/60 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          {/* Left Panel - Preview */}
          <div className="flex-1 flex flex-col bg-gradient-to-br from-purple-900/20 to-pink-900/20 p-6">
            <div className="flex-1 flex items-center justify-center">
              <div className="w-full max-w-md aspect-square rounded-2xl overflow-hidden bg-white/5 border border-white/10 shadow-2xl">
                {images.length > 0 ? (
                  <img
                    src={images[selectedIndex]}
                    alt="Generated artist"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = "/placeholder.svg";
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-white/40">
                    <User className="w-16 h-16 mb-4" />
                    <p className="text-lg font-medium">No artist image yet</p>
                    <p className="text-sm">Generate one to get started</p>
                  </div>
                )}
              </div>
            </div>

            {/* Thumbnail Carousel */}
            {displayThumbs.length > 1 && (
              <div className="mt-6">
                <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                  {displayThumbs.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedIndex(index)}
                      className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                        selectedIndex === index
                          ? "border-purple-400 shadow-lg shadow-purple-400/25"
                          : "border-white/20 hover:border-white/40"
                      }`}
                    >
                      <img
                        src={image}
                        alt={`Artist ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = "/placeholder.svg";
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Controls */}
          <div className="w-full lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-white/10 bg-black/40 flex flex-col">
            {/* Prompt Input */}
            <div className="p-6 border-b border-white/10">
              <label className="block text-sm font-medium mb-3 text-white/80">
                Describe the artist portrait you want:
              </label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., A futuristic cyberpunk musician with neon accents, professional studio portrait..."
                className="w-full h-32 bg-white/5 border-white/20 text-white placeholder:text-white/40 resize-none focus-visible:ring-1 focus-visible:ring-purple-400 focus-visible:border-purple-400"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex-1 p-6 flex flex-col gap-4">
              <Button
                onClick={handleGenerate}
                disabled={loading || !prompt.trim()}
                className="w-full h-12 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="relative">
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                      <div className="absolute inset-0 w-5 h-5 border-2 border-transparent border-t-white/60 rounded-full animate-spin" style={{animationDuration: '1.5s'}}></div>
                    </div>
                  </div>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate
                  </>
                )}
              </Button>

              <Button
                onClick={handleRetry}
                disabled={loading}
                variant="outline"
                className="w-full h-10 border-white/20 text-white hover:bg-white/5"
              >
                <RotateCw className="w-4 h-4 mr-2" />
                Retry
              </Button>

              {images.length > 0 && (
                <>
                  <div className="border-t border-white/10 pt-4 mt-2">
                    <Button
                      onClick={handleDownload}
                      variant="outline"
                      className="w-full h-10 border-white/20 text-white hover:bg-white/5 mb-2"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                    
                    <Button
                      onClick={handleApply}
                      className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-medium"
                    >
                      Apply as Artist Image
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}