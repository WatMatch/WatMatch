"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, RefreshCw, UserRoundPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    fetchInstructorCourseRoster,
    type InstructorRosterEntry,
} from "@/services/users.service";
import {
    addMemberPrivileged,
    createManagedTeam,
    fetchTeams,
    removeMemberPrivileged,
} from "@/services/teams.service";
import { fetchCourses, type Course } from "@/services/courses.service";
import { userContext } from "@/contexts/UserContext";
import {
    StudentProfileDialog,
    type StudentProfileIdentity,
} from "@/components/students/StudentProfileDialog";
import {
    Disclosure,
    EmptyState,
    Notice,
    SectionHeader,
    StatusBadge,
} from "@/components/ui/workspace";

interface TeamLite {
    team_id?: number | string;
    capstone_fk?: number | string | null;
    status?: string;
    capstone?: {
        status?: string | null;
        title?: string | null;
    } | null;
    capstone_title?: string | null;
}

const lockedCapstoneStatuses = new Set([
    "approved",
    "complete",
    "pending_review",
    "pending_admin_course_routing",
    "archived",
]);

const ROSTER_GRID_TEMPLATE =
    "md:grid-cols-[minmax(0,1.35fr)_minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,0.9fr)_5.5rem]";

function normalizeStatus(status?: string | null) {
    return (status || "").trim().toLowerCase();
}

function formatStatusLabel(status?: string | null) {
    const normalized = normalizeStatus(status);
    const labels: Record<string, string> = {
        approved_recruiting: "Approved - Recruiting",
        pending_review: "Awaiting Instructor Review",
        pending_admin_course_routing: "Awaiting Course Routing",
        changes_requested: "Changes Requested",
        complete: "Complete",
    };
    return labels[normalized] ||
        (normalized
            ? normalized
                  .replaceAll("_", " ")
                  .replace(/\b\w/g, (char) => char.toUpperCase())
            : "Unknown");
}

function getTeamId(team: TeamLite) {
    const teamId = Number(team.team_id);
    return Number.isInteger(teamId) && teamId > 0 ? teamId : null;
}

function getTeamCapstoneStatus(team: TeamLite) {
    return normalizeStatus(team.capstone?.status);
}

function getTeamLockReason(team: TeamLite) {
    const teamStatus = normalizeStatus(team.status);
    if (teamStatus === "archived") return "Archived team";
    if (teamStatus === "finalized") return "Finalized team";

    const capstoneStatus = getTeamCapstoneStatus(team);
    if (lockedCapstoneStatuses.has(capstoneStatus)) {
        return `Capstone is ${formatStatusLabel(capstoneStatus)}`;
    }
    return null;
}

function getTeamWarning(team: TeamLite | null) {
    if (!team) return null;
    if (getTeamCapstoneStatus(team) === "approved_recruiting") {
        return "Adding a student may require another instructor review before join requests continue.";
    }
    return null;
}

function getTeamLabel(team: TeamLite) {
    const teamId = getTeamId(team) ?? team.team_id ?? "unknown";
    const capstoneTitle = team.capstone?.title || team.capstone_title;
    return `Team ${teamId} - ${capstoneTitle || "No capstone"}`;
}

function getTeamCapstoneTitle(team: TeamLite) {
    return team.capstone?.title || team.capstone_title || null;
}

function getDepartmentLabel(student: InstructorRosterEntry) {
    const department = student.home_department;
    if (typeof department === "string" && department.trim()) {
        return department;
    }
    if (department && typeof department === "object" && department.name) {
        return department.name;
    }
    return "Unassigned";
}

function getStatusTone(status?: string | null): "neutral" | "info" | "warning" | "danger" | "success" {
    const normalized = normalizeStatus(status);
    if (normalized === "approved_recruiting") return "warning";
    if (normalized === "approved" || normalized === "complete" || normalized === "finalized") return "success";
    if (normalized === "pending_review" || normalized === "pending_admin_course_routing") {
        return "info";
    }
    if (normalized === "rejected" || normalized === "archived") return "danger";
    return "neutral";
}

function getStudentTeamLockReason(student: InstructorRosterEntry) {
    const teamStatus = normalizeStatus(student.team?.status);
    if (teamStatus === "archived") return "Archived team";
    if (teamStatus === "finalized") return "Finalized team";

    const capstoneStatus = normalizeStatus(student.capstone?.status);
    if (lockedCapstoneStatuses.has(capstoneStatus)) {
        return `Capstone is ${formatStatusLabel(capstoneStatus)}`;
    }
    return null;
}

function getStudentRemoveWarning(student: InstructorRosterEntry | null) {
    if (!student) return null;
    if (normalizeStatus(student.capstone?.status) === "approved_recruiting") {
        return "Removing this student may require another instructor review before join requests continue.";
    }
    return null;
}

function parseTeams(payload: unknown): TeamLite[] {
    if (Array.isArray(payload)) return payload as TeamLite[];
    if (payload && typeof payload === "object") {
        const asRecord = payload as { data?: unknown; teams?: unknown };
        if (Array.isArray(asRecord.data)) return asRecord.data as TeamLite[];
        if (Array.isArray(asRecord.teams)) return asRecord.teams as TeamLite[];
    }
    return [];
}

function toPositiveNumber(value: unknown) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function InstructorRosterSection() {
    const { user } = userContext();
    const currentRole = (user?.role || "").toLowerCase();
    const currentCourseFk = toPositiveNumber(user?.course_fk);
    const isInstructorWithoutCourse =
        currentRole === "instructor" && currentCourseFk === null;
    const instructorCourseInactive =
        currentRole === "instructor" &&
        !isInstructorWithoutCourse &&
        (user?.course?.active === false || user?.course_active === false);
    const [students, setStudents] = useState<InstructorRosterEntry[]>([]);
    const [teams, setTeams] = useState<TeamLite[]>([]);
    const [courses, setCourses] = useState<Record<number, Course>>({});
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [profileStudent, setProfileStudent] =
        useState<StudentProfileIdentity | null>(null);

    const [assignTarget, setAssignTarget] = useState<InstructorRosterEntry | null>(
        null
    );
    const [assignTeamId, setAssignTeamId] = useState("");
    const [assignReason, setAssignReason] = useState("");
    const [removeTarget, setRemoveTarget] = useState<InstructorRosterEntry | null>(
        null
    );
    const [removeReason, setRemoveReason] = useState("");
    const [createTeamOpen, setCreateTeamOpen] = useState(false);
    const [createStudentIds, setCreateStudentIds] = useState<number[]>([]);
    const [createLeaderId, setCreateLeaderId] = useState("");
    const [createReason, setCreateReason] = useState("");
    const loadRequestIdRef = useRef(0);

    const loadData = useCallback(async () => {
        const requestId = loadRequestIdRef.current + 1;
        loadRequestIdRef.current = requestId;
        if (isInstructorWithoutCourse) {
            setLoading(false);
            setError(null);
            setStudents([]);
            setTeams([]);
            setCourses({});
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const [rosterPayload, teamsPayload, courseRows] = await Promise.all([
                fetchInstructorCourseRoster(),
                fetchTeams(),
                fetchCourses(false),
            ]);
            if (loadRequestIdRef.current !== requestId) return;
            setStudents(rosterPayload.data || []);
            setTeams(parseTeams(teamsPayload));
            const mapped = (courseRows || []).reduce<Record<number, Course>>(
                (acc, row) => {
                    acc[row.course_id] = row;
                    return acc;
                },
                {}
            );
            setCourses(mapped);
        } catch (err) {
            if (loadRequestIdRef.current !== requestId) return;
            console.error("Failed to load instructor roster:", err);
            setError("Could not load roster and teams.");
            setStudents([]);
            setTeams([]);
        } finally {
            if (loadRequestIdRef.current === requestId) {
                setLoading(false);
            }
        }
    }, [isInstructorWithoutCourse]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const targetTeams = useMemo(
        () =>
            teams
                .filter((team) => Number(team.team_id) > 0)
                .sort((a, b) => Number(a.team_id) - Number(b.team_id)),
        [teams]
    );

    const availableStudents = useMemo(
        () => students.filter((student) => !student.active_team_fk),
        [students]
    );

    const selectedCreateStudents = useMemo(() => {
        const selectedIds = new Set(createStudentIds);
        return availableStudents.filter((student) => selectedIds.has(student.user_id));
    }, [availableStudents, createStudentIds]);

    const createLeaderCandidates = useMemo(
        () =>
            selectedCreateStudents.filter((student) => {
                if (!student.course_fk) return false;
                if (currentRole === "admin") return true;
                return currentCourseFk !== null && student.course_fk === currentCourseFk;
            }),
        [currentCourseFk, currentRole, selectedCreateStudents]
    );
    const selectedCreateLeader = useMemo(
        () =>
            createLeaderCandidates.find(
                (student) => String(student.user_id) === createLeaderId
            ) || null,
        [createLeaderCandidates, createLeaderId]
    );

    useEffect(() => {
        if (!createLeaderId) return;
        const stillEligible = createLeaderCandidates.some(
            (student) => String(student.user_id) === createLeaderId
        );
        if (!stillEligible) {
            setCreateLeaderId("");
        }
    }, [createLeaderCandidates, createLeaderId]);

    const selectedAssignTeam = useMemo(
        () =>
            targetTeams.find((team) => String(getTeamId(team) ?? "") === assignTeamId) ||
            null,
        [assignTeamId, targetTeams]
    );

    const selectedAssignTeamLockReason = selectedAssignTeam
        ? getTeamLockReason(selectedAssignTeam)
        : null;
    const selectedAssignTeamWarning = getTeamWarning(selectedAssignTeam);
    const removeTargetLockReason = removeTarget
        ? getStudentTeamLockReason(removeTarget)
        : null;
    const removeTargetWarning = getStudentRemoveWarning(removeTarget);

    const handleAssignConfirm = async () => {
        if (!assignTarget) return;
        const teamId = Number(assignTeamId);
        if (!Number.isInteger(teamId) || teamId <= 0) {
            setError("Team ID must be a positive number.");
            return;
        }
        if (!selectedAssignTeam) {
            setError("Please choose a target team from the list.");
            return;
        }
        const lockReason = getTeamLockReason(selectedAssignTeam);
        if (lockReason) {
            setError(`Cannot assign to this team: ${lockReason}.`);
            return;
        }
        const reason = assignReason.trim();
        if (!reason) {
            setError("An audit reason is required when assigning a student to a team.");
            return;
        }
        const key = `assign-${assignTarget.user_id}`;
        setActionLoading(key);
        setError(null);
        try {
            await addMemberPrivileged(
                teamId,
                assignTarget.user_id,
                reason
            );
            await loadData();
            setAssignTarget(null);
            setAssignTeamId("");
            setAssignReason("");
        } catch (err) {
            console.error("Failed to assign student:", err);
            setError(
                err instanceof Error ? err.message : "Failed to assign student to team."
            );
        } finally {
            setActionLoading(null);
        }
    };

    const handleRemoveConfirm = async () => {
        if (!removeTarget?.active_team_fk) return;
        const lockReason = getStudentTeamLockReason(removeTarget);
        if (lockReason) {
            setError(`Cannot remove this student: ${lockReason}.`);
            return;
        }
        const reason = removeReason.trim();
        if (!reason) {
            setError("An audit reason is required when removing a student from a team.");
            return;
        }
        const key = `remove-${removeTarget.user_id}`;
        setActionLoading(key);
        setError(null);
        try {
            await removeMemberPrivileged(
                removeTarget.active_team_fk,
                removeTarget.user_id,
                reason
            );
            await loadData();
            setRemoveTarget(null);
            setRemoveReason("");
        } catch (err) {
            console.error("Failed to remove student:", err);
            setError(
                err instanceof Error ? err.message : "Failed to remove student from team."
            );
        } finally {
            setActionLoading(null);
        }
    };

    const toggleCreateStudent = (student: InstructorRosterEntry, checked: boolean) => {
        if (!student.course_fk || student.active_team_fk) return;
        setCreateStudentIds((previous) => {
            const next = new Set(previous);
            if (checked) {
                next.add(student.user_id);
            } else {
                next.delete(student.user_id);
            }
            return Array.from(next).sort((a, b) => a - b);
        });
    };

    const handleCreateManagedTeam = async () => {
        const leaderId = Number(createLeaderId);
        if (createStudentIds.length === 0) {
            setError("Select at least one student.");
            return;
        }
        if (!Number.isInteger(leaderId) || leaderId <= 0) {
            setError("Choose a leader from the selected students.");
            return;
        }
        if (!createLeaderCandidates.some((student) => student.user_id === leaderId)) {
            setError(
                currentRole === "admin"
                    ? "Leader must be a selected student with a course."
                    : "Leader must be a selected student from your course."
            );
            return;
        }
        const reason = createReason.trim();
        if (!reason) {
            setError("An audit reason is required when creating an instructor-managed team.");
            return;
        }

        setActionLoading("create-managed-team");
        setError(null);
        try {
            await createManagedTeam({
                studentIds: createStudentIds,
                leaderId,
                reason,
            });
            await loadData();
            setCreateTeamOpen(false);
            setCreateStudentIds([]);
            setCreateLeaderId("");
            setCreateReason("");
        } catch (err) {
            console.error("Failed to create managed team:", err);
            setError(err instanceof Error ? err.message : "Failed to create team.");
        } finally {
            setActionLoading(null);
        }
    };

    const getCourseLabel = (courseFk?: number | null) => {
        if (!courseFk) return "Course: Unspecified";
        const row = courses[courseFk];
        if (!row) return `Course #${courseFk}`;
        return `${row.code} - ${row.name}`;
    };

    const rosterScopeLabel = user?.course?.code
        ? `${user.course.code}${user.course.name ? ` - ${user.course.name}` : ""}`
        : currentRole === "admin"
          ? "all visible courses"
          : "your assigned course";

    return (
        <section className="space-y-5">
            <SectionHeader
                title="Course roster"
                description={`${students.length} ${students.length === 1 ? "student" : "students"} in ${rosterScopeLabel}; ${availableStudents.length} currently ${availableStudents.length === 1 ? "has" : "have"} no active team.`}
                actions={
                    <>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={loadData}
                            disabled={loading || isInstructorWithoutCourse}
                        >
                            <RefreshCw className="size-4" aria-hidden="true" />
                            Refresh
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => {
                                setCreateTeamOpen(true);
                                setCreateStudentIds([]);
                                setCreateLeaderId("");
                                setCreateReason("");
                            }}
                            disabled={loading || isInstructorWithoutCourse}
                        >
                            <UserRoundPlus className="size-4" aria-hidden="true" />
                            Create team
                        </Button>
                    </>
                }
            />

            {isInstructorWithoutCourse && (
                <Notice tone="warning" title="Course assignment required">
                    Course assignment is required before this instructor can manage a
                    roster or create instructor-managed teams.
                </Notice>
            )}
            {instructorCourseInactive && (
                <Notice tone="warning" title="This course is inactive">
                    This assigned course is inactive. Keep roster edits limited to cleanup
                    until an admin confirms the course should be staffed and routable.
                </Notice>
            )}
            {error && (
                <Notice tone="danger" title="Roster action could not be completed">
                    {error}
                </Notice>
            )}

            {isInstructorWithoutCourse ? null : loading ? (
                <div className="wm-panel px-4 py-5 text-sm text-slate-600" role="status">
                    Loading roster…
                </div>
            ) : (
                <>
                    <Disclosure
                        summary={`Available teams (${targetTeams.length})`}
                        summaryClassName="[&::after]:hidden"
                        contentClassName="p-3"
                    >
                        {targetTeams.length === 0 ? (
                            <p className="text-sm text-slate-600">
                                No teams available in your current instructor scope.
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                                {targetTeams.map((team) => {
                                    const lockReason = getTeamLockReason(team);
                                    const warning = getTeamWarning(team);
                                    const capstoneTitle = getTeamCapstoneTitle(team);
                                    return (
                                        <div
                                            key={`team-${team.team_id}`}
                                            className={`min-w-0 rounded-lg border px-3 py-2.5 ${
                                                lockReason
                                                    ? "border-red-200 bg-red-50/70"
                                                    : warning
                                                      ? "border-amber-200 bg-amber-50/70"
                                                      : "border-slate-200 bg-slate-50"
                                            }`}
                                        >
                                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                <p className="font-medium text-slate-900">
                                                    Team {getTeamId(team) ?? team.team_id}
                                                </p>
                                                <StatusBadge tone={getStatusTone(team.status)}>
                                                    {formatStatusLabel(team.status)}
                                                </StatusBadge>
                                                {lockReason && (
                                                    <StatusBadge tone="danger">
                                                        Locked
                                                    </StatusBadge>
                                                )}
                                                {!lockReason && warning && (
                                                    <StatusBadge tone="warning">
                                                        Review may be needed
                                                    </StatusBadge>
                                                )}
                                            </div>
                                            <p className="mt-1 break-words text-xs text-slate-600">
                                                {capstoneTitle || "No capstone"}
                                                {team.capstone?.status && (
                                                    <>
                                                        {" "}
                                                        <span className="text-slate-400">|</span>{" "}
                                                        {formatStatusLabel(team.capstone.status)}
                                                    </>
                                                )}
                                            </p>
                                            {lockReason && (
                                                <p className="mt-2 text-xs text-red-700">
                                                    {lockReason}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Disclosure>

                    {students.length === 0 ? (
                        <EmptyState
                            title="No students are visible in this roster"
                            description="Students assigned to this course will appear here."
                        />
                    ) : (
                        <div className="wm-panel overflow-hidden">
                            <div className={`hidden gap-4 border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:grid ${ROSTER_GRID_TEMPLATE}`}>
                                <span>Student</span>
                                <span>Enrollment course</span>
                                <span>Team / project</span>
                                <span>Status</span>
                                <span className="justify-self-end">Details</span>
                            </div>
                            <div>
                                {students.map((student) => {
                                    const teamId = student.active_team_fk;
                                    const assignKey = `assign-${student.user_id}`;
                                    const removeKey = `remove-${student.user_id}`;
                                    const removeLockReason = getStudentTeamLockReason(student);
                                    const removeWarning = getStudentRemoveWarning(student);
                                    const canAssignStudent = !teamId && !!student.course_fk;
                                    const rowStatus = teamId
                                        ? student.capstone?.status || student.team?.status || "assigned"
                                        : "unassigned";
                                    return (
                                        <Disclosure
                                            key={`student-${student.user_id}`}
                                            className="group rounded-none border-x-0 border-b-0 border-t border-slate-100 first:border-t-0"
                                            summaryAriaLabel={`Student details for ${student.email}. Enrollment course: ${getCourseLabel(student.course_fk)}. ${teamId ? `Team ${teamId}` : "No team"}. Status: ${teamId ? formatStatusLabel(rowStatus) : "Unassigned"}.`}
                                            summaryClassName="min-h-16 [&::after]:hidden"
                                            contentClassName="bg-slate-50/60"
                                            summary={
                                                <span className={`grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 md:items-center ${ROSTER_GRID_TEMPLATE}`}>
                                                    <span className="col-start-1 row-start-1 min-w-0 md:col-auto md:row-auto">
                                                        <span className="block break-all font-medium text-slate-950">{student.email}</span>
                                                        <span className="mt-0.5 block text-xs text-slate-500 md:hidden">{getDepartmentLabel(student)}</span>
                                                    </span>
                                                    <span className="col-span-2 row-start-2 min-w-0 break-words text-xs font-normal text-slate-600 md:col-auto md:row-auto md:text-sm">{getCourseLabel(student.course_fk)}</span>
                                                    <span className="col-span-2 row-start-3 min-w-0 md:col-auto md:row-auto">
                                                        <span className="block text-sm font-medium text-slate-800">{teamId ? `Team ${teamId}` : "No team"}</span>
                                                        {student.capstone?.title && (
                                                            <span className="mt-0.5 block break-words text-xs font-normal text-slate-500">{student.capstone.title}</span>
                                                        )}
                                                    </span>
                                                    <span className="col-span-2 row-start-4 min-w-0 md:col-auto md:row-auto">
                                                        <StatusBadge
                                                            tone={teamId ? getStatusTone(rowStatus) : "warning"}
                                                            className="h-auto min-h-6 max-w-full whitespace-normal py-1 text-center leading-4"
                                                        >
                                                            {teamId ? formatStatusLabel(rowStatus) : "Unassigned"}
                                                        </StatusBadge>
                                                    </span>
                                                    <span className="col-start-2 row-start-1 inline-flex items-center justify-self-end gap-1 text-xs font-semibold text-slate-500 md:col-auto md:row-auto">
                                                        Details
                                                        <ChevronDown
                                                            className="size-4 shrink-0 transition-transform duration-150 group-open:rotate-180"
                                                            aria-hidden="true"
                                                        />
                                                    </span>
                                                </span>
                                            }
                                        >
                                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                                <dl className="grid min-w-0 gap-x-8 gap-y-3 text-xs text-slate-600 sm:grid-cols-2">
                                                    <div>
                                                        <dt className="font-medium text-slate-500">Home department</dt>
                                                        <dd className="mt-0.5 break-words text-slate-800">{getDepartmentLabel(student)}</dd>
                                                    </div>
                                                    <div>
                                                        <dt className="font-medium text-slate-500">Official project</dt>
                                                        <dd className="mt-0.5 break-words text-slate-800">{student.capstone?.title || "No project attached"}</dd>
                                                    </div>
                                                </dl>
                                                <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                                                    {removeLockReason && (
                                                        <Notice tone="danger" title="Membership is locked" className="max-w-md">
                                                            {removeLockReason}
                                                        </Notice>
                                                    )}
                                                    {!removeLockReason && removeWarning && (
                                                        <Notice tone="warning" className="max-w-md">
                                                            {removeWarning}
                                                        </Notice>
                                                    )}
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            setProfileStudent({
                                                                userId: student.user_id,
                                                                email: student.email,
                                                                courseLabel: getCourseLabel(
                                                                    student.course_fk
                                                                ),
                                                                departmentLabel:
                                                                    getDepartmentLabel(student),
                                                                isLeader:
                                                                    student.team?.leader_fk ===
                                                                    student.user_id,
                                                            })
                                                        }
                                                        aria-label={`View profile for ${student.email}`}
                                                    >
                                                        View profile
                                                    </Button>
                                                    {!teamId ? (
                                                        <Button
                                                            size="sm"
                                                            disabled={!canAssignStudent || actionLoading === assignKey}
                                                            title={!student.course_fk ? "Student must have an enrollment course before joining a team." : undefined}
                                                            onClick={() => {
                                                                setAssignTarget(student);
                                                                setAssignTeamId("");
                                                                setAssignReason("");
                                                            }}
                                                        >
                                                            {actionLoading === assignKey ? "Assigning…" : "Assign to team"}
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            disabled={!!removeLockReason || actionLoading === removeKey}
                                                            onClick={() => {
                                                                setRemoveTarget(student);
                                                                setRemoveReason("");
                                                            }}
                                                        >
                                                            {actionLoading === removeKey ? "Removing…" : "Remove from team"}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </Disclosure>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </>
            )}

            <Dialog
                open={createTeamOpen}
                onOpenChange={(open) => {
                    setCreateTeamOpen(open);
                    if (!open) {
                        setCreateStudentIds([]);
                        setCreateLeaderId("");
                        setCreateReason("");
                    }
                }}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Create Team</DialogTitle>
                        <DialogDescription>
                            Select at least one available student and choose a leader.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                                <Label>Students</Label>
                                <span className="text-xs text-slate-500">
                                    {createStudentIds.length} selected
                                </span>
                            </div>
                            <div className="max-h-72 overflow-y-auto rounded-md border border-slate-200 divide-y divide-slate-100">
                                {availableStudents.length === 0 ? (
                                    <p className="p-3 text-sm text-slate-600">
                                        No available students.
                                    </p>
                                ) : (
                                    availableStudents.map((student) => {
                                        const disabled = !student.course_fk;
                                        const checked = createStudentIds.includes(
                                            student.user_id
                                        );
                                        return (
                                            <label
                                                key={`create-student-${student.user_id}`}
                                                className={`flex items-start gap-3 p-3 text-sm ${
                                                    disabled
                                                        ? "cursor-not-allowed bg-slate-50 text-slate-400"
                                                        : "cursor-pointer hover:bg-slate-50"
                                                }`}
                                            >
                                                <Checkbox
                                                    checked={checked}
                                                    disabled={disabled}
                                                    onCheckedChange={(value) =>
                                                        toggleCreateStudent(
                                                            student,
                                                            value === true
                                                        )
                                                    }
                                                    className="mt-0.5"
                                                />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block font-medium text-slate-900">
                                                        {student.email}
                                                    </span>
                                                    <span className="block text-xs text-slate-600">
                                                        {getCourseLabel(student.course_fk)}
                                                    </span>
                                                    {disabled && (
                                                        <span className="block text-xs text-red-600">
                                                            Student must be assigned to a course before joining a team.
                                                        </span>
                                                    )}
                                                </span>
                                            </label>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="managed-team-leader">Leader</Label>
                            <select
                                id="managed-team-leader"
                                value={createLeaderId}
                                onChange={(event) =>
                                    setCreateLeaderId(event.target.value)
                                }
                                className="w-full max-w-full truncate rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                            >
                                <option value="">Choose a leader</option>
                                {createLeaderCandidates.map((student) => (
                                    <option
                                        key={`managed-leader-${student.user_id}`}
                                        value={String(student.user_id)}
                                    >
                                        {student.email} - {getCourseLabel(student.course_fk)}
                                    </option>
                                ))}
                            </select>
                            {selectedCreateLeader && (
                                <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">
                                    <span className="block break-all font-medium">
                                        {selectedCreateLeader.email}
                                    </span>
                                    <span className="block break-words">
                                        {getCourseLabel(selectedCreateLeader.course_fk)}
                                    </span>
                                </p>
                            )}
                            {createStudentIds.length > 0 &&
                                createLeaderCandidates.length === 0 && (
                                    <p className="text-xs text-red-600">
                                        {currentRole === "admin"
                                            ? "Select a student with a course to lead the team."
                                            : "Select at least one student from your course to lead the team."}
                                    </p>
                                )}
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="managed-team-reason">Audit reason</Label>
                            <Input
                                id="managed-team-reason"
                                value={createReason}
                                onChange={(event) =>
                                    setCreateReason(event.target.value)
                                }
                                placeholder="Why is staff creating this team?"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setCreateTeamOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateManagedTeam}
                            disabled={
                                createStudentIds.length === 0 ||
                                !createLeaderId ||
                                !createReason.trim() ||
                                actionLoading === "create-managed-team"
                            }
                        >
                            {actionLoading === "create-managed-team"
                                ? "Creating..."
                                : "Create Team"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={!!assignTarget}
                onOpenChange={(open) => {
                    if (!open) {
                        setAssignTarget(null);
                        setAssignTeamId("");
                        setAssignReason("");
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Assign Student to Team</DialogTitle>
                        <DialogDescription>
                            Assign {assignTarget?.email || "student"} to a target team.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <Label htmlFor="assign-team-id">Target team</Label>
                            <select
                                id="assign-team-id"
                                value={assignTeamId}
                                onChange={(event) => setAssignTeamId(event.target.value)}
                                className="w-full max-w-full truncate rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                            >
                                <option value="">Choose a team</option>
                                {targetTeams.map((team) => {
                                    const teamId = getTeamId(team);
                                    if (!teamId) return null;
                                    const lockReason = getTeamLockReason(team);
                                    return (
                                        <option
                                            key={`assign-team-${teamId}`}
                                            value={String(teamId)}
                                            disabled={!!lockReason}
                                        >
                                            {getTeamLabel(team)}
                                        </option>
                                    );
                                })}
                            </select>
                            {selectedAssignTeam && (
                                <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">
                                    <span className="block break-words font-medium">
                                        {getTeamLabel(selectedAssignTeam)}
                                    </span>
                                </p>
                            )}
                            {selectedAssignTeamLockReason && (
                                <p className="text-xs text-red-600">
                                    Locked: {selectedAssignTeamLockReason}
                                </p>
                            )}
                            {!selectedAssignTeamLockReason &&
                                selectedAssignTeamWarning && (
                                    <p className="text-xs text-amber-700">
                                        {selectedAssignTeamWarning}
                                    </p>
                                )}
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="assign-reason">Audit reason</Label>
                            <Input
                                id="assign-reason"
                                value={assignReason}
                                onChange={(event) =>
                                    setAssignReason(event.target.value)
                                }
                                placeholder="Why is this student being assigned?"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setAssignTarget(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAssignConfirm}
                            disabled={
                                !assignTeamId.trim() ||
                                !assignReason.trim() ||
                                !!selectedAssignTeamLockReason ||
                                actionLoading === `assign-${assignTarget?.user_id ?? ""}`
                            }
                        >
                            {actionLoading === `assign-${assignTarget?.user_id ?? ""}`
                                ? "Assigning..."
                                : "Assign"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={!!removeTarget}
                onOpenChange={(open) => {
                    if (!open) {
                        setRemoveTarget(null);
                        setRemoveReason("");
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Remove Student from Team</DialogTitle>
                        <DialogDescription>
                            Remove {removeTarget?.email || "student"} from Team{" "}
                            {removeTarget?.active_team_fk ?? ""}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        {removeTargetWarning && (
                            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                {removeTargetWarning}
                            </p>
                        )}
                        <div className="space-y-1">
                            <Label htmlFor="remove-reason">Audit reason</Label>
                            <Input
                                id="remove-reason"
                                value={removeReason}
                                onChange={(event) => setRemoveReason(event.target.value)}
                                placeholder="Why is this student being removed?"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setRemoveTarget(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleRemoveConfirm}
                            disabled={
                                !!removeTargetLockReason ||
                                !removeReason.trim() ||
                                actionLoading === `remove-${removeTarget?.user_id ?? ""}`
                            }
                        >
                            {actionLoading === `remove-${removeTarget?.user_id ?? ""}`
                                ? "Removing..."
                                : "Remove"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <StudentProfileDialog
                student={profileStudent}
                open={profileStudent !== null}
                onOpenChange={(open) => {
                    if (!open) setProfileStudent(null);
                }}
            />
        </section>
    );
}
