import React, { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { User, Shirt, RotateCcw, X } from "lucide-react";

interface AnimatedPromptInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  animatedText?: string;
  isAnimating?: boolean;
  onAnimationComplete?: () => void;
  onPersonClick?: () => void;
  onClothingClick?: () => void;
  onResetClick?: () => void;
  facialReferenceImage?: string;
  isAnalyzingFace?: boolean;
  onFacialReferenceAccepted?: (imageUrl: string) => void;
  onFacialReferenceRemoved?: () => void;
}

export const AnimatedPromptInput: React.FC<AnimatedPromptInputProps> = ({
  value,
  onChange,
  placeholder = "",
  className = "",
  disabled = false,
  animatedText = "",
  isAnimating = false,
  onAnimationComplete,
  onPersonClick,
  onClothingClick,
  onResetClick,
  facialReferenceImage,
  isAnalyzingFace = false,
  onFacialReferenceAccepted,
  onFacialReferenceRemoved
}) => {
  const [showAnimatedText, setShowAnimatedText] = useState(false);
  const [isUserEditing, setIsUserEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cursorPositionRef = useRef<number>(0);
  const [overScrollbar, setOverScrollbar] = useState(false);
  const SCROLLBAR_HOVER_WIDTH = 16;

  // Store cursor position before animation
  const storeCursorPosition = useCallback(() => {
    if (textareaRef.current) {
      cursorPositionRef.current = textareaRef.current.selectionStart;
    }
  }, []);

  // Restore cursor position after animation
  const restoreCursorPosition = useCallback(() => {
    if (textareaRef.current && !isUserEditing) {
      const position = cursorPositionRef.current;
      textareaRef.current.setSelectionRange(position, position);
    }
  }, [isUserEditing]);

  // Handle animation lifecycle
  useEffect(() => {
    if (isAnimating && animatedText && !isUserEditing) {
      storeCursorPosition();
      setShowAnimatedText(true);
      
      const timer = setTimeout(() => {
        setShowAnimatedText(false);
        onAnimationComplete?.();
        // Restore cursor position after a brief delay
        setTimeout(restoreCursorPosition, 10);
      }, 3000);
      
      return () => clearTimeout(timer);
    } else if (!isAnimating) {
      setShowAnimatedText(false);
    }
  }, [isAnimating, animatedText, isUserEditing, onAnimationComplete, storeCursorPosition, restoreCursorPosition]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!disabled) {
      setIsUserEditing(true);
      onChange(e.target.value);
      // Reset editing state after a brief delay
      setTimeout(() => setIsUserEditing(false), 100);
    }
  };

  const handleFocus = () => {
    setIsUserEditing(true);
  };

  const handleBlur = () => {
    setTimeout(() => setIsUserEditing(false), 100);
  };

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLTextAreaElement>) => {
    const el = textareaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const near = e.clientX >= rect.right - SCROLLBAR_HOVER_WIDTH;
    if (near !== overScrollbar) setOverScrollbar(near);
  }, [overScrollbar]);

  const handleMouseLeave = () => setOverScrollbar(false);
  
  const isDisabledByAnalysis = disabled || isAnalyzingFace;
  
  return (
    <div className={cn("relative w-full h-full rounded-lg bg-black/40 border border-white/10", className)}>
      <div className="flex flex-col h-full">
        {/* Top: scrollable input area */}
        <div className="flex-1 min-h-0 p-3 relative">
          <div className={cn("relative", isAnalyzingFace && "blur-3xl")}> 
            <textarea
              ref={textareaRef}
              value={showAnimatedText ? animatedText : value}
              onChange={handleChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              placeholder={showAnimatedText ? "" : placeholder}
              disabled={isDisabledByAnalysis}
              className={cn(
                "w-full h-full resize-none bg-transparent text-white text-sm leading-6 placeholder:text-white/40 pr-20 focus:outline-none transition-colors duration-200 overflow-y-auto lyrics-scrollbar",
                overScrollbar ? "cursor-default" : "cursor-text",
                isDisabledByAnalysis && "cursor-default",
                showAnimatedText && "opacity-80",
                isAnalyzingFace && "opacity-20"
              )}
            />
          </div>
          {isAnalyzingFace && (
            <>
              {/* Scanning beam animation */}
              <div className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none">
                <div className="absolute top-0 left-0 w-16 h-full animate-scan" 
                     style={{
                       background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                       boxShadow: '0 0 20px rgba(255,255,255,0.3)'
                     }} />
              </div>
              {/* Main overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" 
                       style={{ filter: "drop-shadow(0 0 8px rgba(255, 255, 255, 0.6))" }} />
                  <span className="text-white/80 text-sm font-medium">Analyzing face...</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Divider */}
        <div className="px-3">
          <div className="h-px bg-white/10" />
        </div>

        {/* Bottom: button row */}
        <div className="px-3 py-2 flex justify-between items-center">
          {/* Left side: Files display */}
          <div className="flex items-center gap-2">
            {facialReferenceImage && (
              <div className="flex items-center gap-2">
                <span className="text-white/60 text-xs">Files:</span>
                <div className="w-6 h-6 rounded overflow-hidden border border-accent-primary/40 relative group">
                  <img 
                    src={facialReferenceImage} 
                    alt="Facial reference" 
                    className="w-full h-full object-cover"
                  />
                  {onFacialReferenceRemoved && (
                    <button
                      onClick={onFacialReferenceRemoved}
                      className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      type="button"
                    >
                      <X size={8} className="text-white" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right side: Action buttons */}
          <div className="flex gap-1">
            {onPersonClick && (
              <button
                onClick={onPersonClick}
                disabled={isAnalyzingFace}
                className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                type="button"
              >
                <User size={12} className="text-white/60" />
              </button>
            )}
            {onClothingClick && (
              <button
                onClick={onClothingClick}
                disabled={isAnalyzingFace}
                className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                type="button"
              >
                <Shirt size={12} className="text-white/60" />
              </button>
            )}
            {onResetClick && (
              <button
                onClick={onResetClick}
                disabled={isAnalyzingFace}
                className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                type="button"
              >
                <RotateCcw size={12} className="text-white/60" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};