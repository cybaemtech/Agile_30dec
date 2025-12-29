import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface ComboboxOption {
  value: string
  label: string
  searchFields?: string[] // Additional fields to search in
  disabled?: boolean
}

export interface ComboboxProps {
  options: ComboboxOption[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  disabled?: boolean
  required?: boolean
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  emptyText = "No option found.",
  className,
  disabled = false,
  required = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

  // Filter options based on search
  const filteredOptions = React.useMemo(() => {
    if (!searchValue) return options
    const searchLower = searchValue.toLowerCase().trim()
    if (!searchLower) return options

    const filtered = options.filter((option) => {
      // Search in label
      if (option.label && option.label.toLowerCase().includes(searchLower)) {
        return true
      }
      // Search in additional search fields if provided
      if (option.searchFields && Array.isArray(option.searchFields)) {
        return option.searchFields.some(field =>
          field && typeof field === 'string' && field.toLowerCase().includes(searchLower)
        )
      }
      return false
    })

    // Debug logging for search issues
    if (searchValue && filtered.length === 0 && options.length > 0) {
      console.log('🔍 Search Debug:', {
        searchValue,
        searchLower,
        totalOptions: options.length,
        sampleOption: options[0],
        sampleOptionLabel: options[0]?.label,
        sampleOptionSearchFields: options[0]?.searchFields,
        filteredCount: filtered.length,
        firstOptionMatch: options[0]?.label?.toLowerCase()?.includes(searchLower),
        firstOptionSearchFieldsMatch: options[0]?.searchFields?.some(field => field.toLowerCase().includes(searchLower))
      })
    }

    return filtered
  }, [options, searchValue])

  // Find the selected option
  const selectedOption = options.find((option) => option.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between text-left font-normal",
            !selectedOption && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {required && !selectedOption && <span className="text-red-500 ml-1">*</span>}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full max-w-[500px] p-0 z-50" align="start" sideOffset={4}>
        <Command shouldFilter={false} className="max-h-[300px]">
          <CommandInput
            placeholder={searchPlaceholder}
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList className="max-h-[300px] overflow-y-auto overflow-x-hidden">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className="flex items-start justify-between cursor-pointer min-h-[2.5rem] py-2 px-3"
                  onSelect={(currentValue) => {
                    // Handle selection
                    if (currentValue === value) {
                      // If clicking the same value, optionally deselect (or keep selected)
                      onValueChange?.(currentValue)
                    } else {
                      onValueChange?.(currentValue)
                    }
                    setOpen(false)
                    setSearchValue("") // Clear search when selecting
                  }}
                >
                  <div className="flex items-center w-full">
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="text-sm leading-relaxed break-words whitespace-normal">{option.label}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}