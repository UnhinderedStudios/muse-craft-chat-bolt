import React, { forwardRef } from "react";
import { CyberButton } from "@/components/cyber/CyberButton";
import { Textarea } from "@/components/ui/textarea";
import { Dice5, Mic, Upload, Plus, List } from "lucide-react";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (message: string) => void;
  onFileAttach: () => void;
  disabled?: boolean;
  attachedFiles: any[];
  onRemoveAttachment: (index: number) => void;
}

export const ChatInput = forwardRef<HTMLTextAreaElement, ChatInputProps>(({
  value,
  onChange,
  onSend,
  onFileAttach,
  disabled = false,
  attachedFiles,
  onRemoveAttachment
}, ref) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        onSend(value);
      }
    }
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#151515] via-[#151515]/95 to-transparent pt-8 pb-4">
      <div className="px-8">
        <div className="space-y-4">
          {/* Chat Input */}
          <div className="relative">
            <Textarea
              ref={ref}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe the song you want to create..."
              className="min-h-[60px] max-h-[120px] bg-card-alt border-border-main text-text-primary placeholder:text-text-secondary pr-16 py-4 pl-4 rounded-input resize-none chat-input-scrollbar"
              disabled={disabled}
            />
            <CyberButton
              variant="icon"
              onClick={() => value.trim() && onSend(value)}
              disabled={!value.trim() || disabled}
              className="absolute bottom-2 right-2"
            >
              <Plus className="w-4 h-4" />
            </CyberButton>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <CyberButton 
              variant="icon" 
              onClick={onFileAttach}
              disabled={disabled}
            >
              <Upload className="w-4 h-4" />
            </CyberButton>
          </div>
        </div>
      </div>
    </div>
  );
});

ChatInput.displayName = "ChatInput";