import React from "react";
import { CyberButton } from "@/components/cyber/CyberButton";
import { Textarea } from "@/components/ui/textarea";
import { Dice5, Mic, Upload, Grid3X3, Plus, List } from "lucide-react";

interface ChatInputProps {
  input: string;
  setInput: (input: string) => void;
  onSend: () => void;
  onRandomize: () => void;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  onSend,
  onRandomize,
  disabled = false
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#151515] via-[#151515]/95 to-transparent pt-8 pb-4">
      <div className="px-8">
        <div className="space-y-4">
          {/* Chat Input */}
          <div className="relative">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe the song you want to create..."
              className="min-h-[60px] max-h-[120px] bg-card-alt border-border-main text-text-primary placeholder:text-text-secondary pr-16 py-4 pl-4 rounded-input resize-none chat-input-scrollbar"
              disabled={disabled}
            />
            <CyberButton
              variant="icon"
              onClick={onSend}
              disabled={!input.trim() || disabled}
              className="absolute bottom-2 right-2"
            >
              <Plus className="w-4 h-4" />
            </CyberButton>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <CyberButton variant="icon" disabled={disabled}>
              <Upload className="w-4 h-4" />
            </CyberButton>
            <CyberButton variant="icon" disabled={disabled}>
              <Mic className="w-4 h-4" />
            </CyberButton>
            <CyberButton 
              variant="icon" 
              onClick={onRandomize}
              disabled={disabled}
            >
              <Dice5 className="w-4 h-4" />
            </CyberButton>
            <CyberButton variant="icon" disabled={disabled}>
              <Grid3X3 className="w-4 h-4" />
            </CyberButton>
            <CyberButton variant="icon" disabled={disabled}>
              <List className="w-4 h-4" />
            </CyberButton>
          </div>
        </div>
      </div>
    </div>
  );
};