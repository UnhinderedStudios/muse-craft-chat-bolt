import React, { useState, KeyboardEvent, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

export const TagInput: React.FC<TagInputProps> = ({
  tags,
  onChange,
  placeholder = "Add tags...",
  className
}) => {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Check if user typed a comma
    if (value.includes(",")) {
      const newTags = value.split(",").map(tag => tag.trim()).filter(tag => tag.length > 0);
      if (newTags.length > 0) {
        const updatedTags = [...tags, ...newTags];
        onChange(updatedTags);
        setInputValue("");
        return;
      }
    }
    
    setInputValue(value);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      const newTag = inputValue.trim();
      if (newTag && !tags.includes(newTag)) {
        onChange([...tags, newTag]);
      }
      setInputValue("");
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      // Remove last tag if input is empty and backspace is pressed
      const newTags = [...tags];
      newTags.pop();
      onChange(newTags);
    }
  };

  const removeTag = (indexToRemove: number) => {
    const newTags = tags.filter((_, index) => index !== indexToRemove);
    onChange(newTags);
  };

  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  return (
    <div 
      className={cn("h-full min-h-0 overflow-y-auto song-params-scrollbar relative cursor-text", className)}
      onClick={handleContainerClick}
    >
      {/* Inner flex container for tags and input */}
      <div className="flex flex-wrap gap-2 items-start p-4 h-full min-h-0">
        {/* Render existing tags */}
        {tags.map((tag, index) => (
          <div
            key={index}
            className="inline-flex items-center gap-1 px-3 py-1 bg-white text-[#2d2d2d] rounded-full text-sm font-medium cursor-default max-w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="break-words break-all">{tag}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeTag(index);
              }}
              className="hover:bg-gray-200 rounded-full p-0.5 transition-colors flex-shrink-0"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        
        {/* Input field */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder=""
          className="bg-transparent border-0 text-white placeholder:text-white/40 focus:outline-none flex-1 min-w-[120px] text-sm"
        />
      </div>
      
      {/* Show multiline placeholder when no tags and no input */}
      {tags.length === 0 && !inputValue && (
        <div className="absolute top-4 left-4 pointer-events-none text-white/40 text-sm whitespace-pre-wrap leading-relaxed">
          {placeholder}
        </div>
      )}
    </div>
  );
};