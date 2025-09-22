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
  const [isBackspacing, setIsBackspacing] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [originalText, setOriginalText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const animationRef = useRef<number>();

  // Start animation sequence when isAnimating becomes true
  useEffect(() => {
    if (isAnimating && animatedText) {
      setOriginalText(value);
      startBackspaceAnimation();
    } else if (!isAnimating && originalText) {
      // Animation complete, restore original text
      setDisplayText(originalText);
      setIsBackspacing(false);
      setIsTyping(false);
      setOriginalText("");
      onAnimationComplete?.();
    }
  }, [isAnimating, animatedText, value, originalText, onAnimationComplete]);

  const startBackspaceAnimation = useCallback(() => {
    if (!value) {
      startTypeAnimation();
      return;
    }

    setIsBackspacing(true);
    let lastUpdate = Date.now();
    const BACKSPACE_DELAY = 50; // ms between character removals

    const backspaceStep = () => {
      const now = Date.now();
      if (now - lastUpdate < BACKSPACE_DELAY) {
        animationRef.current = requestAnimationFrame(backspaceStep);
        return;
      }

      lastUpdate = now;
      setDisplayText(current => {
        if (current.length <= 0) {
          setIsBackspacing(false);
          setTimeout(startTypeAnimation, 300); // Brief pause before typing
          return "";
        }
        return current.slice(0, -1);
      });
      animationRef.current = requestAnimationFrame(backspaceStep);
    };

    // Start with a small delay
    setTimeout(() => {
      animationRef.current = requestAnimationFrame(backspaceStep);
    }, 500);
  }, [value]);

  const startTypeAnimation = useCallback(() => {
    if (!animatedText) return;

    setIsTyping(true);
    let currentIndex = 0;
    let lastUpdate = Date.now();
    const TYPE_DELAY = 80; // ms between character additions

    const typeStep = () => {
      const now = Date.now();
      if (now - lastUpdate < TYPE_DELAY) {
        animationRef.current = requestAnimationFrame(typeStep);
        return;
      }

      if (currentIndex >= animatedText.length) {
        setIsTyping(false);
        setTimeout(() => {
          // Clear the animated text and prepare to restore original
          setDisplayText("");
          onAnimationComplete?.();
        }, 2000); // Show the sanitized text for 2 seconds
        return;
      }

      lastUpdate = now;
      setDisplayText(animatedText.slice(0, currentIndex + 1));
      currentIndex++;
      animationRef.current = requestAnimationFrame(typeStep);
    };

    animationRef.current = requestAnimationFrame(typeStep);
  }, [animatedText, onAnimationComplete]);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Handle text changes when not animating
  useEffect(() => {
    if (!isAnimating && !isBackspacing && !isTyping) {
      setDisplayText(value);
    }
  }, [value, isAnimating, isBackspacing, isTyping]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!isAnimating && !isBackspacing && !isTyping) {
      onChange(e.target.value);
    }
  };

  const isReadOnly = disabled || isAnimating || isBackspacing || isTyping;

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={displayText}
        onChange={handleChange}
        placeholder={placeholder}
        readOnly={isReadOnly}
        className={cn(
          "w-full h-full resize-none rounded-lg bg-black/40 border border-white/10 text-white placeholder:text-white/40 p-3 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all duration-200",
          isReadOnly && "cursor-default",
          (isBackspacing || isTyping) && "animate-pulse",
          className
        )}
      />
      
      {/* Animated cursor effect during typing */}
      {isTyping && (
        <div className="absolute top-3 text-white animate-pulse" 
             style={{ 
               left: `${3 + Math.min(displayText.length * 8, textareaRef.current?.scrollWidth || 0)}px`,
               opacity: 0.8
             }}>
          |
        </div>
      )}
    </div>
  );
};