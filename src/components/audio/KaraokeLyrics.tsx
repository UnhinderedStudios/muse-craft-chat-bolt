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
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastCurrentTimeRef = useRef<number>(0);

  // Reset when words change or when switching between songs
  useEffect(() => {
    console.log('[Karaoke Reset] Words changed, resetting to top');
    setHighlightedIndex(-1);
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [words]);

  // Reset when currentTime goes back to 0 (new song)
  useEffect(() => {
    if (currentTime === 0) {
      console.log('[Karaoke Reset] Time reset to 0, resetting to top');
      setHighlightedIndex(-1);
      if (containerRef.current) {
        containerRef.current.scrollTop = 0;
      }
    }
  }, [currentTime]);

  // Main effect: Find current word and detect seeking
  useEffect(() => {
    if (words.length === 0) return;

    // Check if user seeked (significant time jump)
    const timeDiff = Math.abs(currentTime - lastCurrentTimeRef.current);
    const hasUserSeeked = timeDiff > 1; // More than 1 second difference indicates seeking
    
    // Resume auto-scroll if user seeked to a different time
    if (hasUserSeeked) {
      setIsUserScrolling(false);
    }
    
    lastCurrentTimeRef.current = currentTime;

    // Find the word that should be highlighted based on current time
    let currentWordIndex = -1;
    for (let i = 0; i < words.length; i++) {
      if (currentTime >= words[i].start && currentTime <= words[i].end) {
        currentWordIndex = i;
        break;
      }
      // If we're past the end of this word but before the start of the next
      if (i < words.length - 1 && currentTime > words[i].end && currentTime < words[i + 1].start) {
        currentWordIndex = i; // Keep the previous word highlighted
        break;
      }
      // If this is the last word and we're past its end
      if (i === words.length - 1 && currentTime > words[i].end) {
        currentWordIndex = i;
        break;
      }
    }

    console.log('[Karaoke Debug] currentTime:', currentTime.toFixed(2), 'wordIndex:', currentWordIndex, 'isPlaying:', isPlaying);

    setHighlightedIndex(currentWordIndex);
  }, [currentTime, isPlaying, words]);

  // Handle user scroll detection
  const handleScroll = () => {
    setIsUserScrolling(true);
  };

  // Separate effect for scrolling - only auto-scroll when user isn't manually scrolling
  useEffect(() => {
    if (highlightedIndex >= 0 && containerRef.current && !isUserScrolling) {
      const highlightedElement = containerRef.current.querySelector('[data-highlighted="true"]');
      
      if (highlightedElement) {
        // Always center the highlighted word smoothly
        highlightedElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
        console.log('[Karaoke Scroll] Centered word', highlightedIndex);
      }
    }
  }, [highlightedIndex, isUserScrolling]);

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
      onScroll={handleScroll}
      className={cn(
        "overflow-y-auto pr-2 pl-4 pt-2 pb-4 rounded-md border bg-muted/20",
        "leading-relaxed text-sm lyrics-scrollbar",
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