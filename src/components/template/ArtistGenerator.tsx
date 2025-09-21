import React, { useEffect, useMemo, useState, useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { TrackItem } from "@/types";
import { ChevronUp, ChevronDown, X, User, Wand2, Repeat, ArrowRight, Download, Upload, Image as ImageIcon } from "lucide-react";
import { useSessionManager } from "@/hooks/use-session-manager";

interface ArtistGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  track: TrackItem | null;
}

export const ArtistGenerator: React.FC<ArtistGeneratorProps> = ({ isOpen, onClose, track }) => {
  const { toast } = useToast();
  const { currentSession, updateSession } = useSessionManager();

  const [images, setImages] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [offset, setOffset] = useState(0); // thumbnail scroll offset
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referenceImageUrl, setReferenceImageUrl] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const VISIBLE_COUNT = 5;

  useEffect(() => {
    console.log("🎯 ArtistGenerator opened:", { isOpen, track: track?.title, trackId: track?.id });
    if (isOpen && track) {
      // Load all previously generated artist images for this track (newest first)
      const existingCovers = track.generatedCovers || [];
      const initial: string[] = [...existingCovers];
      
      // Add current cover as placeholder if it exists and not already in generated covers
      if (track.coverUrl && !initial.includes(track.coverUrl)) {
        initial.push(track.coverUrl);
      }
      
      console.log("🎨 Setting up initial artist images:", initial);
      setImages(initial);
      setSelectedIndex(0);
      setOffset(0);
      setPrompt("");
      setReferenceImage(null);
      setReferenceImageUrl("");
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
    // Generate unique client request ID for debugging
    const clientReqId = `ui_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    console.log(`🚀 [${clientReqId}] Generate artist button clicked, prompt: "${prompt.trim()}"`);
    console.log(`🖼️ [${clientReqId}] Reference image: ${!!referenceImage}`);
    console.log(`🔄 [${clientReqId}] Track: "${track?.title || 'Unknown'}"`);
    
    if (!prompt.trim()) {
      console.log(`❌ [${clientReqId}] Empty prompt, showing toast`);
      toast({ title: "Enter a prompt", description: "Type what you want to see for the artist portrait." });
      return;
    }
    
    try {
      setLoading(true);
      console.log(`🎨 [${clientReqId}] Starting artist generation - ensuring request independence`);
      
      // Clear any potential cached state
      const cleanPrompt = prompt.trim();
      const cleanReferenceImage = referenceImage || undefined;
      
      console.log(`📤 [${clientReqId}] Sending request:`, {
        prompt: cleanPrompt,
        hasImage: !!cleanReferenceImage,
        imageSize: cleanReferenceImage?.size,
        imageType: cleanReferenceImage?.type
      });
      
      const result = await api.generateArtistImages(cleanPrompt, cleanReferenceImage);
      
      console.log(`🖼️ [${clientReqId}] Artist generation response:`, {
        imageCount: result.images?.length || 0,
        hasEnhancedPrompt: !!result.enhancedPrompt,
        debug: result.debug
      });
      
      if (!result.images || result.images.length === 0) {
        console.error(`❌ [${clientReqId}] No images returned from API`);
        toast({ 
          title: "No images returned", 
          description: "Try a different prompt or check the logs for details.", 
          variant: "destructive" 
        });
        return;
      }
      
      console.log(`✅ [${clientReqId}] Generated ${result.images.length} artist images, updating state`);
      
      // Add new images to the front (newest first)
      const updatedImages = [...result.images, ...images];
      setImages(updatedImages);
      
      // Update track's generated covers in session (reusing same field for artist images)
      if (track && currentSession) {
        const updatedTracks = (currentSession.tracks || []).map(t =>
          t.id === track.id ? { 
            ...t, 
            generatedCovers: updatedImages
          } : t
        );
        updateSession(currentSession.id, { tracks: updatedTracks });
        console.log(`💾 [${clientReqId}] Updated session with new images for track "${track.title}"`);
      }
      
      setSelectedIndex(0); // Select the newest generated image
      
      // Show enhanced prompt if available with debug info
      const description = result.enhancedPrompt 
        ? `Enhanced prompt: "${result.enhancedPrompt.substring(0, 50)}..."`
        : `${result.images.length} artist image${result.images.length > 1 ? 's' : ''} added`;
      
      const debugInfo = result.debug?.requestId ? ` (ID: ${result.debug.requestId})` : '';
      
      toast({ 
        title: "Generated", 
        description: description + debugInfo
      });
      
    } catch (e: any) {
      console.error(`❌ [${clientReqId}] Generate error:`, e);
      toast({ 
        title: "Generation failed", 
        description: `${e?.message || "Please try again."} (${clientReqId})`, 
        variant: "destructive" 
      });
    } finally {
      console.log(`🔄 [${clientReqId}] Setting loading to false`);
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    if (!track) return;
    
    const retryReqId = `retry_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    console.log(`🔄 [${retryReqId}] Retry requested for track: "${track.title}"`);
    
    try {
      setLoading(true);
      
      // Generate a fresh prompt based on track details
      let chatInstruction = "";
      
      if (track.title?.trim()) {
        chatInstruction = `Create a simple 1 sentence prompt for an image generation tool for an artist portrait based on this song title. Keep it cinematic and realistic, show a professional artist/musician portrait. Do not use any parameter instructions such as AR16:9.\n\nSong Title: ${track.title.trim()}`;
      } else if (Array.isArray(track.params) && track.params.length > 0) {
        const style = track.params.join(", ");
        chatInstruction = `Create a simple 1 sentence prompt for an image generation tool for an artist portrait based on this music style. Keep it cinematic and realistic, show a professional artist/musician portrait. Do not use any parameter instructions such as AR16:9.\n\nMusic Style: ${style}`;
      }
      
      console.log(`🤖 [${retryReqId}] Getting fresh prompt from ChatGPT`);
      
      // Get a fresh artist portrait prompt from ChatGPT
      if (chatInstruction) {
        const promptResponse = await api.chat([{
          role: "user",
          content: chatInstruction
        }]);
        const newPrompt = promptResponse.content;
        setPrompt(newPrompt);
        
        console.log(`📝 [${retryReqId}] Generated fresh prompt: "${newPrompt}"`);
        
        // Use the proper artist generation API (not album covers)
        const result = await api.generateArtistImages(newPrompt.trim());
        
        console.log(`🖼️ [${retryReqId}] Artist generation response:`, {
          imageCount: result.images?.length || 0,
          hasEnhancedPrompt: !!result.enhancedPrompt
        });
        
        if (!result.images || result.images.length === 0) {
          console.error(`❌ [${retryReqId}] No images returned from artist generation`);
          toast({ title: "No artist images returned", description: "Try again in a moment.", variant: "destructive" });
          return;
        }
        
        // Add new images to the front (newest first)
        const updatedImages = [...result.images, ...images];
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
          console.log(`💾 [${retryReqId}] Updated session with retry images`);
        }
        
        setSelectedIndex(0); // Select the newest generated image
        toast({ 
          title: "Regenerated", 
          description: `${result.images.length} new artist image${result.images.length > 1 ? 's' : ''} added` 
        });
      } else {
        console.error(`❌ [${retryReqId}] No track details available for retry`);
        toast({ title: "Cannot retry", description: "No track details available.", variant: "destructive" });
      }
    } catch (e: any) {
      console.error(`❌ [${retryReqId}] Retry error:`, e);
      toast({ title: "Retry failed", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!track || !currentSession) return;
    const selected = images[selectedIndex];
    if (!selected) {
      toast({ title: "Select an image", description: "Pick a thumbnail to apply as artist image.", variant: "destructive" });
      return;
    }

    const updatedTracks = (currentSession.tracks || []).map(t =>
      t.id === track.id ? { 
        ...t, 
        coverUrl: selected, // For now, just use coverUrl for artist image too
        // Update the generated covers array to put the selected cover first
        generatedCovers: selected ? [selected, ...(t.generatedCovers || []).filter(c => c !== selected)] : t.generatedCovers
      } : t
    );
    updateSession(currentSession.id, { tracks: updatedTracks });
    toast({ title: "Artist image applied", description: `Updated artist image for "${track.title || 'Song'}"` });
    onClose();
  };

  const handleDownload = () => {
    if (!images[selectedIndex]) {
      toast({ title: "No image to download", description: "Select an image first.", variant: "destructive" });
      return;
    }
    
    const link = document.createElement('a');
    link.href = images[selectedIndex];
    link.download = `artist-image-${track?.title || 'untitled'}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Downloaded", description: "Artist image saved to your device" });
  };

  const handleImageUpload = (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ title: "Invalid file", description: "Please select an image file.", variant: "destructive" });
      return;
    }
    
    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please select an image smaller than 10MB.", variant: "destructive" });
      return;
    }
    
    setReferenceImage(file);
    const url = URL.createObjectURL(file);
    setReferenceImageUrl(url);
    toast({ title: "Image uploaded", description: "Reference image ready for analysis." });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const removeReferenceImage = () => {
    setReferenceImage(null);
    if (referenceImageUrl) {
      URL.revokeObjectURL(referenceImageUrl);
      setReferenceImageUrl("");
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent 
        className="max-w-none w-full h-full bg-black/10 backdrop-blur border-0 p-0 flex flex-col"
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={onClose}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
       >
        {/* Accessible title/description for Radix Dialog */}
        <DialogTitle className="sr-only">Artist Generator</DialogTitle>
        <DialogDescription className="sr-only">Generate and select artist portraits for the current track.</DialogDescription>
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
                      alt={`Selected artist image ${selectedIndex + 1}`}
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
                          <User className="w-10 h-10 mb-2" />
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
                  <h3 className="text-white font-medium">Artist Generator</h3>
                  <p className="text-white/50 text-sm">Describe your artist and optionally upload a reference image. We'll analyze and generate portraits using Gemini 2.5 Flash.</p>
                </header>

                {/* Image Upload Area */}
                <div className="mb-4">
                  {referenceImage ? (
                    <div className="relative">
                      <div className="w-full h-20 rounded-lg bg-black/40 border border-white/10 overflow-hidden flex items-center gap-3 p-2">
                        <img 
                          src={referenceImageUrl} 
                          alt="Reference" 
                          className="w-16 h-16 object-cover rounded border border-white/10"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs font-medium truncate">{referenceImage.name}</p>
                          <p className="text-white/50 text-xs">{(referenceImage.size / 1024 / 1024).toFixed(1)}MB</p>
                        </div>
                        <button
                          onClick={removeReferenceImage}
                          className="text-white/60 hover:text-white p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="w-full h-20 rounded-lg border-2 border-dashed border-white/20 hover:border-white/30 transition-colors cursor-pointer flex items-center justify-center gap-2 text-white/60 hover:text-white/80"
                      onDrop={handleDrop}
                      onDragOver={(e) => e.preventDefault()}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4" />
                      <span className="text-xs">Drop image or click to upload</span>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>

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
                      placeholder="e.g., Professional musician portrait with studio lighting, moody and artistic, cinematic quality"
                      className="w-full h-full resize-none rounded-lg bg-black/40 border border-white/10 text-white placeholder:text-white/40 p-3 focus:outline-none focus:ring-1 focus:ring-white/20"
                    />
                  )}
                </div>

                <div className="grid grid-cols-4 gap-1">
                  <Button
                    variant="secondary"
                    onClick={handleGenerate}
                    disabled={loading}
                    className="col-span-1 text-xs px-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:from-pink-600 hover:to-purple-700 border-0 flex items-center justify-center leading-none"
                  >
                    <Wand2 className="w-3 h-3 mr-0.25" />
                    Generate
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleRetry}
                    disabled={loading}
                    className="col-span-1 text-xs px-2 bg-[#202020] text-gray-300 hover:bg-[#2a2a2a] border-white/10 flex items-center justify-center leading-none"
                  >
                    <Repeat className="w-3 h-3 mr-0.25" />
                    Retry
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleDownload}
                    disabled={loading}
                    className="col-span-1 text-xs px-2 bg-[#202020] text-gray-300 hover:bg-[#2a2a2a] border-white/10 flex items-center justify-center leading-none"
                  >
                    <Download className="w-3 h-3 mr-0.25" />
                    Download
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleApply}
                    disabled={loading}
                    className="col-span-1 text-xs px-2 bg-[#202020] text-gray-300 hover:bg-[#2a2a2a] border-white/10 flex items-center justify-center leading-none"
                  >
                    <ArrowRight className="w-3 h-3 mr-0.25" />
                    Apply
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