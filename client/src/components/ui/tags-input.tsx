import React, { useState, KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface TagsInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function TagsInput({ value, onChange, placeholder = "Add tags...", className }: TagsInputProps) {
  const [inputValue, setInputValue] = useState("");
  
  // Parse tags from comma-separated string
  const tags = value ? value.split(",").map(tag => tag.trim()).filter(tag => tag.length > 0) : [];
  
  // Add tag when Enter or comma is pressed
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && inputValue.trim()) {
      e.preventDefault();
      const newTag = inputValue.trim();
      
      // Avoid duplicates
      if (!tags.includes(newTag)) {
        const newTags = [...tags, newTag];
        onChange(newTags.join(","));
      }
      setInputValue("");
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      // Remove last tag when backspace is pressed on empty input
      const newTags = tags.slice(0, -1);
      onChange(newTags.join(","));
    }
  };
  
  // Remove a specific tag
  const removeTag = (tagToRemove: string) => {
    const newTags = tags.filter(tag => tag !== tagToRemove);
    onChange(newTags.join(","));
  };
  
  return (
    <div className={`flex flex-wrap gap-2 p-2 border rounded-md bg-white min-h-[42px] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${className}`}>
      {/* Render existing tags */}
      {tags.map((tag, index) => (
        <Badge
          key={index}
          variant="secondary"
          className="flex items-center gap-1 px-2 py-1 text-xs"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-full p-0.5"
            title={`Remove ${tag} tag`}
            aria-label={`Remove ${tag} tag`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      
      {/* Input for new tags */}
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[120px] border-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 py-0 h-auto"
        style={{ boxShadow: 'none' }}
      />
    </div>
  );
}