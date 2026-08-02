"use client";

import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { CircleIcon } from "lucide-react";

import { cn } from "@/lib/utils";

function RadioGroup({
    className,
    ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
    return (
        <RadioGroupPrimitive.Root
            data-slot="radio-group"
            className={cn("grid gap-2.5", className)}
            {...props}
        />
    );
}

function RadioGroupItem({
    className,
    children,
    id,
    disabled,
    ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item> & {
    children?: React.ReactNode;
}) {
    const generatedId = React.useId();
    const itemId = id || generatedId;
    return (
        <div className="flex items-center gap-2.5">
            <RadioGroupPrimitive.Item
                id={itemId}
                disabled={disabled}
                data-slot="radio-group-item"
                className={cn(
                    "aspect-square size-4 shrink-0 rounded-full border border-slate-300 bg-white text-slate-950 shadow-sm outline-none transition focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/20 aria-invalid:border-red-500 aria-invalid:ring-2 aria-invalid:ring-red-500/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60",
                    className
                )}
                {...props}
            >
                <RadioGroupPrimitive.Indicator
                    data-slot="radio-group-indicator"
                    className="relative flex items-center justify-center"
                >
                    <CircleIcon className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 fill-slate-950 text-slate-950" aria-hidden="true" />
                </RadioGroupPrimitive.Indicator>
            </RadioGroupPrimitive.Item>
            {children ? (
                <label
                    htmlFor={itemId}
                    className={cn(
                        "cursor-pointer select-none text-sm text-slate-800",
                        disabled && "cursor-not-allowed opacity-60"
                    )}
                >
                    {children}
                </label>
            ) : null}
        </div>
    );
}

export { RadioGroup, RadioGroupItem };
