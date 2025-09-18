import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { TrackItem } from "@/types";
import { ChevronUp, ChevronDown, X, ImageIcon, Wand2, Repeat, Check, Download } from "lucide-react";
import { useSessionManager } from "@/hooks/use-session-manager";

interface QuickAlbumCoverGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  track: TrackItem | null;
}

export const QuickAlbumCoverGenerator: React.FC<QuickAlbumCoverGeneratorProps> = ({ isOpen, onClose, track }) => {
  const { toast } = useToast();
  const { currentSession, updateSession } = useSessionManager();

  const [images, setImages] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [offset, setOffset] = useState(0); // thumbnail scroll offset
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const VISIBLE_COUNT = 5;

  useEffect(() => {
    console.log("🎯 QuickAlbumCoverGenerator opened:", { isOpen, track: track?.title, trackId: track?.id });
    if (isOpen && track) {
      // Load all previously generated covers for this track (newest first)
      const existingCovers = track.generatedCovers || [];
      const initial: string[] = [...existingCovers];
      
      // Add current cover if it exists and not already in generated covers
      if (track.coverUrl && !initial.includes(track.coverUrl)) {
        initial.push(track.coverUrl);
      }
      
      console.log("📸 Setting up initial images:", initial);
      setImages(initial);
      setSelectedIndex(0);
      setOffset(0);
      setPrompt("");
    }
  }, [isOpen, track]);

  const canScrollUp = offset > 0;
  const totalThumbs = loading ? images.length + 1 : images.length;
  const canScrollDown = totalThumbs > offset + VISIBLE_COUNT;

  const displayThumbs = useMemo<(string | null)[]>(() => {
    const list: (string | null)[] = loading ? [null, ...images] : [...images];
    return list.slice(offset, offset + VISIBLE_COUNT);
  }, [loading, images, offset]);

  const handleGenerate = async () => {
    console.log("🚀 Generate button clicked, prompt:", prompt.trim());
    if (!prompt.trim()) {
      console.log("❌ Empty prompt, showing toast");
      toast({ title: "Enter a prompt", description: "Type what you want to see on the album cover." });
      return;
    }
    try {
      setLoading(true);
      console.log("🎨 Starting generation with prompt:", prompt.trim());
      
      const newImages = await api.generateAlbumCoversByPrompt(prompt.trim(), 1);
      console.log("🖼️ Generation response:", newImages);
      
      if (!newImages || newImages.length === 0) {
        console.error("❌ No images returned from API");
        toast({ title: "No images returned", description: "Try a different prompt.", variant: "destructive" });
        return;
      }
      
      console.log("✅ Generated", newImages.length, "images, updating state");
      
      // Add new images to the front (newest first)
      const updatedImages = [...newImages, ...images];
      setImages(updatedImages);
      
      // Update track's generated covers in session
      if (track && currentSession) {
        const updatedTracks = (currentSession.tracks || []).map(t =>
          t.id === track.id ? { 
            ...t, 
            generatedCovers: updatedImages
          } : t
        );
        updateSession(currentSession.id, { tracks: updatedTracks });
      }
      
      setSelectedIndex(0); // Select the newest generated image
      toast({ title: "Generated", description: `${newImages.length} cover${newImages.length > 1 ? 's' : ''} added` });
    } catch (e: any) {
      console.error("[Covers] Generate error", e);
      toast({ title: "Generation failed", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      console.log("🔄 Setting loading to false");
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    if (!track) return;
    try {
      setLoading(true);
      
      // Generate the same prompt that would be sent to ChatGPT for this track
      let chatInstruction = "";
      
      if (track.title?.trim()) {
        chatInstruction = `Create a simple 1 sentence prompt for an image generation tool for a musical album cover based on this song title. Keep it cinematic and realistic, do not show humans or text in it. Do not use any parameter instructions such as AR16:9.\n\nSong Title: ${track.title.trim()}`;
      } else if (Array.isArray(track.params) && track.params.length > 0) {
        const style = track.params.join(", ");
        chatInstruction = `Create a simple 1 sentence prompt for an image generation tool for a musical album cover based on this music style. Keep it cinematic and realistic, do not show humans or text in it. Do not use any parameter instructions such as AR16:9.\n\nMusic Style: ${style}`;
      }
      
      // Get the album cover prompt from ChatGPT to show in input field
      if (chatInstruction) {
        const promptResponse = await api.chat([{
          role: "user",
          content: chatInstruction
        }]);
        setPrompt(promptResponse.content);
      }
      
      const details = {
        title: track.title || undefined,
        style: Array.isArray(track.params) ? track.params.join(", ") : undefined,
      };
      const result = await api.generateAlbumCovers(details);
      const covers: string[] = [];
      if (result.cover1) covers.push(result.cover1);
      if (covers.length === 0) {
        toast({ title: "No covers returned", description: "Try again in a moment.", variant: "destructive" });
        return;
      }
      
      // Add new covers to the front (newest first)
      const updatedImages = [...covers, ...images];
      setImages(updatedImages);
      
      // Update track's generated covers in session
      if (track && currentSession) {
        const updatedTracks = (currentSession.tracks || []).map(t =>
          t.id === track.id ? { 
            ...t, 
            generatedCovers: updatedImages
          } : t
        );
        updateSession(currentSession.id, { tracks: updatedTracks });
      }
      
      setSelectedIndex(0); // Select the newest generated image
      toast({ title: "Regenerated", description: "1 new cover added" });
    } catch (e: any) {
      console.error("[Covers] Retry error", e);
      toast({ title: "Retry failed", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!track || !currentSession) return;
    const selected = images[selectedIndex];
    if (!selected) {
      toast({ title: "Select an image", description: "Pick a thumbnail to apply as cover.", variant: "destructive" });
      return;
    }

    const updatedTracks = (currentSession.tracks || []).map(t =>
      t.id === track.id ? { 
        ...t, 
        coverUrl: selected,
        // Update the generated covers array to put the selected cover first
        generatedCovers: selected ? [selected, ...(t.generatedCovers || []).filter(c => c !== selected)] : t.generatedCovers
      } : t
    );
    updateSession(currentSession.id, { tracks: updatedTracks });
    toast({ title: "Cover applied", description: `Updated cover for "${track.title || 'Song'}"` });
    onClose();
  };

  const handleDownload = () => {
    if (!images[selectedIndex]) {
      toast({ title: "No image to download", description: "Select an image first.", variant: "destructive" });
      return;
    }
    
    const link = document.createElement('a');
    link.href = images[selectedIndex];
    link.download = `album-cover-${track?.title || 'untitled'}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Downloaded", description: "Album cover saved to your device" });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-none w-full h-full bg-black/10 backdrop-blur border-0 p-0 flex flex-col">
        {/* Accessible title/description for Radix Dialog */}
        <DialogTitle className="sr-only">Quick Album Cover Generator</DialogTitle>
        <DialogDescription className="sr-only">Generate and select album covers for the current track.</DialogDescription>
        <div className="relative w-full h-full flex flex-col">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-50 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Content */}
          <div className="flex-1 min-h-0 px-6 pb-6 flex items-center justify-center">
            <div className="h-full w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 items-center">
              {/* Left: Preview + Thumbnails (side-by-side) */}
              <div className="flex items-start justify-end gap-6">
                {/* Thumbnails column (left) */}
                <div className="flex flex-col items-center gap-2 w-20">
                  {/* Top arrow */}
                  <button
                    className={cn(
                      "w-8 h-8 flex items-center justify-center rounded-full transition-opacity",
                      canScrollUp ? "opacity-100 hover:bg-white/10" : "opacity-30 pointer-events-none"
                    )}
                    onClick={() => canScrollUp && setOffset(o => Math.max(0, o - 1))}
                    aria-label="Scroll thumbnails up"
                  >
                    <ChevronUp className="w-5 h-5 text-white" />
                  </button>

                  {/* Thumbs */}
                  <div className="flex flex-col items-center gap-2">
                    {Array.from({ length: VISIBLE_COUNT }).map((_, i) => {
                      const img = displayThumbs[i];
                      const idx = offset + i; // position within display list
                      const imageIndexInImages = loading ? idx - 1 : idx;
                      const isPlaceholder = img == null;
                      const isActive = !isPlaceholder && imageIndexInImages === selectedIndex;
                      return (
                        <button
                          key={idx}
                          className={cn(
                            "w-20 h-20 rounded-lg overflow-hidden border transition-all relative",
                            isActive ? "border-accent-primary ring-2 ring-accent-primary/40" : "border-white/10 hover:border-white/20"
                          )}
                          onClick={() => {
                            if (!isPlaceholder && imageIndexInImages >= 0) setSelectedIndex(imageIndexInImages);
                          }}
                          aria-label={`Thumbnail ${idx + 1}`}
                        >
                          {img ? (
                            <img src={img} alt={`Thumbnail ${idx + 1}`} className="block w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-white/5" />
                          )}
                          {/* Loading scan only on first placeholder */}
                          {loading && idx === 0 && isPlaceholder && (
                            <div className="absolute inset-0 overflow-hidden rounded-lg">
                              <div className="w-full h-full bg-gradient-to-r from-transparent via-white/15 to-transparent animate-scanning" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Bottom arrow */}
                  <button
                    className={cn(
                      "w-8 h-8 flex items-center justify-center rounded-full transition-opacity",
                      canScrollDown ? "opacity-100 hover:bg-white/10" : "opacity-30 pointer-events-none"
                    )}
                    onClick={() => canScrollDown && setOffset(o => o + 1)}
                    aria-label="Scroll thumbnails down"
                  >
                    <ChevronDown className="w-5 h-5 text-white" />
                  </button>
                </div>

                {/* Large Preview (right) */}
                <div
                  className="rounded-xl overflow-hidden border border-white/10 flex items-center justify-center relative"
                  style={{ width: "min(520px, 60vh)", height: "min(520px, 60vh)", backgroundColor: '#33343630' }}
                >
                  {!loading && images[selectedIndex] ? (
                    <img
                      src={images[selectedIndex]}
                      alt={`Selected album cover ${selectedIndex + 1}`}
                      className="block w-full h-full object-cover"
                      loading="eager"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-white/40">
                      {loading ? (
                        <div className="loader overlay-loader">
                          <div className="bar"></div>
                          <div className="bar"></div>
                          <div className="bar"></div>
                        </div>
                      ) : (
                        <>
                          <ImageIcon className="w-10 h-10 mb-2" />
                          <span>No image selected</span>
                        </>
                      )}
                    </div>
                  )}
                  {/* Loading animation on main preview when generating */}
                  {loading && (
                    <div className="absolute inset-0 overflow-hidden rounded-xl">
                      <div className="w-full h-full bg-gradient-to-r from-transparent via-white/15 to-transparent animate-scanning" />
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Prompt Controls */}
              <aside 
                className="flex flex-col rounded-xl border border-white/10 p-4"
                style={{ height: "min(520px, 60vh)", backgroundColor: '#33343630' }}
              >
                <header className="mb-4">
                  <h3 className="text-white font-medium">Custom Cover via Gemini</h3>
                  <p className="text-white/50 text-sm">Describe your cover. We'll generate images using Gemini.</p>
                </header>

                <div className="flex-1 mb-4 relative">
                  {loading ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="relative">
                        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                        <div className="absolute inset-0 w-8 h-8 border-2 border-transparent border-t-white/60 rounded-full animate-spin" style={{animationDuration: '1.5s'}}></div>
                        <div className="absolute inset-0 w-8 h-8 rounded-full bg-white/10 animate-pulse"></div>
                      </div>
                    </div>
                  ) : (
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="e.g., Neon-lit city skyline with rain reflections, moody cinematic, no people, no text"
                      className="w-full h-full resize-none rounded-lg bg-black/40 border border-white/10 text-white placeholder:text-white/40 p-3 focus:outline-none focus:ring-1 focus:ring-white/20"
                    />
                  )}
                </div>

                <div className="grid grid-cols-4 gap-1">
                  <Button
                    variant="secondary"
                    onClick={handleGenerate}
                    disabled={loading}
                    className="col-span-1 text-xs px-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:from-pink-600 hover:to-purple-700 border-0"
                  >
                    <Wand2 className="w-3 h-3 mr-1" /> Generate
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleRetry}
                    disabled={loading}
                    className="col-span-1 text-xs px-2 bg-[#202020] text-gray-300 hover:bg-[#2a2a2a] border-white/10"
                  >
                    <Repeat className="w-3 h-3 mr-1" /> Retry
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleDownload}
                    disabled={loading}
                    className="col-span-1 text-xs px-2 bg-[#202020] text-gray-300 hover:bg-[#2a2a2a] border-white/10"
                  >
                    <Download className="w-3 h-3 mr-1" /> Download
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleApply}
                    disabled={loading}
                    className="col-span-1 text-xs px-2 bg-[#202020] text-gray-300 hover:bg-[#2a2a2a] border-white/10"
                  >
                    <Check className="w-3 h-3 mr-1" /> Apply
                  </Button>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuickAlbumCoverGenerator;
