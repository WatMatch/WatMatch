"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, RotateCcw, UserMinus } from "lucide-react";
import {
    ConfirmActionDialog,
    Disclosure,
    EmptyState,
    Notice,
    PaginationBar,
    SectionHeader,
    StatusBadge,
} from "@/components/ui/workspace";
import { fetchCourses, type Course } from "@/services/courses.service";
import {
    courseOptionLabel,
    filterStaffedActiveCourses,
} from "@/lib/course-options";
import {
    decideProjectCommitment,
    fetchPendingProjectCommitments,
    type MarketplaceStudentSummary,
    type ProjectCommitmentQueueItem,
} from "@/services/marketplace.service";
import {
    matchesOptionalId,
    matchesSearch,
    type OperationsQueueFilters,
} from "@/lib/operations-filters";

const PAGE_SIZE = 100;

type CommitmentGroup = {
    key: string;
    items: ProjectCommitmentQueueItem[];
};

type SecondaryDecisionTarget = {
    item: ProjectCommitmentQueueItem;
    decision: "reject" | "cancel";
    groupKey: string;
};

type RosterMember = MarketplaceStudentSummary & {
    source: "official" | "pending";
    is_leader?: boolean | null;
    requestItem?: ProjectCommitmentQueueItem;
    requestedByEmail?: string | null;
};

function courseLabel(course?: Course | ProjectCommitmentQueueItem["recommended_course"] | null) {
    return courseOptionLabel(course, { fallback: "No course" });
}

function departmentLabel(value: MarketplaceStudentSummary | null | undefined): string {
    const department = value?.home_department;
    if (!department) return "Unassigned";
    if (typeof department === "string") return department;
    return department.name;
}

function currentRouteLabel(
    member: MarketplaceStudentSummary | null | undefined,
    courses: Course[]
): string {
    if (!member) return "No course";
    const courseId = member.enrollment_course_fk ?? member.course_fk;
    const course =
        member.enrollment_course ||
        courses.find((candidate) => candidate.course_id === Number(courseId));
    return courseLabel(course);
}

function memberRouteKey(groupKey: string, studentId: number) {
    return `${groupKey}:${studentId}`;
}

function formatShortDateTime(value?: string | null) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function defaultEnrollmentCourseId(
    student: MarketplaceStudentSummary | null | undefined,
    recommendedCourse: ProjectCommitmentQueueItem["recommended_course"],
    staffedCourses: Course[]
) {
    const currentCourseId = student?.enrollment_course_fk || student?.course_fk;
    if (
        currentCourseId &&
        staffedCourses.some((course) => course.course_id === Number(currentCourseId))
    ) {
        return String(currentCourseId);
    }
    if (recommendedCourse?.course_id) {
        return String(recommendedCourse.course_id);
    }
    return "";
}

function finalRosterMembers(group: CommitmentGroup): RosterMember[] {
    const members = new Map<number, RosterMember>();
    const firstItem = group.items[0];

    (firstItem?.official_members || []).forEach((member) => {
        members.set(member.user_id, {
            ...member,
            source: "official",
            is_leader: member.is_leader,
        });
    });

    group.items.forEach((item) => {
        if (!item.student?.user_id) return;
        members.set(item.student.user_id, {
            ...item.student,
            source: "pending",
            requestItem: item,
            requestedByEmail: item.requested_by?.email || null,
        });
    });

    return Array.from(members.values()).sort((a, b) => {
        if (a.source !== b.source) return a.source === "official" ? -1 : 1;
        if (a.is_leader !== b.is_leader) return a.is_leader ? -1 : 1;
        return (a.email || "").localeCompare(b.email || "");
    });
}

