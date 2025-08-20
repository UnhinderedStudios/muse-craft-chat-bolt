import React from "react";
import { CyberCard } from "@/components/cyber/CyberCard";
import { CyberChip } from "@/components/cyber/CyberChip";
import { TagInput } from "./TagInput";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SongDetails } from "@/types";

interface SongDetailsFormProps {
  details: SongDetails;
  setDetails: (details: SongDetails) => void;
  styleTags: string[];
  onStyleTagsChange: (tags: string[]) => void;
  onRandomize: () => void;
  onGenerate: () => void;
  canGenerate: boolean;
  busy: boolean;
  generationProgress: number;
}

export const SongDetailsForm: React.FC<SongDetailsFormProps> = ({
  details,
  setDetails,
  styleTags,
  onStyleTagsChange,
  onRandomize,
  onGenerate,
  canGenerate,
  busy,
  generationProgress
}) => {
  return (
    <div className="space-y-6">
      {/* Song Title */}
      <CyberCard className="space-y-4">
        <div className="flex items-center gap-2">
          <CyberChip variant="purple">Song Title</CyberChip>
        </div>
        <Input
          placeholder="Enter song title..."
          value={details.title || ""}
          onChange={(e) => setDetails({ ...details, title: e.target.value })}
          className="bg-card-alt border-border-main text-text-primary placeholder:text-text-secondary"
        />
      </CyberCard>

      {/* Style Tags */}
      <CyberCard className="space-y-4">
        <div className="flex items-center gap-2">
          <CyberChip variant="teal">Style</CyberChip>
        </div>
        <TagInput
          tags={styleTags}
          onChange={onStyleTagsChange}
          placeholder="Type style elements and press Enter..."
          className="bg-card-alt border-border-main"
        />
      </CyberCard>

      {/* Lyrics */}
      <CyberCard className="space-y-4">
        <div className="flex items-center gap-2">
          <CyberChip variant="purple">Lyrics</CyberChip>
        </div>
        <Textarea
          placeholder="Write your song lyrics here..."
          value={details.lyrics || ""}
          onChange={(e) => setDetails({ ...details, lyrics: e.target.value })}
          className="min-h-[200px] bg-card-alt border-border-main text-text-primary placeholder:text-text-secondary resize-none"
        />
      </CyberCard>
    </div>
  );
};