import React, { useEffect } from "react";
import { Session } from "@/types/session";
import { CyberButton } from "@/components/cyber/CyberButton";
import { Loader2 } from "lucide-react";

interface SessionConfirmationDialogProps {
  session: Session | null;
  isOpen: boolean;
  onClose: () => void;
  onLoadSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

export function SessionConfirmationDialog({
  session,
  isOpen,
  onClose,
  onLoadSession,
  onDeleteSession
}: SessionConfirmationDialogProps) {
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

  if (!isOpen || !session) return null;

  const handleLoadSession = () => {
    onLoadSession(session.id);
    onClose();
  };

  const handleDeleteSession = () => {
    onDeleteSession(session.id);
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
            You're about to leave your current session
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

        {/* Buttons */}
        <div className="flex gap-4">
          <button
            onClick={handleLoadSession}
            className="h-12 px-4 rounded-xl bg-pink-600 text-white hover:bg-pink-500 transition-all duration-200 font-medium flex-1"
          >
            Load Selected
          </button>
          
          <button
            onClick={handleDeleteSession}
            className="relative h-12 px-4 rounded-xl bg-gray-500/20 text-white hover:text-white transition-all duration-200 font-medium flex-1 overflow-hidden group"
          >
            <span className="relative z-10">Delete Session</span>
            <div className="absolute inset-0 bg-red-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
          </button>
        </div>
      </div>
    </div>
  );
}