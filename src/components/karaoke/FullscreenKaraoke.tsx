import React, { useEffect, useState } from "react";
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

  // Handle escape key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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

  // Group words into lines respecting natural line breaks
  const groupWordsIntoLines = (words: TimestampedWord[]): TimestampedWord[][] => {
    const lines: TimestampedWord[][] = [];
    let currentLine: TimestampedWord[] = [];
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      
      // Check if the word contains a line break
      if (word.word.includes('\n')) {
        const parts = word.word.split('\n');
        
        // Add the part before the line break to the current line
        if (parts[0].trim()) {
          currentLine.push({
            ...word,
            word: parts[0].trim()
          });
        }
        
        // Finish the current line
        if (currentLine.length > 0) {
          lines.push(currentLine);
          currentLine = [];
        }
        
        // Add any parts after the line break to new lines
        for (let j = 1; j < parts.length; j++) {
          if (parts[j].trim()) {
            if (j === parts.length - 1) {
              currentLine.push({
                ...word,
                word: parts[j].trim()
              });
            } else {
              lines.push([{
                ...word,
                word: parts[j].trim()
              }]);
            }
          }
        }
      } else {
        currentLine.push(word);
        
        // Natural break after 8-12 words or punctuation
        if (currentLine.length >= 8 && 
            (word.word.endsWith('.') || word.word.endsWith(',') || 
             word.word.endsWith('!') || word.word.endsWith('?') ||
             isNonSungWord(word.word))) {
          lines.push(currentLine);
          currentLine = [];
        }
      }
    }
    
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
    
    return lines;
  };

  const lines = groupWordsIntoLines(words);

  // Find current word and line with timing offset compensation
  useEffect(() => {
    if (words.length === 0) return;

    // Add 0.3s timing offset to compensate for delay
    const adjustedTime = currentTime + 0.3;

    let currentWordIndex = -1;
    for (let i = 0; i < words.length; i++) {
      if (adjustedTime >= words[i].start && adjustedTime <= words[i].end) {
        currentWordIndex = i;
        break;
      }
      if (i < words.length - 1 && adjustedTime > words[i].end && adjustedTime < words[i + 1].start) {
        currentWordIndex = i;
        break;
      }
      if (i === words.length - 1 && adjustedTime > words[i].end) {
        currentWordIndex = i;
        break;
      }
    }

    setHighlightedIndex(currentWordIndex);
  }, [currentTime, isPlaying, words]);

  // Find which line contains the highlighted word
  const getCurrentLineIndex = (): number => {
    if (highlightedIndex === -1) return 0;
    
    let wordCount = 0;
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const lineWordCount = lines[lineIndex].length;
      if (highlightedIndex >= wordCount && highlightedIndex < wordCount + lineWordCount) {
        return lineIndex;
      }
      wordCount += lineWordCount;
    }
    return 0;
  };

  const currentLineIndex = getCurrentLineIndex();

  // Calculate visible lines (sliding window of 5 lines: current + 2 above + 2 below)
  const getVisibleLines = () => {
    const windowSize = 5;
    const halfWindow = Math.floor(windowSize / 2);
    
    let startIndex = Math.max(0, currentLineIndex - halfWindow);
    let endIndex = Math.min(lines.length, startIndex + windowSize);
    
    // Adjust if we're near the end
    if (endIndex - startIndex < windowSize && startIndex > 0) {
      startIndex = Math.max(0, endIndex - windowSize);
    }
    
    return lines.slice(startIndex, endIndex).map((line, index) => ({
      line,
      originalIndex: startIndex + index,
      isCurrentLine: startIndex + index === currentLineIndex,
      distanceFromCurrent: Math.abs(startIndex + index - currentLineIndex)
    }));
  };

  const visibleLines = getVisibleLines();

  // Calculate vertical offset to center the current line
  const getVerticalOffset = () => {
    const totalVisibleLines = visibleLines.length;
    const currentLinePositionInWindow = visibleLines.findIndex(l => l.isCurrentLine);
    
    if (currentLinePositionInWindow === -1) return 0;
    
    // Calculate offset to center the current line
    const lineHeight = 120; // Approximate height per line in pixels
    const centerOffset = (totalVisibleLines / 2 - currentLinePositionInWindow - 0.5) * lineHeight;
    
    return centerOffset;
  };

  const verticalOffset = getVerticalOffset();

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
            opacity: 0.11
          }}
        />
      )}
      
      {/* Centered Lyrics Container - No Scrolling */}
      <div className="absolute inset-0 flex items-center justify-center px-8">
        <div 
          className="relative max-w-6xl w-full"
          style={{
            transform: `translateY(${verticalOffset}px)`,
            transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          {visibleLines.map((lineData) => {
            const { line, originalIndex, isCurrentLine, distanceFromCurrent } = lineData;
            
            // Calculate opacity based on distance from current line
            const lineOpacity = distanceFromCurrent === 0 ? 1 : 
                              distanceFromCurrent === 1 ? 0.7 : 
                              distanceFromCurrent === 2 ? 0.4 : 0.2;
            
            let globalWordIndex = 0;
            // Calculate the starting global index for this line
            for (let i = 0; i < originalIndex; i++) {
              globalWordIndex += lines[i].length;
            }
            
            return (
              <div 
                key={`line-${originalIndex}`}
                className="text-center py-8 leading-relaxed transition-all duration-500"
                style={{
                  opacity: lineOpacity,
                  textShadow: isCurrentLine 
                    ? '0 0 20px rgba(255, 255, 255, 0.5), 0 0 40px rgba(255, 255, 255, 0.3)' 
                    : '0 0 10px rgba(0, 0, 0, 0.8)'
                }}
              >
                {line.map((word, wordIndexInLine) => {
                  const currentGlobalIndex = globalWordIndex + wordIndexInLine;
                  const isHighlighted = currentGlobalIndex === highlightedIndex;
                  const isNonSung = isNonSungWord(word.word);
                  
                  return (
                    <span
                      key={`word-${currentGlobalIndex}`}
                      className="inline-block transition-all duration-300"
                      style={{
                        fontSize: isCurrentLine 
                          ? (isHighlighted ? '4rem' : '3.5rem') 
                          : '2.5rem',
                        fontWeight: isCurrentLine ? '700' : '500',
                        color: isNonSung 
                          ? `rgba(249, 44, 143, ${lineOpacity})`
                          : isHighlighted && isCurrentLine
                            ? '#ffffff'
                            : `rgba(255, 255, 255, ${lineOpacity})`,
                        textShadow: isHighlighted && isCurrentLine
                          ? '0 0 30px rgba(255, 255, 255, 0.8), 0 0 60px rgba(255, 255, 255, 0.4)'
                          : isCurrentLine
                            ? '0 0 15px rgba(255, 255, 255, 0.3)'
                            : '0 0 10px rgba(0, 0, 0, 0.8)',
                        paddingLeft: isHighlighted && isCurrentLine ? '0.5rem' : '0.25rem',
                        paddingRight: isHighlighted && isCurrentLine ? '0.5rem' : '0.25rem',
                        marginLeft: '0.125rem',
                        marginRight: '0.125rem',
                        position: 'relative',
                        zIndex: isHighlighted && isCurrentLine ? 10 : 1,
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