import React, { useState } from "react";
import { AnimatedOrb } from "./AnimatedOrb";
import { VoiceChatLog } from "./VoiceChatLog";
import { useVoiceChat } from "@/hooks/use-voice-chat";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Volume2, VolumeX, X } from "lucide-react";
import { ChatMessage } from "@/types";

interface VoiceInterfaceProps {
  onClose: () => void;
  messages: ChatMessage[];
  sendMessage: (message: string, systemPrompt: string, attachments?: any[]) => Promise<ChatMessage | null>;
}

export const VoiceInterface: React.FC<VoiceInterfaceProps> = ({ onClose, messages, sendMessage }) => {
  const {
    isRecording,
    isPlaying,
    isProcessing,
    startRecording,
    stopRecording,
    stopConversation,
    toggleMute,
    isMuted,
    volume,
    setVolume,
    isListening,
    currentTranscript
  } = useVoiceChat({ messages, sendMessage });

  const [showChatLog, setShowChatLog] = useState(true);

  const getOrbState = () => {
    if (isProcessing) return "processing";
    if (isPlaying) return "speaking";
    if (isListening || isRecording) return "listening";
    return "idle";
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-8">
      {/* Close Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          // Stop conversation before closing
          stopConversation();
          onClose();
        }}
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
          
          {/* Controls Row - directly under orb */}
          <div className="flex items-center justify-center space-x-6">
            {/* Chat Log Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowChatLog(!showChatLog)}
              className="w-12 h-12 rounded-full text-text-secondary hover:text-text-primary border border-white/20 hover:border-white/40 transition-all"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </Button>

            {/* Volume Control */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              className="w-12 h-12 rounded-full text-text-secondary hover:text-text-primary border border-white/20 hover:border-white/40 transition-all"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </Button>

            {/* Main Voice Control */}
            <Button
              onClick={isListening ? stopRecording : startRecording}
              disabled={isProcessing}
              className={`w-16 h-16 rounded-full transition-all duration-200 ${
                isListening || isRecording
                  ? 'bg-red-500 hover:bg-red-600 scale-110 shadow-[0_0_40px_rgba(239,68,68,0.6)]' 
                  : 'bg-accent-primary hover:bg-accent-primary/90 shadow-[0_0_20px_rgba(202,36,116,0.4)]'
              }`}
            >
              {isListening || isRecording ? (
                <MicOff className="w-6 h-6 text-white" />
              ) : (
                <Mic className="w-6 h-6 text-white" />
              )}
            </Button>

            {/* Volume Slider */}
            <div className="flex items-center space-x-2 px-3 py-2 rounded-full border border-white/20 bg-black/20 backdrop-blur-sm">
              <Volume2 className="w-4 h-4 text-text-secondary" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-16 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer 
                           [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 
                           [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full 
                           [&::-webkit-slider-thumb]:bg-accent-primary [&::-webkit-slider-thumb]:shadow-md"
              />
              <span className="text-xs text-text-secondary min-w-[2rem]">{Math.round(volume * 100)}</span>
            </div>
          </div>
          
          {/* Status Text */}
          <div className="text-center space-y-2 mt-4">
            <p className="text-lg text-text-primary font-medium">
              {isProcessing && "Processing..."}
              {isPlaying && "Speaking..."}
              {(isListening || isRecording) && "Listening..."}
              {!isProcessing && !isPlaying && !isListening && !isRecording && "Ready to chat"}
            </p>
            {currentTranscript && !isPlaying && (
              <div className="bg-[hsl(var(--chat-bubble))] backdrop-blur rounded-lg p-3 max-w-md border border-white/10">
                <p className="text-sm text-[hsl(var(--chat-text))] italic">"{currentTranscript}"</p>
              </div>
            )}
            <p className="text-sm text-text-secondary">
              {isListening || isRecording ? "Speak now..." : "Click to start conversation"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};