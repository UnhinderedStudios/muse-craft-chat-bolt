import React, { useEffect, useMemo, useState, useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { TrackItem } from "@/types";
import { ChevronUp, ChevronDown, X, User, Wand2, Repeat, ArrowRight, Download, Palette, RotateCcw, Check, Dices, Pipette } from "lucide-react";
import artistPlaceholderVideo from "@/assets/artist-placeholder.mp4";
import { useSessionManager } from "@/hooks/use-session-manager";
import { AnimatedPromptInput } from "@/components/ui/animated-prompt-input";
import { HexColorPicker } from "react-colorful";

// Function to convert hex color to human-readable name
const getColorName = (hex: string): string => {
  if (!hex || !hex.startsWith('#')) return '';
  
  // Parse hex to RGB
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  
  // Calculate luminance for brightness detection
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Very dark colors
  if (luminance < 0.1) return 'very dark';
  
  // Very light colors  
  if (luminance > 0.9) return 'very light';
  
  // Grayscale detection
  const grayTolerance = 15;
  if (Math.abs(r - g) < grayTolerance && Math.abs(g - b) < grayTolerance && Math.abs(r - b) < grayTolerance) {
    if (luminance > 0.7) return 'light gray';
    if (luminance > 0.4) return 'gray';
    return 'dark gray';
  }
  
  // Find dominant color channel
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  
  // Low saturation colors
  if (saturation < 0.2) {
    if (luminance > 0.6) return 'light gray';
    if (luminance > 0.3) return 'gray';
    return 'dark gray';
  }
  
  // Determine hue-based color names
  let hue = 0;
  if (max !== min) {
    if (max === r) hue = ((g - b) / (max - min) + 6) % 6;
    else if (max === g) hue = (b - r) / (max - min) + 2;
    else hue = (r - g) / (max - min) + 4;
    hue *= 60;
  }
  
  // Color name based on hue ranges
  const brightness = luminance > 0.6 ? 'light ' : luminance < 0.3 ? 'dark ' : '';
  const intensity = saturation > 0.7 ? 'bright ' : saturation < 0.4 ? 'muted ' : '';
  
  if (hue >= 345 || hue < 15) return `${intensity}${brightness}red`;
  if (hue >= 15 && hue < 45) return `${intensity}${brightness}orange`;
  if (hue >= 45 && hue < 75) return `${intensity}${brightness}yellow`;
  if (hue >= 75 && hue < 105) return `${intensity}${brightness}lime green`;
  if (hue >= 105 && hue < 135) return `${intensity}${brightness}green`;
  if (hue >= 135 && hue < 165) return `${intensity}${brightness}teal`;
  if (hue >= 165 && hue < 195) return `${intensity}${brightness}cyan`;
  if (hue >= 195 && hue < 225) return `${intensity}${brightness}blue`;
  if (hue >= 225 && hue < 255) return `${intensity}${brightness}indigo`;
  if (hue >= 255 && hue < 285) return `${intensity}${brightness}purple`;
  if (hue >= 285 && hue < 315) return `${intensity}${brightness}magenta`;
  if (hue >= 315 && hue < 345) return `${intensity}${brightness}pink`;
  
  return 'color';
};

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
  const [isAnimating, setIsAnimating] = useState(false);
  const [videoLoading, setVideoLoading] = useState(true);
  const [sanitizedPrompt, setSanitizedPrompt] = useState("");
  const [originalPrompt, setOriginalPrompt] = useState("");
  
  // Facial reference state
  const [facialReferenceImage, setFacialReferenceImage] = useState<string>("");
  const [isAnalyzingFace, setIsAnalyzingFace] = useState(false);
  
  // Color wheel state
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [isColorApplied, setIsColorApplied] = useState(false);
  
  // Settings state
  const [artistCount, setArtistCount] = useState([1]);
  const [isRealistic, setIsRealistic] = useState(true);

  const VISIBLE_COUNT = 5;

  useEffect(() => {
    console.log("🎯 ArtistGenerator opened:", { isOpen, track: track?.title, trackId: track?.id });
    if (isOpen && track) {
      // Load only previously generated artist images for this track (newest first)
      const existingCovers = track.albumCoverIds || [];
      const initial: string[] = [...existingCovers];
      
      console.log("🎨 Setting up initial artist images:", initial);
      setImages(initial);
      setSelectedIndex(0);
      setOffset(0);
      setPrompt("");
      setVideoLoading(true);
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
    console.log(`🔄 [${clientReqId}] Track: "${track?.title || 'Unknown'}"`);
    
    if (!prompt.trim()) {
      console.log(`❌ [${clientReqId}] Empty prompt, showing toast`);
      toast({ title: "Enter a prompt", description: "Type what you want to see for the artist portrait." });
      return;
    }
    
    try {
      setLoading(true);
      setOriginalPrompt(prompt);
      
      // Start visual animation immediately - will persist until first image arrives
      const mockSanitized = "Professional music artist portrait, clean visual styling, performer aesthetic";
      setSanitizedPrompt(mockSanitized);
      setIsAnimating(true);
      
      console.log(`🎨 [${clientReqId}] Animation started, processing artist generation...`);
      
      const cleanPrompt = prompt.trim();
      
      // Prepare request payload
      const requestPayload: any = { prompt: cleanPrompt };
      
      // Add background color if applied
      if (isColorApplied && selectedColor) {
        requestPayload.backgroundHex = selectedColor;
        console.log(`🎨 [${clientReqId}] Adding background color: ${selectedColor}`);
      }
      
      // Add facial reference if available
      if (facialReferenceImage) {
        requestPayload.facialReference = facialReferenceImage;
        console.log(`👤 [${clientReqId}] Adding facial reference image`);
      }
      
      // Always add character count (including 1)
      requestPayload.characterCount = artistCount[0];
      console.log(`👥 [${clientReqId}] Adding character count: ${artistCount[0]}`);
      
      console.log(`📤 [${clientReqId}] Sending request:`, requestPayload);
      
      const result = await api.generateArtistImages(cleanPrompt, requestPayload.backgroundHex, requestPayload.characterCount, isRealistic, requestPayload.facialReference);
      
      console.log(`🖼️ [${clientReqId}] Artist generation response:`, {
        imageCount: result.images?.length || 0,
        hasEnhancedPrompt: !!result.enhancedPrompt,
        debug: result.debug
      });
      
      if (!result.images || result.images.length === 0) {
        console.error(`❌ [${clientReqId}] No images returned from API`);
        
        // Stop animation on error
        setIsAnimating(false);
        setSanitizedPrompt("");
        
        toast({ 
          title: "No images returned", 
          description: "The prompt may have been filtered. Try a simpler description.", 
          variant: "destructive" 
        });
        return;
      }
      
      console.log(`✅ [${clientReqId}] Generated ${result.images.length} artist images, updating state`);
      
      // Stop animation when first image arrives
      setIsAnimating(false);
      setSanitizedPrompt("");
      
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
      
      // Stop animation on error
      setIsAnimating(false);
      setSanitizedPrompt("");
      
      toast({ 
        title: "Generation failed", 
        description: `${e?.message || "Try a simpler prompt."} (${clientReqId})`, 
        variant: "destructive" 
      });
    } finally {
      console.log(`🔄 [${clientReqId}] Setting loading to false`);
      setLoading(false);
    }
  };

  const handleAnimationComplete = () => {
    setIsAnimating(false);
    setSanitizedPrompt("");
    setPrompt(originalPrompt);
  };

  const handleRetry = async () => {
    // Retry button operation disabled - button remains visible but non-functional
    console.log(`🔄 Retry button clicked but operation is disabled`);
    return;
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
        albumCoverIds: selected ? [selected, ...(t.albumCoverIds || []).filter(c => c !== selected)] : t.albumCoverIds
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

  const handleColorApply = () => {
    setIsColorApplied(true);
    toast({ title: "Color applied", description: `Background color set to ${selectedColor}` });
  };

  const handleColorReset = () => {
    setSelectedColor("");
    setIsColorApplied(false);
    toast({ title: "Color reset", description: "Background color reset to default" });
  };

  const handleColorRandomize = () => {
    const randomColor = `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
    setSelectedColor(randomColor);
    toast({ title: "Color randomized", description: `Random color: ${randomColor}` });
  };

  const handleColorPicker = () => {
    toast({ title: "Color picker", description: "Eyedropper tool (coming soon)" });
  };

  const handlePersonClick = () => {
    // Create a file input to upload facial reference
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = handleFacialReferenceUpload;
    input.click();
  };

  const handleFacialReferenceUpload = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    setIsAnalyzingFace(true);
    
    try {
      // Create FormData for the face analysis
      const formData = new FormData();
      formData.append('image', file);

      console.log('🔍 Analyzing uploaded facial reference...');
      
      const response = await fetch('https://afsyxzxwxszujnsmukff.supabase.co/functions/v1/analyze-face', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('📊 Face analysis result:', result);

      if (result.accepted) {
        setFacialReferenceImage(result.imageData);
        toast({ 
          title: "Facial reference accepted", 
          description: "Face detected and ready for generation" 
        });
      } else {
        toast({ 
          title: "Image rejected", 
          description: result.rejectionReason || "Please try a different image",
          variant: "destructive" 
        });
      }
    } catch (error) {
      console.error('❌ Face analysis error:', error);
      toast({ 
        title: "Analysis failed", 
        description: "Could not analyze the image. Please try again.",
        variant: "destructive" 
      });
    } finally {
      setIsAnalyzingFace(false);
    }
  };

  const handleClothingClick = () => {
    const clothing = ["wearing casual streetwear", "in elegant formal attire", "wearing leather jacket", "in vintage clothing", "wearing colorful outfit"];
    const randomClothing = clothing[Math.floor(Math.random() * clothing.length)];
    setPrompt(prev => prev ? `${prev}, ${randomClothing}` : randomClothing);
  };

  const handlePromptReset = () => {
    setPrompt("");
    setFacialReferenceImage("");
    toast({ title: "Reset complete", description: "Prompt and facial reference cleared" });
  };

  const handleFacialReferenceRemoved = () => {
    setFacialReferenceImage("");
    toast({ title: "Facial reference removed", description: "Reference image cleared" });
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
          <div className="flex-1 min-h-0 px-6 pb-6 flex flex-col items-center justify-center">
            <div className="w-full max-w-6xl space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-[max-content_420px] gap-4 items-start">
                {/* Header: spans full width across both columns */}
                <div className="w-full rounded-lg border border-white/10 px-4 py-2 lg:col-span-2" style={{ backgroundColor: '#33343630' }}>
                  <div className="text-xs text-white/60">Artist Image Generation</div>
                </div>

                {/* Left: Preview + Thumbnails (side-by-side) */}
                <div className="flex items-start justify-start gap-4 lg:col-start-1 lg:row-start-2">
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
                    ) : !loading && images.length === 0 ? (
                      // Show video when no generated images are present
                      <>
                        <video
                          src={artistPlaceholderVideo}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="block w-full h-full object-cover"
                          onLoadedData={() => setVideoLoading(false)}
                          onError={() => setVideoLoading(false)}
                        />
                        {/* Scanning animation while video loads */}
                        {videoLoading && (
                          <div className="absolute inset-0 pointer-events-none">
                            <div className="w-full h-full bg-gradient-to-r from-transparent via-white/15 to-transparent animate-scanning" />
                          </div>
                        )}
                       </>
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
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="w-full h-full bg-gradient-to-r from-transparent via-white/15 to-transparent animate-scanning" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Prompt Controls */}
                <aside 
                  className="flex flex-col rounded-xl border border-white/10 px-4 pt-3 pb-3 overflow-hidden min-h-0 lg:col-start-2 lg:row-start-2"
                  style={{ height: "min(520px, 60vh)", backgroundColor: '#33343630' }}
                >

                  <header className="mb-2">
                    <h3 className="text-xs text-white/60">Artist Generator</h3>
                  </header>

                  <div className="flex-1 min-h-0 mb-1 space-y-1 overflow-auto pr-1">
                    <div>
                       <AnimatedPromptInput
                         value={prompt}
                         onChange={setPrompt}
                         placeholder="e.g., Professional musician portrait with studio lighting, moody and artistic, cinematic quality"
                         disabled={loading}
                         animatedText={sanitizedPrompt}
                         isAnimating={isAnimating}
                         onAnimationComplete={handleAnimationComplete}
                         onPersonClick={handlePersonClick}
                         onClothingClick={handleClothingClick}
                         onResetClick={handlePromptReset}
                         facialReferenceImage={facialReferenceImage}
                         isAnalyzingFace={isAnalyzingFace}
                         onFacialReferenceRemoved={handleFacialReferenceRemoved}
                         className="h-36"
                       />
                    </div>

                    {/* Background Color Section */}
                    <div>
                      <div className="text-xs text-white/60 mb-2">Background Color</div>
                      <div className="w-full rounded-lg bg-black/20 border border-white/10 p-3 pb-1.5">
                        <div className="flex flex-col gap-1.5">
                          {/* Color Picker - Full Width */}
                          <div className="color-picker-compact w-full">
                            <HexColorPicker
                              color={selectedColor || "#ffffff"}
                              onChange={setSelectedColor}
                              style={{ width: '100%', height: '118px' }}
                            />
                          </div>
                          
                           {/* Color Controls - Below picker */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs text-white/80 select-all font-mono">
                              <span>{selectedColor || "#ffffff"}</span>
                              {selectedColor && (
                                <>
                                  <span className="text-white/30">|</span>
                                  <span className="text-white/60 font-sans">{getColorName(selectedColor)}</span>
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleColorRandomize}
                                className="bg-white/10 border-0 text-white hover:bg-white/20 hover:text-white w-6 h-6 p-0"
                              >
                                <Dices className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleColorPicker}
                                className="bg-white/10 border-0 text-white hover:bg-white/20 hover:text-white w-6 h-6 p-0"
                              >
                                <Pipette className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleColorReset}
                                className="bg-white/10 border-0 text-white hover:bg-white/20 hover:text-white w-6 h-6 p-0"
                              >
                                <RotateCcw className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleColorApply}
                                disabled={!selectedColor}
                                className="bg-white/10 border-0 text-white hover:bg-white/20 hover:text-white w-6 h-6 p-0"
                              >
                                <Check className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Settings container */}
                  <div className="mt-1.5 mb-1.5">
                    <div className="text-xs text-white/60 mb-1.5">Settings</div>
                    <div className="w-full rounded-lg bg-black/20 border border-white/10 p-2.5">
                      <div className="flex items-center gap-3">
                        {/* Artist Count Slider */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="text-xs text-white/80 whitespace-nowrap">Characters:</span>
                          <div className="flex-1 min-w-[50px] max-w-[120px]">
                            <div className="slider-container">
                              <Slider
                                value={artistCount}
                                onValueChange={setArtistCount}
                                min={1}
                                max={3}
                                step={1}
                                className="w-full"
                              />
                            </div>
                          </div>
                          <span className="text-xs text-white/60 w-3 text-center">{artistCount[0]}</span>
                        </div>
                        
                        {/* Separator */}
                        <div className="w-px h-4 bg-white/30"></div>
                        
                        {/* Realistic/Animated Toggle - Custom Design */}
                        <div className="flex-shrink-0">
                          <button
                            onClick={() => setIsRealistic(!isRealistic)}
                            className={cn(
                              "relative w-32 h-7 rounded-full transition-all duration-300 overflow-hidden",
                              "bg-white/10 hover:bg-white/15"
                            )}
                          >
                            {/* Sliding background */}
                            <div
                              className={cn(
                                "absolute inset-0.5 rounded-full transition-transform duration-300 bg-accent-primary",
                                isRealistic ? "translate-x-0" : "translate-x-[100%]"
                              )}
                              style={{ width: '50%' }}
                            />
                            
                            {/* Text labels */}
                            <div className="relative w-full h-full flex">
                              <span
                                className={cn(
                                  "flex-1 flex items-center justify-center text-[10px] font-medium transition-colors duration-300",
                                  isRealistic ? "text-white" : "text-white/60"
                                )}
                              >
                                Realistic
                              </span>
                              <span
                                className={cn(
                                  "flex-1 flex items-center justify-center text-[10px] font-medium transition-colors duration-300",
                                  !isRealistic ? "text-white" : "text-white/60"
                                )}
                              >
                                Animated
                              </span>
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto">
                    <div className="grid grid-cols-4 gap-1 mt-2">
                      <Button
                        variant="secondary"
                        onClick={handleGenerate}
                        disabled={loading}
                        className="col-span-1 text-xs px-2 py-1.5 h-7 bg-accent-primary hover:bg-accent-primary/90 text-white border-0 flex items-center justify-center leading-none"
                      >
                        <Wand2 className="w-2.5 h-2.5 mr-0.25" />
                        Generate
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={handleRetry}
                        disabled={loading}
                        className="col-span-1 text-xs px-2 py-1.5 h-7 bg-[#202020] text-gray-300 hover:bg-[#2a2a2a] border-white/10 flex items-center justify-center leading-none"
                      >
                        <Repeat className="w-2.5 h-2.5 mr-0.25" />
                        Retry
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={handleDownload}
                        disabled={loading}
                        className="col-span-1 text-xs px-2 py-1.5 h-7 bg-[#202020] text-gray-300 hover:bg-[#2a2a2a] border-white/10 flex items-center justify-center leading-none"
                      >
                        <Download className="w-2.5 h-2.5 mr-0.25" />
                        Download
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={handleApply}
                        disabled={loading}
                        className="col-span-1 text-xs px-2 py-1.5 h-7 bg-[#202020] text-gray-300 hover:bg-[#2a2a2a] border-white/10 flex items-center justify-center leading-none"
                      >
                        <ArrowRight className="w-2.5 h-2.5 mr-0.25" />
                        Next
                      </Button>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};