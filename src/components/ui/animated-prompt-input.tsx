import React, { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { User, Shirt, RotateCcw } from "lucide-react";

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
  onResetClick
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
  return (
    <div className={cn("relative w-full h-full rounded-lg bg-black/40 border border-white/10", className)}>
      <div className="flex flex-col h-full">
        {/* Top: scrollable input area */}
        <div className="flex-1 min-h-0 p-3">
          <textarea
            ref={textareaRef}
            value={showAnimatedText ? animatedText : value}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            placeholder={showAnimatedText ? "" : placeholder}
            disabled={disabled}
            className={cn(
              "w-full h-full resize-none bg-transparent text-white text-sm leading-6 placeholder:text-white/40 pr-20 focus:outline-none transition-colors duration-200 overflow-y-auto lyrics-scrollbar",
              overScrollbar ? "cursor-default" : "cursor-text",
              disabled && "cursor-default",
              showAnimatedText && "opacity-80"
            )}
          />
        </div>

        {/* Divider */}
        <div className="px-3">
          <div className="h-px bg-white/10 mr-16" />
        </div>

        {/* Bottom: button row */}
        <div className="px-3 py-2 flex justify-end gap-1">
          {onPersonClick && (
            <button
              onClick={onPersonClick}
              className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors duration-200"
              type="button"
            >
              <User size={12} className="text-white/60" />
            </button>
          )}
          {onClothingClick && (
            <button
              onClick={onClothingClick}
              className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors duration-200"
              type="button"
            >
              <Shirt size={12} className="text-white/60" />
            </button>
          )}
          {onResetClick && (
            <button
              onClick={onResetClick}
              className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors duration-200"
              type="button"
            >
              <RotateCcw size={12} className="text-white/60" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};