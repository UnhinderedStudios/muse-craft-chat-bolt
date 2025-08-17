import React, { useState, KeyboardEvent } from "react";
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

  return (
    <div className={cn("min-h-[120px] flex flex-wrap gap-2 items-start", className)}>
      {/* Render existing tags */}
      {tags.map((tag, index) => (
        <div
          key={index}
          className="inline-flex items-center gap-1 px-3 py-1 bg-white text-[#2d2d2d] rounded-full text-sm font-medium"
        >
          <span>{tag}</span>
          <button
            onClick={() => removeTag(index)}
            className="hover:bg-gray-200 rounded-full p-0.5 transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      ))}
      
      {/* Input field */}
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="bg-transparent border-0 text-white placeholder:text-white/40 focus:outline-none flex-1 min-w-[120px] text-sm"
      />
    </div>
  );
};