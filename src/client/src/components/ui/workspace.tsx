"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
    AlertCircle,
    BookOpen,
    CheckCircle2,
    Inbox,
    Info,
    MoreHorizontal,
    TriangleAlert,
    UserRound,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";

export function PageShell({
    className,
    ...props
}: React.ComponentProps<"div">) {
    return <div className={cn("wm-page", className)} {...props} />;
}

type PageHeaderProps = Omit<React.ComponentProps<"header">, "title"> & {
    eyebrow?: React.ReactNode;
    title: React.ReactNode;
    description?: React.ReactNode;
    actions?: React.ReactNode;
};

export function PageHeader({
    eyebrow,
    title,
    description,
    actions,
    className,
    ...props
}: PageHeaderProps) {
    return (
        <header className={cn("wm-page-header", className)} {...props}>
            <div className="min-w-0">
                {eyebrow ? <p className="wm-eyebrow">{eyebrow}</p> : null}
                <h1 className="wm-page-title">{title}</h1>
                {description ? (
                    <div className="wm-page-description">{description}</div>
                ) : null}
            </div>
            {actions ? (
                <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
                    {actions}
                </div>
            ) : null}
        </header>
    );
}

type SectionHeaderProps = Omit<React.ComponentProps<"div">, "title"> & {
    title: React.ReactNode;
    description?: React.ReactNode;
    actions?: React.ReactNode;
};

export function SectionHeader({
    title,
    description,
    actions,
    className,
    ...props
}: SectionHeaderProps) {
    return (
        <div
            className={cn(
                "flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between",
                className
            )}
            {...props}
        >
            <div className="min-w-0">
                <h2 className="wm-section-title">{title}</h2>
                {description ? (
                    <div className="wm-section-description">{description}</div>
                ) : null}
            </div>
            {actions ? (
                <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
                    {actions}
                </div>
            ) : null}
        </div>
    );
}

const statusVariants = cva("wm-status", {
    variants: {
        tone: {
            neutral: "border-slate-200 bg-slate-50 text-slate-700",
            info: "border-blue-200 bg-blue-50 text-blue-700",
            success: "border-emerald-200 bg-emerald-50 text-emerald-700",
            warning: "border-amber-200 bg-amber-50 text-amber-800",
            danger: "border-red-200 bg-red-50 text-red-700",
            accent: "border-violet-200 bg-violet-50 text-violet-700",
        },
    },
    defaultVariants: { tone: "neutral" },
});

export function StatusBadge({
    className,
    tone,
    ...props
}: React.ComponentProps<"span"> & VariantProps<typeof statusVariants>) {
    return (
        <span className={cn(statusVariants({ tone }), className)} {...props} />
    );
}

const countVariants = cva(
    "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-5 tabular-nums",
    {
        variants: {
            tone: {
                neutral: "bg-slate-100 text-slate-600",
                inverse: "bg-white/15 text-white",
                info: "bg-blue-100 text-blue-700",
                warning: "bg-amber-100 text-amber-800",
                danger: "bg-red-100 text-red-700",
            },
        },
        defaultVariants: { tone: "neutral" },
    }
);

export function CountBadge({
    className,
    tone,
    ...props
}: React.ComponentProps<"span"> & VariantProps<typeof countVariants>) {
    return <span className={cn(countVariants({ tone }), className)} {...props} />;
}

const noticeConfig = {
    info: {
        icon: Info,
        className: "border-blue-200 bg-blue-50/80 text-blue-900",
    },
    success: {
        icon: CheckCircle2,
        className: "border-emerald-200 bg-emerald-50/80 text-emerald-900",
    },
    warning: {
        icon: TriangleAlert,
        className: "border-amber-200 bg-amber-50/80 text-amber-950",
    },
    danger: {
        icon: AlertCircle,
        className: "border-red-200 bg-red-50/80 text-red-900",
    },
    neutral: {
        icon: Info,
        className: "border-slate-200 bg-slate-50 text-slate-800",
    },
} as const;

type NoticeProps = Omit<React.ComponentProps<"div">, "title"> & {
    tone?: keyof typeof noticeConfig;
    title?: React.ReactNode;
    icon?: React.ElementType;
};

export function Notice({
    tone = "neutral",
    title,
    icon,
    children,
    className,
    ...props
}: NoticeProps) {
    const config = noticeConfig[tone];
    const Icon = icon || config.icon;
    return (
        <div
            role={tone === "danger" ? "alert" : "status"}
            className={cn(
                "flex items-start gap-3 rounded-lg border px-3.5 py-3 text-sm leading-5",
                config.className,
                className
            )}
            {...props}
        >
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
                {title ? <p className="font-semibold">{title}</p> : null}
                <div className={cn(title && "mt-0.5")}>{children}</div>
            </div>
        </div>
    );
}

