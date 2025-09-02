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

interface SessionsPanelProps {
  className?: string;
}

// Mock data for development - more sessions to trigger scrollbar
const mockSessions: Session[] = [
  { 
    id: "session-1", 
    title: "Synthwave Collection",
    createdAt: Date.now() - 86400000, // 1 day ago
    lastModified: Date.now() - 3600000 // 1 hour ago
  },
  { 
    id: "session-2", 
    title: "Acoustic Sessions",
    createdAt: Date.now() - 172800000, // 2 days ago
    lastModified: Date.now() - 7200000 // 2 hours ago
  },
  { 
    id: "session-3", 
    title: "Electronic Experiments",
    createdAt: Date.now() - 259200000, // 3 days ago
    lastModified: Date.now() - 14400000 // 4 hours ago
  },
  { 
    id: "session-4", 
    title: "Jazz Fusion Project",
    createdAt: Date.now() - 345600000, // 4 days ago
    lastModified: Date.now() - 86400000 // 1 day ago
  },
  { 
    id: "session-5", 
    title: "Lo-Fi Hip Hop Vibes",
    createdAt: Date.now() - 432000000, // 5 days ago
    lastModified: Date.now() - 172800000 // 2 days ago
  },
  { 
    id: "session-6", 
    title: "Rock Anthem Session",
    createdAt: Date.now() - 518400000, // 6 days ago
    lastModified: Date.now() - 259200000 // 3 days ago
  },
  { 
    id: "session-7", 
    title: "Ambient Soundscapes",
    createdAt: Date.now() - 604800000, // 7 days ago
    lastModified: Date.now() - 345600000 // 4 days ago
  },
  { 
    id: "session-8", 
    title: "Country Roads Mix",
    createdAt: Date.now() - 691200000, // 8 days ago
    lastModified: Date.now() - 432000000 // 5 days ago
  },
  { 
    id: "session-9", 
    title: "Classical Crossover",
    createdAt: Date.now() - 777600000, // 9 days ago
    lastModified: Date.now() - 518400000 // 6 days ago
  },
  { 
    id: "session-10", 
    title: "Reggae Sunset Session",
    createdAt: Date.now() - 864000000, // 10 days ago
    lastModified: Date.now() - 604800000 // 7 days ago
  },
  { 
    id: "session-11", 
    title: "Punk Revival Project",
    createdAt: Date.now() - 950400000, // 11 days ago
    lastModified: Date.now() - 691200000 // 8 days ago
  },
  { 
    id: "session-12", 
    title: "Orchestral Arrangements",
    createdAt: Date.now() - 1036800000, // 12 days ago
    lastModified: Date.now() - 777600000 // 9 days ago
  }
];

export function SessionsPanel({ className }: SessionsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [sessions, setSessions] = useState<Session[]>(mockSessions);
  
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

  // Sort sessions by last modified (newest first)
  const sortedSessions = [...filteredSessions].sort((a, b) => b.lastModified - a.lastModified);

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
    const newSession: Session = {
      id: `session_${Date.now()}`,
      title: `Session ${sessions.length + 1}`,
      createdAt: Date.now(),
      lastModified: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    toast.success(`Created new session: "${newSession.title}"`);
  };

  // Handle session menu actions
  const handleSessionAction = (sessionId: string, action: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    switch (action) {
      case 'open':
        toast.success(`Opening session: "${session.title}"`);
        break;
      case 'rename':
        // This will be handled by the inline edit
        break;
      case 'duplicate':
        const duplicatedSession: Session = {
          id: `session_${Date.now()}`,
          title: `${session.title} (Copy)`,
          createdAt: Date.now(),
          lastModified: Date.now()
        };
        setSessions(prev => [duplicatedSession, ...prev]);
        toast.success(`Duplicated session: "${session.title}"`);
        break;
      case 'export':
        toast.success(`Exporting session: "${session.title}"`);
        break;
      case 'delete':
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        toast.success(`Deleted session: "${session.title}"`);
        break;
      default:
        console.log(`Action ${action} on session ${sessionId}`);
    }
  };

  // Handle session title edit
  const handleTitleEdit = (sessionId: string, newTitle: string) => {
    setSessions(prev => prev.map(session => 
      session.id === sessionId 
        ? { ...session, title: newTitle, lastModified: Date.now() }
        : session
    ));
    toast.success("Session renamed successfully");
  };

  // Handle session click
  const handleSessionClick = (session: Session) => {
    setSelectedSession(session);
    setIsDialogOpen(true);
  };

  // Handle dialog actions
  const handleLoadSession = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      toast.success(`Loading session: "${session.title}"`);
      // Add session loading logic here
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      toast.success(`Deleted session: "${session.title}"`);
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedSession(null);
  };

  return (
    <div className={cn("h-full bg-[#151515] rounded-2xl flex flex-col", className)}>
      {/* Header with Title and New Session Button */}
      <div className="shrink-0 px-2 pt-3 pb-2">
        {/* Menu Title */}
        <div className="px-2 mb-3">
          <h2 className="text-white font-semibold text-lg">Menu</h2>
        </div>
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
                onTitleEdit={handleTitleEdit}
                onSessionClick={handleSessionClick}
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