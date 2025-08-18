import React from "react";
import { cn } from "@/lib/utils";
import { CyberChip } from "@/components/cyber/CyberChip";
import { ParsedSongRequest } from "@/lib/parseSongRequest";

interface ChatSongPreviewProps {
  songRequest: ParsedSongRequest;
  className?: string;
}

export const ChatSongPreview: React.FC<ChatSongPreviewProps> = ({ 
  songRequest, 
  className 
}) => {
  // Parse style into individual elements
  const styleElements = songRequest.style.split(",").map(s => s.trim()).filter(Boolean);
  
  // Format lyrics with proper section headers
  const formatLyrics = (lyrics: string) => {
    return lyrics
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        // Check if line is a section header
        const sectionHeaders = ['Intro:', 'Verse:', 'Pre-Chorus:', 'Chorus:', 'Bridge:', 'Outro:', 'Verse 1:', 'Verse 2:', 'Chorus 1:', 'Chorus 2:'];
        const isHeader = sectionHeaders.some(header => line.startsWith(header));
        
        if (isHeader) {
          return (
            <div key={index} className="mt-4 first:mt-0">
              <h4 className="text-accent-primary font-semibold text-sm mb-2 uppercase tracking-wide">
                {line.replace(':', '')}
              </h4>
            </div>
          );
        } else {
          return (
            <p key={index} className="text-text-primary/90 leading-relaxed mb-1">
              {line}
            </p>
          );
        }
      });
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Style chips */}
      <div className="flex flex-wrap gap-2">
        {styleElements.map((element, index) => (
          <CyberChip 
            key={index} 
            variant={index % 2 === 0 ? "purple" : "teal"}
          >
            {element}
          </CyberChip>
        ))}
      </div>

      {/* Lyrics */}
      {songRequest.lyrics && (
        <div className="bg-black/20 border border-accent-primary/20 rounded-lg p-4">
          <h4 className="text-white font-bold text-lg mb-3 uppercase tracking-wide">
            {songRequest.title}
          </h4>
          <div className="space-y-1">
            {formatLyrics(songRequest.lyrics)}
          </div>
        </div>
      )}
    </div>
  );
};