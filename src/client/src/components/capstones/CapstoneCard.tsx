import type { ReactNode } from "react";
import {
    Building2,
    CalendarDays,
    CheckCircle2,
    ChevronRight,
    CircleAlert,
    Crown,
    Eye,
    GraduationCap,
    Handshake,
    Loader2,
    Pencil,
    UserPlus,
    Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TaxonomyChipList } from "@/components/ui/taxonomy-chip";
import {
    CapstoneSaveToggle,
    type CapstoneSaveKind,
} from "@/components/capstones/CapstoneSaveToggle";
import type { CapstoneSupportSummary } from "@/services/capstones.service";
import type {
    CapstoneTeamContext,
    CapstoneTeamContextMember,
} from "@/services/teams.service";

export interface CanonicalCapstoneProject {
    capstone_id: string | number;
    title?: string | null;
    description?: string | null;
    status?: string | null;
    department?: string | string[] | null;
    year?: number | string | null;
    external_partner_organization?: string | null;
    disciplines?: string[] | null;
    skills?: string[] | null;
    marketplace_action_state?: string | null;
    marketplace_phase?: "exploration" | "commitment" | "finalization" | string;
    marketplace_phase_context?: {
        effective_phase?: "exploration" | "commitment" | "finalization";
        override_source?: "global" | "course" | "ecosystem";
    } | null;
    read_only_reason?: string | null;
    can_express_interest?: boolean;
    support_summary?: CapstoneSupportSummary;
}

interface CapstoneCardProps {
    project: CanonicalCapstoneProject;
    mode?: "compact" | "expanded";
    courseLabel?: string | null;
    teamContext?: CapstoneTeamContext | null;
    contextLoading?: boolean;
    contextError?: string | null;
    showTeamContext?: boolean;
    details?: ReactNode;
    actions?: ReactNode;
    supportActions?: ReactNode;
    management?: ReactNode;
    timeline?: ReactNode;
    renderMemberAction?: (member: CapstoneTeamContextMember) => ReactNode;
    onClick?: () => void;
    isInterested?: boolean;
    canExpressInterest?: boolean;
    actionLabel?: string;
    activeActionLabel?: string;
    actionKind?: "interest" | "mentor";
    showSaveAction?: boolean;
    isSaved?: boolean;
    canSave?: boolean;
    saveBusy?: boolean;
    saveKind?: CapstoneSaveKind;
    onInterestClick?: () => void;
    onSaveClick?: (nextSaved: boolean) => void | Promise<void>;
    onSaveOptimisticChange?: (nextSaved: boolean) => void;
    onSaveError?: (error: unknown, previousSaved: boolean) => void;
}

export const CAPSTONE_STATUS_LABELS: Readonly<Record<string, string>> = {
    draft: "Draft",
    approved_recruiting: "Recruiting",
    pending_review: "Awaiting instructor review",
    pending_admin_course_routing: "Awaiting course routing",
    changes_requested: "Changes requested",
    rejected: "Rejected",
    approved: "Finalized",
    complete: "Completed",
    archived: "Archived",
};

export function getCapstoneStatusLabel(value?: string | null): string | null {
    if (!value?.trim()) return null;
    return CAPSTONE_STATUS_LABELS[value.trim().toLowerCase()] || null;
}

