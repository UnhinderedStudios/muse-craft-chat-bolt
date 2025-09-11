import React, { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Filter, Search, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { SessionItem } from "./SessionItem";
import { Session } from "@/types/session";
import { toast } from "sonner";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { SessionConfirmationDialog } from "./SessionConfirmationDialog";
import { useSessionManager } from "@/hooks/use-session-manager";

interface SessionsPanelProps {
  className?: string;
  onSessionSwitch?: (sessionId: string) => void;
}

export function SessionsPanel({ className, onSessionSwitch }: SessionsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);
  
  // Use session manager instead of mock data
  const {
    sessions,
    currentSessionId,
    createSession,
    deleteSession,
    renameSession,
    duplicateSession,
    switchToSession
  } = useSessionManager();
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const sessionsPerPage = 10;
  
  // Session confirmation dialog state
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Filter sessions based on search query
  const filteredSessions = searchQuery.trim() === "" 
    ? sessions 
    : sessions.filter(session => 
        session.title.toLowerCase().includes(searchQuery.toLowerCase())
      );

  // Sessions are already sorted by the session manager (Global first, then by last modified)
  const sortedSessions = filteredSessions;

  // Calculate pagination
  const totalPages = Math.ceil(sortedSessions.length / sessionsPerPage);
  const startIndex = (currentPage - 1) * sessionsPerPage;
  const endIndex = startIndex + sessionsPerPage;
  const paginatedSessions = sortedSessions.slice(startIndex, endIndex);

  // Handle search input changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setIsSearchMode(value.trim() !== "");
    setCurrentPage(1); // Reset to first page when searching
  };

  // Clear search and restore original state
  const clearSearch = () => {
    setSearchQuery("");
    setIsSearchMode(false);
    setCurrentPage(1);
  };

  // Handle page changes
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Create new session
  const handleCreateSession = () => {
    const sessionId = createSession();
    const newSession = sessions.find(s => s.id === sessionId);
    if (newSession) {
      toast.success(`Created new session: "${newSession.title}"`);
    }
  };

  // Handle session menu actions
  const handleSessionAction = (sessionId: string, action: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    switch (action) {
      case 'open':
        switchToSession(sessionId);
        onSessionSwitch?.(sessionId);
        toast.success(`Opened session: "${session.title}"`);
        break;
      case 'rename':
        // This will be handled by the inline edit
        break;
      case 'duplicate':
        const newSessionId = duplicateSession(sessionId);
        if (newSessionId) {
          toast.success(`Duplicated session: "${session.title}"`);
        }
        break;
      case 'export':
        toast.success(`Exporting session: "${session.title}"`);
        break;
      case 'delete':
        if (deleteSession(sessionId)) {
          toast.success(`Deleted session: "${session.title}"`);
        } else {
          toast.error("Cannot delete Global session");
        }
        break;
      default:
        console.log(`Action ${action} on session ${sessionId}`);
    }
  };

  // Handle session title edit
  const handleTitleEdit = (sessionId: string, newTitle: string) => {
    if (renameSession(sessionId, newTitle)) {
      toast.success("Session renamed successfully");
    } else {
      toast.error("Cannot rename Global session");
    }
  };

  // Handle session click
  const handleSessionClick = (session: any) => {
    setSelectedSession(session);
    setIsDialogOpen(true);
  };

  // Handle dialog actions
  const handleLoadSession = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      switchToSession(sessionId);
      onSessionSwitch?.(sessionId);
      toast.success(`Loaded session: "${session.title}"`);
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    if (deleteSession(sessionId)) {
      toast.success(`Deleted session`);
    } else {
      toast.error("Cannot delete Global session");
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedSession(null);
  };

  return (
    <div className={cn("h-full bg-[#151515] rounded-2xl flex flex-col", className)}>
      {/* Header with New Session Button */}
      <div className="shrink-0 px-2 pt-3 pb-2">
        <div className="flex items-center justify-center mb-3">
          <Button
            onClick={handleCreateSession}
            className="w-full h-9 bg-accent-primary hover:bg-accent-primary/80 text-white font-medium px-4 rounded-xl flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Session
          </Button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search sessions..."
            className="w-full bg-[#1e1e1e] border-0 text-white placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-white/20 pr-20 rounded-xl"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <button className="text-white/40 hover:text-white/60 transition-colors">
              <Filter className="w-4 h-4" />
            </button>
            <button
              onClick={isSearchMode ? clearSearch : undefined}
              className="text-white/40 hover:text-white/60 transition-colors"
            >
              {isSearchMode ? (
                <X className="w-4 h-4" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Search Results Count */}
        {isSearchMode && (
          <div className="text-xs text-white/40 mt-2">
            {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''} found
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full overflow-y-auto overflow-x-hidden lyrics-scrollbar">
          <div className="min-h-full flex flex-col justify-start gap-2 px-2 pb-4">
            {/* Session Items */}
            {paginatedSessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                onMenuAction={handleSessionAction}
                onTitleEdit={session.id === 'global' ? undefined : handleTitleEdit}
                onSessionClick={handleSessionClick}
                isActive={session.id === currentSessionId}
                isGlobal={session.id === 'global'}
              />
            ))}

            {/* Empty State */}
            {sortedSessions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="text-white/60 mb-2">
                  {isSearchMode ? 
                    "No sessions found" : 
                    "No sessions yet"
                  }
                </div>
                {!isSearchMode && (
                  <button
                    onClick={handleCreateSession}
                    className="text-sm text-accent-primary hover:text-accent-primary/80 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Create your first session
                  </button>
                )}
              </div>
            )}
            
            {/* Pagination */}
            {sortedSessions.length > sessionsPerPage && (
              <div className="mt-2 flex justify-center px-6 py-1">
                <Pagination className="w-auto">
                  <PaginationContent className="gap-0.5 text-xs">
                     <PaginationItem>
                       <PaginationPrevious
                         href="#"
                         onClick={(e) => {
                           e.preventDefault();
                           handlePageChange(currentPage - 1);
                         }}
                         className={cn(
                           "h-6 px-1.5 text-xs",
                           currentPage === 1 ? "pointer-events-none text-white/20 hover:text-white/20" : ""
                         )}
                       />
                     </PaginationItem>
                    
                    {Array.from({ length: totalPages }, (_, index) => {
                      const page = index + 1;
                      return (
                         <PaginationItem key={page}>
                           <PaginationLink
                             href="#"
                             onClick={(e) => {
                               e.preventDefault();
                               handlePageChange(page);
                             }}
                             isActive={currentPage === page}
                             className="h-6 w-6 text-xs"
                           >
                             {page}
                           </PaginationLink>
                         </PaginationItem>
                      );
                    })}
                    
                     <PaginationItem>
                       <PaginationNext
                         href="#"
                         onClick={(e) => {
                           e.preventDefault();
                           handlePageChange(currentPage + 1);
                         }}
                         className={cn(
                           "h-6 px-1.5 text-xs",
                           currentPage === totalPages ? "pointer-events-none text-white/20 hover:text-white/20" : ""
                         )}
                       />
                     </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Session Confirmation Dialog */}
      <SessionConfirmationDialog
        session={selectedSession}
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        onLoadSession={handleLoadSession}
        onDeleteSession={handleDeleteSession}
      />
    </div>
  );
}