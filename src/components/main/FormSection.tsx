import React from "react";
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
    <div className="bg-transparent">
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
      
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate || busy}
          className="mt-6 px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-400 disabled:to-gray-400 text-white rounded-lg font-medium transition-all duration-200 disabled:cursor-not-allowed"
        >
          {busy ? "Generating..." : "Generate Song"}
        </button>
      </div>
    </div>
  );
};