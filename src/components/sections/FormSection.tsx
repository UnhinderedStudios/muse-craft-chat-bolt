import React from "react";
import { CyberCard } from "@/components/cyber/CyberCard";
import { SongDetailsForm } from "@/components/song/SongDetailsForm";
import { TagInput } from "@/components/song/TagInput";
import { Label } from "@/components/ui/label";
import { type SongDetails } from "@/lib/api";

interface FormSectionProps {
  details: SongDetails;
  setDetails: (details: SongDetails) => void;
  styleTags: string[];
  handleStyleTagsChange: (tags: string[]) => void;
  randomizeAll: () => void;
}

export const FormSection: React.FC<FormSectionProps> = ({
  details,
  setDetails,
  styleTags,
  handleStyleTagsChange,
  randomizeAll
}) => {
  return (
    <CyberCard className="h-full overflow-y-auto">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-text-primary">Song Details</h2>
        </div>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="style-tags" className="text-text-primary font-medium mb-2 block">
              Style Tags
            </Label>
            <TagInput
              tags={styleTags}
              onChange={handleStyleTagsChange}
              placeholder="Add style tags (e.g., pop, upbeat, acoustic)"
              className="bg-card-alt border-border-main"
            />
          </div>
          
          <SongDetailsForm
            details={details}
            setDetails={setDetails}
            styleTags={[]}
            setStyleTags={() => {}}
          />
        </div>
      </div>
    </CyberCard>
  );
};