type EmptyStateProps = Omit<React.ComponentProps<"div">, "title"> & {
    title: React.ReactNode;
    description?: React.ReactNode;
    action?: React.ReactNode;
    icon?: React.ElementType;
};

export function EmptyState({
    title,
    description,
    action,
    icon: Icon = Inbox,
    className,
    ...props
}: EmptyStateProps) {
    return (
        <div className={cn("wm-empty", className)} {...props}>
            <span className="mx-auto mb-3 flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <Icon className="size-4" aria-hidden="true" />
            </span>
            <p className="font-medium text-slate-800">{title}</p>
            {description ? (
                <p className="mx-auto mt-1 max-w-lg leading-5 text-slate-500">
                    {description}
                </p>
            ) : null}
            {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
        </div>
    );
}

export function LoadingSkeleton({
    className,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div
            aria-hidden="true"
            className={cn("animate-pulse rounded-lg bg-slate-200/75", className)}
            {...props}
        />
    );
}

type DisclosureProps = React.ComponentProps<"details"> & {
    summary: React.ReactNode;
    summaryAriaLabel?: string;
    summaryClassName?: string;
    contentClassName?: string;
};

export function Disclosure({
    summary,
    summaryAriaLabel,
    summaryClassName,
    contentClassName,
    children,
    className,
    ...props
}: DisclosureProps) {
    return (
        <details className={cn("wm-disclosure", className)} {...props}>
            <summary className={summaryClassName} aria-label={summaryAriaLabel}>
                <span className="min-w-0 flex-1">{summary}</span>
            </summary>
            <div
                className={cn(
                    "border-t border-slate-100 px-4 py-4 text-sm text-slate-700",
                    contentClassName
                )}
            >
                {children}
            </div>
        </details>
    );
}

type PaginationBarProps = {
    page: number;
    totalPages: number;
    loading?: boolean;
    onPrevious: () => void;
    onNext: () => void;
    className?: string;
    hideSinglePage?: boolean;
};

export function PaginationBar({
    page,
    totalPages,
    loading = false,
    onPrevious,
    onNext,
    className,
    hideSinglePage = true,
}: PaginationBarProps) {
    if (hideSinglePage && totalPages <= 1) return null;
    return (
        <nav
            aria-label="Pagination"
            className={cn(
                "flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3",
                className
            )}
        >
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onPrevious}
                disabled={loading || page <= 1}
            >
                Previous
            </Button>
            <span className="text-xs font-medium tabular-nums text-slate-500">
                Page {page} of {Math.max(totalPages, 1)}
            </span>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onNext}
                disabled={loading || page >= totalPages}
            >
                Next
            </Button>
        </nav>
    );
}

type WorkspaceTab<T extends string> = {
    id: T;
    label: React.ReactNode;
    count?: number;
    icon?: React.ElementType;
    panelId?: string;
    disabled?: boolean;
};

type WorkspaceTabsProps<T extends string> = {
    tabs: Array<WorkspaceTab<T>>;
    activeTab: T;
    onChange: (tab: T) => void;
    className?: string;
    label?: string;
};

