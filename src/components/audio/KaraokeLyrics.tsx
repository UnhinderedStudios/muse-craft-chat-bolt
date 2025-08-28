import React, { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { TimestampedWord } from "@/types";
import { useScrollDelegationHook } from "@/utils/scrollDelegation";

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
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  // Add scroll delegation
  useScrollDelegationHook(containerRef);

  // Function to detect if a word is metadata/action rather than actual lyrics
  const isNonSungWord = (word: string): boolean => {
    const cleanWord = word.toLowerCase().trim();
    const nonSungPatterns = [
      // Section markers
      /^(verse|chorus|bridge|intro|outro|refrain|pre|solo|instrumental|finale|coda)/,
      /^(verse|chorus)\s*\d+/,
      // Action words and stage directions
      /^\*.*\*$/,  // Words wrapped in asterisks like *Cheesy time*
      /^.*:$/,     // Words ending with colon like "Finale:"
      /^\[.*\]$/,  // Words in brackets
      /^\(.*\)$/,  // Words in parentheses
      // Vocal expressions and adlibs
      /^(shout|shooting|screaming|laughing|crying|whisper|yelling|cheering|applause)/,
      /^(oh|ah|yeah|hey|yo|uh|huh|mm|hmm|ooh|wow|whoa|aha|haha|wooo|ayy)$/,
      // Repetition markers
      /\d+x|x\d+/,
      /^repeat/,
      /^fade/,
      /^end$/,
      // Common metadata
      /^(time|moment|part|section)/,
      /^(cheesy|funky|groovy|smooth|dramatic|epic)/
    ];
    
    return nonSungPatterns.some(pattern => pattern.test(cleanWord));
  };

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

  // Main effect: Find current word with timing offset compensation
  useEffect(() => {
    if (words.length === 0) return;

    // Add 0.3s timing offset to compensate for delay
    const adjustedTime = currentTime + 0.3;

    // Find the word that should be highlighted based on adjusted time
    let currentWordIndex = -1;
    for (let i = 0; i < words.length; i++) {
      if (adjustedTime >= words[i].start && adjustedTime <= words[i].end) {
        currentWordIndex = i;
        break;
      }
      // If we're past the end of this word but before the start of the next
      if (i < words.length - 1 && adjustedTime > words[i].end && adjustedTime < words[i + 1].start) {
        currentWordIndex = i; // Keep the previous word highlighted
        break;
      }
      // If this is the last word and we're past its end
      if (i === words.length - 1 && adjustedTime > words[i].end) {
        currentWordIndex = i;
        break;
      }
    }

    console.log('[Karaoke Debug] currentTime:', currentTime.toFixed(2), 'adjustedTime:', adjustedTime.toFixed(2), 'wordIndex:', currentWordIndex, 'isPlaying:', isPlaying);

    setHighlightedIndex(currentWordIndex);
  }, [currentTime, isPlaying, words]);

  // Detect user scrolling and temporarily disable auto-scroll
  const handleScroll = () => {
    setIsUserScrolling(true);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 1500); // Resume auto-scroll after 1.5s of no user scrolling
  };

  // Auto-scroll effect with continuous centering - only when user isn't manually scrolling
  useEffect(() => {
    if (highlightedIndex >= 0 && containerRef.current && !isUserScrolling && isPlaying) {
      const highlightedElement = containerRef.current.querySelector('[data-highlighted="true"]') as HTMLElement;
      
      if (highlightedElement) {
        const container = containerRef.current;
        const elementTop = highlightedElement.offsetTop;
        const containerHeight = container.clientHeight;
        const elementHeight = highlightedElement.clientHeight;
        
        // Calculate precise center position
        const elementCenter = elementTop + (elementHeight / 2);
        const containerCenter = containerHeight / 2;
        const scrollTo = elementCenter - containerCenter;
        
        // Ensure we don't scroll beyond bounds
        const maxScroll = container.scrollHeight - containerHeight;
        const targetScroll = Math.max(0, Math.min(scrollTo, maxScroll));
        
        // Only scroll if there's a meaningful difference to avoid jitter
        const currentScroll = container.scrollTop;
        if (Math.abs(targetScroll - currentScroll) > 5) {
          container.scrollTo({
            top: targetScroll,
            behavior: 'smooth'
          });
          
          console.log('[Karaoke Scroll] Centering word', highlightedIndex, 'at time', currentTime.toFixed(2));
        }
      }
    }
  }, [highlightedIndex, currentTime, isUserScrolling, isPlaying]);

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
      tabIndex={-1}
      className={cn(
        "overflow-y-auto pr-2 pl-4 pt-2 pb-4 rounded-md border bg-muted/20",
        "leading-relaxed text-sm lyrics-scrollbar relative",
        className
      )}
      style={{ 
        scrollbarGutter: 'stable',
        maxHeight: '100%',
        contain: 'layout style paint',
        overflowAnchor: 'none',
        willChange: 'scroll-position',
        isolation: 'isolate'
      }}
    >
      {words.map((word, index) => {
        const isHighlighted = index === highlightedIndex;
        const isPast = currentTime > word.end;
        const isFuture = currentTime < word.start;
        const isNonSung = isNonSungWord(word.word);
        
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
              color: isNonSung 
                ? '#f92c8f' // Pink color for non-sung words (matches Generate button)
                : isHighlighted 
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