function formatUnknownStatus(value?: string | null): string | null {
    if (!value?.trim()) return null;
    return value
        .trim()
        .replaceAll("_", " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

function statusClass(value?: string | null): string {
    const status = (value || "").toLowerCase();
    if (["approved", "complete", "approved_recruiting"].includes(status)) {
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }
    if (["rejected", "changes_requested"].includes(status)) {
        return "border-rose-200 bg-rose-50 text-rose-700";
    }
    if (["pending_review", "pending_admin_course_routing"].includes(status)) {
        return "border-amber-200 bg-amber-50 text-amber-800";
    }
    return "border-slate-200 bg-slate-50 text-slate-700";
}

function memberCourseLabel(member: CapstoneTeamContextMember): string {
    const course = member.enrollment_course || member.course;
    if (course?.code && course?.name) return `${course.code} - ${course.name}`;
    if (course?.code) return course.code;
    if (course?.name) return course.name;
    return "Enrollment course not recorded";
}

function memberDepartmentLabel(member: CapstoneTeamContextMember): string | null {
    return member.home_department?.name || null;
}

export function ProjectSupportSummary({
    support,
}: {
    support: CapstoneSupportSummary;
}) {
    const acceptedMentor = support.accepted_mentor;
    const pendingCount =
        Number(support.pending_mentor_request_count || 0) +
        Number(support.pending_mentor_offer_count || 0);

    let title = "Support required";
    let detail = "An accepted mentor or confirmed external partner is still required.";
    let tone = "border-amber-200 bg-amber-50 text-amber-900";
    let Icon = CircleAlert;

    if (acceptedMentor) {
        title = "Mentor confirmed";
        detail = acceptedMentor.mentor_email || `Mentor #${acceptedMentor.mentor_fk}`;
        tone = "border-emerald-200 bg-emerald-50 text-emerald-900";
        Icon = CheckCircle2;
    } else if (support.external_partner_support_confirmed) {
        title = "External partner confirmed";
        detail =
            support.external_partner?.organization ||
            support.external_partner?.name ||
            "External partner support is attached.";
        tone = "border-emerald-200 bg-emerald-50 text-emerald-900";
        Icon = CheckCircle2;
    } else if (support.requires_project_support === false) {
        title = "Support optional";
        detail = "This coordinating course does not require project support.";
        tone = "border-slate-200 bg-slate-50 text-slate-700";
        Icon = Handshake;
    }

    return (
        <div className={`flex min-w-0 gap-3 rounded-md border p-3 ${tone}`}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-0.5 text-xs [overflow-wrap:anywhere]">{detail}</p>
                {pendingCount > 0 && (
                    <p className="mt-1 text-xs font-medium">
                        {pendingCount} pending support {pendingCount === 1 ? "item" : "items"}
                    </p>
                )}
            </div>
        </div>
    );
}

export function OfficialTeamRoster({
    members,
    renderMemberAction,
    onViewProfile,
}: {
    members: CapstoneTeamContextMember[];
    renderMemberAction?: (member: CapstoneTeamContextMember) => ReactNode;
    onViewProfile?: (member: CapstoneTeamContextMember) => void;
}) {
    if (members.length === 0) {
        return <p className="text-sm text-slate-600">No official members are recorded.</p>;
    }
    return (
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-2">
            {members.map((member) => {
                const department = memberDepartmentLabel(member);
                return (
                    <li
                        key={member.user_id}
                        className="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                    >
                        <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                                {(member.email || "?").charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex min-w-0 items-start gap-2">
                                    <span className="min-w-0 text-sm font-medium text-slate-900 [overflow-wrap:anywhere]">
                                        {member.email}
                                    </span>
                                    {member.is_leader && (
                                        <Crown
                                            className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
                                            aria-label="Team leader"
                                        />
                                    )}
                                </div>
                                <p className="mt-1 text-xs text-slate-600 [overflow-wrap:anywhere]">
                                    {memberCourseLabel(member)}
                                </p>
                                {department && (
                                    <p className="mt-0.5 text-xs text-slate-500 [overflow-wrap:anywhere]">
                                        {department}
                                    </p>
                                )}
                            </div>
                        </div>
                        {(onViewProfile || renderMemberAction) && (
                            <div className="mt-3 flex flex-wrap items-center justify-end gap-1.5 border-t border-slate-100 pt-2.5">
                                {onViewProfile && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onViewProfile(member)}
                                        className="text-slate-600"
                                        aria-label={`View profile for ${member.email}`}
                                    >
                                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                                        View profile
                                    </Button>
                                )}
                                {renderMemberAction?.(member)}
                            </div>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}

export function OfficialTeamRosterSkeleton({ count = 3 }: { count?: number }) {
    return (
        <div
            className="grid min-h-[7.5rem] grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-2"
            aria-label="Loading official team roster"
        >
            {Array.from({ length: Math.max(1, count) }, (_, index) => (
                <div
                    key={index}
                    className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                >
                    <div className="flex items-start gap-3">
                        <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-slate-200" />
                        <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                            <div className="h-3.5 w-4/5 animate-pulse rounded bg-slate-200" />
                            <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
                        </div>
                    </div>
                    <div className="mt-3 flex justify-end border-t border-slate-100 pt-2.5">
                        <div className="h-7 w-24 animate-pulse rounded-md bg-slate-100" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function FinalizationReadiness({
    readiness,
}: {
    readiness: CapstoneTeamContext["readiness"];
}) {
    return (
        <>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                    Finalization readiness
                </h3>
                <span className="text-xs font-medium text-slate-500">
                    {readiness.ready_count}/{readiness.total_count} ready
                </span>
            </div>
            <ul className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-2">
                {[...readiness.items]
                    .sort((left, right) => Number(left.ready) - Number(right.ready))
                    .map((item) => (
                    <li
                        key={item.key}
                        className={`flex min-w-0 gap-3 rounded-md border p-3 ${
                            item.ready
                                ? "border-slate-100 bg-slate-50/70"
                                : "border-amber-200 bg-amber-50/70"
                        }`}
                    >
                        {item.ready ? (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                        ) : (
                            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        )}
                        <div className="min-w-0">
                            <p className={`text-sm font-medium ${item.ready ? "text-slate-600" : "text-slate-900"}`}>{item.label}</p>
                            <p className={`mt-0.5 text-xs leading-5 [overflow-wrap:anywhere] ${item.ready ? "text-slate-500" : "text-amber-900"}`}>
                                {item.detail}
                            </p>
                        </div>
                    </li>
                ))}
            </ul>
        </>
    );
}

export function CapstoneCard({
    project,
    mode = "compact",
    courseLabel,
    teamContext,
    contextLoading = false,
    contextError,
    showTeamContext = Boolean(teamContext || contextLoading || contextError),
    details,
    actions,
    supportActions,
    management,
    timeline,
    renderMemberAction,
    onClick,
    isInterested = false,
    canExpressInterest = true,
    actionLabel = "Request to join",
    activeActionLabel = "Edit request",
    actionKind = "interest",
    showSaveAction = false,
    isSaved = false,
    canSave = false,
    saveBusy = false,
    saveKind = "project",
    onInterestClick,
    onSaveClick,
    onSaveOptimisticChange,
    onSaveError,
}: CapstoneCardProps) {
    const ActionIcon = actionKind === "mentor" ? Handshake : UserPlus;
    const phaseLabel =
        project.marketplace_phase_context?.effective_phase || project.marketplace_phase;
    const hasPhaseOverride =
        project.marketplace_phase_context?.override_source &&
        project.marketplace_phase_context.override_source !== "global";
    const isReadOnly =
        project.marketplace_action_state === "read_only" ||
        (project.can_express_interest === false && Boolean(project.read_only_reason));
    const support = teamContext?.support_summary || project.support_summary;
    const statusLabel =
        getCapstoneStatusLabel(project.status) || formatUnknownStatus(project.status);
    const departmentValues = Array.isArray(project.department)
        ? project.department
        : project.department
          ? [project.department]
          : [];

    if (mode === "compact") {
        const summary = (
            <div className="flex min-w-0 flex-col gap-3 p-4 sm:p-5">
                <div className="flex min-w-0 items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h3 className="text-lg font-semibold leading-snug tracking-[-0.015em] text-slate-950 [overflow-wrap:anywhere]">
                            {project.title || "Untitled Project"}
                        </h3>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500">
                            {project.year && (
                                <span className="inline-flex items-center gap-1.5">
                                    <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                                    {project.year}
                                </span>
                            )}
                            {courseLabel && (
                                <span className="inline-flex min-w-0 items-center gap-1.5 [overflow-wrap:anywhere]">
                                    <GraduationCap className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                    {courseLabel}
                                </span>
                            )}
                            {departmentValues.length > 0 && (
                                <span className="inline-flex min-w-0 items-center gap-1.5 [overflow-wrap:anywhere]">
                                    <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                    <TaxonomyChipList
                                        namespace="department"
                                        values={departmentValues}
                                    />
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex max-w-[45%] shrink-0 flex-wrap justify-end gap-1.5">
                        {statusLabel && (
                            <span
                                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass(project.status)}`}
                            >
                                {statusLabel}
                            </span>
                        )}
                        {isReadOnly && statusLabel !== "Read-only" && (
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                Read-only
                            </span>
                        )}
                    </div>
                </div>

                <p className="line-clamp-2 text-sm leading-6 text-slate-600 [overflow-wrap:anywhere]">
                    {project.description || "No description provided."}
                </p>

                {(project.external_partner_organization || hasPhaseOverride) && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        {project.external_partner_organization && (
                            <span className="inline-flex min-w-0 items-center gap-1.5 font-medium text-slate-700 [overflow-wrap:anywhere]">
                                <Handshake className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                {project.external_partner_organization}
                            </span>
                        )}
                        {hasPhaseOverride && phaseLabel && (
                            <span className="capitalize">{phaseLabel} phase</span>
                        )}
                    </div>
                )}

                {onClick && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700">
                        View details
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                )}
            </div>
        );

        const hasFooterActions =
            Boolean(actions) ||
            Boolean(showSaveAction && onSaveClick) ||
            Boolean(canExpressInterest && onInterestClick);
        const hasFooter = Boolean(support?.accepted_mentor) || hasFooterActions;

        return (
            <Card className="group w-full gap-0 p-0 transition hover:border-slate-300 hover:shadow-[0_2px_4px_rgba(15,23,42,0.04),0_12px_28px_rgba(15,23,42,0.04)]">
                {onClick ? (
                    <button
                        type="button"
                        onClick={onClick}
                        className="w-full min-w-0 rounded-t-xl text-left outline-none transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400"
                        aria-label={`View details for ${project.title || "untitled project"}`}
                    >
                        {summary}
                    </button>
                ) : (
                    summary
                )}
                {hasFooter && (
                    <footer className="flex min-w-0 flex-col gap-3 border-t border-slate-100 bg-slate-50/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                        {support?.accepted_mentor && (
                            <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-emerald-700 [overflow-wrap:anywhere]">
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                Mentor confirmed
                            </span>
                        )}
                        {hasFooterActions && (
                            <div className="flex w-full min-w-0 flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:items-center sm:justify-end">
                                {actions || (
                                    <>
                                        {showSaveAction && onSaveClick && (
                                            <CapstoneSaveToggle
                                                kind={saveKind}
                                                saved={isSaved}
                                                canSave={canSave}
                                                busy={saveBusy}
                                                onToggle={onSaveClick}
                                                onOptimisticChange={onSaveOptimisticChange}
                                                onError={onSaveError}
                                            />
                                        )}
                                        {canExpressInterest && onInterestClick && (
                                            <Button
                                                type="button"
                                                variant={isInterested ? "secondary" : "default"}
                                                size="sm"
                                                onClick={onInterestClick}
                                                aria-label={isInterested ? activeActionLabel : actionLabel}
                                                className={isInterested ? "text-emerald-700" : undefined}
                                            >
                                                {isInterested ? <Pencil aria-hidden="true" /> : <ActionIcon aria-hidden="true" />}
                                                {isInterested ? activeActionLabel : actionLabel}
                                            </Button>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </footer>
                )}
            </Card>
        );
    }

    return (
        <Card className="w-full gap-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-0 shadow-sm">
            <header className="border-b border-slate-200 bg-slate-50 px-4 py-5 sm:px-6">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <h2 className="text-xl font-semibold leading-tight text-slate-950 [overflow-wrap:anywhere] sm:text-2xl">
                            {project.title || "Untitled Project"}
                        </h2>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                            {teamContext && (
                                <span className="inline-flex items-center gap-1.5">
                                    <Users className="h-4 w-4" />
                                    {teamContext.members.length} {teamContext.members.length === 1 ? "member" : "members"}
                                </span>
                            )}
                            {courseLabel && <span className="[overflow-wrap:anywhere]">{courseLabel}</span>}
                        </div>
                    </div>
                    {statusLabel && (
                        <span className={`w-fit shrink-0 rounded border px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(project.status)}`}>
                            {statusLabel}
                        </span>
                    )}
                </div>
            </header>

            <div className="divide-y divide-slate-200">
                <section className="px-4 py-5 sm:px-6" aria-labelledby={`overview-${project.capstone_id}`}>
                    <h3 id={`overview-${project.capstone_id}`} className="text-xs font-semibold uppercase text-slate-500">
                        Project Overview
                    </h3>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700 [overflow-wrap:anywhere]">
                        {project.description || "No project description has been provided."}
                    </p>
                    {((project.disciplines?.length ?? 0) > 0 ||
                        (project.skills?.length ?? 0) > 0) && (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            {project.disciplines?.length ? (
                                <div>
                                    <p className="mb-1.5 text-xs font-medium text-slate-500">
                                        Disciplines
                                    </p>
                                    <TaxonomyChipList
                                        namespace="discipline"
                                        values={project.disciplines}
                                    />
                                </div>
                            ) : null}
                            {project.skills?.length ? (
                                <div>
                                    <p className="mb-1.5 text-xs font-medium text-slate-500">
                                        Useful skills
                                    </p>
                                    <TaxonomyChipList
                                        namespace="skill"
                                        values={project.skills}
                                    />
                                </div>
                            ) : null}
                        </div>
                    )}
                </section>

                {showTeamContext && (
                    <>
                        {contextLoading ? (
                            <section className="flex items-center gap-2 px-4 py-5 text-sm text-slate-600 sm:px-6">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading official team context...
                            </section>
                        ) : contextError ? (
                            <section className="px-4 py-5 sm:px-6">
                                <div className="flex gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                                    <p>{contextError}</p>
                                </div>
                            </section>
                        ) : teamContext ? (
                            <>
                                <section className="px-4 py-5 sm:px-6" aria-labelledby={`team-${project.capstone_id}`}>
                                    <div className="flex items-center justify-between gap-3">
                                        <h3 id={`team-${project.capstone_id}`} className="text-xs font-semibold uppercase text-slate-500">
                                            Official Team
                                        </h3>
                                        <span className="text-xs text-slate-500">
                                            {teamContext.members.length} {teamContext.members.length === 1 ? "member" : "members"}
                                        </span>
                                    </div>
                                    <div className="mt-3">
                                        <OfficialTeamRoster
                                            members={teamContext.members}
                                            renderMemberAction={renderMemberAction}
                                        />
                                    </div>
                                </section>

                                <section className="px-4 py-5 sm:px-6" aria-labelledby={`readiness-${project.capstone_id}`}>
                                    <FinalizationReadiness readiness={teamContext.readiness} />
                                </section>

                                <section className="px-4 py-5 sm:px-6" aria-labelledby={`support-${project.capstone_id}`}>
                                    <h3 id={`support-${project.capstone_id}`} className="text-xs font-semibold uppercase text-slate-500">
                                        Project Support
                                    </h3>
                                    <div className="mt-3">
                                        <ProjectSupportSummary support={teamContext.support_summary} />
                                    </div>
                                    {supportActions && <div className="mt-4">{supportActions}</div>}
                                </section>
                            </>
                        ) : null}
                    </>
                )}

                {details && <section className="px-4 py-5 sm:px-6">{details}</section>}
                {actions && <section className="px-4 py-4 sm:px-6">{actions}</section>}
                {management && <section className="px-4 py-5 sm:px-6">{management}</section>}
                {timeline && <section className="px-4 py-5 sm:px-6">{timeline}</section>}
            </div>
        </Card>
    );
}
