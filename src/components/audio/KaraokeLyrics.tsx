import React, { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { TimestampedWord } from "@/types";

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

  // Reset karaoke state when words change (new song)
  useEffect(() => {
    console.log('[Karaoke] Words changed, resetting state');
    setHighlightedIndex(-1);
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [words]);

  useEffect(() => {
    if (!isPlaying) {
      setHighlightedIndex(-1);
      return;
    }

    // Find the current word based on time
    const currentWordIndex = words.findIndex((word, index) => {
      const isInRange = currentTime >= word.start && currentTime <= word.end;
      // Also check if we're between this word and the next
      const nextWord = words[index + 1];
      const isBeforeNext = !nextWord || currentTime < nextWord.start;
      
      // Handle zero-duration words by checking if we're within a small buffer
      const bufferTime = 0.1; // 100ms buffer
      const isNearWord = Math.abs(currentTime - word.start) <= bufferTime;
      
      const shouldHighlight = isInRange || (currentTime >= word.start && isBeforeNext) || (word.start === word.end && isNearWord);
      
      if (shouldHighlight) {
        console.log(`[Karaoke] Word ${index}: "${word.word}" (${word.start}-${word.end}) highlighted at time ${currentTime}`);
      }
      
      return shouldHighlight;
    });

    setHighlightedIndex(currentWordIndex);

    // Auto-scroll to highlighted word within container only
    if (currentWordIndex >= 0 && containerRef.current && isPlaying) {
      const wordElement = containerRef.current.children[currentWordIndex] as HTMLElement;
      if (wordElement) {
        // Calculate scroll position to center the highlighted word
        const container = containerRef.current;
        const scrollTop = wordElement.offsetTop - (container.clientHeight / 2) + (wordElement.clientHeight / 2);
        
        container.scrollTo({
          top: Math.max(0, scrollTop),
          behavior: "smooth"
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
        "min-h-[200px] max-h-[400px] overflow-y-auto pr-2 pl-4 py-4 rounded-md border bg-muted/20",
        "leading-relaxed text-sm space-y-1 lyrics-scrollbar",
        className
      )}
      style={{ scrollbarGutter: 'stable' }}
    >
      {words.map((word, index) => {
        const isHighlighted = index === highlightedIndex;
        const isPast = currentTime > word.end;
        const isFuture = currentTime < word.start;
        
        return (
          <span
            key={index}
            className={cn(
              "inline-block transition-all duration-300 px-1 rounded",
              {
                "scale-105": isHighlighted,
                "opacity-80": !isPlaying,
              }
            )}
            style={{
              color: isHighlighted 
                ? '#ffffff' 
                : isPast && !isHighlighted 
                  ? '#f1f1f1' 
                  : '#656565',
              textShadow: isHighlighted ? '0 0 8px rgba(255, 255, 255, 0.3)' : 'none',
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