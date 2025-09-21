import React, { useEffect } from "react";
import { Loader2 } from "lucide-react";

interface NewSessionConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onStartSession: () => void;
}

export function NewSessionConfirmationDialog({
  isOpen,
  onClose,
  onStartSession
}: NewSessionConfirmationDialogProps) {
  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleStartSession = () => {
    onStartSession();
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md"
      onClick={onClose}
    >
      {/* Dialog */}
      <div 
        className="relative bg-black/70 rounded-2xl w-[520px] p-6 mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-medium text-white mb-4">
            You're about to start a new session
          </h2>
          <div className="relative flex justify-center">
            <Loader2 
              className="w-8 h-8 animate-spin text-pink-500" 
              style={{
                filter: 'drop-shadow(0 0 8px rgba(236, 72, 153, 0.6)) drop-shadow(0 0 16px rgba(236, 72, 153, 0.4))',
                animationDuration: '1s'
              }}
            />
          </div>
        </div>

        {/* Button */}
        <div className="flex justify-center">
          <button
            onClick={handleStartSession}
            className="relative h-12 px-8 rounded-xl bg-gray-500/20 text-white hover:text-white transition-all duration-200 font-medium overflow-hidden group"
          >
            <span className="relative z-10">Start Session</span>
            <div className="absolute inset-0 bg-accent-primary transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
          </button>
        </div>
      </div>
    </div>
  );
}