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

  return (
    <div className="relative w-full h-full">
      <textarea
        ref={textareaRef}
        value={showAnimatedText ? animatedText : value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={showAnimatedText ? "" : placeholder}
        disabled={disabled}
        className={cn(
          "w-full h-full resize-none rounded-lg bg-black/40 border border-white/10 text-white placeholder:text-white/40 p-3 pb-12 pr-20 focus:outline-none focus:border-white/30 transition-colors duration-200 overflow-hidden",
          disabled && "cursor-default",
          showAnimatedText && "opacity-80",
          className
        )}
      />
      {/* Divider line */}
      <div className="absolute bottom-12 left-3 right-16 h-px bg-white/10" />
      
      {/* Button container on the right side */}
      <div className="absolute bottom-5 right-3 flex gap-1">
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
  );
};