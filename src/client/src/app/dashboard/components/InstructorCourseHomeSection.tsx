"use client";

import { useEffect, useMemo, useState } from "react";
import {
    ArrowRight,
    AlertTriangle,
    CheckCircle2,
    ClipboardCheck,
    Loader2,
    UserRoundCog,
    Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice, SectionHeader, StatusBadge } from "@/components/ui/workspace";
import { userContext } from "@/contexts/UserContext";
import { fetchPendingCapstones } from "@/services/capstones.service";
import { fetchTeams } from "@/services/teams.service";
import { fetchInstructorCourseRoster } from "@/services/users.service";
import { InstructorCoursePhaseCard } from "./InstructorCoursePhaseCard";

type CourseHomeTab = "approvals" | "teams" | "roster" | "mentors";
type AttentionTone = "slate" | "amber" | "blue";

interface InstructorCourseHomeSectionProps {
    onNavigate: (tab: CourseHomeTab) => void;
}

interface TeamSummary {
    team_id?: number | string;
    status?: string | null;
    capstone?: {
        status?: string | null;
        title?: string | null;
    } | null;
    capstone_title?: string | null;
}

function parseTeams(payload: unknown): TeamSummary[] {
    if (Array.isArray(payload)) return payload as TeamSummary[];
    if (payload && typeof payload === "object") {
        const record = payload as { data?: unknown; teams?: unknown };
        if (Array.isArray(record.data)) return record.data as TeamSummary[];
        if (Array.isArray(record.teams)) return record.teams as TeamSummary[];
    }
    return [];
}

function normalizeStatus(value?: string | null) {
    return (value || "").trim().toLowerCase();
}

function loadErrorDetail(error: unknown, fallback: string) {
    return error instanceof Error && error.message ? error.message : fallback;
}

function attentionToneClass(tone: AttentionTone) {
    const classes: Record<AttentionTone, string> = {
        slate: "bg-white text-slate-700",
        amber: "bg-amber-50/60 text-amber-900",
        blue: "bg-blue-50/60 text-blue-800",
    };
    return classes[tone];
}