export function WorkspaceTabs<T extends string>({
    tabs,
    activeTab,
    onChange,
    className,
    label = "Workspace sections",
}: WorkspaceTabsProps<T>) {
    const tabListId = React.useId().replace(/:/g, "");

    const moveFocus = (
        event: React.KeyboardEvent<HTMLButtonElement>,
        currentIndex: number
    ) => {
        const enabledTabs = tabs
            .map((tab, index) => ({ tab, index }))
            .filter(({ tab }) => !tab.disabled);
        const enabledIndex = enabledTabs.findIndex(({ index }) => index === currentIndex);
        if (enabledIndex < 0 || enabledTabs.length < 2) return;

        let nextEnabledIndex: number | null = null;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
            nextEnabledIndex = (enabledIndex + 1) % enabledTabs.length;
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
            nextEnabledIndex =
                (enabledIndex - 1 + enabledTabs.length) % enabledTabs.length;
        } else if (event.key === "Home") {
            nextEnabledIndex = 0;
        } else if (event.key === "End") {
            nextEnabledIndex = enabledTabs.length - 1;
        }

        if (nextEnabledIndex === null) return;
        event.preventDefault();
        const nextTab = enabledTabs[nextEnabledIndex].tab;
        document
            .getElementById(`${tabListId}-${nextTab.id}`)
            ?.focus();
        onChange(nextTab.id);
    };

    return (
        <div className={cn("min-w-0 pb-1", className)}>
            <div
                className="wm-divider-tabs"
                role="tablist"
                aria-label={label}
                aria-orientation="horizontal"
            >
                {tabs.map((tab, index) => {
                    const active = tab.id === activeTab;
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            id={`${tabListId}-${tab.id}`}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            aria-controls={tab.panelId}
                            tabIndex={active ? 0 : -1}
                            disabled={tab.disabled}
                            data-active={active}
                            className="wm-divider-tab"
                            onClick={() => onChange(tab.id)}
                            onKeyDown={(event) => moveFocus(event, index)}
                        >
                            {Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
                            <span>{tab.label}</span>
                            {typeof tab.count === "number" ? (
                                <CountBadge tone={active ? "inverse" : "neutral"}>
                                    {tab.count}
                                </CountBadge>
                            ) : null}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

type QueueToolbarProps = Omit<React.ComponentProps<"section">, "title"> & {
    label?: string;
    controls?: React.ReactNode;
    resultSummary?: React.ReactNode;
    actions?: React.ReactNode;
};

export function QueueToolbar({
    label = "Queue controls",
    controls,
    resultSummary,
    actions,
    children,
    className,
    ...props
}: QueueToolbarProps) {
    return (
        <section
            aria-label={label}
            className={cn(
                "flex min-w-0 flex-col gap-3 rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm sm:p-4",
                className
            )}
            {...props}
        >
            {controls || actions ? (
                <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
                    {controls ? (
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                            {controls}
                        </div>
                    ) : null}
                    {actions ? (
                        <div className="flex min-w-0 flex-wrap items-center gap-2 lg:ml-auto lg:justify-end">
                            {actions}
                        </div>
                    ) : null}
                </div>
            ) : null}
            {children}
            {resultSummary ? (
                <div className="text-xs font-medium text-slate-500" aria-live="polite">
                    {resultSummary}
                </div>
            ) : null}
        </section>
    );
}

type QueueRowProps = Omit<React.ComponentProps<"article">, "title"> & {
    title: React.ReactNode;
    description?: React.ReactNode;
    metadata?: React.ReactNode;
    status?: React.ReactNode;
    actions?: React.ReactNode;
};

export function QueueRow({
    title,
    description,
    metadata,
    status,
    actions,
    children,
    className,
    ...props
}: QueueRowProps) {
    const titleId = React.useId();
    return (
        <article
            aria-labelledby={titleId}
            className={cn(
                "grid min-w-0 gap-3 border-b border-slate-100 px-4 py-3.5 last:border-b-0 md:grid-cols-[minmax(0,1fr)_auto] md:items-start",
                className
            )}
            {...props}
        >
            <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h3 id={titleId} className="min-w-0 font-semibold leading-5 text-slate-950">
                        {title}
                    </h3>
                    {status}
                </div>
                {description ? (
                    <div className="mt-1 text-sm leading-5 text-slate-600">{description}</div>
                ) : null}
                {metadata ? (
                    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        {metadata}
                    </div>
                ) : null}
                {children ? <div className="mt-3 min-w-0">{children}</div> : null}
            </div>
            {actions ? (
                <div className="flex min-w-0 flex-wrap items-center gap-2 md:justify-end">
                    {actions}
                </div>
            ) : null}
        </article>
    );
}

type KeyValueItem = {
    label: React.ReactNode;
    value: React.ReactNode;
};

type KeyValueSummaryProps = React.ComponentProps<"dl"> & {
    items: KeyValueItem[];
    columns?: 1 | 2 | 3;
};

const summaryColumns = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
} as const;

export function KeyValueSummary({
    items,
    columns = 2,
    className,
    ...props
}: KeyValueSummaryProps) {
    return (
        <dl className={cn("grid gap-x-5 gap-y-3", summaryColumns[columns], className)} {...props}>
            {items.map((item, index) => (
                <div key={index} className="min-w-0">
                    <dt className="text-xs font-medium text-slate-500">{item.label}</dt>
                    <dd className="mt-0.5 min-w-0 break-words text-sm leading-5 text-slate-900">
                        {item.value}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

type PersonSummaryProps = Omit<React.ComponentProps<"div">, "title"> & {
    name?: React.ReactNode;
    email?: string;
    detail?: React.ReactNode;
    badges?: React.ReactNode;
    actions?: React.ReactNode;
    initials?: string;
};

export function PersonSummary({
    name,
    email,
    detail,
    badges,
    actions,
    initials,
    className,
    ...props
}: PersonSummaryProps) {
    const fallbackInitials = String(name || email || "?")
        .split(/\s|@/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("");
    return (
        <div className={cn("flex min-w-0 items-start gap-3", className)} {...props}>
            <span
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600"
                aria-hidden="true"
            >
                {initials || fallbackInitials || <UserRound className="size-4" />}
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="min-w-0 break-words text-sm font-semibold text-slate-950">
                        {name || email || "Unknown person"}
                    </p>
                    {badges}
                </div>
                {name && email ? (
                    <p className="mt-0.5 break-all text-xs text-slate-500">{email}</p>
                ) : null}
                {detail ? (
                    <div className="mt-1 text-xs leading-5 text-slate-600">{detail}</div>
                ) : null}
            </div>
            {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
    );
}

type CourseRoute = {
    label: React.ReactNode;
    course: React.ReactNode;
    description?: React.ReactNode;
};

type CourseRouteSummaryProps = React.ComponentProps<"div"> & {
    routes: CourseRoute[];
};

export function CourseRouteSummary({
    routes,
    className,
    ...props
}: CourseRouteSummaryProps) {
    return (
        <div className={cn("grid min-w-0 gap-2 sm:grid-cols-2", className)} {...props}>
            {routes.map((route, index) => (
                <div key={index} className="min-w-0 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3">
                    <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-indigo-700">
                        <BookOpen className="size-3.5 shrink-0" aria-hidden="true" />
                        <span>{route.label}</span>
                    </div>
                    <div className="mt-1 break-words text-sm font-semibold leading-5 text-slate-950">
                        {route.course}
                    </div>
                    {route.description ? (
                        <div className="mt-1 text-xs leading-5 text-slate-600">
                            {route.description}
                        </div>
                    ) : null}
                </div>
            ))}
        </div>
    );
}

type AuditReasonFieldProps = Omit<React.ComponentProps<typeof Textarea>, "onChange"> & {
    label?: React.ReactNode;
    description?: React.ReactNode;
    error?: React.ReactNode;
    onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
};

export const AuditReasonField = React.forwardRef<HTMLTextAreaElement, AuditReasonFieldProps>(
    function AuditReasonField(
        {
            id,
            label = "Reason",
            description,
            error,
            required,
            className,
            "aria-describedby": ariaDescribedBy,
            ...props
        },
        ref
    ) {
        const generatedId = React.useId();
        const fieldId = id || generatedId;
        const descriptionId = description ? `${fieldId}-description` : undefined;
        const errorId = error ? `${fieldId}-error` : undefined;
        const describedBy = [ariaDescribedBy, descriptionId, errorId]
            .filter(Boolean)
            .join(" ") || undefined;
        return (
            <div className="space-y-1.5">
                <Label htmlFor={fieldId}>
                    {label}
                    {required ? <span className="text-red-600" aria-hidden="true">*</span> : null}
                </Label>
                {description ? (
                    <p id={descriptionId} className="text-xs leading-5 text-slate-500">
                        {description}
                    </p>
                ) : null}
                <Textarea
                    ref={ref}
                    id={fieldId}
                    required={required}
                    aria-invalid={Boolean(error)}
                    aria-describedby={describedBy}
                    className={cn("min-h-24", className)}
                    {...props}
                />
                {error ? (
                    <p id={errorId} role="alert" className="text-xs font-medium text-red-700">
                        {error}
                    </p>
                ) : null}
            </div>
        );
    }
);

type ConfirmActionDialogProps = {
    trigger?: React.ReactElement;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    title: React.ReactNode;
    description?: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: "default" | "destructive";
    reasonLabel?: React.ReactNode;
    reasonDescription?: React.ReactNode;
    reasonPlaceholder?: string;
    reasonRequired?: boolean;
    initialReason?: string;
    onConfirm: (reason: string) => void | Promise<void>;
};

export function ConfirmActionDialog({
    trigger,
    open,
    onOpenChange,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    tone = "default",
    reasonLabel,
    reasonDescription,
    reasonPlaceholder,
    reasonRequired = false,
    initialReason = "",
    onConfirm,
}: ConfirmActionDialogProps) {
    const [internalOpen, setInternalOpen] = React.useState(false);
    const [reason, setReason] = React.useState(initialReason);
    const [reasonError, setReasonError] = React.useState("");
    const [submitError, setSubmitError] = React.useState("");
    const [submitting, setSubmitting] = React.useState(false);
    const reasonRef = React.useRef<HTMLTextAreaElement>(null);
    const currentOpen = open ?? internalOpen;
    const showReason = reasonRequired || Boolean(reasonLabel || reasonDescription || reasonPlaceholder);

    React.useEffect(() => {
        setReason(initialReason);
        setReasonError("");
        setSubmitError("");
    }, [currentOpen, initialReason]);

    const updateOpen = (nextOpen: boolean) => {
        if (open === undefined) setInternalOpen(nextOpen);
        onOpenChange?.(nextOpen);
        if (nextOpen) {
            setReason(initialReason);
            setReasonError("");
            setSubmitError("");
        }
    };

    const handleConfirm = async () => {
        if (reasonRequired && !reason.trim()) {
            setReasonError("Enter a reason before continuing.");
            reasonRef.current?.focus();
            return;
        }
        setReasonError("");
        setSubmitError("");
        setSubmitting(true);
        try {
            await onConfirm(reason.trim());
            updateOpen(false);
        } catch (error) {
            setSubmitError(
                error instanceof Error ? error.message : "The action could not be completed."
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={currentOpen} onOpenChange={(nextOpen) => !submitting && updateOpen(nextOpen)}>
            {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description ? <DialogDescription>{description}</DialogDescription> : null}
                </DialogHeader>
                {showReason ? (
                    <AuditReasonField
                        ref={reasonRef}
                        label={reasonLabel || "Reason"}
                        description={reasonDescription}
                        placeholder={reasonPlaceholder}
                        required={reasonRequired}
                        value={reason}
                        error={reasonError}
                        disabled={submitting}
                        onChange={(event) => {
                            setReason(event.target.value);
                            if (reasonError && event.target.value.trim()) setReasonError("");
                        }}
                    />
                ) : null}
                {submitError ? <Notice tone="danger">{submitError}</Notice> : null}
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline" disabled={submitting}>
                            {cancelLabel}
                        </Button>
                    </DialogClose>
                    <Button
                        type="button"
                        variant={tone === "destructive" ? "destructive" : "default"}
                        loading={submitting}
                        loadingLabel={`${confirmLabel} in progress`}
                        onClick={handleConfirm}
                    >
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

type OverflowMenuItem = {
    id: string;
    label: React.ReactNode;
    icon?: React.ElementType;
    disabled?: boolean;
    destructive?: boolean;
    onSelect: () => void;
};

type OverflowMenuProps = {
    label?: string;
    items: OverflowMenuItem[];
    align?: "start" | "center" | "end";
};

export function OverflowMenu({
    label = "More actions",
    items,
    align = "end",
}: OverflowMenuProps) {
    const [open, setOpen] = React.useState(false);
    const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

    const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        const enabledItems = itemRefs.current.filter(
            (item): item is HTMLButtonElement => Boolean(item && !item.disabled)
        );
        if (!enabledItems.length) return;
        const currentIndex = enabledItems.indexOf(document.activeElement as HTMLButtonElement);
        let nextIndex: number | null = null;
        if (event.key === "ArrowDown") {
            nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % enabledItems.length;
        } else if (event.key === "ArrowUp") {
            nextIndex =
                currentIndex < 0
                    ? enabledItems.length - 1
                    : (currentIndex - 1 + enabledItems.length) % enabledItems.length;
        } else if (event.key === "Home") {
            nextIndex = 0;
        } else if (event.key === "End") {
            nextIndex = enabledItems.length - 1;
        }
        if (nextIndex === null) return;
        event.preventDefault();
        enabledItems[nextIndex].focus();
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={label}
                    aria-haspopup="menu"
                    aria-expanded={open}
                    disabled={items.length === 0}
                >
                    <MoreHorizontal className="size-4" aria-hidden="true" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align={align}
                className="w-56 p-1"
                onOpenAutoFocus={(event) => {
                    event.preventDefault();
                    itemRefs.current.find((item) => item && !item.disabled)?.focus();
                }}
            >
                <div role="menu" aria-label={label} onKeyDown={handleMenuKeyDown}>
                    {items.map((item, index) => {
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.id}
                                ref={(node) => {
                                    itemRefs.current[index] = node;
                                }}
                                type="button"
                                role="menuitem"
                                disabled={item.disabled}
                                className={cn(
                                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 outline-none transition-colors hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400/60 disabled:cursor-not-allowed disabled:opacity-45",
                                    item.destructive && "text-red-700 hover:bg-red-50 focus-visible:bg-red-50"
                                )}
                                onClick={() => {
                                    setOpen(false);
                                    item.onSelect();
                                }}
                            >
                                {Icon ? <Icon className="size-4 shrink-0" aria-hidden="true" /> : null}
                                <span className="min-w-0 flex-1">{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
}
