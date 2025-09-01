import React, { useEffect } from "react";
import { Session } from "@/types/session";
import { CyberButton } from "@/components/cyber/CyberButton";

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
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/70" />
      
      {/* Dialog */}
      <div 
        className="relative bg-black/70 rounded-2xl border border-white/10 w-[400px] p-6 mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-medium text-white mb-2">
            You're about to leave your current session
          </h2>
          <p className="text-sm text-white/60">
            Loading "{session.title}"
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-3">
          <CyberButton
            variant="primary"
            onClick={handleLoadSession}
            className="h-12"
          >
            Load Session
          </CyberButton>
          
          <button
            onClick={handleDeleteSession}
            className="h-12 px-4 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 hover:border-red-500/50 transition-all duration-200 font-medium"
          >
            Delete Session
          </button>
        </div>
      </div>
    </div>
  );
}