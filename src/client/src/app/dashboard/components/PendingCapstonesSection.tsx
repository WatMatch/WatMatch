"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { CapstoneCard } from "@/components/capstones/CapstoneCard";
import { Archive, ArrowRight, Check, MessageSquarePlus, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { TaxonomyChipList } from "@/components/ui/taxonomy-chip";
import { Textarea } from "@/components/ui/textarea";
import {
    Disclosure,
    EmptyState,
    Notice,
    PaginationBar,
    SectionHeader,
    StatusBadge,
} from "@/components/ui/workspace";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { userContext } from "@/contexts/UserContext";
import {
    fetchPendingCapstones,
    approveCapstone,
    deleteCapstone,
    rejectCapstone,
    requestCapstoneChanges,
    fetchCapstoneApprovalHistory,
} from "@/services/capstones.service";
import { fetchCourses, type Course } from "@/services/courses.service";
import {
    fetchCapstoneTeamContext,
    type CapstoneTeamContext,
} from "@/services/teams.service";

interface Project {
    capstone_id: string;
    title?: string;
    description?: string;
    project_start_date?: string;
    disciplines?: string[];
    skills?: string[];
    problem_area?: string;
    main_objectives?: string;
    scope_of_work?: string;
    deliverable_types?: string[];
    deliverables?: string;
    success_criteria?: string;
    validation_plan?: string;
    stakeholders?: string;
    risks_constraints?: string;
    public_evaluation_acknowledged?: boolean;
    ip_acknowledged?: boolean;
    confidentiality_acknowledged?: boolean;
    meeting_frequency?: string;
    uw_resources?: string;
    org_resources?: string;
    other_resources?: string;
    how_heard_about_capstone?: string;
    proposed_team_members?: string;
    organization_name?: string;
    primary_contact?: string;
    email?: string;
    phone?: string;
    website?: string;
    organization_description?: string;
    organization_size?: string;
    sector?: string;
    external_partner_name?: string | null;
    external_partner_organization?: string | null;
    external_partner_email?: string | null;
    external_partner_website?: string | null;
    external_partner_notes?: string | null;
    status?: string;
    created_at?: string;
    course_fk?: number | null;
    user_fk?: string | number;
    department?: string;
    year?: number;
}

function formatSubmittedAge(value?: string) {
    if (!value) return "Submission time unavailable";

    const submittedAt = new Date(value);
    if (Number.isNaN(submittedAt.getTime())) return "Submission time unavailable";

    const elapsedMinutes = Math.max(
        0,
        Math.floor((Date.now() - submittedAt.getTime()) / 60_000)
    );
    if (elapsedMinutes < 1) return "Submitted just now";
    if (elapsedMinutes < 60) {
        return `Submitted ${elapsedMinutes}m ago`;
    }

    const elapsedHours = Math.floor(elapsedMinutes / 60);
    if (elapsedHours < 24) {
        return `Submitted ${elapsedHours}h ago`;
    }

    const elapsedDays = Math.floor(elapsedHours / 24);
    if (elapsedDays < 7) {
        return `Submitted ${elapsedDays}d ago`;
    }

    return `Submitted ${submittedAt.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: submittedAt.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
    })}`;
}

export function PendingCapstonesSection() {
    const { user } = userContext();
    const normalizedRole = user?.role?.toLowerCase();
    const canReviewCapstones =
        normalizedRole === "instructor" || normalizedRole === "admin";

    const [pendingProjects, setPendingProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const pageSize = 10;

    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [feedbackText, setFeedbackText] = useState("");
    const [selectedCapstoneId, setSelectedCapstoneId] = useState<string | null>(
        null
    );
    const [submittingFeedback, setSubmittingFeedback] = useState(false);
    const [feedbackError, setFeedbackError] = useState<string | null>(null);
    const [isApproveOpen, setIsApproveOpen] = useState(false);
    const [approveText, setApproveText] = useState("");
    const [selectedApproveCapstoneId, setSelectedApproveCapstoneId] = useState<
        string | null
    >(null);
    const [submittingApprove, setSubmittingApprove] = useState(false);
    const [approveError, setApproveError] = useState<string | null>(null);
    const [isRejectOpen, setIsRejectOpen] = useState(false);
    const [rejectText, setRejectText] = useState("");
    const [selectedRejectCapstoneId, setSelectedRejectCapstoneId] = useState<
        string | null
    >(null);
    const [submittingReject, setSubmittingReject] = useState(false);
    const [rejectError, setRejectError] = useState<string | null>(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
    const [deleteReason, setDeleteReason] = useState("");
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [deletingCapstone, setDeletingCapstone] = useState(false);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [studentResubmissionNote, setStudentResubmissionNote] = useState<string | null>(null);
    const [changedFields, setChangedFields] = useState<string[]>([]);
    const [timeline, setTimeline] = useState<
        Array<{
            action: string;
            comments?: string | null;
            created_at?: string;
            instructor_display?: string | null;
            instructor_name?: string | null;
            instructor_email?: string | null;
        }>
    >([]);
    const [loadingResubmissionNote, setLoadingResubmissionNote] = useState(false);
    const [teamContext, setTeamContext] = useState<CapstoneTeamContext | null>(null);
    const [teamContextLoading, setTeamContextLoading] = useState(false);
    const [teamContextError, setTeamContextError] = useState<string | null>(null);
    const [courseMap, setCourseMap] = useState<Record<number, Course>>({});
    const [departmentFilter, setDepartmentFilter] = useState("All");

    const [submittingActions, setSubmittingActions] = useState<
        Record<string, boolean>
    >({});

    const isActionPending = useMemo(
        () => (capstoneId: string) => submittingActions[capstoneId] ?? false,
        [submittingActions]
    );
    const homeDepartmentName = user?.home_department?.name;
    const departmentOptions = useMemo(() => {
        const departments = new Set<string>();
        if (homeDepartmentName) {
            departments.add(homeDepartmentName);
        }
        pendingProjects.forEach((project) => {
            (project.disciplines || []).forEach((department) => {
                if (department?.trim()) departments.add(department.trim());
            });
        });
        return Array.from(departments).sort((a, b) => a.localeCompare(b));
    }, [homeDepartmentName, pendingProjects]);
    const filteredPendingProjects = useMemo(() => {
        if (departmentFilter === "All") {
            return pendingProjects;
        }
        return pendingProjects.filter((project) =>
            (project.disciplines || []).some(
                (department) =>
                    department.trim().toLowerCase() ===
                    departmentFilter.trim().toLowerCase()
            )
        );
    }, [departmentFilter, pendingProjects]);
    const getErrorMessage = (err: unknown, fallback: string) =>
        err instanceof Error && err.message ? err.message : fallback;

    const formatTimelineAction = (action: string) => {
        const labels: Record<string, string> = {
            initial_submission: "Submitted",
            student_resubmitted: "Resubmitted",
            changes_requested: "Changes Requested",
            request_changes: "Changes Requested",
            rejected: "Rejected",
            approved: "Approved",
            capstone_finalized: "Team Finalized",
            capstone_finalized_staff_override: "Team Finalized by Staff",
            capstone_approved_recruiting: "Opened for Student Interest",
            course_routed: "Course Routed",
            team_roster_changed: "Roster Updated",
            team_roster_changed_recruiting_preserved: "Roster Updated",
            team_roster_changed_course_routing_required: "Routing Required",
            team_roster_changed_review_required: "Review Required",
            review_withdrawn: "Reopened for Edits",
        };

        return (
            labels[action] ??
            action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        );
    };

    const getTimelineCommentOverride = (action: string) => {
        const comments: Record<string, string> = {
            capstone_approved_recruiting:
                "Review completed. This capstone is now visible for student interest.",
            capstone_finalized:
                "The team finalized this capstone and recruiting is now closed.",
            capstone_finalized_staff_override:
                "Course staff finalized this capstone on behalf of the team.",
            course_routed:
                "This capstone was routed to the target course for instructor review.",
            team_roster_changed:
                "The team roster was updated.",
            team_roster_changed_recruiting_preserved:
                "The team roster was updated. The project remains open for student interest.",
            team_roster_changed_course_routing_required:
                "The team roster was updated. Course routing is required before instructor review.",
            team_roster_changed_review_required:
                "The team roster was updated. This project is back under instructor review.",
            review_withdrawn:
                "The team leader reopened this capstone for edits.",
        };

        return comments[action] ?? null;
    };

    const renderTimelineComment = (action: string, comments?: string | null) => {
        const override = getTimelineCommentOverride(action);
        if (override) {
            return (
                <p className="text-slate-500 mt-1 whitespace-pre-wrap">
                    {override}
                </p>
            );
        }

        if (!comments?.trim()) return null;

        if (action === "initial_submission") {
            try {
                const parsed = JSON.parse(comments) as Record<string, unknown>;
                const title =
                    typeof parsed.title === "string" ? parsed.title : null;
                const description =
                    typeof parsed.description === "string"
                        ? parsed.description
                        : null;
                const startDate =
                    typeof parsed.project_start_date === "string"
                        ? parsed.project_start_date
                        : null;
                const disciplines = Array.isArray(parsed.project_disciplines)
                    ? parsed.project_disciplines.filter(
                          (value): value is string => typeof value === "string"
                      )
                    : [];
                const skills = Array.isArray(parsed.skills_required)
                    ? parsed.skills_required.filter(
                          (value): value is string => typeof value === "string"
                      )
                    : [];

                return (
                    <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2 space-y-2">
                        {title && (
                            <p className="text-slate-800">
                                <span className="font-medium">Title:</span>{" "}
                                {title}
                            </p>
                        )}
                        {description && (
                            <p className="text-slate-700 whitespace-pre-wrap">
                                <span className="font-medium">Summary:</span>{" "}
                                {description}
                            </p>
                        )}
                        {(startDate || disciplines.length || skills.length) && (
                            <div className="flex flex-wrap items-start gap-3">
                                {startDate && (
                                    <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                                        Start: {startDate}
                                    </span>
                                )}
                                {disciplines.length > 0 && (
                                    <div className="min-w-0 space-y-1">
                                        <p className="font-medium text-slate-600">Disciplines</p>
                                        <TaxonomyChipList
                                            namespace="discipline"
                                            values={disciplines}
                                        />
                                    </div>
                                )}
                                {skills.length > 0 && (
                                    <div className="min-w-0 space-y-1">
                                        <p className="font-medium text-slate-600">Skills</p>
                                        <TaxonomyChipList
                                            namespace="skill"
                                            values={skills}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            } catch {
                return (
                    <p className="text-slate-500 mt-1 whitespace-pre-wrap">
                        {comments}
                    </p>
                );
            }
        }

        return (
            <p className="text-slate-500 mt-1 whitespace-pre-wrap">
                {comments}
            </p>
        );
    };

    const openRequestChangesModal = (capstoneId: string) => {
        setSelectedCapstoneId(capstoneId);
        setFeedbackText("");
        setFeedbackError(null);
        setIsFeedbackOpen(true);
    };

    const closeRequestChangesModal = () => {
        setIsFeedbackOpen(false);
        setSelectedCapstoneId(null);
        setFeedbackText("");
        setFeedbackError(null);
    };

    const openApproveModal = (capstoneId: string) => {
        setSelectedApproveCapstoneId(capstoneId);
        setApproveText("");
        setApproveError(null);
        setIsApproveOpen(true);
    };

    const closeApproveModal = () => {
        setIsApproveOpen(false);
        setSelectedApproveCapstoneId(null);
        setApproveText("");
        setApproveError(null);
    };

    const openRejectModal = (capstoneId: string) => {
        setSelectedRejectCapstoneId(capstoneId);
        setRejectText("");
        setRejectError(null);
        setIsRejectOpen(true);
    };

    const closeRejectModal = () => {
        setIsRejectOpen(false);
        setSelectedRejectCapstoneId(null);
        setRejectText("");
        setRejectError(null);
    };

    const handleDecision = async (
        capstoneId: string,
        decision: "approve" | "request_changes" | "reject",
        feedback?: string
    ) => {
        try {
            setSubmittingActions((previous) => ({
                ...previous,
                [capstoneId]: true,
            }));

            if (decision === "approve") {
                await approveCapstone(capstoneId, feedback);
            } else if (decision === "reject") {
                await rejectCapstone(capstoneId, feedback);
            } else if (decision === "request_changes" && feedback) {
                await requestCapstoneChanges(capstoneId, feedback);
            }

            setPendingProjects((previous) =>
                previous.filter((project) => project.capstone_id !== capstoneId)
            );
        } catch (decisionError) {
            console.error("Error performing decision request:", decisionError);
            const message =
                decisionError instanceof Error
                    ? decisionError.message
                    : "Could not update capstone status. Please try again.";
            setError(message);
            throw decisionError;
        } finally {
            setSubmittingActions((previous) => {
                const updated = { ...previous };
                delete updated[capstoneId];
                return updated;
            });
        }
    };

    const handleSubmitFeedback = async () => {
        if (!selectedCapstoneId) {
            return;
        }

        const trimmedFeedback = feedbackText.trim();
        if (!trimmedFeedback) {
            return;
        }

        setFeedbackError(null);
        setSubmittingFeedback(true);

        try {
            await handleDecision(
                selectedCapstoneId,
                "request_changes",
                trimmedFeedback
            );
            closeRequestChangesModal();
        } catch (submitError) {
            console.error("Error submitting feedback:", submitError);
            setFeedbackError(
                getErrorMessage(submitError, "Could not submit feedback. Please try again.")
            );
        } finally {
            setSubmittingFeedback(false);
        }
    };

    const handleSubmitApprove = async () => {
        if (!selectedApproveCapstoneId) return;
        setSubmittingApprove(true);
        setApproveError(null);
        try {
            await handleDecision(
                selectedApproveCapstoneId,
                "approve",
                approveText.trim() || undefined
            );
            closeApproveModal();
        } catch (err) {
            console.error("Error submitting approve note:", err);
            setApproveError(
                getErrorMessage(err, "Could not approve capstone. Please try again.")
            );
        } finally {
            setSubmittingApprove(false);
        }
    };

    const handleDeleteSelectedCapstone = async () => {
        if (!deleteTarget?.capstone_id) return;
        const trimmedReason = deleteReason.trim();
        if (!trimmedReason) {
            setDeleteError("An audit reason is required when archiving a capstone.");
            return;
        }
        setDeletingCapstone(true);
        setDeleteError(null);

        try {
            await deleteCapstone(
                deleteTarget.capstone_id,
                trimmedReason
            );
            setPendingProjects((previous) =>
                previous.filter(
                    (project) =>
                        project.capstone_id !== deleteTarget.capstone_id
                )
            );
            setSelectedProject(null);
            setDeleteTarget(null);
            setIsDeleteOpen(false);
            setDeleteReason("");
        } catch (err) {
            console.error("Failed to archive capstone:", err);
            setDeleteError(getErrorMessage(err, "Failed to archive capstone."));
        } finally {
            setDeletingCapstone(false);
        }
    };

    const handleSubmitReject = async () => {
        if (!selectedRejectCapstoneId) {
            return;
        }

        const trimmedRejectReason = rejectText.trim();
        if (!trimmedRejectReason) {
            return;
        }

        setRejectError(null);
        setSubmittingReject(true);
        try {
            await handleDecision(
                selectedRejectCapstoneId,
                "reject",
                trimmedRejectReason
            );
            closeRejectModal();
        } catch (submitError) {
            console.error("Error submitting rejection reason:", submitError);
            setRejectError(
                getErrorMessage(
                    submitError,
                    "Could not submit rejection reason. Please try again."
                )
            );
        } finally {
            setSubmittingReject(false);
        }
    };

    useEffect(() => {
        if (!canReviewCapstones) {
            return;
        }

        async function fetchPending() {
            setLoading(true);
            setError(null);
            try {
                const data = await fetchPendingCapstones(page, pageSize);
                const resolvedTotalPages = Math.max(1, data.total_pages ?? 1);
                setTotalPages(resolvedTotalPages);
                if (page > resolvedTotalPages) {
                    setPage(resolvedTotalPages);
                    return;
                }
                setPendingProjects(data.data ?? []);
            } catch (err) {
                console.error("Error fetching pending capstones:", err);
                setError(getErrorMessage(err, "Could not load pending capstones."));
            } finally {
                setLoading(false);
            }
        }

        fetchPending();
    }, [canReviewCapstones, page, pageSize]);

    useEffect(() => {
        if (!canReviewCapstones) return;
        async function loadCourses() {
            try {
                const courses = await fetchCourses(false);
                const mapped = (courses || []).reduce<Record<number, Course>>(
                    (acc, course) => {
                        acc[course.course_id] = course;
                        return acc;
                    },
                    {}
                );
                setCourseMap(mapped);
            } catch (err) {
                console.error("Failed to load courses for pending cards:", err);
                setCourseMap({});
            }
        }
        loadCourses();
    }, [canReviewCapstones]);

    useEffect(() => {
        if (!homeDepartmentName) return;
        setDepartmentFilter((currentDepartment) =>
            currentDepartment === "All" ? homeDepartmentName : currentDepartment
        );
    }, [homeDepartmentName]);

    useEffect(() => {
        async function loadResubmissionNote() {
            if (!selectedProject?.capstone_id) {
                setStudentResubmissionNote(null);
                setChangedFields([]);
                setTimeline([]);
                return;
            }
            setLoadingResubmissionNote(true);
            try {
                const history = await fetchCapstoneApprovalHistory(
                    selectedProject.capstone_id
                );
                const latestResubmission = history.find(
                    (record) =>
                        record.action === "student_resubmitted" &&
                        record.comments
                );
                const initialSubmission = history.find(
                    (record) => record.action === "initial_submission" && record.comments
                );
                setStudentResubmissionNote(
                    latestResubmission?.comments?.trim() || null
                );
                setTimeline(
                    history.map((record) => ({
                        action: record.action,
                        comments: record.comments,
                        created_at: record.created_at,
                        instructor_display: record.instructor_display,
                        instructor_name: record.instructor_name,
                        instructor_email: record.instructor_email,
                    }))
                );
                const snapshotRaw = initialSubmission?.comments || "";
                let snapshot: Record<string, unknown> = {};
                try {
                    snapshot = snapshotRaw ? (JSON.parse(snapshotRaw) as Record<string, unknown>) : {};
                } catch {
                    snapshot = {};
                }
                const fieldsToCompare: Array<[string, string, unknown]> = [
                    ["Title", "title", selectedProject?.title],
                    ["Description", "description", selectedProject?.description],
                    ["Disciplines", "project_disciplines", selectedProject?.disciplines],
                    ["Skills", "skills_required", selectedProject?.skills],
                    ["Problem Area", "problem_area", selectedProject?.problem_area],
                    ["Main Objectives", "main_objectives", selectedProject?.main_objectives],
                    ["Scope of Work", "scope_of_work", selectedProject?.scope_of_work],
                    ["Deliverable Types", "deliverable_types", selectedProject?.deliverable_types],
                    ["Deliverables", "deliverables", selectedProject?.deliverables],
                    ["Success Criteria", "success_criteria", selectedProject?.success_criteria],
                    ["Validation Plan", "validation_plan", selectedProject?.validation_plan],
                    ["Stakeholders / Users", "stakeholders", selectedProject?.stakeholders],
                    ["Risks / Constraints", "risks_constraints", selectedProject?.risks_constraints],
                    ["Resources", "other_resources", selectedProject?.other_resources],
                    ["Proposed Team Members", "proposed_team_members", selectedProject?.proposed_team_members],
                ];
                const changed = fieldsToCompare
                    .filter(([, snapshotKey, currentValue]) => {
                        const snapshotValue = snapshot[snapshotKey];
                        return JSON.stringify(snapshotValue ?? null) !== JSON.stringify(currentValue ?? null);
                    })
                    .map(([label]) => label);
                setChangedFields(changed);
            } catch (err) {
                console.error("Failed to load resubmission note:", err);
                setStudentResubmissionNote(null);
                setChangedFields([]);
                setTimeline([]);
            } finally {
                setLoadingResubmissionNote(false);
            }
        }

        loadResubmissionNote();
    }, [selectedProject]);

    useEffect(() => {
        let active = true;

        async function loadTeamContext() {
            const capstoneId = selectedProject?.capstone_id;
            if (!capstoneId) {
                setTeamContext(null);
                setTeamContextError(null);
                setTeamContextLoading(false);
                return;
            }

            setTeamContext(null);
            setTeamContextError(null);
            setTeamContextLoading(true);
            try {
                const context = await fetchCapstoneTeamContext(capstoneId);
                if (active) setTeamContext(context);
            } catch (err) {
                if (active) {
                    setTeamContextError(
                        getErrorMessage(err, "Could not load official team context.")
                    );
                }
            } finally {
                if (active) setTeamContextLoading(false);
            }
        }

        loadTeamContext();
        return () => {
            active = false;
        };
    }, [selectedProject?.capstone_id]);

    if (!canReviewCapstones) {
        return null;
    }

    return (
        <section className="space-y-5">
            <SectionHeader
                title="Project reviews"
                description="Open a submission to inspect its proposal, official roster, and review history before deciding."
            />

            <div className="wm-panel flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 text-sm text-slate-600">
                    Showing <span className="font-medium tabular-nums text-slate-900">{filteredPendingProjects.length}</span>{" "}
                    of <span className="font-medium tabular-nums text-slate-900">{pendingProjects.length}</span>{" "}
                    submissions on this page
                </div>
                <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                    <Label htmlFor="review-department-filter" className="sr-only">
                        Filter reviews by department
                    </Label>
                    <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                        <SelectTrigger id="review-department-filter" className="w-full sm:w-[280px]">
                            <SelectValue placeholder="Filter by department" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All departments</SelectItem>
                            {departmentOptions.map((department) => (
                                <SelectItem key={department} value={department}>
                                    {department}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-9 self-start sm:self-auto"
                        onClick={() => setDepartmentFilter("All")}
                        disabled={departmentFilter === "All"}
                    >
                        Clear
                    </Button>
                </div>
            </div>

            {error && (
                <Notice tone="danger" title="Reviews could not be refreshed">
                    {error}
                </Notice>
            )}

            {loading ? (
                <div className="wm-panel px-4 py-5 text-sm text-slate-600" role="status">
                    Loading project reviews…
                </div>
            ) : pendingProjects.length === 0 ? (
                <EmptyState
                    title="No submissions are waiting for review"
                    description="New or resubmitted projects for this course will appear here."
                />
            ) : filteredPendingProjects.length === 0 ? (
                <EmptyState
                    title="No reviews match this department"
                    description="Clear the department filter to return to the full course queue."
                    action={
                        <Button type="button" variant="outline" size="sm" onClick={() => setDepartmentFilter("All")}>
                            Clear filter
                        </Button>
                    }
                />
            ) : (
                <div className="grid gap-3">
                    {filteredPendingProjects.map((project) => (
                        <CapstoneCard
                            key={project.capstone_id}
                            project={project}
                            courseLabel={
                                project.course_fk && courseMap[project.course_fk]
                                    ? `${courseMap[project.course_fk].code} - ${courseMap[project.course_fk].name}`
                                    : "Course not specified"
                            }
                            onClick={() => setSelectedProject(project)}
                            canExpressInterest={false}
                            actions={
                                <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0 text-xs leading-5 text-slate-500">
                                        <p className="break-all font-medium text-slate-700">
                                            Submitted by {project.email || "student team"}
                                        </p>
                                        <p>
                                            {project.proposed_team_members
                                                ? "Team proposal"
                                                : "Individual proposal"}
                                            {" · "}
                                            {formatSubmittedAge(project.created_at)}
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        size="sm"
                                        className="w-full shrink-0 sm:w-auto"
                                        disabled={isActionPending(project.capstone_id)}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setSelectedProject(project);
                                        }}
                                    >
                                        Review submission
                                        <ArrowRight className="size-4" aria-hidden="true" />
                                    </Button>
                                </div>
                            }
                        />
                    ))}
                </div>
            )}

            {pendingProjects.length > 0 && (
                <PaginationBar
                    page={page}
                    totalPages={totalPages}
                    loading={loading}
                    onPrevious={() => setPage((current) => Math.max(1, current - 1))}
                    onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
                    className="rounded-xl border border-slate-200 bg-white"
                />
            )}
            <Dialog
                open={!!selectedProject}
                onOpenChange={(open) => {
                    if (!open) setSelectedProject(null);
                }}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto bg-slate-50 p-2 sm:max-w-5xl sm:p-4">
                    {selectedProject && (
                        <>
                            <DialogTitle className="sr-only">
                                Review {selectedProject.title || "capstone submission"}
                            </DialogTitle>
                            <DialogDescription className="sr-only">
                                Review the proposal, official team, readiness, support, and approval history before recording a decision.
                            </DialogDescription>
                            <CapstoneCard
                                mode="expanded"
                                project={selectedProject}
                                courseLabel={
                                    selectedProject.course_fk && courseMap[selectedProject.course_fk]
                                        ? `${courseMap[selectedProject.course_fk].code} - ${courseMap[selectedProject.course_fk].name}`
                                        : "Course not specified"
                                }
                                teamContext={teamContext}
                                contextLoading={teamContextLoading}
                                contextError={teamContextError}
                                showTeamContext
                                details={
                                    <div className="space-y-3 text-sm">
                                        {loadingResubmissionNote ? (
                                            <p className="text-slate-600" role="status">
                                                Loading revision context…
                                            </p>
                                        ) : studentResubmissionNote ? (
                                            <Notice tone="info" title="Student resubmission note">
                                                <p className="whitespace-pre-wrap">{studentResubmissionNote}</p>
                                            </Notice>
                                        ) : null}

                                        {changedFields.length > 0 && (
                                            <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3">
                                                <p className="text-xs font-semibold text-blue-900">
                                                    Changed since the original submission
                                                </p>
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    {changedFields.map((field) => (
                                                        <StatusBadge key={field} tone="info">
                                                            {field}
                                                        </StatusBadge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <Disclosure
                                            summary="Submission details"
                                            summaryClassName="[&::after]:hidden"
                                            contentClassName="space-y-3"
                                        >
                                            {selectedProject.project_start_date && (
                                                <p>
                                                    <span className="font-medium text-slate-900">Starting term:</span>{" "}
                                                    {selectedProject.project_start_date}
                                                </p>
                                            )}
                                            {selectedProject.how_heard_about_capstone && (
                                                <p>
                                                    <span className="font-medium text-slate-900">Heard about capstone:</span>{" "}
                                                    {selectedProject.how_heard_about_capstone}
                                                </p>
                                            )}
                                            {(selectedProject.deliverable_types || []).length > 0 && (
                                                <div>
                                                    <p className="font-medium text-slate-900">Deliverable types</p>
                                                    <TaxonomyChipList
                                                        namespace="deliverable"
                                                        values={selectedProject.deliverable_types}
                                                        className="mt-1.5"
                                                    />
                                                </div>
                                            )}
                                            {selectedProject.success_criteria && (
                                                <p className="whitespace-pre-wrap">
                                                    <span className="font-medium text-slate-900">Success criteria:</span>{" "}
                                                    {selectedProject.success_criteria}
                                                </p>
                                            )}
                                            {selectedProject.validation_plan && (
                                                <p className="whitespace-pre-wrap">
                                                    <span className="font-medium text-slate-900">Validation plan:</span>{" "}
                                                    {selectedProject.validation_plan}
                                                </p>
                                            )}
                                            {selectedProject.stakeholders && (
                                                <p className="whitespace-pre-wrap">
                                                    <span className="font-medium text-slate-900">Stakeholders and users:</span>{" "}
                                                    {selectedProject.stakeholders}
                                                </p>
                                            )}
                                            {selectedProject.risks_constraints && (
                                                <p className="whitespace-pre-wrap">
                                                    <span className="font-medium text-slate-900">Risks and constraints:</span>{" "}
                                                    {selectedProject.risks_constraints}
                                                </p>
                                            )}
                                            <p>
                                                <span className="font-medium text-slate-900">Policy acknowledgements:</span>{" "}
                                                {[
                                                    selectedProject.public_evaluation_acknowledged ? "Public evaluation" : null,
                                                    selectedProject.ip_acknowledged ? "IP policy" : null,
                                                    selectedProject.confidentiality_acknowledged ? "Confidentiality/NDA" : null,
                                                ].filter(Boolean).join(", ") || "Not confirmed"}
                                            </p>
                                            {selectedProject.proposed_team_members && (
                                                <p className="whitespace-pre-wrap">
                                                    <span className="font-medium text-slate-900">Proposed team members:</span>{" "}
                                                    {selectedProject.proposed_team_members}
                                                </p>
                                            )}
                                        </Disclosure>

                                        {(selectedProject.external_partner_organization ||
                                            selectedProject.external_partner_name ||
                                            selectedProject.external_partner_email) && (
                                            <Disclosure
                                                summary="External partner context"
                                                summaryClassName="[&::after]:hidden"
                                                contentClassName="space-y-2"
                                            >
                                                {selectedProject.external_partner_organization && (
                                                    <p><span className="font-medium text-slate-900">Organization:</span> {selectedProject.external_partner_organization}</p>
                                                )}
                                                {selectedProject.external_partner_name && (
                                                    <p><span className="font-medium text-slate-900">Contact:</span> {selectedProject.external_partner_name}</p>
                                                )}
                                                {selectedProject.external_partner_email && (
                                                    <p className="break-all"><span className="font-medium text-slate-900">Email:</span> {selectedProject.external_partner_email}</p>
                                                )}
                                                {selectedProject.external_partner_website && (
                                                    <p className="break-all"><span className="font-medium text-slate-900">Website:</span> {selectedProject.external_partner_website}</p>
                                                )}
                                                {selectedProject.external_partner_notes && (
                                                    <p className="whitespace-pre-wrap"><span className="font-medium text-slate-900">Notes:</span> {selectedProject.external_partner_notes}</p>
                                                )}
                                            </Disclosure>
                                        )}

                                        {timeline.length > 0 && (
                                            <Disclosure
                                                summary={`Review history (${timeline.length})`}
                                                summaryClassName="[&::after]:hidden"
                                                contentClassName="space-y-0"
                                            >
                                                {timeline.map((item, index) => {
                                                    const isLast = index === timeline.length - 1;
                                                    return (
                                                        <div key={`${item.action}-${index}`} className="grid grid-cols-[20px_minmax(0,1fr)] gap-3">
                                                            <div className="flex flex-col items-center">
                                                                <span className="mt-1 size-2.5 rounded-full bg-slate-500 ring-2 ring-slate-100" />
                                                                {!isLast && <span className="mt-1 h-full min-h-10 w-px bg-slate-200" />}
                                                            </div>
                                                            <div className="pb-4">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <span className="font-medium text-slate-900">{formatTimelineAction(item.action)}</span>
                                                                    {item.created_at && (
                                                                        <span className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</span>
                                                                    )}
                                                                </div>
                                                                <p className="mt-0.5 text-xs text-slate-500">
                                                                    {item.instructor_display || item.instructor_email || "WatMatch"}
                                                                </p>
                                                                <div className="mt-2 text-xs text-slate-700">
                                                                    {renderTimelineComment(item.action, item.comments)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </Disclosure>
                                        )}
                                    </div>
                                }
                                actions={
                                    <div className="space-y-4">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-slate-900">Record a review decision</p>
                                                <p className="mt-0.5 text-xs leading-5 text-slate-600">
                                                    Approval opens the project to student interest. Changes and rejection require written feedback.
                                                </p>
                                            </div>
                                            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        const capstoneId = selectedProject.capstone_id;
                                                        setSelectedProject(null);
                                                        openRequestChangesModal(capstoneId);
                                                    }}
                                                >
                                                    <MessageSquarePlus className="size-4" aria-hidden="true" />
                                                    Request changes
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-red-700 hover:bg-red-50 hover:text-red-800"
                                                    onClick={() => {
                                                        const capstoneId = selectedProject.capstone_id;
                                                        setSelectedProject(null);
                                                        openRejectModal(capstoneId);
                                                    }}
                                                >
                                                    <X className="size-4" aria-hidden="true" />
                                                    Reject
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    onClick={() => {
                                                        const capstoneId = selectedProject.capstone_id;
                                                        setSelectedProject(null);
                                                        openApproveModal(capstoneId);
                                                    }}
                                                >
                                                    <Check className="size-4" aria-hidden="true" />
                                                    Approve
                                                </Button>
                                            </div>
                                        </div>

                                        <Disclosure
                                            summary="Administrative actions"
                                            summaryClassName="[&::after]:hidden"
                                            contentClassName="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                                        >
                                            <div>
                                                <p className="font-medium text-slate-900">Archive this submission</p>
                                                <p className="mt-0.5 text-xs text-slate-600">
                                                    This closes the submission and may disband its linked team. An audit reason is required.
                                                </p>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => {
                                                    setDeleteTarget(selectedProject);
                                                    setSelectedProject(null);
                                                    setIsDeleteOpen(true);
                                                }}
                                            >
                                                <Archive className="size-4" aria-hidden="true" />
                                                Archive submission
                                            </Button>
                                        </Disclosure>
                                    </div>
                                }
                            />
                        </>
                    )}
                </DialogContent>
            </Dialog>
            <Dialog
                open={isDeleteOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        setIsDeleteOpen(false);
                        setDeleteTarget(null);
                        setDeleteReason("");
                        setDeleteError(null);
                    }
                }}
            >
                <DialogContent className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>Archive submission</DialogTitle>
                        <DialogDescription>
                            This closes {deleteTarget?.title || "the submission"} and, when
                            needed, disbands the linked team. This action is audited.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="archive-capstone-reason">Audit reason</Label>
                        <Textarea
                            id="archive-capstone-reason"
                            value={deleteReason}
                            onChange={(event) => {
                                setDeleteReason(event.target.value);
                                setDeleteError(null);
                            }}
                            placeholder="Why is this submission being archived?"
                            rows={3}
                        />
                    </div>
                    {deleteError && (
                        <p className="text-sm text-red-600" role="alert">{deleteError}</p>
                    )}
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsDeleteOpen(false);
                                setDeleteTarget(null);
                                setDeleteReason("");
                                setDeleteError(null);
                            }}
                            disabled={deletingCapstone}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteSelectedCapstone}
                            disabled={deletingCapstone || !deleteReason.trim()}
                        >
                            {deletingCapstone ? "Archiving…" : "Archive submission"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={isApproveOpen}
                onOpenChange={(open) => {
                    if (!open) closeApproveModal();
                }}
            >
                <DialogContent className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>Approve Capstone</DialogTitle>
                        <DialogDescription>
                            Optionally add feedback for the team. If no more review
                            is needed, the project will open to student interest.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="approve-capstone-note">Feedback (optional)</Label>
                        <Textarea
                            id="approve-capstone-note"
                            value={approveText}
                            onChange={(event) => setApproveText(event.target.value)}
                            placeholder="Add a short note for the student team"
                            rows={5}
                        />
                    </div>
                    {approveError && (
                        <p className="text-sm text-red-600" role="alert">{approveError}</p>
                    )}
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={closeApproveModal}
                            disabled={submittingApprove}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmitApprove}
                            disabled={submittingApprove}
                        >
                            {submittingApprove ? "Approving..." : "Approve"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={isRejectOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        closeRejectModal();
                    }
                }}
            >
                <DialogContent className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>Reject Capstone</DialogTitle>
                        <DialogDescription>
                            Add a short reason so the student understands why
                            this submission was rejected.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="reject-capstone-reason">Reason for rejection</Label>
                        <Textarea
                            id="reject-capstone-reason"
                            value={rejectText}
                            onChange={(event) => setRejectText(event.target.value)}
                            placeholder="Explain why this submission cannot proceed"
                            rows={6}
                        />
                    </div>
                    {rejectError && (
                        <p className="text-sm text-red-600" role="alert">{rejectError}</p>
                    )}
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={closeRejectModal}
                            disabled={submittingReject}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleSubmitReject}
                            disabled={
                                rejectText.trim().length === 0 ||
                                submittingReject
                            }
                        >
                            {submittingReject ? "Rejecting..." : "Reject"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={isFeedbackOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        closeRequestChangesModal();
                    }
                }}
            >
                <DialogContent className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>Request Changes</DialogTitle>
                        <DialogDescription>
                            Share specific feedback so the student team knows
                            what to improve.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="request-capstone-changes">Requested updates</Label>
                        <Textarea
                            id="request-capstone-changes"
                            value={feedbackText}
                            onChange={(event) =>
                                setFeedbackText(event.target.value)
                            }
                            placeholder="Detail the updates the student team should make"
                            rows={8}
                            className="min-h-[220px]"
                        />
                    </div>
                    {feedbackError && (
                        <p className="text-sm text-red-600" role="alert">{feedbackError}</p>
                    )}
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={closeRequestChangesModal}
                            disabled={submittingFeedback}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmitFeedback}
                            disabled={
                                feedbackText.trim().length === 0 ||
                                submittingFeedback
                            }
                        >
                            {submittingFeedback
                                ? "Submitting..."
                                : "Submit Feedback"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}
