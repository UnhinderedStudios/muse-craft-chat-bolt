import React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreatePlaylistPromptProps {
  searchQuery: string;
  onCreatePlaylist: (name: string) => void;
}

export function CreatePlaylistPrompt({ searchQuery, onCreatePlaylist }: CreatePlaylistPromptProps) {
  const handleCreate = () => {
    onCreatePlaylist(searchQuery.trim());
  };

  return (
    <div className="bg-[#1e1e1e] rounded-xl p-3 border border-accent-primary/30 cursor-pointer hover:bg-[#252525] transition-colors group"
         onClick={handleCreate}>
      <div className="flex items-center gap-3">
        {/* Create Icon */}
        <div className="shrink-0 w-10 h-10 rounded-md bg-accent-primary/20 flex items-center justify-center">
          <Plus className="w-5 h-5 text-accent-primary" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="text-sm text-white font-medium">
            Create "{searchQuery.trim()}"
          </div>
          <div className="text-xs text-white/60">
            New playlist • 0 songs
          </div>
        </div>

        {/* Create Button */}
        <div className="shrink-0">
          <div className="px-3 py-1.5 bg-accent-primary/20 text-accent-primary text-xs font-medium rounded-md group-hover:bg-accent-primary/30 transition-colors">
            Create
          </div>
        </div>
      </div>
    </div>
  );
}