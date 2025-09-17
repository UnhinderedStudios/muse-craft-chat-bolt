import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { TrackItem } from "@/types";
import { ChevronUp, ChevronDown, X, ImageIcon, Send, Repeat, Check } from "lucide-react";
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
  const [retryLoading, setRetryLoading] = useState(false);

  const VISIBLE_COUNT = 5;

  useEffect(() => {
    if (isOpen) {
      const initial: string[] = [];
      if (track?.coverUrl) initial.push(track.coverUrl);
      setImages(initial);
      setSelectedIndex(0);
      setOffset(0);
      setPrompt("");
    }
  }, [isOpen, track]);

  const canScrollUp = offset > 0;
  const canScrollDown = images.length > offset + VISIBLE_COUNT;

  const visibleThumbs = useMemo(() => images.slice(offset, offset + VISIBLE_COUNT), [images, offset]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({ title: "Enter a prompt", description: "Type what you want to see on the album cover." });
      return;
    }
    try {
      setLoading(true);
      const newImages = await api.generateAlbumCoversByPrompt(prompt.trim(), 1);
      if (!newImages || newImages.length === 0) {
        toast({ title: "No images returned", description: "Try a different prompt.", variant: "destructive" });
        return;
      }
      setImages(prev => [...prev, ...newImages]);
      if (images.length === 0 && newImages.length > 0) setSelectedIndex(0);
      toast({ title: "Generated", description: `${newImages.length} cover${newImages.length > 1 ? 's' : ''} added` });
    } catch (e: any) {
      console.error("[Covers] Generate error", e);
      toast({ title: "Generation failed", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    if (!track) return;
    try {
      setRetryLoading(true);
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
      setImages(prev => [...prev, ...covers]);
      toast({ title: "Regenerated", description: "1 new cover added" });
    } catch (e: any) {
      console.error("[Covers] Retry error", e);
      toast({ title: "Retry failed", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setRetryLoading(false);
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
      t.id === track.id ? { ...t, coverUrl: selected } : t
    );
    updateSession(currentSession.id, { tracks: updatedTracks });
    toast({ title: "Cover applied", description: `Updated cover for "${track.title || 'Song'}"` });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-none w-full h-full bg-black/10 backdrop-blur border-0 p-0 flex flex-col">
        <div className="relative w-full h-full flex flex-col">
          {/* Custom X button */}
          <button
            className="absolute top-6 right-6 z-10 w-8 h-8 flex items-center justify-center text-white/60 hover:text-white transition-colors rounded-full hover:bg-white/10"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Content */}
          <div className="flex-1 min-h-0 px-6 pb-6 flex items-center justify-center">
            <div className="h-full w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 items-center">
              {/* Left: Preview + Thumbnails (side-by-side) */}
              <div className="flex items-start justify-center gap-6">
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
                      const img = visibleThumbs[i];
                      const idx = offset + i;
                      const isActive = idx === selectedIndex;
                      return (
                        <button
                          key={idx}
                          className={cn(
                            "w-20 h-20 rounded-lg overflow-hidden border transition-all",
                            isActive ? "border-accent-primary ring-2 ring-accent-primary/40" : "border-white/10 hover:border-white/20"
                          )}
                          onClick={() => img && setSelectedIndex(idx)}
                          aria-label={`Thumbnail ${idx + 1}`}
                        >
                          {img ? (
                            <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-white/5" />
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
                  className="rounded-xl overflow-hidden bg-white/10 border border-white/10 flex items-center justify-center"
                  style={{ width: "min(520px, 60vh)", height: "min(520px, 60vh)" }}
                >
                  {images[selectedIndex] ? (
                    <img
                      src={images[selectedIndex]}
                      alt={`Selected album cover ${selectedIndex + 1}`}
                      className="w-full h-full object-cover"
                      loading="eager"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-white/40">
                      <ImageIcon className="w-10 h-10 mb-2" />
                      <span>No image selected</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Prompt Controls */}
              <aside className="flex flex-col rounded-xl border border-white/10 bg-black/30 p-4">
                <header className="mb-4">
                  <h3 className="text-white font-medium">Custom Cover via Gemini</h3>
                  <p className="text-white/50 text-sm">Describe your cover. We'll generate images using Gemini.</p>
                </header>

                <div className="mb-4">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., Neon-lit city skyline with rain reflections, moody cinematic, no people, no text"
                    className="w-full h-32 resize-none rounded-lg bg-black/40 border border-white/10 text-white placeholder:text-white/40 p-3 focus:outline-none focus:ring-1 focus:ring-white/20"
                  />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Button
                    onClick={handleGenerate}
                    disabled={loading}
                    className="col-span-1 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white"
                  >
                    <Send className="w-4 h-4 mr-2" /> Generate
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleRetry}
                    disabled={retryLoading}
                    className="col-span-1"
                  >
                    <Repeat className="w-4 h-4 mr-2" /> Retry
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleApply}
                    className="col-span-1 border-accent-primary text-white hover:bg-white/10"
                  >
                    <Check className="w-4 h-4 mr-2" /> Apply
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
