import React, { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

export interface TimestampedWord {
  word: string;
  success: boolean;
  start_s: number;
  end_s: number;
  p_align: number;
}

interface KaraokeLyricsProps {
  words: TimestampedWord[];
  currentTime: number;
  isPlaying: boolean;
  className?: string;
}

export const KaraokeLyrics: React.FC<KaraokeLyricsProps> = ({
  words,
  currentTime,
  isPlaying,
  className
}) => {
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPlaying) {
      setHighlightedIndex(-1);
      return;
    }

    // Find the current word based on time
    const currentWordIndex = words.findIndex((word, index) => {
      const isInRange = currentTime >= word.start_s && currentTime <= word.end_s;
      // Also check if we're between this word and the next
      const nextWord = words[index + 1];
      const isBeforeNext = !nextWord || currentTime < nextWord.start_s;
      return isInRange || (currentTime >= word.start_s && isBeforeNext);
    });

    setHighlightedIndex(currentWordIndex);

    // Auto-scroll to highlighted word
    if (currentWordIndex >= 0 && containerRef.current) {
      const wordElement = containerRef.current.children[currentWordIndex] as HTMLElement;
      if (wordElement) {
        wordElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [currentTime, isPlaying, words]);

  if (!words.length) {
    return (
      <div className={cn("min-h-[200px] flex items-center justify-center text-muted-foreground", className)}>
        <p>Lyrics will appear here when available</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={cn(
        "min-h-[200px] max-h-[400px] overflow-y-auto p-4 rounded-md border bg-muted/20",
        "leading-relaxed text-sm space-y-1",
        className
      )}
    >
      {words.map((word, index) => {
        const isHighlighted = index === highlightedIndex;
        const isPast = currentTime > word.end_s;
        const isFuture = currentTime < word.start_s;
        
        return (
          <span
            key={index}
            className={cn(
              "inline-block transition-all duration-300 px-1 rounded",
              {
                "bg-primary text-primary-foreground shadow-sm scale-105": isHighlighted,
                "text-muted-foreground": isPast && !isHighlighted,
                "text-foreground": isFuture && !isHighlighted,
                "opacity-80": !isPlaying,
              }
            )}
            style={{
              marginRight: word.word.endsWith('\n') ? '0' : '0.25rem',
            }}
          >
            {word.word.replace(/\n/g, ' ')}
            {word.word.includes('\n') && <br />}
          </span>
        );
      })}
    </div>
  );
};