export function ProjectCommitmentsSection({ filters }: { filters?: OperationsQueueFilters } = {}) {
    const [items, setItems] = useState<ProjectCommitmentQueueItem[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [selectedCourses, setSelectedCourses] = useState<Record<string, string>>({});
    const [selectedMemberCourses, setSelectedMemberCourses] = useState<Record<string, string>>({});
    const [comments, setComments] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [secondaryDecisionTarget, setSecondaryDecisionTarget] =
        useState<SecondaryDecisionTarget | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const loadRequestIdRef = useRef(0);

    const staffedCourses = useMemo(
        () => filterStaffedActiveCourses(courses),
        [courses]
    );
    const groupedItems = useMemo<CommitmentGroup[]>(() => {
        const groups = new Map<string, ProjectCommitmentQueueItem[]>();
        items.forEach((item) => {
            const key = `${item.request.capstone_fk}-${item.request.team_fk}`;
            groups.set(key, [...(groups.get(key) || []), item]);
        });
        return Array.from(groups.entries()).map(([key, groupItems]) => ({
            key,
            items: groupItems,
        }));
    }, [items]);
    const visibleGroups = useMemo(
        () =>
            groupedItems
                .map((group) => ({
                    ...group,
                    items: group.items.filter((item) => {
                        const departmentValue = item.student?.home_department;
                        const departmentId =
                            typeof departmentValue === "object" && departmentValue
                                ? departmentValue.department_id
                                : item.student?.home_department_id;
                        return (
                            matchesSearch(filters?.search, [
                                item.capstone?.title,
                                item.student?.email,
                                item.requested_by?.email,
                            ]) &&
                            matchesOptionalId(filters?.courseId, [
                                item.recommended_course?.course_id,
                                item.request.target_course_fk,
                                item.student?.course_fk,
                                item.team?.course_fk,
                                item.capstone?.course_fk,
                            ]) &&
                            matchesOptionalId(filters?.departmentId, [departmentId])
                        );
                    }),
                }))
                .filter((group) => group.items.length > 0),
        [filters?.courseId, filters?.departmentId, filters?.search, groupedItems]
    );

    const load = useCallback(async (targetPage: number) => {
        const requestId = loadRequestIdRef.current + 1;
        loadRequestIdRef.current = requestId;
        setLoading(true);
        setError(null);
        try {
            const [queue, courseRows] = await Promise.all([
                fetchPendingProjectCommitments(targetPage, PAGE_SIZE, {
                    search: filters?.search || null,
                    course_id: filters?.courseId || null,
                    department_id: filters?.departmentId || null,
                }),
                fetchCourses(true),
            ]);
            if (loadRequestIdRef.current !== requestId) return;
            setItems(queue.data || []);
            setCourses(courseRows);
            setPage(queue.page || targetPage);
            setTotalPages(queue.total_pages || 1);
            setSelectedCourses((current) => {
                const next = { ...current };
                (queue.data || []).forEach((item) => {
                    const groupKey = `${item.request.capstone_fk}-${item.request.team_fk}`;
                    if (!next[groupKey] && item.recommended_course?.course_id) {
                        next[groupKey] = String(item.recommended_course.course_id);
                    }
                });
                return next;
            });
            setSelectedMemberCourses((current) => {
                const next = { ...current };
                (queue.data || []).forEach((item) => {
                    const groupKey = `${item.request.capstone_fk}-${item.request.team_fk}`;
                    const members = [
                        ...(item.official_members || []),
                        ...(item.student ? [item.student] : []),
                    ];
                    members.forEach((member) => {
                        const key = memberRouteKey(groupKey, member.user_id);
                        if (!next[key]) {
                            next[key] = defaultEnrollmentCourseId(
                                member,
                                item.recommended_course,
                                filterStaffedActiveCourses(courseRows)
                            );
                        }
                    });
                });
                return next;
            });
        } catch (err) {
            if (loadRequestIdRef.current !== requestId) return;
            console.error(err);
            setError(err instanceof Error ? err.message : "Could not load commitment requests.");
        } finally {
            if (loadRequestIdRef.current === requestId) {
                setLoading(false);
            }
        }
    }, [filters?.courseId, filters?.departmentId, filters?.search]);

    useEffect(() => {
        load(1);
    }, [load]);

    const decide = async (
        item: ProjectCommitmentQueueItem,
        decision: "approve" | "reject" | "cancel",
        groupKey?: string,
        notesOverride?: string
    ) => {
        const requestId = item.request.commitment_request_id;
        const key = groupKey || String(requestId);
        const courseId = Number(selectedCourses[key]);
        const decisionNotes = notesOverride?.trim() || comments[key]?.trim() || "";
        if ((decision === "reject" || decision === "cancel") && !decisionNotes) {
            setError("Decision notes are required when rejecting or returning a commitment.");
            return;
        }
        if (decision === "approve" && (!Number.isFinite(courseId) || courseId <= 0)) {
            setError("Choose a staffed active coordinating course before approving this commitment.");
            return;
        }
        const visibleGroup =
            groupKey && decision === "approve"
                ? visibleGroups.find((group) => group.key === groupKey)
                : null;
        const memberRoutes: Record<string, number> = {};
        if (visibleGroup) {
            const rosterMembers = finalRosterMembers(visibleGroup);
            const teamPendingCount = Math.max(
                ...visibleGroup.items.map((groupItem) => groupItem.team_pending_count || 0),
                visibleGroup.items.length
            );
            if (teamPendingCount > visibleGroup.items.length) {
                setError(
                    "Clear filters or page through until every confirmed student for this project/team is visible before approving. Staff must choose enrollment courses for the full proposed roster."
                );
                return;
            }
            for (const member of rosterMembers) {
                const routeKey = memberRouteKey(groupKey!, member.user_id);
                const rawEnrollmentCourseId =
                    selectedMemberCourses[routeKey] ||
                    defaultEnrollmentCourseId(
                        member,
                        visibleGroup.items[0]?.recommended_course || null,
                        staffedCourses
                    ) ||
                    String(courseId);
                const enrollmentCourseId = Number(rawEnrollmentCourseId);
                if (!Number.isFinite(enrollmentCourseId) || enrollmentCourseId <= 0) {
                    setError("Choose a staffed active enrollment course for every proposed-roster student.");
                    return;
                }
                memberRoutes[String(member.user_id)] = enrollmentCourseId;
            }
            const enrollmentChanged = rosterMembers.some((member) => {
                const currentCourseId = member.enrollment_course_fk || member.course_fk;
                return (
                    currentCourseId &&
                    memberRoutes[String(member.user_id)] !== Number(currentCourseId)
                );
            });
            const coordinatingChanged =
                visibleGroup.items[0]?.recommended_course?.course_id &&
                Number(visibleGroup.items[0].recommended_course.course_id) !== Number(courseId);
            if ((enrollmentChanged || coordinatingChanged) && !decisionNotes) {
                setError("Decision notes are required when approving a changed coordinating or enrollment course route.");
                return;
            }
        }
        setSavingId(decision === "approve" ? key : String(requestId));
        setError(null);
        setNotice(null);
        try {
            const result = await decideProjectCommitment(requestId, {
                decision,
                target_course_id: decision === "approve" ? courseId : null,
                member_enrollment_routes:
                    decision === "approve" && Object.keys(memberRoutes).length > 0
                        ? memberRoutes
                        : null,
                comments: decisionNotes || null,
            });
            if (decision === "approve") {
                const routedCount =
                    ("routed_students" in result && result.routed_students?.length) ||
                    ("routed_count" in result && result.routed_count) ||
                    ("committed_count" in result && result.committed_count) ||
                    ("commitment_requests" in result && result.commitment_requests?.length) ||
                    1;
                const targetCourse =
                    "coordinating_course" in result && result.coordinating_course
                        ? result.coordinating_course
                        : "target_course" in result && result.target_course
                          ? result.target_course
                        : selectedCourses[key]
                          ? courses.find((course) => String(course.course_id) === selectedCourses[key])
                          : null;
                setNotice(
                    `Approved ${routedCount} student${routedCount === 1 ? "" : "s"}, set ${courseLabel(targetCourse)} as the coordinating course, assigned enrollment courses, and reopened instructor review.`
                );
            } else {
                setNotice(
                    decision === "cancel"
                        ? "Commitment returned to exploration where possible."
                        : "Commitment rejected."
                );
            }
            await load(page);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Could not save commitment decision.");
        } finally {
            setSavingId(null);
        }
    };

    return (
        <section className="space-y-4">
            <SectionHeader
                title="Commitment routing"
                description="Choose the coordinating review course and confirm one enrollment route for every proposed roster member."
            />

            <Notice tone="warning">
                Approval records intended routes in WatMatch. The matching Registrar or Quest updates still happen outside WatMatch.
            </Notice>

            {error && (
                <Notice tone="danger" title="Decision not saved">{error}</Notice>
            )}
            {notice && (
                <Notice tone="success">{notice}</Notice>
            )}

            {loading ? (
                <div className="space-y-3" aria-label="Loading commitment requests">
                    {[0, 1].map((item) => (
                        <div key={item} className="h-52 animate-pulse rounded-xl border border-slate-200 bg-white" />
                    ))}
                </div>
            ) : items.length === 0 ? (
                <EmptyState
                    title="Commitment queue is clear"
                    description="No proposed rosters currently need staff course routing."
                />
            ) : visibleGroups.length === 0 ? (
                <EmptyState
                    title="No matching commitments"
                    description="Adjust the search, course, or department filters."
                />
            ) : (
                <div className="space-y-3">
                    {visibleGroups.map((group) => {
                        const firstItem = group.items[0];
                        const selectedCourse = staffedCourses.find(
                            (course) => String(course.course_id) === selectedCourses[group.key]
                        );
                        const busy = savingId === group.key;
                        const rosterMembers = finalRosterMembers(group);
                        const teamPendingCount = Math.max(
                            ...group.items.map((item) => item.team_pending_count || 0),
                            group.items.length
                        );
                        const hiddenPendingCount = Math.max(0, teamPendingCount - group.items.length);

                        return (
                            <article
                                key={group.key}
                                className="wm-panel overflow-hidden"
                            >
                                <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 md:flex-row md:items-start md:justify-between">
                                    <div className="min-w-0">
                                        <h3 className="font-semibold tracking-[-0.01em] text-slate-950">
                                            {firstItem.capstone?.title || "Untitled capstone"}
                                        </h3>
                                        <p className="mt-1 text-sm text-slate-600">
                                            Recommended coordinator: <span className="font-medium text-slate-800">{courseLabel(firstItem.recommended_course)}</span>
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        <StatusBadge tone="warning">
                                            {group.items.length} pending
                                        </StatusBadge>
                                        <StatusBadge tone="neutral">
                                            {rosterMembers.length} roster member{rosterMembers.length === 1 ? "" : "s"}
                                        </StatusBadge>
                                        <StatusBadge tone="neutral">Team #{firstItem.request.team_fk}</StatusBadge>
                                    </div>
                                </div>

                                {hiddenPendingCount > 0 && (
                                    <div className="px-4 pt-4">
                                        <Notice tone="danger" title="Roster is partially hidden">
                                            Clear the current filters before approving so routes can be confirmed for {hiddenPendingCount} additional student{hiddenPendingCount === 1 ? "" : "s"}.
                                        </Notice>
                                    </div>
                                )}

                                <ul className="divide-y divide-slate-100 px-4">
                                    {rosterMembers.map((member) => {
                                        const requestItem = member.requestItem;
                                        const requestId = requestItem?.request.commitment_request_id;
                                        const itemBusy = requestId ? savingId === String(requestId) : false;
                                        const routeKey = memberRouteKey(group.key, member.user_id);
                                        const enrollmentValue =
                                            selectedMemberCourses[routeKey] ||
                                            defaultEnrollmentCourseId(
                                                member,
                                                firstItem.recommended_course || null,
                                                staffedCourses
                                            );
                                        const requestedAt = formatShortDateTime(
                                            requestItem?.request.created_at
                                        );
                                        return (
                                            <li
                                                key={`${member.source}-${member.user_id}`}
                                                className="grid gap-3 py-3.5 text-sm md:grid-cols-[minmax(0,1fr)_minmax(280px,380px)] md:items-start"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="break-all font-medium text-slate-900">
                                                            {member.email || `Student #${member.user_id}`}
                                                        </p>
                                                        <StatusBadge tone={member.source === "pending" ? "warning" : "neutral"}>
                                                            {member.source === "official"
                                                                ? member.is_leader
                                                                    ? "Leader"
                                                                    : "Official member"
                                                                : "Pending commitment"}
                                                        </StatusBadge>
                                                    </div>
                                                    <Disclosure
                                                        className="mt-2 border-0 bg-transparent shadow-none"
                                                        summaryClassName="px-0 py-1 text-xs font-medium text-slate-500 hover:bg-transparent hover:text-slate-800"
                                                        contentClassName="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5"
                                                        summary="Student context and secondary actions"
                                                    >
                                                        <dl className="grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
                                                            <div>
                                                                <dt className="text-slate-500">Home department</dt>
                                                                <dd className="font-medium text-slate-800">{departmentLabel(member)}</dd>
                                                            </div>
                                                            <div>
                                                                <dt className="text-slate-500">Current route</dt>
                                                                <dd className="font-medium text-slate-800">{currentRouteLabel(member, courses)}</dd>
                                                            </div>
                                                            {member.source === "pending" && (
                                                                <div>
                                                                    <dt className="text-slate-500">Requested by</dt>
                                                                    <dd className="break-all font-medium text-slate-800">{member.requestedByEmail || "Unknown"}</dd>
                                                                </div>
                                                            )}
                                                            {requestedAt && (
                                                                <div>
                                                                    <dt className="text-slate-500">Requested</dt>
                                                                    <dd className="font-medium text-slate-800">{requestedAt}</dd>
                                                                </div>
                                                            )}
                                                        </dl>
                                                        {requestItem ? (
                                                            <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() =>
                                                                        setSecondaryDecisionTarget({
                                                                            item: requestItem,
                                                                            decision: "cancel",
                                                                            groupKey: group.key,
                                                                        })
                                                                    }
                                                                    disabled={itemBusy || busy}
                                                                >
                                                                    <RotateCcw /> Return to exploration
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() =>
                                                                        setSecondaryDecisionTarget({
                                                                            item: requestItem,
                                                                            decision: "reject",
                                                                            groupKey: group.key,
                                                                        })
                                                                    }
                                                                    disabled={itemBusy || busy}
                                                                    className="text-red-700 hover:border-red-300 hover:bg-red-50 hover:text-red-800"
                                                                >
                                                                    <UserMinus /> Reject student
                                                                </Button>
                                                            </div>
                                                        ) : null}
                                                    </Disclosure>
                                                </div>
                                                <div className="min-w-0">
                                                    <label htmlFor={`commitment-enrollment-${routeKey}`} className="mb-1.5 block text-xs font-medium text-slate-600">
                                                        Enrollment course
                                                    </label>
                                                    <Select
                                                        value={enrollmentValue}
                                                        onValueChange={(value) =>
                                                            setSelectedMemberCourses((current) => ({
                                                                ...current,
                                                                [routeKey]: value,
                                                            }))
                                                        }
                                                    >
                                                        <SelectTrigger id={`commitment-enrollment-${routeKey}`}>
                                                            <SelectValue placeholder="Choose enrollment course" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {staffedCourses.map((course) => (
                                                                <SelectItem key={course.course_id} value={String(course.course_id)}>
                                                                    {courseLabel(course)}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>

                                <div className="border-t border-slate-100 bg-slate-50/60 p-4">
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <div className="min-w-0">
                                            <label htmlFor={`commitment-course-${group.key}`} className="mb-1.5 block text-xs font-medium text-slate-700">Coordinating review course</label>
                                            <Select
                                                value={selectedCourses[group.key] || ""}
                                                onValueChange={(value) =>
                                                    setSelectedCourses((current) => ({ ...current, [group.key]: value }))
                                                }
                                            >
                                                <SelectTrigger id={`commitment-course-${group.key}`} className="w-full min-w-0">
                                                    <SelectValue placeholder="Choose coordinating course" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {staffedCourses.map((course) => (
                                                        <SelectItem key={course.course_id} value={String(course.course_id)}>
                                                            {courseLabel(course)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="min-w-0">
                                            <label htmlFor={`commitment-notes-${group.key}`} className="mb-1.5 block text-xs font-medium text-slate-700">Decision notes</label>
                                            <Textarea
                                                id={`commitment-notes-${group.key}`}
                                                value={comments[group.key] || ""}
                                                onChange={(event) =>
                                                    setComments((current) => ({ ...current, [group.key]: event.target.value }))
                                                }
                                                placeholder="Required for route changes, returns, or rejection"
                                                className="min-h-9"
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-3 flex flex-col gap-3 border-t border-slate-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
                                        <p className="max-w-3xl text-xs leading-5 text-slate-600">
                                            Approval routes the complete roster together, assigns the selected enrollment courses, and returns the project to instructor review.
                                        </p>
                                        <Button
                                            onClick={() => decide(firstItem, "approve", group.key)}
                                            disabled={busy || !selectedCourse || hiddenPendingCount > 0}
                                            className="sm:shrink-0"
                                        >
                                            {busy ? <Loader2 className="animate-spin" /> : null}
                                            {busy ? "Saving…" : "Approve routing"}
                                        </Button>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            <ConfirmActionDialog
                key={
                    secondaryDecisionTarget
                        ? `${secondaryDecisionTarget.item.request.commitment_request_id}-${secondaryDecisionTarget.decision}`
                        : "closed-secondary-decision"
                }
                open={Boolean(secondaryDecisionTarget)}
                onOpenChange={(open) => {
                    if (!open) setSecondaryDecisionTarget(null);
                }}
                title={
                    secondaryDecisionTarget?.decision === "reject"
                        ? "Reject this student’s commitment?"
                        : "Return this student to exploration?"
                }
                description={
                    secondaryDecisionTarget?.decision === "reject"
                        ? `This removes ${secondaryDecisionTarget.item.student?.email || "the student"} from this proposed roster and records the reason for staff review.`
                        : `This cancels ${secondaryDecisionTarget?.item.student?.email || "the student"}’s pending commitment and returns them to marketplace exploration where possible.`
                }
                confirmLabel={
                    secondaryDecisionTarget?.decision === "reject"
                        ? "Reject commitment"
                        : "Return to exploration"
                }
                tone={secondaryDecisionTarget?.decision === "reject" ? "destructive" : "default"}
                reasonLabel="Decision notes"
                reasonDescription="Explain the decision so the student and other staff have useful context."
                reasonPlaceholder="Add a concise reason for this decision."
                reasonRequired
                onConfirm={async (reason) => {
                    if (!secondaryDecisionTarget) return;
                    await decide(
                        secondaryDecisionTarget.item,
                        secondaryDecisionTarget.decision,
                        secondaryDecisionTarget.groupKey,
                        reason
                    );
                }}
            />

            <PaginationBar
                page={page}
                totalPages={totalPages}
                loading={loading}
                onPrevious={() => load(Math.max(1, page - 1))}
                onNext={() => load(Math.min(totalPages, page + 1))}
                className="rounded-xl border border-slate-200 bg-white"
            />
        </section>
    );
}
