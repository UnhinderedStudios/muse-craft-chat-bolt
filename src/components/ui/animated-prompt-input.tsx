import React, { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface AnimatedPromptInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  animatedText?: string;
  isAnimating?: boolean;
  onAnimationComplete?: () => void;
}

export const AnimatedPromptInput: React.FC<AnimatedPromptInputProps> = ({
  value,
  onChange,
  placeholder = "",
  className = "",
  disabled = false,
  animatedText = "",
  isAnimating = false,
  onAnimationComplete
}) => {
  const [displayText, setDisplayText] = useState(value);
  const [showAnimatedText, setShowAnimatedText] = useState(false);

  // Simple CSS-based animation instead of complex RAF
  useEffect(() => {
    if (isAnimating && animatedText) {
      setShowAnimatedText(true);
      // Auto-hide after 3 seconds
      const timer = setTimeout(() => {
        setShowAnimatedText(false);
        onAnimationComplete?.();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isAnimating, animatedText, onAnimationComplete]);

  // Update display text when not animating
  useEffect(() => {
    if (!isAnimating) {
      setDisplayText(value);
      setShowAnimatedText(false);
    }
  }, [value, isAnimating]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!disabled) {
      onChange(e.target.value);
    }
  };

  return (
    <textarea
      value={showAnimatedText ? animatedText : displayText}
      onChange={handleChange}
      placeholder={showAnimatedText ? "" : placeholder}
      disabled={disabled}
      className={cn(
        "w-full h-full resize-none rounded-lg bg-black/40 border border-white/10 text-white placeholder:text-white/40 p-3 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all duration-200",
        disabled && "cursor-default",
        showAnimatedText && "animate-pulse",
        className
      )}
    />
  );
};