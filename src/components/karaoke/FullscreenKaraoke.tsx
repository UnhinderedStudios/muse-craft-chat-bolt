import React, { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { TimestampedWord } from "@/types";

interface FullscreenKaraokeProps {
  words: TimestampedWord[];
  currentTime: number;
  isPlaying: boolean;
  albumCoverUrl?: string;
  onClose: () => void;
}

export const FullscreenKaraoke: React.FC<FullscreenKaraokeProps> = ({
  words,
  currentTime,
  isPlaying,
  albumCoverUrl,
  onClose
}) => {
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  // Function to detect if a word is metadata/action rather than actual lyrics
  const isNonSungWord = (word: string): boolean => {
    const cleanWord = word.toLowerCase().trim();
    const nonSungPatterns = [
      /^(verse|chorus|bridge|intro|outro|refrain|pre|solo|instrumental|finale|coda)/,
      /^(verse|chorus)\s*\d+/,
      /^\*.*\*$/,
      /^.*:$/,
      /^\[.*\]$/,
      /^\(.*\)$/,
      /^(shout|shooting|screaming|laughing|crying|whisper|yelling|cheering|applause)/,
      /^(oh|ah|yeah|hey|yo|uh|huh|mm|hmm|ooh|wow|whoa|aha|haha|wooo|ayy)$/,
      /\d+x|x\d+/,
      /^repeat/,
      /^fade/,
      /^end$/,
      /^(time|moment|part|section)/,
      /^(cheesy|funky|groovy|smooth|dramatic|epic)/
    ];
    
    return nonSungPatterns.some(pattern => pattern.test(cleanWord));
  };

  // Group words into lines for better fullscreen display
  const groupWordsIntoLines = (words: TimestampedWord[]): TimestampedWord[][] => {
    const lines: TimestampedWord[][] = [];
    let currentLine: TimestampedWord[] = [];
    
    words.forEach((word, index) => {
      currentLine.push(word);
      
      // Check if this word ends with a line break or if we should start a new line
      if (word.word.includes('\n') || currentLine.length >= 8) {
        lines.push([...currentLine]);
        currentLine = [];
      }
    });
    
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
    
    return lines;
  };

  const lines = groupWordsIntoLines(words);

  // Find current word and line
  useEffect(() => {
    if (words.length === 0) return;

    let currentWordIndex = -1;
    for (let i = 0; i < words.length; i++) {
      if (currentTime >= words[i].start && currentTime <= words[i].end) {
        currentWordIndex = i;
        break;
      }
      if (i < words.length - 1 && currentTime > words[i].end && currentTime < words[i + 1].start) {
        currentWordIndex = i;
        break;
      }
      if (i === words.length - 1 && currentTime > words[i].end) {
        currentWordIndex = i;
        break;
      }
    }

    setHighlightedIndex(currentWordIndex);
  }, [currentTime, isPlaying, words]);

  // Find which line contains the highlighted word
  const getCurrentLineIndex = (): number => {
    // Start with first line if no word is highlighted yet
    if (highlightedIndex === -1) return 0;
    
    let wordCount = 0;
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const lineWordCount = lines[lineIndex].length;
      if (highlightedIndex >= wordCount && highlightedIndex < wordCount + lineWordCount) {
        return lineIndex;
      }
      wordCount += lineWordCount;
    }
    return 0; // Fallback to first line
  };

  const currentLineIndex = getCurrentLineIndex();

  // Calculate distance-based opacity for lines
  const getLineOpacity = (lineIndex: number): number => {
    const distance = Math.abs(lineIndex - currentLineIndex);
    if (distance === 0) return 1; // Current line - full white
    if (distance === 1) return 0.7; // Adjacent lines
    if (distance === 2) return 0.4; // Further lines
    return 0.2; // Very distant lines - almost black
  };

  // Get word index within the current line
  const getWordIndexInLine = (globalWordIndex: number): number => {
    let wordCount = 0;
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const lineWordCount = lines[lineIndex].length;
      if (globalWordIndex >= wordCount && globalWordIndex < wordCount + lineWordCount) {
        return globalWordIndex - wordCount;
      }
      wordCount += lineWordCount;
    }
    return -1;
  };

  // Detect user scrolling
  const handleScroll = () => {
    setIsUserScrolling(true);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 1500);
  };

  // Auto-scroll to current line
  useEffect(() => {
    if (containerRef.current && !isUserScrolling) {
      const lineElements = containerRef.current.querySelectorAll('[data-line-index]');
      const currentLineElement = lineElements[currentLineIndex] as HTMLElement;
      
      if (currentLineElement) {
        currentLineElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }, [currentLineIndex, isUserScrolling]);

  // Initial scroll to first line on mount with delay to ensure DOM is ready
  useEffect(() => {
    const scrollToFirstLine = () => {
      if (containerRef.current) {
        const lineElements = containerRef.current.querySelectorAll('[data-line-index]');
        const firstLineElement = lineElements[0] as HTMLElement;
        
        if (firstLineElement) {
          firstLineElement.scrollIntoView({
            behavior: 'auto', // Use 'auto' for immediate positioning
            block: 'center'
          });
        }
      }
    };

    // Immediate scroll
    scrollToFirstLine();
    
    // Delayed scroll to ensure DOM is fully rendered
    const timeoutId = setTimeout(scrollToFirstLine, 100);
    
    return () => clearTimeout(timeoutId);
  }, []);

  // Force scroll to first line when song starts (first word becomes highlighted)
  useEffect(() => {
    if (highlightedIndex === 0 && containerRef.current) {
      const lineElements = containerRef.current.querySelectorAll('[data-line-index]');
      const firstLineElement = lineElements[0] as HTMLElement;
      
      if (firstLineElement) {
        firstLineElement.scrollIntoView({
          behavior: 'auto',
          block: 'center'
        });
      }
    }
  }, [highlightedIndex]);

  return (
    <div 
      className="fixed inset-0 z-50 cursor-pointer overflow-hidden"
      onClick={onClose}
      style={{
        background: '#000000'
      }}
    >
      {/* Album Cover Background */}
      {albumCoverUrl && (
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${albumCoverUrl})`,
            opacity: 0.11 // 89% opacity over black = 11% visible
          }}
        />
      )}
      
      {/* Lyrics Container */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="absolute inset-0 overflow-y-auto px-8 py-16 flex flex-col justify-center"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
      >
        <style>{`
          .fullscreen-karaoke::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        
        <div className="max-w-6xl mx-auto space-y-6">
          {lines.map((line, lineIndex) => {
            const lineOpacity = getLineOpacity(lineIndex);
            let globalWordIndex = 0;
            
            // Calculate the starting global index for this line
            for (let i = 0; i < lineIndex; i++) {
              globalWordIndex += lines[i].length;
            }
            
            return (
              <div 
                key={`line-${lineIndex}`}
                data-line-index={lineIndex}
                className="text-center leading-relaxed transition-all duration-500"
                style={{
                  opacity: lineOpacity,
                  textShadow: lineIndex === currentLineIndex 
                    ? '0 0 20px rgba(255, 255, 255, 0.5), 0 0 40px rgba(255, 255, 255, 0.3)' 
                    : '0 0 10px rgba(0, 0, 0, 0.8)'
                }}
              >
                {line.map((word, wordIndexInLine) => {
                  const currentGlobalIndex = globalWordIndex + wordIndexInLine;
                  const isHighlighted = currentGlobalIndex === highlightedIndex;
                  const isPast = currentTime > word.end;
                  const isNonSung = isNonSungWord(word.word);
                  
                  return (
                    <span
                      key={`word-${currentGlobalIndex}`}
                      className={cn(
                        "inline-block transition-all duration-300",
                        {
                          "animate-pulse": isHighlighted && isPlaying,
                        }
                      )}
                      style={{
                        fontSize: lineIndex === currentLineIndex 
                          ? (isHighlighted ? '4rem' : '3.5rem') 
                          : '2.5rem',
                        fontWeight: lineIndex === currentLineIndex ? '700' : '500',
                        color: isNonSung 
                          ? `rgba(249, 44, 143, ${lineOpacity})` // Pink color for non-sung words
                          : isHighlighted && lineIndex === currentLineIndex
                            ? '#ffffff'
                            : `rgba(255, 255, 255, ${lineOpacity})`,
                        textShadow: isHighlighted && lineIndex === currentLineIndex
                          ? '0 0 30px rgba(255, 255, 255, 0.8), 0 0 60px rgba(255, 255, 255, 0.4)'
                          : lineIndex === currentLineIndex
                            ? '0 0 15px rgba(255, 255, 255, 0.3)'
                            : '0 0 10px rgba(0, 0, 0, 0.8)',
                        paddingLeft: isHighlighted && lineIndex === currentLineIndex ? '0.5rem' : '0.25rem',
                        paddingRight: isHighlighted && lineIndex === currentLineIndex ? '0.5rem' : '0.25rem',
                        marginLeft: '0.125rem',
                        marginRight: '0.125rem',
                        position: 'relative',
                        zIndex: isHighlighted && lineIndex === currentLineIndex ? 10 : 1,
                        transformOrigin: 'center',
                        whiteSpace: 'nowrap',
                        contain: 'layout style',
                        willChange: 'font-size, color, padding',
                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                    >
                      {word.word.replace(/\n/g, ' ')}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Subtle exit hint */}
      <div className="absolute top-8 right-8 text-white/40 text-sm">
        Click anywhere to exit
      </div>
    </div>
  );
};