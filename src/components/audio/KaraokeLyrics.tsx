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

    // Reset scroll to top when playback starts
    if (isPlaying && containerRef.current && currentTime < 1) {
      console.log('[Karaoke] Playback started, scrolling to top');
      containerRef.current.scrollTop = 0;
    }

    // Find the current word - only highlight if we're exactly within the word's time range
    let currentWordIndex = -1;
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      
      // For zero-duration words, use a small buffer
      if (word.start === word.end) {
        const bufferTime = 0.05; // 50ms buffer for zero-duration words
        if (Math.abs(currentTime - word.start) <= bufferTime) {
          currentWordIndex = i;
          console.log(`[Karaoke] Zero-duration word ${i}: "${word.word}" highlighted at time ${currentTime}`);
          break;
        }
      } else {
        // For normal words, only highlight if we're within the exact time range
        if (currentTime >= word.start && currentTime <= word.end) {
          currentWordIndex = i;
          console.log(`[Karaoke] Word ${i}: "${word.word}" (${word.start}-${word.end}) highlighted at time ${currentTime}`);
          break;
        }
      }
    }

    setHighlightedIndex(currentWordIndex);

    // Container-specific auto-scroll that doesn't hijack main page scrolling
    if (currentWordIndex >= 0 && containerRef.current) {
      const highlightedElement = containerRef.current.querySelector('[data-highlighted="true"]');
      if (highlightedElement) {
        const container = containerRef.current;
        const elementTop = (highlightedElement as HTMLElement).offsetTop;
        const elementHeight = (highlightedElement as HTMLElement).offsetHeight;
        const containerHeight = container.clientHeight;
        const containerScrollTop = container.scrollTop;
        
        // Calculate optimal scroll position to center the element
        const targetScrollTop = elementTop - (containerHeight / 2) + (elementHeight / 2);
        
        // Direct scrollTop manipulation - no browser interference with main page
        const maxScrollTop = container.scrollHeight - containerHeight;
        container.scrollTop = Math.max(0, Math.min(targetScrollTop, maxScrollTop));
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
        "overflow-y-auto pr-2 pl-4 py-4 rounded-md border bg-muted/20",
        "leading-relaxed text-sm space-y-1 lyrics-scrollbar",
        className
      )}
      style={{ 
        scrollbarGutter: 'stable',
        maxHeight: '100%' 
      }}
    >
      {words.map((word, index) => {
        const isHighlighted = index === highlightedIndex;
        const isPast = currentTime > word.end;
        const isFuture = currentTime < word.start;
        
        return (
          <span
            key={`word-${index}`}
            data-highlighted={isHighlighted ? "true" : "false"}
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