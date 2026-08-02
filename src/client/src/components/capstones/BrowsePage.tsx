import type { ReactNode } from "react";
import {
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    Inbox,
    Loader2,
    X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function BrowsePageShell({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("bg-slate-50/70 px-3 py-6 sm:px-6 sm:py-8", className)}>
            <div className="mx-auto w-full max-w-6xl space-y-5">{children}</div>
        </div>
    );
}

export function BrowsePageHeader({
    eyebrow,
    title,
    description,
    actions,
}: {
    eyebrow?: string;
    title: string;
    description: string;
    actions?: ReactNode;
}) {
    return (
        <header className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 max-w-3xl">
                {eyebrow && (
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {eyebrow}
                    </p>
                )}
                <h1 className="text-2xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-[1.75rem]">
                    {title}
                </h1>
                <p className="mt-1.5 text-sm leading-6 text-slate-600">{description}</p>
            </div>
            {actions && <div className="shrink-0">{actions}</div>}
        </header>
    );
}

export function BrowseToolbar({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "rounded-xl border border-slate-200/90 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]",
                className
            )}
            role="search"
        >
            {children}
        </div>
    );
}

export function BrowseClearButton({
    active,
    onClear,
}: {
    active: boolean;
    onClear: () => void;
}) {
    return (
        <Button
            type="button"
            variant="ghost"
            onClick={onClear}
            disabled={!active}
            aria-label="Clear filters"
            className="min-w-[5.5rem] justify-center px-3 disabled:bg-transparent disabled:text-slate-400 disabled:opacity-100"
        >
            <X aria-hidden="true" />
            <span>Clear</span>
        </Button>
    );
}

export function ResultsSummary({
    count,
    singular,
    plural,
    page,
    totalPages,
    detail,
}: {
    count: number;
    singular: string;
    plural?: string;
    page: number;
    totalPages: number;
    detail?: ReactNode;
}) {
    const pluralLabel =
        plural ||
        (singular.endsWith("y")
            ? `${singular.slice(0, -1)}ies`
            : `${singular}s`);

    return (
        <div className="flex min-w-0 flex-col gap-1 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <p aria-live="polite">
                <span className="font-medium text-slate-900">{count}</span>{" "}
                {count === 1 ? singular : pluralLabel} on this page
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                {detail}
                {totalPages > 1 && (
                    <span>
                        Page {page} of {totalPages}
                    </span>
                )}
            </div>
        </div>
    );
}

type NoticeTone = "info" | "success" | "warning" | "error";

const noticeTone: Record<NoticeTone, string> = {
    info: "border-blue-200 bg-blue-50/80 text-blue-950",
    success: "border-emerald-200 bg-emerald-50/80 text-emerald-950",
    warning: "border-amber-200 bg-amber-50/80 text-amber-950",
    error: "border-red-200 bg-red-50/80 text-red-950",
};

export function BrowseNotice({
    children,
    tone = "info",
    action,
}: {
    children: ReactNode;
    tone?: NoticeTone;
    action?: ReactNode;
}) {
    return (
        <div
            className={cn(
                "flex min-w-0 flex-col gap-3 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between",
                noticeTone[tone]
            )}
            role={tone === "error" ? "alert" : "status"}
        >
            <div className="flex min-w-0 items-start gap-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div className="min-w-0 leading-5 [overflow-wrap:anywhere]">{children}</div>
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
}

export function BrowseLoading({ label }: { label: string }) {
    return (
        <Card className="items-center justify-center gap-3 px-5 py-14 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-slate-500" aria-hidden="true" />
            <p className="text-sm text-slate-600">{label}</p>
        </Card>
    );
}

export function BrowseEmpty({
    title,
    description,
    action,
}: {
    title: string;
    description: string;
    action?: ReactNode;
}) {
    return (
        <Card className="items-center justify-center gap-2 px-5 py-12 text-center">
            <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <Inbox className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            <p className="max-w-md text-sm leading-6 text-slate-600">{description}</p>
            {action && <div className="mt-2">{action}</div>}
        </Card>
    );
}

export function PaginationBar({
    page,
    totalPages,
    loading = false,
    onPrevious,
    onNext,
}: {
    page: number;
    totalPages: number;
    loading?: boolean;
    onPrevious: () => void;
    onNext: () => void;
}) {
    if (totalPages <= 1) return null;

    return (
        <nav
            className="flex flex-col-reverse items-center justify-between gap-3 border-t border-slate-200 pt-4 sm:flex-row"
            aria-label="Results pagination"
        >
            <p className="text-sm text-slate-500">
                Page <span className="font-medium text-slate-900">{page}</span> of{" "}
                <span className="font-medium text-slate-900">{totalPages}</span>
            </p>
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onPrevious}
                    disabled={loading || page <= 1}
                >
                    <ChevronLeft aria-hidden="true" />
                    Previous
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={onNext}
                    disabled={loading || page >= totalPages}
                >
                    Next
                    <ChevronRight aria-hidden="true" />
                </Button>
            </div>
        </nav>
    );
}

export function DetailDisclosure({
    label,
    children,
    defaultOpen = false,
}: {
    label: string;
    children: ReactNode;
    defaultOpen?: boolean;
}) {
    return (
        <details
            className="group rounded-lg border border-slate-200 bg-white open:shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
            open={defaultOpen}
        >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400 [&::-webkit-details-marker]:hidden">
                {label}
                <ChevronRight
                    className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90"
                    aria-hidden="true"
                />
            </summary>
            <div className="border-t border-slate-100 px-4 py-4 text-sm text-slate-700">
                {children}
            </div>
        </details>
    );
}