export function InstructorCourseHomeSection({ onNavigate }: InstructorCourseHomeSectionProps) {
    const { user } = userContext();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [pendingReviewCount, setPendingReviewCount] = useState(0);
    const [rosterCount, setRosterCount] = useState(0);
    const [unassignedCount, setUnassignedCount] = useState(0);
    const [teams, setTeams] = useState<TeamSummary[]>([]);

    const course = user?.course;
    const courseId = course?.course_id ?? user?.course_fk;
    const courseIdKey = courseId === null || courseId === undefined ? "" : String(courseId);
    const userIdKey = user?.user_id === null || user?.user_id === undefined ? "" : String(user?.user_id);
    const hasAssignedCourse =
        courseId !== null &&
        courseId !== undefined &&
        String(courseId).trim().length > 0;
    const courseInactive =
        hasAssignedCourse && (course?.active === false || user?.course_active === false);
    const courseLabel = course?.code
        ? `${course.code}${course.name ? ` - ${course.name}` : ""}`
        : "Assigned course";

    useEffect(() => {
        let mounted = true;

        async function loadCourseHome() {
            if (!hasAssignedCourse) {
                setLoading(false);
                setError("");
                setPendingReviewCount(0);
                setRosterCount(0);
                setUnassignedCount(0);
                setTeams([]);
                return;
            }

            setLoading(true);
            setError("");
            try {
                const [reviewResult, rosterResult, teamsResult] = await Promise.allSettled([
                    fetchPendingCapstones(1, 100),
                    fetchInstructorCourseRoster(),
                    fetchTeams(),
                ]);
                if (!mounted) return;

                const failures: string[] = [];

                if (reviewResult.status === "fulfilled") {
                    const reviewPayload = reviewResult.value;
                    setPendingReviewCount(
                        Number(reviewPayload.total ?? reviewPayload.data?.length ?? 0)
                    );
                } else {
                    setPendingReviewCount(0);
                    failures.push(
                        `reviews (${loadErrorDetail(reviewResult.reason, "failed to load")})`
                    );
                }

                if (rosterResult.status === "fulfilled") {
                    const roster = rosterResult.value.data || [];
                    setRosterCount(roster.length);
                    setUnassignedCount(
                        roster.filter((student) => !student.active_team_fk).length
                    );
                } else {
                    setRosterCount(0);
                    setUnassignedCount(0);
                    failures.push(
                        `roster (${loadErrorDetail(rosterResult.reason, "failed to load")})`
                    );
                }

                if (teamsResult.status === "fulfilled") {
                    setTeams(parseTeams(teamsResult.value));
                } else {
                    setTeams([]);
                    failures.push(
                        `teams (${loadErrorDetail(teamsResult.reason, "failed to load")})`
                    );
                }

                setError(
                    failures.length
                        ? `Some course home data could not load: ${failures.join("; ")}.`
                        : ""
                );
            } catch (err) {
                console.error("Failed to load instructor course home:", err);
                if (mounted) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Could not load course management summary."
                    );
                    setPendingReviewCount(0);
                    setRosterCount(0);
                    setUnassignedCount(0);
                    setTeams([]);
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        loadCourseHome();

        return () => {
            mounted = false;
        };
    }, [courseIdKey, hasAssignedCourse, userIdKey]);

    const teamCounts = useMemo(() => {
        return teams.reduce(
            (acc, team) => {
                const teamStatus = normalizeStatus(team.status);
                const capstoneStatus = normalizeStatus(team.capstone?.status);
                if (capstoneStatus === "approved_recruiting") {
                    acc.recruiting += 1;
                }
                if (
                    teamStatus === "finalized" ||
                    capstoneStatus === "approved" ||
                    capstoneStatus === "complete"
                ) {
                    acc.finalized += 1;
                }
                return acc;
            },
            { recruiting: 0, finalized: 0 }
        );
    }, [teams]);

    const attentionItems = useMemo(() => {
        const items: Array<{
            title: string;
            detail: string;
            tone: AttentionTone;
            count: number;
            icon: typeof ClipboardCheck;
            tab: CourseHomeTab;
            action: string;
        }> = [];

        if (pendingReviewCount > 0) {
            items.push({
                title: "Submissions waiting for review",
                detail: "Review each proposal and record an approve, reject, or changes-requested decision.",
                tone: "blue",
                count: pendingReviewCount,
                icon: ClipboardCheck,
                tab: "approvals",
                action: "Open reviews",
            });
        }
        if (unassignedCount > 0) {
            items.push({
                title: "Students without teams",
                detail: "Inspect enrollment and team context before assigning or creating a team.",
                tone: "amber",
                count: unassignedCount,
                icon: Users,
                tab: "roster",
                action: "Open roster",
            });
        }
        if (teamCounts.recruiting > 0) {
            items.push({
                title: "Recruiting teams need follow-up",
                detail: "Check roster readiness, project support, and the next finalization step.",
                tone: "slate",
                count: teamCounts.recruiting,
                icon: UserRoundCog,
                tab: "teams",
                action: "Review teams",
            });
        }

        return items;
    }, [pendingReviewCount, teamCounts.recruiting, unassignedCount]);

    return (
        <section className="space-y-5">
            <SectionHeader
                title="Course attention"
                description={`Tasks for ${courseLabel} are ordered by what most directly blocks student progress.`}
                actions={
                    courseInactive ? (
                        <StatusBadge tone="warning">Inactive course</StatusBadge>
                    ) : undefined
                }
            />

            {error && (
                <Notice tone="danger" title="Some course data could not load">
                    {error}
                </Notice>
            )}

            {!hasAssignedCourse ? (
                <Notice tone="warning" title="Course assignment needed" icon={AlertTriangle}>
                    Ask an admin or enrollment operator to assign this instructor to an active
                    course before reviews, roster management, and team operations are available.
                </Notice>
            ) : courseInactive ? (
                <Notice tone="warning" title="Verify course setup before new decisions">
                    Existing roster and team records remain visible, but new routing decisions
                    should wait until an admin verifies staffing and term availability.
                </Notice>
            ) : null}

            {hasAssignedCourse && <InstructorCoursePhaseCard courseId={Number(courseId)} />}

            {hasAssignedCourse && loading ? (
                <div className="wm-panel flex items-center gap-2 px-4 py-5 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Loading course attention…
                </div>
            ) : hasAssignedCourse ? (
                <>
                    <section aria-labelledby="course-attention-heading" className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <h3 id="course-attention-heading" className="text-sm font-semibold text-slate-900">
                                Needs attention
                            </h3>
                            <span className="text-xs font-medium tabular-nums text-slate-500">
                                {attentionItems.length} {attentionItems.length === 1 ? "task" : "tasks"}
                            </span>
                        </div>

                        {attentionItems.length === 0 ? (
                            <Notice tone="success" title="Course operations are clear" icon={CheckCircle2}>
                                There are no pending reviews, unassigned roster students, or
                                recruiting-team follow-ups visible right now.
                            </Notice>
                        ) : (
                            <div className="wm-panel divide-y divide-slate-100 overflow-hidden">
                                {attentionItems.map((item) => {
                                    const ItemIcon = item.icon;
                                    const badgeTone =
                                        item.tone === "blue"
                                            ? "info"
                                            : item.tone === "amber"
                                              ? "warning"
                                              : "neutral";
                                    return (
                                        <div
                                            key={item.title}
                                            className={`grid min-w-0 gap-3 px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center ${attentionToneClass(item.tone)}`}
                                        >
                                            <span className="flex size-9 items-center justify-center rounded-lg border border-current/15 bg-white/70">
                                                <ItemIcon className="size-4" aria-hidden="true" />
                                            </span>
                                            <div className="min-w-0">
                                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                    <p className="font-medium text-slate-950">{item.title}</p>
                                                    <StatusBadge tone={badgeTone} className="tabular-nums">
                                                        {item.count}
                                                    </StatusBadge>
                                                </div>
                                                <p className="mt-1 text-sm leading-5 text-slate-600">
                                                    {item.detail}
                                                </p>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => onNavigate(item.tab)}
                                                className="w-full bg-white/90 sm:w-auto"
                                            >
                                                {item.action}
                                                <ArrowRight className="size-4" aria-hidden="true" />
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    <section className="wm-panel overflow-hidden" aria-labelledby="course-snapshot-heading">
                        <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h3 id="course-snapshot-heading" className="text-sm font-semibold text-slate-900">
                                    Course snapshot
                                </h3>
                                <p className="mt-0.5 text-xs text-slate-500">
                                    Settled course state stays quiet until it needs action.
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => onNavigate("mentors")}
                            >
                                Browse mentors
                            </Button>
                        </div>
                        <dl className="grid divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                            <div className="px-4 py-3">
                                <dt className="text-xs text-slate-500">Roster students</dt>
                                <dd className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{rosterCount}</dd>
                            </div>
                            <div className="px-4 py-3">
                                <dt className="text-xs text-slate-500">Course teams</dt>
                                <dd className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{teams.length}</dd>
                            </div>
                            <div className="px-4 py-3">
                                <dt className="text-xs text-slate-500">Finalized teams</dt>
                                <dd className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{teamCounts.finalized}</dd>
                            </div>
                        </dl>
                        {(pendingReviewCount === 0 || unassignedCount === 0 || teamCounts.recruiting === 0) && (
                            <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
                                {pendingReviewCount === 0 && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden="true" />
                                        Reviews clear
                                    </span>
                                )}
                                {unassignedCount === 0 && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden="true" />
                                        Every roster student has a team
                                    </span>
                                )}
                                {teamCounts.recruiting === 0 && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden="true" />
                                        No recruiting follow-up
                                    </span>
                                )}
                            </div>
                        )}
                    </section>
                </>
            ) : null}
        </section>
    );
}
