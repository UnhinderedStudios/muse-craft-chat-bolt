import React from "react";
import { Dice5 } from "lucide-react";
import { CyberCard } from "@/components/cyber/CyberCard";
import { CyberButton } from "@/components/cyber/CyberButton";
import { SongDetailsForm } from "@/components/song/SongDetailsForm";
import { TagInput } from "@/components/song/TagInput";
import { type SongDetails } from "@/lib/api";

interface FormSectionProps {
  details: SongDetails;
  setDetails: (details: SongDetails) => void;
  styleTags: string[];
  onStyleTagsChange: (tags: string[]) => void;
  onRandomize: () => void;
  onGenerate: () => void;
  canGenerate: boolean;
  busy: boolean;
}

export const FormSection: React.FC<FormSectionProps> = ({
  details,
  setDetails,
  styleTags,
  onStyleTagsChange,
  onRandomize,
  onGenerate,
  canGenerate,
  busy
}) => {
  return (
    <CyberCard>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white mb-4">Song Details</h2>
        <SongDetailsForm
          details={details}
          setDetails={setDetails}
          styleTags={styleTags}
          setStyleTags={onStyleTagsChange}
        />
        
        <TagInput
          tags={styleTags}
          onChange={onStyleTagsChange}
          placeholder="Add style tags..."
        />
      </div>
      
      <div className="flex gap-4 justify-center">
        <CyberButton
          onClick={onRandomize}
          variant="secondary"
          className="gap-2"
        >
          <Dice5 className="w-4 h-4" />
          Random
        </CyberButton>
        <CyberButton
          onClick={onGenerate}
          disabled={!canGenerate || busy}
          className="px-8"
        >
          {busy ? "Generating..." : "Generate Song"}
        </CyberButton>
      </div>
    </CyberCard>
  );
};