import React from "react";
import { Play, Pause } from "lucide-react";
import { CyberCard } from "@/components/cyber/CyberCard";
import { AudioPlayer } from "@/components/audio/AudioPlayer";
import { KaraokeLyrics } from "@/components/audio/KaraokeLyrics";
import { type TimestampedWord } from "@/types";

interface TrackListProps {
  versions: Array<{
    url: string;
    audioId: string;
    musicIndex: number;
    words: TimestampedWord[];
    hasTimestamps?: boolean;
    timestampError?: string;
  }>;
  currentAudioIndex: number;
  isPlaying: boolean;
  currentTime: number;
  details: any;
  albumCovers: any;
  onAudioPlay: (index: number) => void;
  onAudioPause: () => void;
  onTimeUpdate: (audio: HTMLAudioElement) => void;
  onSeek: (time: number) => void;
  onShowFullscreen: () => void;
  audioRefs: React.MutableRefObject<HTMLAudioElement[]>;
}

export const TrackList: React.FC<TrackListProps> = ({
  versions,
  currentAudioIndex,
  isPlaying,
  currentTime,
  details,
  albumCovers,
  onAudioPlay,
  onAudioPause,
  onTimeUpdate,
  onSeek,
  onShowFullscreen,
  audioRefs
}) => {
  if (versions.length === 0) return null;

  return (
    <div className="col-span-3 space-y-4">
      <h2 className="text-xl font-semibold text-white mb-4">Generated Tracks</h2>
      
      {versions.map((version, index) => (
        <CyberCard key={version.audioId} className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => isPlaying && currentAudioIndex === index ? onAudioPause() : onAudioPlay(index)}
                className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 flex items-center justify-center text-white transition-all duration-200"
              >
                {isPlaying && currentAudioIndex === index ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5" />
                )}
              </button>
              
              <div>
                <h3 className="font-medium text-white">
                  {details.title ? `${details.title} - Version ${version.musicIndex + 1}` : `Track ${index + 1}`}
                </h3>
                {version.hasTimestamps ? (
                  <p className="text-sm text-green-400">✓ Karaoke ready</p>
                ) : version.timestampError ? (
                  <p className="text-sm text-yellow-400">⚠ {version.timestampError}</p>
                ) : (
                  <p className="text-sm text-gray-400">Audio only</p>
                )}
              </div>
            </div>
            
            {albumCovers && (
              <div className="flex gap-2">
                <img 
                  src={albumCovers.cover1} 
                  alt="Album Cover 1" 
                  className="w-16 h-16 rounded-lg object-cover"
                />
                <img 
                  src={albumCovers.cover2} 
                  alt="Album Cover 2" 
                  className="w-16 h-16 rounded-lg object-cover"
                />
              </div>
            )}
          </div>
          
          <audio
            ref={(el) => {
              if (el) audioRefs.current[index] = el;
            }}
            src={version.url}
            onTimeUpdate={() => currentAudioIndex === index && onTimeUpdate(audioRefs.current[index])}
            controls
            className="w-full mb-4"
          />
          
          {version.hasTimestamps && version.words && (
            <div className="space-y-2">
              <KaraokeLyrics
                words={version.words}
                currentTime={currentAudioIndex === index ? currentTime : 0}
                isPlaying={isPlaying && currentAudioIndex === index}
                className="h-32"
              />
              <button
                onClick={onShowFullscreen}
                className="px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded text-white text-sm"
              >
                Fullscreen Karaoke
              </button>
            </div>
          )}
        </CyberCard>
      ))}
    </div>
  );
};