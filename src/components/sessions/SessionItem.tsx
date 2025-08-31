import React, { useState } from "react";
import { MoreVertical, Clock, Edit3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Session } from "@/types/session";
import EllipsisMarquee from "@/components/ui/EllipsisMarquee";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

interface SessionItemProps {
  session: Session;
  onMenuAction: (sessionId: string, action: string) => void;
  onTitleEdit?: (sessionId: string, newTitle: string) => void;
}

export function SessionItem({ session, onMenuAction, onTitleEdit }: SessionItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(session.title);
  
  const handleMenuAction = (action: string) => {
    onMenuAction(session.id, action);
  };

  const handleTitleClick = () => {
    setIsEditing(true);
    setEditTitle(session.title);
  };

  const handleTitleSubmit = () => {
    if (editTitle.trim() && editTitle.trim() !== session.title) {
      onTitleEdit?.(session.id, editTitle.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSubmit();
    } else if (e.key === 'Escape') {
      setEditTitle(session.title);
      setIsEditing(false);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div 
      className={cn(
        "group bg-[#1e1e1e] rounded-xl px-3 py-2 cursor-pointer hover:bg-[#252525] transition-all duration-200"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center gap-1">
        {/* Icon - Fixed width */}
        <div className="flex-none w-8 h-8 rounded-md bg-black/30 flex items-center justify-center">
          <Clock className="w-4 h-4 text-white/60" />
        </div>

        {/* Title area - Flexible with overflow handling */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {isEditing ? (
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={handleKeyDown}
              className="w-full text-sm font-medium bg-transparent border-white/20 text-white"
              autoFocus
            />
          ) : (
            <div 
              onClick={handleTitleClick}
              className="flex items-center gap-1 group/title"
            >
              <EllipsisMarquee
                text={session.title}
                className="w-full text-sm font-medium text-white"
                speedPxPerSec={70}
                gapPx={32}
                isActive={isHovered}
              />
              <Edit3 className="w-3 h-3 text-white/40 opacity-0 group-hover/title:opacity-100 transition-opacity" />
            </div>
          )}
          <div className="text-xs text-white/60 truncate">
            Created: {formatDate(session.createdAt)} - Last modified: {formatDateTime(session.lastModified)}
          </div>
        </div>

        {/* 3-dot Menu - Fixed width */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              className="flex-none opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center text-white/60 hover:text-white transition-all duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="w-48 bg-[#1e1e1e] border-white/10"
          >
            <DropdownMenuItem 
              onClick={() => handleMenuAction('open')}
              className="text-white hover:bg-white/10 focus:bg-white/10"
            >
              Open Session
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem 
              onClick={() => handleMenuAction('rename')}
              className="text-white hover:bg-white/10 focus:bg-white/10"
            >
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleMenuAction('duplicate')}
              className="text-white hover:bg-white/10 focus:bg-white/10"
            >
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem 
              onClick={() => handleMenuAction('export')}
              className="text-white hover:bg-white/10 focus:bg-white/10"
            >
              Export
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleMenuAction('delete')}
              className="text-red-400 hover:bg-red-500/10 focus:bg-red-500/10"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}