"use client";

import {
    Popover,
    PopoverTrigger,
    PopoverContent,
} from "@/components/ui/popover";
import {
    Command,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
} from "@/components/ui/command";
import { Check, ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface MultiSelectProps {
    id?: string;
    "aria-label"?: string;
    "aria-labelledby"?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
    disabled?: boolean;
    options: { value: string; label: string }[];
    value: string[];
    onChange: (value: string[]) => void;
    placeholder?: string;
    maxSelected?: number;
    allowCustom?: boolean;
    customLabel?: string;
    chipClassName?: string | ((value: string) => string);
}

export function MultiSelect({
    id,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
    disabled = false,
    options,
    value,
    onChange,
    placeholder,
    maxSelected,
    allowCustom = false,
    customLabel = "Add",
    chipClassName,
}: MultiSelectProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");

    const normalizedSearch = search.trim();
    const atLimit = typeof maxSelected === "number" && value.length >= maxSelected;
    const canAddCustom =
        allowCustom &&
        normalizedSearch.length > 0 &&
        !options.some(
            (option) => option.value.toLowerCase() === normalizedSearch.toLowerCase()
        ) &&
        !value.some((selected) => selected.toLowerCase() === normalizedSearch.toLowerCase()) &&
        !atLimit;

    const toggleValue = (val: string) => {
        if (value.includes(val)) {
            onChange(value.filter((v) => v !== val));
        } else if (!atLimit) {
            onChange([...value, val]);
        }
    };

    const addCustomValue = () => {
        if (!canAddCustom) return;
        onChange([...value, normalizedSearch]);
        setSearch("");
    };
    const optionLabel = (selected: string) =>
        options.find((option) => option.value === selected)?.label || selected;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-label={ariaLabel || (!ariaLabelledBy ? placeholder || "Select options" : undefined)}
                    aria-labelledby={ariaLabelledBy}
                    aria-describedby={ariaDescribedBy}
                    aria-invalid={ariaInvalid}
                    disabled={disabled}
                    className="h-auto min-h-10 w-full items-start justify-between gap-3 whitespace-normal px-3 py-2 text-left font-normal"
                >
                    {value.length ? (
                        <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                            {value.map((selected) => (
                                <span
                                    key={selected}
                                    className={cn(
                                        "inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-xs font-medium leading-5",
                                        typeof chipClassName === "function"
                                            ? chipClassName(selected)
                                            : chipClassName ||
                                                  "border-slate-200 bg-slate-50 text-slate-700"
                                    )}
                                >
                                    <span className="break-words">{optionLabel(selected)}</span>
                                </span>
                            ))}
                        </span>
                    ) : (
                        <span className="min-w-0 flex-1 py-0.5 text-slate-500">
                            {placeholder || "Select..."}
                        </span>
                    )}
                    <ChevronDown className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                collisionPadding={16}
                className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0"
            >
                <Command>
                    <CommandInput
                        placeholder="Search..."
                        className="w-full"
                        value={search}
                        onValueChange={setSearch}
                    />
                    <CommandList className="max-h-72 p-1.5" aria-multiselectable="true">
                        <CommandEmpty>
                            {canAddCustom ? (
                                <button
                                    type="button"
                                    onClick={addCustomValue}
                                    className="mx-auto flex w-full min-w-0 max-w-full items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/20"
                                >
                                    <Plus className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                    <span className="min-w-0 flex-1 break-words text-left [overflow-wrap:anywhere]">
                                        {customLabel} &quot;{normalizedSearch}&quot;
                                    </span>
                                </button>
                            ) : atLimit ? (
                                `Maximum of ${maxSelected} selected.`
                            ) : (
                                "No results found."
                            )}
                        </CommandEmpty>
                        <CommandGroup>
                            {canAddCustom && (
                                <CommandItem
                                    onSelect={addCustomValue}
                                    className="min-h-10 min-w-0 gap-3 px-3 py-2"
                                >
                                    <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
                                    <span className="min-w-0 flex-1 break-words leading-5 [overflow-wrap:anywhere]">
                                        {customLabel} &quot;{normalizedSearch}&quot;
                                    </span>
                                </CommandItem>
                            )}
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    onSelect={() => toggleValue(option.value)}
                                    className={cn(
                                        "min-h-10 gap-3 px-3 py-2",
                                        value.includes(option.value) &&
                                            "bg-slate-50 font-medium text-slate-950"
                                    )}
                                    disabled={
                                        Boolean(maxSelected) &&
                                        value.length >= Number(maxSelected) &&
                                        !value.includes(option.value)
                                    }
                                >
                                    <Check
                                        className={cn(
                                            "size-4 shrink-0 text-slate-700",
                                            value.includes(option.value)
                                                ? "opacity-100"
                                                : "opacity-0"
                                        )}
                                        aria-hidden="true"
                                    />
                                    <span className="min-w-0 flex-1 break-words leading-5">
                                        {option.label}
                                        {value.includes(option.value) ? (
                                            <span className="sr-only"> (selected)</span>
                                        ) : null}
                                    </span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
