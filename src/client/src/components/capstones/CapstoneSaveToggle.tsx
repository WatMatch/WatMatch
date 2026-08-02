"use client";

import { useEffect, useId, useState } from "react";
import { Bookmark, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CapstoneSaveKind = "project" | "inspiration";

export interface CapstoneSaveToggleProps {
    kind: CapstoneSaveKind;
    saved: boolean;
    canSave?: boolean;
    busy?: boolean;
    className?: string;
    onToggle: (nextSaved: boolean) => void | Promise<void>;
    onOptimisticChange?: (nextSaved: boolean) => void;
    onError?: (error: unknown, previousSaved: boolean) => void;
}

const labels = {
    project: {
        save: "Save project",
        saved: "Saved project",
        addTooltip: "Save this recruiting project privately",
        removeTooltip: "Remove this project from saved projects",
    },
    inspiration: {
        save: "Save inspiration",
        saved: "Saved inspiration",
        addTooltip: "Save this past capstone as private inspiration",
        removeTooltip: "Remove this capstone from saved inspiration",
    },
} as const;

export function CapstoneSaveToggle({
    kind,
    saved,
    canSave = true,
    busy = false,
    className,
    onToggle,
    onOptimisticChange,
    onError,
}: CapstoneSaveToggleProps) {
    const tooltipId = useId();
    const [optimisticSaved, setOptimisticSaved] = useState(saved);
    const [internalBusy, setInternalBusy] = useState(false);
    const copy = labels[kind];
    const isBusy = busy || internalBusy;
    const disabled = isBusy || (!optimisticSaved && !canSave);
    const visibleLabel = optimisticSaved ? copy.saved : copy.save;
    const tooltip = optimisticSaved ? copy.removeTooltip : copy.addTooltip;

    useEffect(() => {
        if (!internalBusy) {
            setOptimisticSaved(saved);
        }
    }, [internalBusy, saved]);

    const handleToggle = async () => {
        if (disabled) return;

        const previousSaved = optimisticSaved;
        const nextSaved = !previousSaved;
        setOptimisticSaved(nextSaved);
        setInternalBusy(true);
        onOptimisticChange?.(nextSaved);

        try {
            await onToggle(nextSaved);
        } catch (error) {
            setOptimisticSaved(previousSaved);
            onOptimisticChange?.(previousSaved);
            onError?.(error, previousSaved);
        } finally {
            setInternalBusy(false);
        }
    };

    return (
        <span
            className={cn(
                "group/save relative flex w-full min-w-0 items-stretch sm:inline-flex sm:w-auto",
                className
            )}
        >
            <Button
                type="button"
                variant={optimisticSaved ? "secondary" : "outline"}
                size="sm"
                onClick={handleToggle}
                disabled={disabled}
                aria-label={tooltip}
                aria-describedby={tooltipId}
                aria-pressed={optimisticSaved}
                aria-busy={isBusy}
                className={cn(
                    "w-full min-w-0 gap-2 sm:w-auto",
                    optimisticSaved && "text-blue-700"
                )}
            >
                {isBusy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                    <Bookmark
                        className={cn(
                            "size-4",
                            optimisticSaved && "fill-current"
                        )}
                        aria-hidden="true"
                    />
                )}
                <span>{visibleLabel}</span>
            </Button>
            <span
                id={tooltipId}
                role="tooltip"
                className="pointer-events-none invisible absolute bottom-full right-0 z-50 mb-2 w-max max-w-60 rounded-md bg-slate-950 px-2.5 py-1.5 text-xs leading-4 text-white opacity-0 shadow-lg transition group-hover/save:visible group-hover/save:opacity-100 group-focus-within/save:visible group-focus-within/save:opacity-100"
            >
                {tooltip}
            </span>
        </span>
    );
}
