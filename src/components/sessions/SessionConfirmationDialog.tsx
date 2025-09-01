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
          <Loader2 className="w-6 h-6 animate-spin text-blue-400 mx-auto" />
        </div>

        {/* Buttons */}
        <div className="flex gap-4">
          <button
            onClick={handleLoadSession}
            className="h-12 px-4 rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-all duration-200 font-medium flex-1"
          >
            Load {session.title}...
          </button>
          
          <button
            onClick={handleDeleteSession}
            className="h-12 px-4 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all duration-200 font-medium flex-1"
          >
            Delete Session
          </button>
        </div>
      </div>
    </div>
  );
}