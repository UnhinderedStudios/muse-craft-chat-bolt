import React, { useState } from "react";
import { AnimatedOrb } from "./AnimatedOrb";
import { VoiceChatLog } from "./VoiceChatLog";
import { useVoiceChat } from "@/hooks/use-voice-chat";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Volume2, VolumeX, X } from "lucide-react";

interface VoiceInterfaceProps {
  onClose: () => void;
}

export const VoiceInterface: React.FC<VoiceInterfaceProps> = ({ onClose }) => {
  const {
    messages,
    isRecording,
    isPlaying,
    isProcessing,
    startRecording,
    stopRecording,
    toggleMute,
    isMuted,
    volume,
    setVolume
  } = useVoiceChat();

  const [showChatLog, setShowChatLog] = useState(true);

  const getOrbState = () => {
    if (isProcessing) return "processing";
    if (isPlaying) return "speaking";
    if (isRecording) return "listening";
    return "idle";
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-background via-background/95 to-accent/10 p-8">
      {/* Close Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="absolute top-4 right-4 z-50 text-text-secondary hover:text-text-primary"
      >
        <X className="w-6 h-6" />
      </Button>

      {/* Title */}
      <div className="absolute top-8 left-1/2 transform -translate-x-1/2">
        <h2 className="text-2xl font-bold text-text-primary">Melody Speech</h2>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex items-center justify-center w-full max-w-4xl">
        {/* Chat Log */}
        {showChatLog && (
          <div className="absolute left-8 top-20 bottom-24 w-80">
            <VoiceChatLog messages={messages} />
          </div>
        )}

        {/* Central Orb */}
        <div className="flex flex-col items-center space-y-8">
          <AnimatedOrb state={getOrbState()} />
          
          {/* Status Text */}
          <div className="text-center space-y-2">
            <p className="text-lg text-text-primary font-medium">
              {isProcessing && "Processing..."}
              {isPlaying && "Speaking..."}
              {isRecording && "Listening..."}
              {!isProcessing && !isPlaying && !isRecording && "Ready to chat"}
            </p>
            <p className="text-sm text-text-secondary">
              {isRecording ? "Release to send" : "Hold to speak"}
            </p>
          </div>
        </div>

        {/* Controls Panel */}
        <div className="absolute right-8 top-20 space-y-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowChatLog(!showChatLog)}
            className="text-text-secondary hover:text-text-primary"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            className="text-text-secondary hover:text-text-primary"
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </Button>

          {/* Volume Slider */}
          <div className="flex flex-col items-center space-y-2">
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-20 h-2 bg-surface-secondary rounded-lg appearance-none cursor-pointer 
                         [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 
                         [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full 
                         [&::-webkit-slider-thumb]:bg-accent-primary"
              style={{ transform: 'rotate(-90deg)' }}
            />
          </div>
        </div>
      </div>

      {/* Main Voice Control */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
        <Button
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          disabled={isProcessing || isPlaying}
          className={`w-20 h-20 rounded-full transition-all duration-200 ${
            isRecording 
              ? 'bg-red-500 hover:bg-red-600 scale-110 shadow-[0_0_40px_rgba(239,68,68,0.6)]' 
              : 'bg-accent-primary hover:bg-accent-primary/90 shadow-[0_0_20px_rgba(202,36,116,0.4)]'
          }`}
        >
          {isRecording ? (
            <MicOff className="w-8 h-8 text-white" />
          ) : (
            <Mic className="w-8 h-8 text-white" />
          )}
        </Button>
      </div>
    </div>
  );
};