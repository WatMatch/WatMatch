import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Bookmark, BookmarkCheck, Handshake, Pencil, UserPlus } from "lucide-react";

interface Project {
    capstone_id: string;
    title?: string;
    description?: string;
    department?: string;
    year?: number;
    external_partner_name?: string | null;
    external_partner_organization?: string | null;
    external_partner_email?: string | null;
    external_partner_website?: string | null;
    marketplace_action_state?: string | null;
    marketplace_phase?: "exploration" | "commitment" | "finalization";
    marketplace_phase_context?: {
        effective_phase?: "exploration" | "commitment" | "finalization";
        override_source?: "global" | "course" | "ecosystem";
    } | null;
    read_only_reason?: string | null;
    can_express_interest?: boolean;
    support_summary?: {
        accepted_mentor?: {
            mentor_email?: string | null;
        } | null;
        external_partner_support_confirmed?: boolean;
    };
}

interface CapstoneCardProps {
    project: Project;
    isInterested: boolean;
    canExpressInterest?: boolean;
    actionLabel?: string;
    activeActionLabel?: string;
    actionKind?: "interest" | "mentor";
    showSaveAction?: boolean;
    isSaved?: boolean;
    canSave?: boolean;
    saveBusy?: boolean;
    onClick: () => void;
    onInterestClick: () => void;
    onSaveClick?: () => void;
}

export function CapstoneCard({
    project,
    isInterested,
    canExpressInterest = true,
    actionLabel = "Request to join",
    activeActionLabel = "Edit request",
    actionKind = "interest",
    showSaveAction = false,
    isSaved = false,
    canSave = false,
    saveBusy = false,
    onClick,
    onInterestClick,
    onSaveClick,
}: CapstoneCardProps) {
    const ActionIcon = actionKind === "mentor" ? Handshake : UserPlus;
    const acceptedMentor = project.support_summary?.accepted_mentor || null;
    const mentorLabel = acceptedMentor?.mentor_email || "Accepted mentor";
    const SaveIcon = isSaved ? BookmarkCheck : Bookmark;
    const isReadOnly =
        project.marketplace_action_state === "read_only" ||
        (project.can_express_interest === false && Boolean(project.read_only_reason));
    const hasPhaseOverride =
        project.marketplace_phase_context?.override_source &&
        project.marketplace_phase_context.override_source !== "global";
    const phaseLabel =
        project.marketplace_phase_context?.effective_phase || project.marketplace_phase;

    return (
        <Card
            className="w-full cursor-pointer gap-0 rounded-lg border border-slate-200 bg-white p-0 shadow-sm transition hover:border-slate-300 hover:shadow-md"
            onClick={onClick}
        >
            <div className="flex flex-col gap-3 p-4 sm:p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <CardTitle className="min-w-0 break-words text-lg leading-snug text-slate-900">
                        {project.title}
                    </CardTitle>
                    <div className="flex max-w-full shrink-0 flex-wrap gap-2 sm:justify-end">
                        {isReadOnly && (
                            <span className="w-fit rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                                Read-only
                            </span>
                        )}
                        {hasPhaseOverride && phaseLabel && (
                            <span className="w-fit rounded border border-fuchsia-100 bg-fuchsia-50 px-2.5 py-1 text-xs font-medium capitalize text-fuchsia-700">
                                {phaseLabel}
                            </span>
                        )}
                        {project.year && (
                            <span className="w-fit rounded border border-green-100 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                                {project.year}
                            </span>
                        )}
                    </div>
                </div>

                <p className="text-sm leading-6 text-slate-600 line-clamp-3">
                    {project.description}
                </p>

                {project.external_partner_organization && (
                    <p className="mt-2 line-clamp-2 break-words text-xs font-medium text-slate-700">
                        External partner: {project.external_partner_organization}
                    </p>
                )}
                {acceptedMentor && (
                    <p className="line-clamp-2 break-words text-xs font-medium text-slate-700">
                        Mentor: {mentorLabel}
                    </p>
                )}

                <div className="flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                    {project.department && (
                        <CardDescription className="min-w-0 break-words text-xs">
                            {project.department}
                        </CardDescription>
                    )}

                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
                        {showSaveAction && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if ((isSaved || canSave) && onSaveClick) {
                                        onSaveClick();
                                    }
                                }}
                                disabled={(!isSaved && !canSave) || saveBusy}
                                aria-label={isSaved ? "Remove saved project" : "Save project"}
                                title={isSaved ? "Remove saved project" : "Save project"}
                                className={`w-full rounded-md px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed sm:w-auto sm:p-1.5 ${
                                    isSaved
                                        ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                        : "text-slate-600 hover:bg-slate-100 hover:text-blue-600 disabled:opacity-50"
                                }`}
                            >
                                <span className="inline-flex items-center justify-center gap-2">
                                    <SaveIcon className="h-4 w-4" />
                                    <span className="sm:hidden">
                                        {isSaved ? "Saved" : saveBusy ? "Saving..." : "Save"}
                                    </span>
                                </span>
                            </button>
                        )}

                        {canExpressInterest && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onInterestClick();
                                }}
                                aria-label={
                                    isInterested
                                        ? "Edit interest message"
                                        : actionLabel
                                }
                                className={`w-full rounded-md px-3 py-2 text-sm font-medium transition sm:w-auto sm:p-1.5 ${
                                    isInterested
                                        ? "bg-green-100 text-green-600 hover:bg-green-200"
                                        : "hover:bg-slate-100 text-slate-600 hover:text-blue-500"
                                }`}
                            >
                                <span className="inline-flex items-center justify-center gap-2">
                                    {isInterested ? (
                                        <>
                                            <Pencil className="w-4 h-4" />
                                            <span className="sm:hidden">{activeActionLabel}</span>
                                        </>
                                    ) : (
                                        <>
                                            <ActionIcon className="w-4 h-4" />
                                            <span className="sm:hidden">{actionLabel}</span>
                                        </>
                                    )}
                                </span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </Card>
    );
}
