"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    BookOpen,
    CheckCircle2,
    Clock3,
    FolderOpen,
    History,
    Loader2,
    Mail,
    UserPlus,
    Users,
} from "lucide-react";
import {
    CapstoneCard,
    FinalizationReadiness,
    getCapstoneStatusLabel,
    OfficialTeamRoster,
    OfficialTeamRosterSkeleton,
    ProjectSupportSummary,
} from "@/components/capstones/CapstoneCard";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { userContext } from "@/contexts/UserContext";
import { useTeam, type TeamData } from "@/hooks/useTeam";
import {
    fetchTeamInvites,
    fetchCapstoneTeamContext,
    finalizeTeam,
    inviteTeammate,
    reassignLeader,
    revokeInvite,
    type CapstoneTeamContext,
    type CapstoneTeamContextMember,
    type TeamPendingInvite,
} from "@/services/teams.service";
import {
    StudentProfileDialog,
    type StudentProfileIdentity,
} from "@/components/students/StudentProfileDialog";
import {
    fetchCapstoneApprovalHistory,
    fetchActiveMentors,
    fetchCapstoneMentorRequests,
    fetchMyPastCapstoneShortlists,
    requestMentor,
    decideMentorOffer,
    cancelMentorRequest,
    withdrawCapstoneReview,
    type ApprovalHistoryRecord,
    type CapstoneSupportSummary,
    type MentorRequest,
    type MentorUserSummary,
    type PastCapstone,
} from "@/services/capstones.service";
import {
    ConfirmActionDialog,
    Disclosure,
    EmptyState,
    Notice,
    PageHeader,
    PageShell,
    SectionHeader,
    StatusBadge,
} from "@/components/ui/workspace";

function mentorDirectoryLabel(mentor: MentorUserSummary): string {
    const profile = mentor.profile;
    const name = profile?.display_name || mentor.email;
    const affiliation =
        profile?.primary_department?.name ||
        profile?.departments?.[0]?.name ||
        profile?.affiliation;
    const expertise = (profile?.expertise_tags || []).slice(0, 2).join(", ");
    return [name, affiliation, expertise].filter(Boolean).join(" - ");
}

const NO_MENTOR = "none";
type MarketplacePhase = "exploration" | "commitment" | "finalization";

function normalizeMarketplacePhase(phase?: string | null): MarketplacePhase {
    const normalized = String(phase || "exploration").toLowerCase();
    if (normalized === "commitment") return "commitment";
    if (normalized === "finalization" || normalized === "locked") return "finalization";
    return "exploration";
}

function marketplacePhaseLabel(phase: MarketplacePhase): string {
    return `${phase.charAt(0).toUpperCase()}${phase.slice(1)}`;
}

function fallbackRosterMembers(
    team: TeamData,
    currentUserId: number | null
): CapstoneTeamContextMember[] {
    const leaderId =
        team.leader_fk ?? (team.is_leader && currentUserId ? currentUserId : null);

    return team.team_members
        .map((member): CapstoneTeamContextMember | null => {
            const userId = Number(member.user_id);
            if (!Number.isInteger(userId) || userId <= 0) return null;
            const homeDepartment =
                typeof member.home_department === "string"
                    ? { name: member.home_department }
                    : member.home_department;
            return {
                user_id: userId,
                email: member.email,
                is_leader: leaderId !== null && userId === Number(leaderId),
                course_fk: member.course_fk,
                course: member.course,
                enrollment_course_fk: member.enrollment_course_fk,
                enrollment_course: member.enrollment_course,
                home_department_id: member.home_department_id,
                home_department: homeDepartment,
            };
        })
        .filter((member): member is CapstoneTeamContextMember => member !== null)
        .sort((left, right) => Number(Boolean(right.is_leader)) - Number(Boolean(left.is_leader)));
}

function TeamContextPanelSkeleton({ label }: { label: string }) {
    return (
        <div className="space-y-2" aria-label={`Loading ${label.toLowerCase()}`}>
            <div className="h-3 w-32 animate-pulse rounded bg-slate-200" />
            <div className="grid min-h-16 gap-2 sm:grid-cols-2">
                <div className="h-16 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
                <div className="h-16 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
            </div>
        </div>
    );
}

function projectStatusTone(
    status?: string | null
): "neutral" | "info" | "success" | "warning" | "danger" | "accent" {
    const normalized = String(status || "").toLowerCase();
    if (["approved", "complete", "approved_recruiting", "committed"].includes(normalized)) {
        return "success";
    }
    if (["changes_requested", "rejected", "declined", "expired"].includes(normalized)) {
        return "danger";
    }
    if (
        [
            "pending_review",
            "pending_admin_course_routing",
            "pending_commitment",
            "invited",
        ].includes(normalized)
    ) {
        return "warning";
    }
    if (["interested", "exploring"].includes(normalized)) {
        return "info";
    }
    return "neutral";
}

export function StudentDashboard() {
    const { user } = userContext();
    const router = useRouter();
    const {
        teams,
        pendingInterests,
        explorations,
        commitmentRequests,
        marketplace,
        invites,
        loading,
        actionLoading,
        error: teamActionError,
        clearError,
        acceptStudent,
        rejectStudent,
        removeStudent,
        withdrawInterest,
        leaveTeam,
        abandonSoloProject,
        createEmptyTeam,
        acceptInvite,
        declineInvite,
        createProjectCommitment,
        confirmTeamCommitmentRoster,
        cancelProjectExploration,
        refetch,
    } = useTeam(user?.user_id);

    const [selectedTeam, setSelectedTeam] = useState<TeamData | null>(null);
    const teamDialogOpenerRef = useRef<HTMLElement | null>(null);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState("");
    const [emailError, setEmailError] = useState("");
    const [inviteLoading, setInviteLoading] = useState(false);
    const [profileStudent, setProfileStudent] =
        useState<StudentProfileIdentity | null>(null);
    const [approvalHistory, setApprovalHistory] = useState<ApprovalHistoryRecord[]>([]);
    const [loadingApprovalHistory, setLoadingApprovalHistory] = useState(false);
    const [isReassignOpen, setIsReassignOpen] = useState(false);
    const [reassignChoice, setReassignChoice] = useState("");
    const [reassignReason, setReassignReason] = useState("");
    const [reassignError, setReassignError] = useState("");
    const [finalizeLoading, setFinalizeLoading] = useState(false);
    const [finalizeError, setFinalizeError] = useState("");
    const [withdrawReviewLoading, setWithdrawReviewLoading] = useState(false);
    const [withdrawReviewError, setWithdrawReviewError] = useState("");
    const [teamInviteList, setTeamInviteList] = useState<TeamPendingInvite[]>([]);
    const [teamInviteListLoading, setTeamInviteListLoading] = useState(false);
    const [teamInviteListError, setTeamInviteListError] = useState("");
    const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);
    const [mentorRequests, setMentorRequests] = useState<MentorRequest[]>([]);
    const [mentorSupportSummary, setMentorSupportSummary] =
        useState<CapstoneSupportSummary | null>(null);
    const [mentorOptions, setMentorOptions] = useState<MentorUserSummary[]>([]);
    const [selectedMentorId, setSelectedMentorId] = useState(NO_MENTOR);
    const [mentorMessage, setMentorMessage] = useState("");
    const [mentorDataLoading, setMentorDataLoading] = useState(false);
    const [mentorDataError, setMentorDataError] = useState("");
    const [mentorActionLoading, setMentorActionLoading] = useState<string | null>(null);
    const [teamContext, setTeamContext] = useState<CapstoneTeamContext | null>(null);
    const [teamContextLoading, setTeamContextLoading] = useState(false);
    const [teamContextError, setTeamContextError] = useState("");
    const [savedPastCapstones, setSavedPastCapstones] = useState<PastCapstone[]>([]);
    const [savedPastLoading, setSavedPastLoading] = useState(false);
    const [savedPastError, setSavedPastError] = useState("");
    const [showFinalizeModal, setShowFinalizeModal] = useState(false);
    const [showWithdrawReviewModal, setShowWithdrawReviewModal] = useState(false);
    const [showAbandonProjectModal, setShowAbandonProjectModal] = useState(false);
    const [abandonProjectError, setAbandonProjectError] = useState("");
    const [acceptInterestError, setAcceptInterestError] = useState("");
    const [acceptTarget, setAcceptTarget] = useState<{
        studentId: string;
        teamId: number;
        email?: string;
        courseLabel?: string;
        courseMode?: "same" | "new" | "missing" | "unknown";
    } | null>(null);
    const [rejectTarget, setRejectTarget] = useState<{
        studentId: string;
        teamId: number;
        email?: string;
    } | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [rejectError, setRejectError] = useState("");
    const [inviteAcceptError, setInviteAcceptError] = useState("");
    const [inviteAcceptTarget, setInviteAcceptTarget] = useState<{
        inviteId: string;
        capstoneTitle?: string | null;
    } | null>(null);

    const getErrorMessage = (error: unknown, fallback: string) =>
        error instanceof Error ? error.message : fallback;

    const hasTeams = teams.length > 0;
    const hasInvites = invites.length > 0;
    const hasPendingInterests = pendingInterests.length > 0;
    const rawMarketplacePhase =
        (marketplace as { phase?: string; current_term?: string } | null)?.phase ||
        "exploration";
    const marketplacePhase = normalizeMarketplacePhase(rawMarketplacePhase);
    const pendingCommitments = commitmentRequests.filter(
        (request) => (request.status || "").toLowerCase() === "pending"
    );
    const pendingCommitmentExplorationIds = new Set(
        pendingCommitments
            .map((request) => request.exploration_fk)
            .filter((explorationId): explorationId is number => explorationId !== null && explorationId !== undefined)
    );
    const liveInviteCapstoneIds = new Set(
        invites
            .map((invite) => invite.capstone?.capstone_id ?? invite.team?.capstone_fk)
            .filter((capstoneId): capstoneId is number => capstoneId !== null && capstoneId !== undefined)
            .map((capstoneId) => String(capstoneId))
    );
    const marketplaceCards =
        explorations.length > 0
            ? explorations.filter((exploration) => {
                  const status = (exploration.status || "").toLowerCase();
                  const capstoneId = exploration.capstone?.capstone_id ?? exploration.capstone_fk;
                  if (status === "invited" && liveInviteCapstoneIds.has(String(capstoneId))) {
                      return false;
                  }
                  if (
                      status === "pending_commitment" &&
                      pendingCommitmentExplorationIds.has(exploration.exploration_id)
                  ) {
                      return false;
                  }
                  return [
                      "shortlisted",
                      "interested",
                      "invited",
                      "exploring",
                      "pending_commitment",
                      "committed",
                  ].includes(status);
              })
            : pendingInterests.map((interest) => ({
                  exploration_id: interest.exploration_id,
                  status: interest.status || "interested",
                  capstone_fk: interest.capstone_id,
                  team_fk: interest.team_id,
                  student_fk: Number(user?.user_id),
                  message: interest.message,
                  student_commitment_confirmed_at: interest.student_commitment_confirmed_at,
                  team_commitment_confirmed_at: interest.team_commitment_confirmed_at,
                  student_commitment_confirmed: interest.student_commitment_confirmed,
                  team_commitment_confirmed: interest.team_commitment_confirmed,
                  created_at: interest.created_at,
                  updated_at: interest.updated_at,
                  capstone: {
                      capstone_id: interest.capstone_id,
                      title: interest.project_name,
                      description: interest.project_description,
                  },
              }));
    const resolvedMarketplaceCards = explorations.filter((exploration) =>
        ["withdrawn", "declined", "not_selected", "expired"].includes(
            (exploration.status || "").toLowerCase()
        )
    );
    const hasMarketplaceCards = marketplaceCards.length > 0;
    const currentUserId = Number(user?.user_id);
    const userHasCourse =
        user?.course_fk !== null && user?.course_fk !== undefined;
    const userCourseInactive =
        userHasCourse && (user?.course_active === false || user?.course?.active === false);
    const canUseCourseFlows = userHasCourse && !userCourseInactive;
    const courseSetupMessage = !userHasCourse
        ? "You can browse projects and explore fit, but staff must assign a staffed capstone course before you submit your own proposal or become an official team member."
        : userCourseInactive
          ? "Your assigned capstone course is not currently active for routing. You can keep browsing and exploring, but submit a course request before creating course-owned team work."
          : null;
    const isCurrentUserId = (value?: string | number | null) =>
        Number.isInteger(currentUserId) && Number(value) === currentUserId;

    const getStatusLabel = (status?: string | null) => {
        return getCapstoneStatusLabel(status) || "In review";
    };

    const getStatusBadgeClass = (status?: string | null) => {
        const normalized = (status || "").toLowerCase();
        if (normalized === "approved" || normalized === "complete") {
            return "bg-green-100 text-green-700 border-green-200";
        }
        if (normalized === "draft") {
            return "bg-violet-100 text-violet-700 border-violet-200";
        }
        if (normalized === "approved_recruiting") {
            return "bg-emerald-100 text-emerald-700 border-emerald-200";
        }
        if (normalized === "rejected") {
            return "bg-rose-100 text-rose-700 border-rose-200";
        }
        if (normalized === "changes_requested") {
            return "bg-amber-100 text-amber-700 border-amber-200";
        }
        if (normalized === "pending_admin_course_routing") {
            return "bg-amber-100 text-amber-700 border-amber-200";
        }
        if (normalized === "pending_review") {
            return "bg-slate-100 text-slate-700 border-slate-200";
        }
        return "bg-slate-100 text-slate-700 border-slate-200";
    };

    const getExplorationStatusLabel = (status?: string | null) => {
        const normalized = (status || "").toLowerCase();
        const labels: Record<string, string> = {
            shortlisted: "Saved",
            interested: "Request sent",
            invited: "Invited",
            exploring: "Exploring",
            pending_commitment: "Awaiting staff routing",
            withdrawn: "Withdrawn",
            declined: "Declined",
            not_selected: "Not selected",
            expired: "Expired",
            committed: "Committed",
        };
        return labels[normalized] || "Exploring";
    };

    const getExplorationStatusClass = (status?: string | null) => {
        const normalized = (status || "").toLowerCase();
        if (normalized === "pending_commitment") {
            return "border-amber-200 bg-amber-50 text-amber-700";
        }
        if (normalized === "committed") {
            return "border-green-200 bg-green-50 text-green-700";
        }
        if (normalized === "exploring") {
            return "border-emerald-200 bg-emerald-50 text-emerald-700";
        }
        if (normalized === "invited") {
            return "border-blue-200 bg-blue-50 text-blue-700";
        }
        if (normalized === "shortlisted") {
            return "border-slate-200 bg-slate-50 text-slate-700";
        }
        if (["withdrawn", "declined", "not_selected", "expired"].includes(normalized)) {
            return "border-slate-200 bg-slate-50 text-slate-500";
        }
        return "border-violet-200 bg-violet-50 text-violet-700";
    };

    const hasStudentCommitmentConfirmation = (exploration?: {
        student_commitment_confirmed?: boolean;
        student_commitment_confirmed_at?: string | null;
    }) =>
        Boolean(
            exploration?.student_commitment_confirmed ||
                exploration?.student_commitment_confirmed_at
        );

    const hasTeamCommitmentConfirmation = (exploration?: {
        team_commitment_confirmed?: boolean;
        team_commitment_confirmed_at?: string | null;
    }) =>
        Boolean(
            exploration?.team_commitment_confirmed ||
                exploration?.team_commitment_confirmed_at
        );

    const getStudentCourseLabel = (student?: {
        course_fk?: number | null;
        course?: {
            code?: string;
            name?: string;
        } | null;
        enrollment_course_fk?: number | null;
        enrollment_course?: {
            code?: string;
            name?: string;
        } | null;
    }) => {
        if (!student) return "Course unknown";
        const course = student.enrollment_course || student.course;
        if (course?.code && course?.name) {
            return `${course.code} - ${course.name}`;
        }
        if (course?.code) {
            return course.code;
        }
        if (
            student.enrollment_course_fk !== undefined &&
            student.enrollment_course_fk !== null
        ) {
            return `Course #${student.enrollment_course_fk}`;
        }
        if (student.course_fk !== undefined && student.course_fk !== null) {
            return `Course #${student.course_fk}`;
        }
        return "No course assigned";
    };

    const getStudentDepartmentLabel = (student?: {
        home_department?: string | { name?: string | null } | null;
        home_department_id?: number | null;
    }) => {
        const department = student?.home_department;
        if (typeof department === "string" && department.trim()) {
            return department;
        }
        if (department && typeof department === "object" && department.name) {
            return department.name;
        }
        if (student?.home_department_id) {
            return `Department #${student.home_department_id}`;
        }
        return "Home department unknown";
    };

    const formatShortDateTime = (value?: string | null) => {
        if (!value) return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        return date.toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    };

    const getSavedPastSourceLabel = (capstone: PastCapstone) =>
        capstone.source_type === "watmatch" ? "WatMatch completed" : "Historical";

    const getStudentCourseMode = (
        team: TeamData,
        student: { course_fk?: number | null }
    ): "same" | "new" | "missing" | "unknown" => {
        if (student.course_fk === undefined || student.course_fk === null) {
            return "missing";
        }
        const teamCourseIds = new Set(
            (team.team_members || [])
                .map((member) => member.course_fk)
                .filter((courseFk): courseFk is number => courseFk !== undefined && courseFk !== null)
        );
        if (teamCourseIds.size === 0) {
            return "unknown";
        }
        return teamCourseIds.has(student.course_fk) ? "same" : "new";
    };

    const canRequestMentorForTeam = (team: TeamData | null) => {
        if (!team?.is_leader || !team.project?.capstone_id) return false;
        const projectStatus = team.project.status?.toLowerCase();
        const teamStatus = team.status?.toLowerCase();
        return (
            teamStatus !== "finalized" &&
            teamStatus !== "archived" &&
            ["draft", "pending_admin_course_routing", "pending_review", "approved_recruiting"].includes(
                projectStatus || ""
            )
        );
    };

    const selectedProjectStatus = selectedTeam?.project?.status?.toLowerCase();
    const selectedTeamStatus = (selectedTeam as { status?: string } | null)?.status?.toLowerCase();
    const selectedTeamIsRecruiting = selectedProjectStatus === "approved_recruiting";
    const selectedProjectPhase = normalizeMarketplacePhase(
        selectedTeam?.project?.marketplace_phase ||
            selectedTeam?.project?.marketplace_phase_context?.effective_phase ||
            marketplacePhase
    );
    const selectedProjectAllowsNewExploration =
        selectedTeam?.project?.can_invite ??
        (selectedTeamIsRecruiting && selectedProjectPhase === "exploration");
    const selectedProjectAllowsCommitment =
        selectedTeam?.project?.can_commit ??
        (selectedTeamIsRecruiting &&
            (selectedProjectPhase === "exploration" ||
                selectedProjectPhase === "commitment"));
    const selectedProjectIsFinalization = selectedProjectPhase === "finalization";

    const loadTeamContextForTeam = async (team: TeamData | null) => {
        const capstoneId = team?.project?.capstone_id;
        if (!capstoneId) {
            setTeamContext(null);
            setTeamContextError("");
            setTeamContextLoading(false);
            return;
        }

        setTeamContextLoading(true);
        setTeamContextError("");
        try {
            const context = await fetchCapstoneTeamContext(capstoneId);
            setTeamContext(context);
        } catch (error) {
            console.error("Failed to load official team context:", error);
            setTeamContext(null);
            setTeamContextError(
                getErrorMessage(error, "Failed to load official team context.")
            );
        } finally {
            setTeamContextLoading(false);
        }
    };

    const loadMentorDataForTeam = async (team: TeamData | null) => {
        const capstoneId = team?.project?.capstone_id;
        if (!team?.is_leader || !capstoneId) {
            setMentorRequests([]);
            setMentorSupportSummary(null);
            setMentorOptions([]);
            setSelectedMentorId(NO_MENTOR);
            setMentorMessage("");
            setMentorDataError("");
            setMentorDataLoading(false);
            return;
        }

        setMentorDataLoading(true);
        setMentorDataError("");
        try {
            const [requestData, activeMentors] = await Promise.all([
                fetchCapstoneMentorRequests(capstoneId),
                canRequestMentorForTeam(team)
                    ? fetchActiveMentors()
                    : Promise.resolve([] as MentorUserSummary[]),
            ]);
            setMentorRequests(requestData.requests);
            setMentorSupportSummary(requestData.support_summary);
            setMentorOptions(activeMentors);
        } catch (error) {
            console.error("Failed to load mentor support data:", error);
            setMentorRequests([]);
            setMentorSupportSummary(null);
            setMentorOptions([]);
            setMentorDataError(getErrorMessage(error, "Failed to load mentor support."));
        } finally {
            setMentorDataLoading(false);
        }
    };

    const handleAcceptStudent = async (student_id: string, team_id: number) => {
        setAcceptInterestError("");
        const result = await acceptStudent(student_id, team_id);
        if (result?.success) {
            setAcceptTarget(null);
            return;
        }
        setAcceptInterestError(
            getErrorMessage(result?.error, "Could not accept student.")
        );
    };

    const handleRejectStudent = async () => {
        if (!rejectTarget) return;
        const trimmedReason = rejectReason.trim();
        if (!trimmedReason) {
            setRejectError("Add a short reason before declining this student's interest.");
            return;
        }
        setRejectError("");
        const result = await rejectStudent(
            rejectTarget.studentId,
            rejectTarget.teamId,
            trimmedReason
        );
        if (result?.success) {
            setRejectTarget(null);
            setRejectReason("");
            return;
        }
        setRejectError(
            getErrorMessage(result?.error, "Could not reject student.")
        );
    };

    const handleRemoveStudent = async (student_id: string, team_id: number) => {
        await removeStudent(student_id, team_id);
    };

    const handleLeaveTeam = async (team_id: number) => {
        const result = await leaveTeam(team_id);
        if (result?.success) {
            setSelectedTeam(null);
        }
    };

    const handleAbandonProject = async () => {
        if (!selectedTeam?.team_id) return;
        setAbandonProjectError("");
        const result = await abandonSoloProject(selectedTeam.team_id);
        if (result?.success) {
            setShowAbandonProjectModal(false);
            setSelectedTeam(null);
            return;
        }
        setAbandonProjectError(
            getErrorMessage(result?.error, "Could not abandon project.")
        );
    };

    const handleOpenInviteModal = () => {
        clearError();
        setShowInviteModal(true);
        setInviteEmail("");
        setEmailError("");
    };

    const handleCloseInviteModal = () => {
        setShowInviteModal(false);
        setInviteEmail("");
        setEmailError("");
    };

    const validateEmail = (email: string): boolean => {
        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail) {
            setEmailError("Email is required");
            return false;
        }
        if (!normalizedEmail.endsWith("@uwaterloo.ca")) {
            setEmailError("Email must end with @uwaterloo.ca");
            return false;
        }
        setEmailError("");
        return true;
    };

    const hasExistingInterestFromInvitee = (email: string): boolean => {
        const normalizedEmail = email.trim().toLowerCase();
        return selectedTeam?.interested_students.some(
            (student) => student.email?.trim().toLowerCase() === normalizedEmail
        ) ?? false;
    };

    const handleViewStudentProfile = (
        userId: string | number,
        email: string,
        courseLabel?: string | null,
        departmentLabel?: string | null,
        isLeader?: boolean
    ) => {
        setProfileStudent({
            userId,
            email,
            courseLabel,
            departmentLabel,
            isLeader,
        });
    };

    const handleOpenTeamWorkspace = (team: TeamData) => {
        setTeamContext(null);
        setTeamContextError("");
        setTeamContextLoading(Boolean(team.project?.capstone_id));
        setSelectedTeam(team);
    };

    const handleInviteSubmit = async () => {
        if (!selectedTeam) return;

        if (!selectedProjectAllowsNewExploration) {
            setEmailError("Team invites are paused because this project is outside its marketplace exploration phase.");
            return;
        }

        if (validateEmail(inviteEmail)) {
            if (hasExistingInterestFromInvitee(inviteEmail)) {
                setEmailError(
                    "This student already expressed interest in this capstone. Accept or reject their interest instead."
                );
                return;
            }

            setInviteLoading(true);
            try {
                await inviteTeammate(
                    selectedTeam.team_id,
                    inviteEmail.trim().toLowerCase()
                );
                handleCloseInviteModal();
                try {
                    const nextInvites = await fetchTeamInvites(selectedTeam.team_id);
                    setTeamInviteList(nextInvites);
                } catch (refreshError) {
                    console.error("Failed to refresh team invites:", refreshError);
                }
            } catch (error) {
                console.error("Failed to send invite:", error);
                setEmailError(getErrorMessage(error, "Failed to send invite. Please try again."));
            } finally {
                setInviteLoading(false);
            }
        }
    };

    const handleReassignLeadership = async () => {
        if (!selectedTeam?.is_leader) return;
        const members = selectedTeam.team_members.filter(
            (member) => !isCurrentUserId(member.user_id)
        );
        if (members.length === 0) {
            setReassignError(
                "No eligible members found. You need at least one other teammate to transfer leadership."
            );
            return;
        }
        setReassignChoice("");
        setReassignReason("");
        setReassignError("");
        setIsReassignOpen(true);
    };

    const handleConfirmReassignLeadership = async () => {
        if (!selectedTeam?.is_leader) return;
        const members = selectedTeam.team_members.filter(
            (member) => !isCurrentUserId(member.user_id)
        );
        const idx = Number(reassignChoice);
        if (!Number.isInteger(idx) || idx < 1 || idx > members.length) {
            setReassignError("Please select a valid teammate.");
            return;
        }
        const newLeader = members[idx - 1];
        try {
            await reassignLeader(
                selectedTeam.team_id,
                Number(newLeader.user_id),
                reassignReason || undefined
            );
            setIsReassignOpen(false);
            await refetch();
        } catch (error) {
            console.error("Failed to reassign leader:", error);
            setReassignError(getErrorMessage(error, "Failed to reassign leader."));
        }
    };

    const handleFinalizeTeam = async () => {
        if (!selectedTeam?.is_leader) return;
        setFinalizeLoading(true);
        setFinalizeError("");
        try {
            await finalizeTeam(selectedTeam.team_id);
            setShowFinalizeModal(false);
            await refetch();
        } catch (error) {
            console.error("Failed to finalize team:", error);
            setFinalizeError(getErrorMessage(error, "Failed to finalize team."));
        } finally {
            setFinalizeLoading(false);
        }
    };

    const handleWithdrawReview = async () => {
        const capstoneId = selectedTeam?.project?.capstone_id;
        if (!selectedTeam?.is_leader || !capstoneId) return;
        setWithdrawReviewLoading(true);
        setWithdrawReviewError("");
        try {
            await withdrawCapstoneReview(capstoneId);
            setShowWithdrawReviewModal(false);
            await refetch();
        } catch (error) {
            console.error("Failed to withdraw capstone from review:", error);
            setWithdrawReviewError(
                getErrorMessage(error, "Failed to reopen capstone for edits.")
            );
        } finally {
            setWithdrawReviewLoading(false);
        }
    };

    const getAcceptDialogDescription = () => {
        if (!acceptTarget) return "";
        if (acceptTarget.courseMode === "missing") {
            return "This student does not have a course assigned. During exploration they can explore with your team, but by commitment staff must route them into a staffed course.";
        }
        return "This moves the student into marketplace exploration with your team. They are not an official member until a final commitment is routed.";
    };

    const handleRevokeTeamInvite = async (inviteId: string) => {
        setRevokingInviteId(inviteId);
        setTeamInviteListError("");
        try {
            await revokeInvite(inviteId);
            setTeamInviteList((current) =>
                current.filter((invite) => invite.invite_id !== inviteId)
            );
        } catch (error) {
            console.error("Failed to revoke invite:", error);
            setTeamInviteListError(
                getErrorMessage(error, "Failed to revoke invite.")
            );
        } finally {
            setRevokingInviteId(null);
        }
    };

    const handleCancelExploration = async (
        explorationId: number,
        reason: string
    ) => {
        await cancelProjectExploration(explorationId, reason);
    };

    const handleConfirmCommitmentRoster = async () => {
        if (!selectedTeam) return;
        await confirmTeamCommitmentRoster(
            selectedTeam.team_id,
            "Team leader sent a marketplace commitment roster proposal for routing."
        );
    };

    const handleRequestMentor = async () => {
        const capstoneId = selectedTeam?.project?.capstone_id;
        if (!selectedTeam || !capstoneId) return;
        if (selectedMentorId === NO_MENTOR) {
            setMentorDataError("Select a mentor before sending the request.");
            return;
        }

        setMentorActionLoading("request-mentor");
        setMentorDataError("");
        try {
            await requestMentor(capstoneId, {
                mentor_id: Number(selectedMentorId),
                message: mentorMessage.trim() || null,
            });
            setSelectedMentorId(NO_MENTOR);
            setMentorMessage("");
            await Promise.all([
                loadMentorDataForTeam(selectedTeam),
                loadTeamContextForTeam(selectedTeam),
            ]);
        } catch (error) {
            console.error("Failed to request mentor:", error);
            setMentorDataError(getErrorMessage(error, "Failed to request mentor."));
        } finally {
            setMentorActionLoading(null);
        }
    };

    const handleDecideMentorOffer = async (
        request: MentorRequest,
        decision: "accept" | "decline"
    ) => {
        if (!selectedTeam) return;
        setMentorActionLoading(`${decision}-mentor-offer-${request.mentor_request_id}`);
        setMentorDataError("");
        try {
            await decideMentorOffer(request.mentor_request_id, {
                decision,
                response_note: null,
            });
            await Promise.all([
                loadMentorDataForTeam(selectedTeam),
                loadTeamContextForTeam(selectedTeam),
            ]);
        } catch (error) {
            console.error("Failed to decide mentor offer:", error);
            setMentorDataError(getErrorMessage(error, "Failed to save mentor offer decision."));
        } finally {
            setMentorActionLoading(null);
        }
    };

    const handleCancelMentorRequest = async (request: MentorRequest) => {
        if (!selectedTeam) return;
        setMentorActionLoading(`cancel-mentor-${request.mentor_request_id}`);
        setMentorDataError("");
        try {
            await cancelMentorRequest(request.mentor_request_id, {
                reason: "Team cancelled the mentor request.",
            });
            await Promise.all([
                loadMentorDataForTeam(selectedTeam),
                loadTeamContextForTeam(selectedTeam),
            ]);
        } catch (error) {
            console.error("Failed to cancel mentor request:", error);
            setMentorDataError(getErrorMessage(error, "Failed to cancel mentor request."));
        } finally {
            setMentorActionLoading(null);
        }
    };

    const handleConfirmAcceptInvite = async () => {
        if (!inviteAcceptTarget) return;
        setInviteAcceptError("");
        const result = await acceptInvite(inviteAcceptTarget.inviteId);
        if (result?.success) {
            setInviteAcceptTarget(null);
            return;
        }
        setInviteAcceptError(
            getErrorMessage(result?.error, "Could not accept invite.")
        );
    };

    useEffect(() => {
        async function loadModalData() {
            const capstoneId = selectedTeam?.project?.capstone_id;
            if (!capstoneId) {
                setApprovalHistory([]);
                return;
            }
            setLoadingApprovalHistory(true);
            try {
                const history = await fetchCapstoneApprovalHistory(capstoneId);
                setApprovalHistory(history);
            } catch (error) {
                console.error("Failed to load approval history:", error);
                setApprovalHistory([]);
            } finally {
                setLoadingApprovalHistory(false);
            }
        }

        loadModalData();
    }, [selectedTeam]);

    useEffect(() => {
        loadMentorDataForTeam(selectedTeam);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        selectedTeam?.is_leader,
        selectedTeam?.project?.capstone_id,
        selectedTeam?.project?.status,
        selectedTeam?.status,
        selectedTeam?.team_id,
    ]);

    useEffect(() => {
        loadTeamContextForTeam(selectedTeam);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        selectedTeam?.project?.capstone_id,
        selectedTeam?.project?.status,
        selectedTeam?.status,
        selectedTeam?.team_id,
        selectedTeam?.team_members.length,
    ]);

    useEffect(() => {
        let isMounted = true;

        async function loadTeamInvites() {
            if (!selectedTeam?.is_leader) {
                setTeamInviteList([]);
                setTeamInviteListError("");
                setTeamInviteListLoading(false);
                return;
            }

            setTeamInviteListLoading(true);
            setTeamInviteListError("");
            try {
                const nextInvites = await fetchTeamInvites(selectedTeam.team_id);
                if (isMounted) {
                    setTeamInviteList(nextInvites);
                }
            } catch (error) {
                console.error("Failed to load team invites:", error);
                if (isMounted) {
                    setTeamInviteList([]);
                    setTeamInviteListError(
                        getErrorMessage(error, "Failed to load pending invites.")
                    );
                }
            } finally {
                if (isMounted) {
                    setTeamInviteListLoading(false);
                }
            }
        }

        loadTeamInvites();

        return () => {
            isMounted = false;
        };
    }, [selectedTeam?.is_leader, selectedTeam?.project?.status, selectedTeam?.team_id]);

    useEffect(() => {
        let isMounted = true;

        async function loadSavedPastCapstones() {
            if ((user?.role || "").toLowerCase() !== "student") {
                setSavedPastCapstones([]);
                setSavedPastError("");
                setSavedPastLoading(false);
                return;
            }

            setSavedPastLoading(true);
            setSavedPastError("");
            try {
                const saved = await fetchMyPastCapstoneShortlists(6);
                if (isMounted) {
                    setSavedPastCapstones(saved);
                }
            } catch (error) {
                console.error("Failed to load saved past capstones:", error);
                if (isMounted) {
                    setSavedPastCapstones([]);
                    setSavedPastError(
                        error instanceof Error
                            ? error.message
                            : "Failed to load saved past capstones."
                    );
                }
            } finally {
                if (isMounted) {
                    setSavedPastLoading(false);
                }
            }
        }

        loadSavedPastCapstones();

        return () => {
            isMounted = false;
        };
    }, [user?.role, user?.user_id]);

    useEffect(() => {
        if (!selectedTeam) {
            return;
        }

        const refreshedSelectedTeam = teams.find(
            (team) => team.team_id === selectedTeam.team_id
        );

        if (!refreshedSelectedTeam) {
            setSelectedTeam(null);
            return;
        }

        if (refreshedSelectedTeam !== selectedTeam) {
            setSelectedTeam(refreshedSelectedTeam);
        }
    }, [teams, selectedTeam]);


    if (loading) {
        return (
            <PageShell>
                <Card className="flex min-h-48 items-center justify-center gap-3 p-6 text-sm text-slate-600">
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    Loading your capstone workspace…
                </Card>
            </PageShell>
        );
    }

    const latestChangesRequested = approvalHistory.find(
        (record) => record.action === "changes_requested" && record.comments
    );
    const latestRejected = approvalHistory.find(
        (record) => record.action === "rejected" && record.comments
    );
    const selectedTeamCanWithdrawReview =
        selectedTeam?.is_leader &&
        (selectedProjectStatus === "approved_recruiting" ||
            selectedProjectStatus === "pending_review" ||
            selectedProjectStatus === "pending_admin_course_routing");
    const selectedTeamIsLocked =
        selectedTeamStatus === "finalized" ||
        selectedProjectStatus === "approved" ||
        selectedProjectStatus === "complete" ||
        selectedProjectStatus === "pending_review" ||
        selectedProjectStatus === "pending_admin_course_routing";
    const selectedTeamCanInvite =
        selectedTeam?.is_leader && !selectedTeamIsLocked && selectedProjectAllowsNewExploration;
    const selectedTeamCanAbandonSoloProject =
        selectedTeam?.is_leader &&
        selectedTeam.team_members.length === 1 &&
        !selectedTeamIsLocked &&
        selectedTeamStatus !== "archived" &&
        selectedTeamStatus !== "finalized" &&
        (selectedProjectPhase === "exploration" || selectedProjectPhase === "commitment");
    const selectedTeamMutuallyConfirmedCandidates = (
        selectedTeam?.exploring_students || []
    ).filter((student) => {
        const status = (student.status || "exploring").toLowerCase();
        return (
            status === "exploring" &&
            hasStudentCommitmentConfirmation(student) &&
            hasTeamCommitmentConfirmation(student)
        );
    });
    const selectedTeamRosterAlreadyConfirmed = Boolean(
        selectedTeam?.commitment_roster_confirmed_at
    );
    const selectedTeamCanConfirmRoster =
        selectedTeam?.is_leader &&
        !selectedTeamIsLocked &&
        selectedProjectAllowsCommitment &&
        !selectedTeamRosterAlreadyConfirmed &&
        selectedTeamMutuallyConfirmedCandidates.length > 0;
    const selectedTeamCanRequestMentor = canRequestMentorForTeam(selectedTeam);
    const visibleSupportSummary = teamContext?.support_summary || mentorSupportSummary;
    const acceptedMentor = visibleSupportSummary?.accepted_mentor;
    const pendingMentorRequests = mentorRequests.filter(
        (request) =>
            request.status === "pending" && request.request_source !== "mentor_offer"
    );
    const pendingMentorOffers = mentorRequests.filter(
        (request) =>
            request.status === "pending" && request.request_source === "mentor_offer"
    );
    const showMentorManagement = Boolean(
        selectedTeam?.is_leader &&
            (mentorDataLoading ||
                mentorDataError ||
                pendingMentorRequests.length > 0 ||
                pendingMentorOffers.length > 0 ||
                (selectedTeamCanRequestMentor && !acceptedMentor))
    );
    const blockedMentorIds = new Set(
        mentorRequests
            .filter((request) => request.status === "pending" || request.status === "accepted")
            .map((request) => Number(request.mentor_fk))
    );
    const availableMentors = mentorOptions.filter(
        (mentor) => !blockedMentorIds.has(Number(mentor.user_id))
    );
    const finalizeSupportMissing = Boolean(
        teamContext?.readiness.items.find((item) => item.key === "project_support")
            ?.ready === false
    );
    const primaryTeam = teams[0];
    const primaryProjectStatus = (primaryTeam?.project?.status || "").toLowerCase();
    const primaryCandidateCount = primaryTeam?.is_leader
        ? primaryTeam.interested_students.length
        : 0;
    const nextSteps: Array<{
        id: string;
        title: string;
        detail: string;
        state: "attention" | "waiting" | "complete";
        actionLabel?: string;
        onAction?: () => void;
    }> = [];

    if (hasInvites) {
        nextSteps.push({
            id: "invitations",
            title: `Review ${invites.length} team invitation${invites.length === 1 ? "" : "s"}`,
            detail: "Accepting begins exploration; official membership comes later through mutual commitment and routing.",
            state: "attention",
            actionLabel: "Review invitations",
            onAction: () =>
                document
                    .getElementById("invitations-heading")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" }),
        });
    }

    if (primaryTeam?.is_leader && !primaryTeam.project) {
        nextSteps.push({
            id: "proposal",
            title: "Create your team proposal",
            detail: "Your team workspace is ready. Add the project route, plan, team needs, resources, and agreements.",
            state: "attention",
            actionLabel: "Start proposal",
            onAction: () => router.push("/project-form"),
        });
    } else if (
        primaryTeam?.is_leader &&
        primaryTeam.project &&
        ["draft", "changes_requested", "rejected"].includes(primaryProjectStatus)
    ) {
        nextSteps.push({
            id: "revision",
            title:
                primaryProjectStatus === "draft"
                    ? "Finish your draft proposal"
                    : "Revise your proposal",
            detail:
                primaryProjectStatus === "draft"
                    ? "Complete the draft and submit it for instructor review."
                    : "Address the instructor feedback and summarize what changed before resubmitting.",
            state: "attention",
            actionLabel:
                primaryProjectStatus === "draft" ? "Open draft" : "Open revision form",
            onAction: () =>
                router.push(
                    `/project-form/resubmit/${primaryTeam.project?.capstone_id}`
                ),
        });
    }

    if (primaryTeam && primaryCandidateCount > 0) {
        nextSteps.push({
            id: "candidates",
            title: `Review ${primaryCandidateCount} join request${primaryCandidateCount === 1 ? "" : "s"}`,
            detail: "Open a student profile when you need more context, then start exploration or reject with a reason.",
            state: "attention",
            actionLabel: "Review requests",
            onAction: () => handleOpenTeamWorkspace(primaryTeam),
        });
    }

    if (pendingCommitments.length > 0) {
        nextSteps.push({
            id: "routing",
            title: "Wait for course routing",
            detail: "Both sides confirmed commitment. Staff is resolving the coordinating and per-student enrollment routes.",
            state: "waiting",
        });
    } else if (
        primaryTeam?.project &&
        ["pending_review", "pending_admin_course_routing"].includes(primaryProjectStatus)
    ) {
        nextSteps.push({
            id: "review",
            title:
                primaryProjectStatus === "pending_review"
                    ? "Instructor review in progress"
                    : "Course routing in progress",
            detail: "No action is required unless staff or the instructor returns the proposal.",
            state: "waiting",
        });
    } else if (
        primaryTeam?.project &&
        ["approved", "complete"].includes(primaryProjectStatus)
    ) {
        nextSteps.push({
            id: "finalized",
            title: primaryProjectStatus === "complete" ? "Capstone completed" : "Team finalized",
            detail: "The official roster is read-only for students.",
            state: "complete",
            actionLabel: "View team",
            onAction: () => handleOpenTeamWorkspace(primaryTeam),
        });
    } else if (primaryTeam?.project && primaryProjectStatus === "approved_recruiting") {
        nextSteps.push({
            id: "team-formation",
            title: primaryTeam.is_leader ? "Continue team formation" : "Review your team workspace",
            detail: primaryTeam.is_leader
                ? "Review join requests, invitations, support, and finalization readiness."
                : "Check the official roster, project support, and current readiness blockers.",
            state: "attention",
            actionLabel: "Open team workspace",
            onAction: () => handleOpenTeamWorkspace(primaryTeam),
        });
    } else if (primaryTeam && !primaryTeam.project && !primaryTeam.is_leader) {
        nextSteps.push({
            id: "team-proposal-wait",
            title: "Team proposal not submitted yet",
            detail: "Your team leader owns the proposal. You can review the roster while they prepare it.",
            state: "waiting",
            actionLabel: "View team",
            onAction: () => handleOpenTeamWorkspace(primaryTeam),
        });
    } else if (!hasTeams && hasMarketplaceCards && pendingCommitments.length === 0) {
        nextSteps.push({
            id: "exploration",
            title: "Continue project exploration",
            detail: "Review the relationship state below and take the next available action when you are ready.",
            state: "attention",
            actionLabel: "View exploration",
            onAction: () =>
                document
                    .getElementById("exploration-heading")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" }),
        });
    }

    if (nextSteps.length === 0) {
        nextSteps.push({
            id: "discover",
            title: "Find a capstone project",
            detail: "Browse recruiting projects, save possibilities, or start a team proposal.",
            state: "attention",
            actionLabel: "Discover projects",
            onAction: () => router.push("/discover"),
        });
    }

    return (
        <PageShell>
            <PageHeader
                eyebrow="Student workspace"
                title="My capstone"
                description="Start with the next decision that needs you. Supporting project, profile, and history details stay available when you need them."
                actions={
                    <Button type="button" variant="outline" onClick={() => router.push("/discover")}>
                        <BookOpen aria-hidden="true" />
                        Discover projects
                    </Button>
                }
            />

            <div className="flex flex-col gap-5">
                        {teamActionError && (
                            <Notice tone="danger" title="Action could not be completed">
                                {teamActionError}
                            </Notice>
                        )}
                        {courseSetupMessage && (
                            <Notice tone="warning" title="Course setup needs attention">
                                <p className="[overflow-wrap:anywhere]">{courseSetupMessage}</p>
                            </Notice>
                        )}
                        <section className="order-0 space-y-3" aria-labelledby="next-steps-heading">
                            <SectionHeader
                                title={<span id="next-steps-heading">Next steps</span>}
                                description="Work from top to bottom. Settled and waiting items stay quiet so the next decision is easy to find."
                            />
                            <ol className="space-y-2">
                                {nextSteps.slice(0, 3).map((task, index) => {
                                    const isComplete = task.state === "complete";
                                    const isWaiting = task.state === "waiting";
                                    return (
                                        <li
                                            key={task.id}
                                            className={`flex min-w-0 flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                                                isComplete
                                                    ? "border-slate-200 bg-slate-50/70"
                                                    : isWaiting
                                                      ? "border-amber-200 bg-amber-50/60"
                                                      : "border-slate-200 bg-white shadow-sm"
                                            }`}
                                        >
                                            <div className="flex min-w-0 items-start gap-3">
                                                <span
                                                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                                                        isComplete
                                                            ? "bg-slate-200 text-slate-600"
                                                            : isWaiting
                                                              ? "bg-amber-100 text-amber-800"
                                                              : "bg-slate-900 text-white"
                                                    }`}
                                                    aria-hidden="true"
                                                >
                                                    {isComplete ? (
                                                        <CheckCircle2 className="h-4 w-4" />
                                                    ) : isWaiting ? (
                                                        <Clock3 className="h-3.5 w-3.5" />
                                                    ) : (
                                                        index + 1
                                                    )}
                                                </span>
                                                <div className="min-w-0">
                                                    <p className={`text-sm font-semibold ${isComplete ? "text-slate-700" : "text-slate-950"}`}>
                                                        {task.title}
                                                    </p>
                                                    <p className="mt-0.5 text-xs leading-5 text-slate-600">
                                                        {task.detail}
                                                    </p>
                                                </div>
                                            </div>
                                            {task.onAction && task.actionLabel && (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant={isComplete ? "outline" : "default"}
                                                    onClick={task.onAction}
                                                    className="w-full shrink-0 sm:w-auto"
                                                >
                                                    {task.actionLabel}
                                                </Button>
                                            )}
                                        </li>
                                    );
                                })}
                            </ol>
                        </section>
                        {(savedPastLoading || savedPastError || savedPastCapstones.length > 0) && (
                            <Disclosure
                                className="order-50"
                                summary={
                                    <span className="inline-flex items-center gap-2">
                                        <BookOpen className="h-4 w-4 text-slate-500" aria-hidden="true" />
                                        Saved inspiration
                                        {savedPastCapstones.length > 0 && (
                                            <span className="wm-count tabular-nums">{savedPastCapstones.length}</span>
                                        )}
                                    </span>
                                }
                            >
                                <div className="space-y-3">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <p className="text-xs leading-5 text-slate-500">
                                            Private historical bookmarks only. They never create project interest or team commitment.
                                        </p>
                                        <Button variant="outline" size="sm" onClick={() => router.push("/past-capstones")}>
                                            Browse archive
                                        </Button>
                                    </div>
                                    {savedPastError && <Notice tone="danger">{savedPastError}</Notice>}
                                    {savedPastLoading ? (
                                        <p className="inline-flex items-center gap-2 text-sm text-slate-500">
                                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                            Loading saved inspiration…
                                        </p>
                                    ) : (
                                        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                                            {savedPastCapstones.map((capstone) => (
                                                <li key={`${capstone.source_type}-${capstone.source_id || capstone.id}`} className="flex min-w-0 flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-medium text-slate-800">{capstone.title}</p>
                                                        <p className="mt-0.5 text-xs text-slate-500">
                                                            {getSavedPastSourceLabel(capstone)} · {capstone.completed_term || capstone.year}
                                                        </p>
                                                    </div>
                                                    <Button variant="ghost" size="sm" onClick={() => router.push("/past-capstones")}>
                                                        View
                                                    </Button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </Disclosure>
                        )}
                        {/* CASE 1 & 3: USER HAS TEAM(S) */}
                        {hasTeams && (
                            <section className="order-20 space-y-3" aria-labelledby="current-project-heading">
                                <SectionHeader
                                    title={<span id="current-project-heading">Current project</span>}
                                    description="Your official team, review status, support, and next team decision."
                                />
                                <div className="space-y-3">
                                    {teams.map((teamData, index) => {
                                        const candidateCount = teamData.is_leader
                                            ? teamData.interested_students.length
                                            : 0;
                                        const primaryLabel =
                                            teamData.is_leader && !teamData.project
                                                ? "Start proposal"
                                                : candidateCount > 0
                                                  ? `Review ${candidateCount} candidate${candidateCount === 1 ? "" : "s"}`
                                                  : "Open team workspace";
                                        return (
                                            <CapstoneCard
                                                key={teamData.team_id}
                                                project={
                                                    teamData.project || {
                                                        capstone_id: `team-${teamData.team_id}`,
                                                        title: `Team ${index + 1}`,
                                                        description: "Your team is ready for a capstone proposal.",
                                                        status: teamData.status,
                                                    }
                                                }
                                                onClick={() => handleOpenTeamWorkspace(teamData)}
                                                canExpressInterest={false}
                                                actions={
                                                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                                                        <span className="text-xs text-slate-500">
                                                            {teamData.team_members.length} official member{teamData.team_members.length === 1 ? "" : "s"}
                                                            {teamData.is_leader ? " · You lead this team" : ""}
                                                        </span>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            onClick={() => {
                                                                if (teamData.is_leader && !teamData.project) {
                                                                    router.push("/project-form");
                                                                    return;
                                                                }
                                                                handleOpenTeamWorkspace(teamData);
                                                            }}
                                                        >
                                                            {primaryLabel}
                                                        </Button>
                                                    </div>
                                                }
                                            />
                                        );
                                    })}
                                </div>
                            </section>
                        )}

                        {/* CASE 2: USER HAS MARKETPLACE EXPLORATIONS */}
                        {!hasTeams && (hasMarketplaceCards || pendingCommitments.length > 0 || resolvedMarketplaceCards.length > 0) && (
                            <section className="order-30 space-y-3" aria-labelledby="exploration-heading">
                                <SectionHeader
                                    title={<span id="exploration-heading">Project exploration</span>}
                                    description={`Explore more than one project until you and a team are ready to commit. Marketplace phase: ${marketplacePhase}.`}
                                />

                                {pendingCommitments.map((request) => {
                                    const relatedExploration = explorations.find(
                                        (exploration) =>
                                            Number(exploration.capstone_fk) === Number(request.capstone_fk)
                                    );
                                    return (
                                        <Card key={`commitment-${request.commitment_request_id}`} className="gap-0 border-amber-200 p-0">
                                            <div className="flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="font-semibold text-slate-950 [overflow-wrap:anywhere]">
                                                            {relatedExploration?.capstone?.title || "Commitment request"}
                                                        </h3>
                                                        <StatusBadge tone="warning">Staff routing</StatusBadge>
                                                    </div>
                                                    <p className="mt-1 text-sm leading-6 text-slate-600">
                                                        Both sides confirmed. Staff is selecting the coordinating and enrollment course routes before membership becomes official.
                                                    </p>
                                                </div>
                                                <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-amber-800">
                                                    <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                                                    No action needed
                                                </span>
                                            </div>
                                            {request.comments && (
                                                <Disclosure
                                                    summary="Routing note"
                                                    className="rounded-none border-x-0 border-b-0 shadow-none"
                                                >
                                                    <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{request.comments}</p>
                                                </Disclosure>
                                            )}
                                        </Card>
                                    );
                                })}

                                {marketplaceCards.map((exploration) => {
                                    const status = (exploration.status || "").toLowerCase();
                                    const capstoneId =
                                        exploration.capstone?.capstone_id ??
                                        exploration.capstone_fk;
                                    const cardCapstone = exploration.capstone as
                                        | {
                                              marketplace_phase?: string | null;
                                              marketplace_phase_context?: {
                                                  effective_phase?: string | null;
                                              } | null;
                                              can_commit?: boolean | null;
                                          }
                                        | null
                                        | undefined;
                                    const explorationPhase = normalizeMarketplacePhase(
                                        cardCapstone?.marketplace_phase ||
                                            cardCapstone?.marketplace_phase_context?.effective_phase ||
                                            marketplacePhase
                                    );
                                    const explorationCanCommit =
                                        cardCapstone?.can_commit ??
                                        (explorationPhase === "exploration" ||
                                            explorationPhase === "commitment");
                                    const explorationIsFinalization =
                                        explorationPhase === "finalization";
                                    const title =
                                        exploration.capstone?.title ||
                                        `Capstone #${capstoneId}`;
                                    const description =
                                        exploration.capstone?.description ||
                                        "No description available.";
                                    const studentConfirmed = hasStudentCommitmentConfirmation(exploration);
                                    const teamConfirmed = hasTeamCommitmentConfirmation(exploration);
                                    const canShowCommit =
                                        Boolean(exploration.exploration_id) && status === "exploring";
                                    const commitDisabled =
                                        !explorationCanCommit ||
                                        pendingCommitments.length > 0 ||
                                        studentConfirmed ||
                                        actionLoading ===
                                            `commit-exploration-${exploration.exploration_id}`;
                                    const commitmentDescription =
                                        status === "pending_commitment"
                                            ? "Staff is confirming the coordinating and enrollment course routes."
                                            : status === "committed"
                                            ? "Your official project membership is confirmed."
                                            : status === "exploring" && studentConfirmed && teamConfirmed
                                            ? "The team leader sends the confirmed roster for routing."
                                        : status === "exploring" && studentConfirmed && !teamConfirmed
                                            ? "The team decides whether to confirm commitment."
                                            : status === "exploring" && teamConfirmed && !studentConfirmed
                                            ? "Confirm commitment when you are ready."
                                            : status === "exploring"
                                            ? "Keep exploring fit, or confirm commitment when ready."
                                            : status === "invited"
                                            ? "Accept the invitation to begin exploring fit."
                                            : status === "interested"
                                            ? "The team leader reviews your request."
                                            : status === "shortlisted"
                                            ? "Open the project when you are ready to express interest."
                                            : "No action is required right now.";
                                    const commitmentButtonLabel = explorationIsFinalization
                                        ? "Finalization"
                                        : pendingCommitments.length > 0
                                        ? "Staff routing pending"
                                        : studentConfirmed && teamConfirmed
                                        ? "Commitment confirmed"
                                        : studentConfirmed && !teamConfirmed
                                        ? "Waiting for team"
                                        : "Confirm commitment";
                                    const showCommitAction =
                                        canShowCommit &&
                                        explorationCanCommit &&
                                        !studentConfirmed &&
                                        pendingCommitments.length === 0;
                                    return (
                                        <Card key={`${exploration.capstone_fk}-${exploration.status}`} className="gap-0 p-0">
                                            <div className="grid min-w-0 gap-2 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="font-semibold text-slate-950 [overflow-wrap:anywhere]">{title}</h3>
                                                        <StatusBadge tone={projectStatusTone(status)}>
                                                            {getExplorationStatusLabel(status)}
                                                        </StatusBadge>
                                                    </div>
                                                    <p className="mt-1 text-xs leading-5 text-slate-600">
                                                        <span className="font-medium text-slate-700">Next:</span>{" "}
                                                        {commitmentDescription}
                                                    </p>
                                                </div>
                                                <span className="text-xs font-medium text-slate-500">
                                                    {marketplacePhaseLabel(explorationPhase)} phase
                                                </span>
                                            </div>
                                            <Disclosure
                                                summary={
                                                    showCommitAction
                                                        ? "Project details and next action"
                                                        : "Project details and request options"
                                                }
                                                className="rounded-none border-x-0 border-b-0 shadow-none"
                                                summaryClassName="py-2.5"
                                                contentClassName="px-4 py-3"
                                            >
                                                <div className="space-y-3">
                                                    <p className="whitespace-pre-wrap leading-6 [overflow-wrap:anywhere]">{description}</p>
                                                    <dl className="grid gap-3 text-xs sm:grid-cols-2">
                                                        <div>
                                                            <dt className="font-medium text-slate-500">Marketplace phase</dt>
                                                            <dd className="mt-0.5 text-slate-700">{marketplacePhaseLabel(explorationPhase)}</dd>
                                                        </div>
                                                        {exploration.message && (
                                                            <div>
                                                                <dt className="font-medium text-slate-500">Your note</dt>
                                                                <dd className="mt-0.5 whitespace-pre-wrap text-slate-700 [overflow-wrap:anywhere]">{exploration.message}</dd>
                                                            </div>
                                                        )}
                                                    </dl>
                                                    <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                                                        {showCommitAction ? (
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                onClick={() =>
                                                                    createProjectCommitment(
                                                                        Number(exploration.exploration_id),
                                                                        "Student requested final project commitment."
                                                                    )
                                                                }
                                                                disabled={commitDisabled}
                                                            >
                                                                {actionLoading === `commit-exploration-${exploration.exploration_id}` ? (
                                                                    <Loader2 className="animate-spin" aria-hidden="true" />
                                                                ) : null}
                                                                {commitmentButtonLabel}
                                                            </Button>
                                                        ) : (
                                                            <span className="text-xs text-slate-500">
                                                                Your request can be changed until commitment is finalized.
                                                            </span>
                                                        )}
                                                        <ConfirmActionDialog
                                                            title="Withdraw project request?"
                                                            description={
                                                                <>
                                                                    This removes your request from{" "}
                                                                    <span className="font-medium text-slate-800">
                                                                        {title}
                                                                    </span>
                                                                    {" "}and ends your active marketplace relationship with this project. You can send a new request later if the project is still recruiting.
                                                                </>
                                                            }
                                                            confirmLabel="Withdraw request"
                                                            tone="destructive"
                                                            onConfirm={async () => {
                                                                await withdrawInterest(
                                                                    String(capstoneId)
                                                                );
                                                            }}
                                                            trigger={
                                                                <Button
                                                                    type="button"
                                                                    variant="link"
                                                                    size="sm"
                                                                    disabled={
                                                                        status === "committed" ||
                                                                        actionLoading === `withdraw-${capstoneId}`
                                                                    }
                                                                    className="justify-start text-slate-500 hover:text-red-700 sm:justify-center"
                                                                    aria-busy={
                                                                        actionLoading === `withdraw-${capstoneId}`
                                                                    }
                                                                >
                                                                    {actionLoading === `withdraw-${capstoneId}` && (
                                                                        <Loader2 className="animate-spin" aria-hidden="true" />
                                                                    )}
                                                                    Withdraw request
                                                                </Button>
                                                            }
                                                        />
                                                    </div>
                                                </div>
                                            </Disclosure>
                                        </Card>
                                    );
                                })}
                                {resolvedMarketplaceCards.length > 0 && (
                                    <Disclosure
                                        summary={
                                            <span className="inline-flex items-center gap-2">
                                                <History className="h-4 w-4 text-slate-500" aria-hidden="true" />
                                                Resolved history
                                                <span className="wm-count tabular-nums">{resolvedMarketplaceCards.length}</span>
                                            </span>
                                        }
                                    >
                                        <div className="space-y-2">
                                            {resolvedMarketplaceCards.map((exploration) => {
                                                const status = (exploration.status || "").toLowerCase();
                                                const capstoneId =
                                                    exploration.capstone?.capstone_id ??
                                                    exploration.capstone_fk;
                                                return (
                                                    <div
                                                        key={`resolved-${exploration.exploration_id}`}
                                                        className="flex flex-col gap-1 rounded border border-slate-100 bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                                                    >
                                                        <div className="min-w-0">
                                                            <p className="truncate font-medium text-slate-700">
                                                                {exploration.capstone?.title ||
                                                                    `Capstone #${capstoneId}`}
                                                            </p>
                                                            {exploration.message && (
                                                                <p className="truncate text-xs text-slate-500">
                                                                    {exploration.message}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <StatusBadge tone={projectStatusTone(status)}>
                                                            {getExplorationStatusLabel(status)}
                                                        </StatusBadge>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </Disclosure>
                                )}
                            </section>
                        )}

                        {/* TEAM INVITES SECTION */}
                        {hasInvites && (
                            <section className="order-10 space-y-3" aria-labelledby="invitations-heading">
                                <SectionHeader
                                    title={
                                        <span id="invitations-heading" className="inline-flex items-center gap-2">
                                            <Mail className="h-4 w-4 text-blue-600" aria-hidden="true" />
                                            Team invitations
                                            <span className="wm-count tabular-nums">{invites.length}</span>
                                        </span>
                                    }
                                    description="Accepting starts marketplace exploration; it does not make you an official member."
                                />
                                {invites.filter(Boolean).map((invite) => {
                                    const capstone = invite?.capstone ?? null;
                                    const capstoneStatus = (capstone?.status || "").toLowerCase();
                                    const inviteProjectPhase = normalizeMarketplacePhase(
                                        invite.marketplace_phase ||
                                            capstone?.marketplace_phase ||
                                            capstone?.marketplace_phase_context?.effective_phase ||
                                            marketplacePhase
                                    );
                                    const acceptanceBlockedReason =
                                        invite.acceptance_blocked_reason ||
                                        (inviteProjectPhase === "finalization"
                                            ? "This project is in finalization. Staff can resolve official workflows, but new exploration is closed."
                                            : "") ||
                                        (inviteProjectPhase !== "exploration"
                                            ? "This project is in commitment. Existing explorations can commit, but new invite acceptance is closed."
                                            : "") ||
                                        (capstoneStatus === "pending_review"
                                            ? "This invite is paused while the project is being reviewed."
                                            : capstoneStatus === "pending_admin_course_routing"
                                            ? "This invite is paused while the project is awaiting course routing."
                                            : "");
                                    const inviteBusy =
                                        actionLoading ===
                                            `accept-invite-${invite.invite_id}` ||
                                        actionLoading ===
                                            `decline-${invite.invite_id}`;
                                    return (
                                        <Card key={invite.invite_id} className="gap-0 border-blue-200 p-0">
                                            <div className="flex min-w-0 flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="font-semibold text-slate-950 [overflow-wrap:anywhere]">
                                                            {capstone?.title || `Team ${invite.team_fk}`}
                                                        </h3>
                                                        <StatusBadge tone={projectStatusTone(capstone?.status || "invited")}>
                                                            {capstone?.status ? getStatusLabel(capstone.status) : "Team forming"}
                                                        </StatusBadge>
                                                    </div>
                                                    <p className="mt-1 text-sm leading-6 text-slate-600">
                                                        {acceptanceBlockedReason
                                                            ? `${acceptanceBlockedReason} You can decline now or accept later.`
                                                            : "This team invited you to begin exploring fit. Official membership comes only after mutual commitment and routing."}
                                                    </p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    onClick={() => {
                                                        if (acceptanceBlockedReason) {
                                                            return;
                                                        }
                                                        setInviteAcceptError("");
                                                        setInviteAcceptTarget({
                                                            inviteId: invite.invite_id,
                                                            capstoneTitle: capstone?.title,
                                                        });
                                                    }}
                                                    disabled={
                                                        inviteBusy ||
                                                        !!acceptanceBlockedReason
                                                    }
                                                    className="w-full sm:w-auto"
                                                >
                                                    {actionLoading ===
                                                    `accept-invite-${invite.invite_id}` ? (
                                                        <Loader2 className="animate-spin" aria-hidden="true" />
                                                    ) : null}
                                                    Accept invitation
                                                </Button>
                                            </div>
                                            <Disclosure
                                                summary="Project context and invitation options"
                                                className="rounded-none border-x-0 border-b-0 shadow-none"
                                            >
                                                <div className="space-y-3">
                                                    <p className="whitespace-pre-wrap leading-6 [overflow-wrap:anywhere]">
                                                        {capstone?.description || "This team has not submitted a capstone yet."}
                                                    </p>
                                                    <p className="text-xs text-slate-500">Marketplace phase: <span className="capitalize">{inviteProjectPhase}</span></p>
                                                    <ConfirmActionDialog
                                                        title="Decline team invitation?"
                                                        description={
                                                            <>
                                                                This removes the invitation from{" "}
                                                                <span className="font-medium text-slate-800">
                                                                    {capstone?.title || `Team ${invite.team_fk}`}
                                                                </span>
                                                                . The team can invite you again later.
                                                            </>
                                                        }
                                                        confirmLabel="Decline invitation"
                                                        tone="destructive"
                                                        onConfirm={async () => {
                                                            await declineInvite(invite.invite_id);
                                                        }}
                                                        trigger={
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                disabled={inviteBusy}
                                                                className="text-red-700 hover:bg-red-50 hover:text-red-800"
                                                                aria-busy={
                                                                    actionLoading === `decline-${invite.invite_id}`
                                                                }
                                                            >
                                                                {actionLoading === `decline-${invite.invite_id}` && (
                                                                    <Loader2 className="animate-spin" aria-hidden="true" />
                                                                )}
                                                                Decline invitation
                                                            </Button>
                                                        }
                                                    />
                                                </div>
                                            </Disclosure>
                                        </Card>
                                    );
                                })}
                            </section>
                        )}

                        {/* CASE 4: NO TEAM AND NO INTERESTS AND NO INVITES */}
                        {!hasTeams && !hasPendingInterests && !hasMarketplaceCards && !hasInvites && pendingCommitments.length === 0 && (
                            <section className="order-40 space-y-3">
                                <EmptyState
                                    icon={FolderOpen}
                                    title="Find your capstone path"
                                    description={
                                        !userHasCourse
                                            ? "You can browse and explore now. Staff will confirm a staffed course route before official membership."
                                            : userCourseInactive
                                              ? "You can keep exploring while staff resolves your inactive course assignment."
                                              : "Browse recruiting projects, save possibilities, and contact a team when one feels promising."
                                    }
                                    action={
                                        <Button type="button" onClick={() => router.push("/discover")}>
                                            Discover projects
                                        </Button>
                                    }
                                />
                                <Disclosure summary="Want to lead your own proposal?">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <p className="max-w-2xl text-sm leading-6 text-slate-600">
                                            Create a team workspace first, then build one capstone proposal for that team. An active staffed course assignment is required.
                                        </p>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={async () => {
                                                if (!canUseCourseFlows) return;
                                                const result = await createEmptyTeam();
                                                if (!result?.success) {
                                                    console.error("Failed to create empty team");
                                                }
                                            }}
                                            disabled={actionLoading === "create-team" || !canUseCourseFlows}
                                            title={
                                                canUseCourseFlows
                                                    ? undefined
                                                    : userHasCourse
                                                      ? "Active course assignment required"
                                                      : "Course assignment required"
                                            }
                                            className="w-full sm:w-auto"
                                        >
                                            {actionLoading === "create-team" ? (
                                                <Loader2 className="animate-spin" aria-hidden="true" />
                                            ) : (
                                                <Users aria-hidden="true" />
                                            )}
                                            Create team workspace
                                        </Button>
                                    </div>
                                </Disclosure>
                            </section>
                        )}
            </div>

            {/* Modal for Team Details */}
            <Dialog
                open={!!selectedTeam}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedTeam(null);
                        setTeamContext(null);
                        setTeamContextError("");
                        setTeamContextLoading(false);
                    }
                }}
            >
                <DialogContent
                    onOpenAutoFocus={() => {
                        if (document.activeElement instanceof HTMLElement) {
                            teamDialogOpenerRef.current = document.activeElement;
                        }
                    }}
                    onCloseAutoFocus={(event) => {
                        const opener = teamDialogOpenerRef.current;
                        if (opener?.isConnected) {
                            event.preventDefault();
                            opener.focus();
                        }
                        teamDialogOpenerRef.current = null;
                    }}
                    className="
                        fixed z-50
                        left-1/2 top-1/2
                        -translate-x-1/2 -translate-y-1/2
                        w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] sm:max-w-6xl
                        h-auto max-h-[90vh]
                        overflow-y-auto
                        p-0 gap-0
                        rounded-lg
                        bg-white
                        shadow-2xl
                        border border-slate-200
                        data-[state=open]:animate-in data-[state=closed]:animate-out
                        data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95
                        data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0
                    "
                >
                    {selectedTeam && (
                        <div className="flex flex-col h-full">
                            {/* HEADER */}
                            <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-6 pr-12 sm:px-8 sm:py-8 sm:pr-12">
                                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <DialogTitle className="break-words text-xl font-bold leading-tight text-slate-900 sm:text-2xl">
                                                {selectedTeam.project
                                                    ? selectedTeam.project.title
                                                    : `Team ${selectedTeam.team_id}`}
                                            </DialogTitle>
                                        </div>
                                        <DialogDescription className="sr-only">
                                            Official team roster, finalization readiness, project support, and team management controls.
                                        </DialogDescription>
                                        <div className="text-sm text-slate-500 font-medium">
                                            {selectedTeam.team_members.length}{" "}
                                            member
                                            {selectedTeam.team_members
                                                .length !== 1
                                                ? "s"
                                                : ""}
                                            {selectedTeam.is_leader &&
                                                selectedTeam.interested_students
                                                    .length > 0 && (
                                                    <>
                                                        {" "}
                                                        ·{" "}
                                                        {
                                                            selectedTeam
                                                                .interested_students
                                                                .length
                                                        }{" "}
                                                        pending
                                                    </>
                                                )}
                                        </div>
                                    </div>
                                    {selectedTeam.project && (
                                        <span
                                            className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold tracking-wide border ${getStatusBadgeClass(
                                                selectedTeam.project.status
                                            )}`}
                                        >
                                            {getStatusLabel(selectedTeam.project.status)}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* BODY */}
                            <div className="p-4 sm:p-6">
                                <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(22rem,0.88fr)] xl:gap-8">
                                    {/* LEFT COLUMN: Description */}
                                    <div className="space-y-6">
                                        {selectedTeam.project ? (
                                            <Disclosure summary="Project details">
                                                <p className="whitespace-pre-wrap leading-6 text-slate-700 [overflow-wrap:anywhere]">
                                                    {selectedTeam.project.description}
                                                </p>
                                            </Disclosure>
                                        ) : (
                                            <Notice tone="warning" title="Proposal not submitted">
                                                This team does not have a capstone proposal yet.
                                            </Notice>
                                        )}

                                        {selectedTeam.project?.status?.toLowerCase() ===
                                            "changes_requested" && (
                                            <div className="space-y-3">
                                                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                                                    Instructor feedback
                                                </h3>
                                                {loadingApprovalHistory ? (
                                                    <p className="text-slate-600 text-sm">
                                                        Loading feedback...
                                                    </p>
                                                ) : latestChangesRequested?.comments ? (
                                                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 whitespace-pre-wrap">
                                                        {latestChangesRequested.instructor_display && (
                                                            <p className="font-semibold mb-1">
                                                                Feedback by{" "}
                                                                {latestChangesRequested.instructor_display}
                                                            </p>
                                                        )}
                                                        {latestChangesRequested.comments}
                                                    </div>
                                                ) : (
                                                    <p className="text-slate-600 text-sm">
                                                        No feedback text was found for this change request.
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {selectedTeam.project?.status?.toLowerCase() ===
                                            "rejected" && (
                                            <div className="space-y-3">
                                                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                                                    Rejection reason
                                                </h3>
                                                {loadingApprovalHistory ? (
                                                    <p className="text-slate-600 text-sm">
                                                        Loading rejection details...
                                                    </p>
                                                ) : latestRejected?.comments ? (
                                                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900 whitespace-pre-wrap">
                                                        {latestRejected.instructor_display && (
                                                            <p className="font-semibold mb-1">
                                                                Rejected by{" "}
                                                                {latestRejected.instructor_display}
                                                            </p>
                                                        )}
                                                        {latestRejected.comments}
                                                    </div>
                                                ) : (
                                                    <p className="text-slate-600 text-sm">
                                                        No rejection reason was provided.
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {selectedTeam.is_leader &&
                                            ["draft", "changes_requested", "rejected"].includes(
                                                selectedTeam.project?.status?.toLowerCase() || ""
                                            ) && (
                                                <div className="space-y-3 border border-slate-200 rounded-lg p-4 bg-slate-50">
                                                    <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                                                        {selectedTeam.project?.status?.toLowerCase() === "draft"
                                                            ? "Draft proposal"
                                                            : "Revise and resubmit"}
                                                    </h3>
                                                    <p className="text-sm text-slate-600">
                                                        Open the full capstone form to revise your submission.
                                                        All fields will be pre-filled from your current capstone.
                                                    </p>
                                                    <Button
                                                        onClick={() => {
                                                            const capstoneId =
                                                                selectedTeam.project?.capstone_id;
                                                            if (capstoneId) {
                                                                setSelectedTeam(null);
                                                                router.push(
                                                                    `/project-form/resubmit/${capstoneId}`
                                                                );
                                                            }
                                                        }}
                                                        className="w-full sm:w-auto"
                                                    >
                                                        {selectedTeam.project?.status?.toLowerCase() === "draft"
                                                            ? "Edit and submit for review"
                                                            : "Open revision form"}
                                                    </Button>
                                                </div>
                                            )}

                                        {/* Actions */}
                                        <div className="flex flex-wrap gap-2">
                                            {selectedTeam.is_leader && selectedTeamIsRecruiting && (
                                                <Button
                                                    variant="default"
                                                    onClick={() => {
                                                        setFinalizeError("");
                                                        setShowFinalizeModal(true);
                                                    }}
                                                    disabled={finalizeLoading}
                                                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700"
                                                >
                                                    Finalize team
                                                </Button>
                                            )}
                                            {selectedTeamCanWithdrawReview && (
                                                <Button
                                                    variant="outline"
                                                    onClick={() => {
                                                        setWithdrawReviewError("");
                                                        setShowWithdrawReviewModal(true);
                                                    }}
                                                    disabled={withdrawReviewLoading}
                                                    className="w-full sm:w-auto"
                                                >
                                                    {withdrawReviewLoading ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : null}
                                                    Reopen for edits
                                                </Button>
                                            )}
                                            {selectedTeamCanInvite && (
                                                <Button
                                                    variant="default"
                                                    onClick={
                                                        handleOpenInviteModal
                                                    }
                                                    className="w-full sm:w-auto"
                                                >
                                                    <UserPlus className="h-4 w-4" />
                                                    Invite teammate
                                                </Button>
                                            )}
                                            {((selectedTeam.is_leader && !selectedTeamIsLocked) ||
                                                (!selectedTeam.is_leader && !selectedTeamIsLocked) ||
                                                selectedTeamCanAbandonSoloProject) && (
                                                <details className="basis-full">
                                                    <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">
                                                        More actions
                                                    </summary>
                                                    <div className="mt-2 flex flex-wrap gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                                                        {selectedTeam.is_leader && !selectedTeamIsLocked && (
                                                            <Button
                                                                variant="outline"
                                                                onClick={handleReassignLeadership}
                                                                className="w-full sm:w-auto"
                                                            >
                                                                Reassign leader
                                                            </Button>
                                                        )}
                                                        {!selectedTeam.is_leader && !selectedTeamIsLocked && (
                                                            <Button
                                                                variant="outline"
                                                                onClick={() =>
                                                                    handleLeaveTeam(
                                                                        selectedTeam.team_id
                                                                    )
                                                                }
                                                                disabled={
                                                                    actionLoading ===
                                                                    "leave-team"
                                                                }
                                                                className="w-full sm:w-auto"
                                                            >
                                                                {actionLoading ===
                                                                "leave-team" ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                ) : null}
                                                                Leave team
                                                            </Button>
                                                        )}
                                                        {selectedTeamCanAbandonSoloProject && (
                                                            <Button
                                                                variant="outline"
                                                                onClick={() => {
                                                                    setAbandonProjectError("");
                                                                    setShowAbandonProjectModal(true);
                                                                }}
                                                                disabled={actionLoading === "abandon-project"}
                                                                className="w-full border-red-200 text-red-700 hover:bg-red-50 sm:w-auto"
                                                            >
                                                                {actionLoading === "abandon-project" ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                ) : null}
                                                                Abandon project
                                                            </Button>
                                                        )}
                                                    </div>
                                                </details>
                                            )}
                                            {finalizeError && (
                                                <p className="basis-full text-sm text-red-600">
                                                    {finalizeError}
                                                </p>
                                            )}
                                            {abandonProjectError && (
                                                <p className="basis-full text-sm text-red-600">
                                                    {abandonProjectError}
                                                </p>
                                            )}
                                            {withdrawReviewError && (
                                                <p className="basis-full text-sm text-red-600">
                                                    {withdrawReviewError}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* RIGHT COLUMN: Team Members & Interested Students */}
                                    <div className="space-y-6">
                                        {/* Team Members */}
                                        <div>
                                            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                                                Team members
                                            </h3>
                                            {teamContextLoading ? (
                                                <OfficialTeamRosterSkeleton
                                                    count={Math.min(
                                                        Math.max(selectedTeam.team_members.length, 1),
                                                        4
                                                    )}
                                                />
                                            ) : (
                                                <OfficialTeamRoster
                                                    members={
                                                        teamContext?.members ||
                                                        fallbackRosterMembers(
                                                            selectedTeam,
                                                            Number.isInteger(currentUserId)
                                                                ? currentUserId
                                                                : null
                                                        )
                                                    }
                                                    onViewProfile={(member) =>
                                                        handleViewStudentProfile(
                                                            member.user_id,
                                                            member.email,
                                                            getStudentCourseLabel(member),
                                                            getStudentDepartmentLabel(member),
                                                            member.is_leader
                                                        )
                                                    }
                                                    renderMemberAction={(member) =>
                                                        selectedTeam.is_leader &&
                                                        !selectedTeamIsLocked &&
                                                        !isCurrentUserId(String(member.user_id)) ? (
                                                            <ConfirmActionDialog
                                                                title="Remove official team member?"
                                                                description={
                                                                    <>
                                                                        This removes{" "}
                                                                        <span className="font-medium text-slate-800">
                                                                            {member.email}
                                                                        </span>
                                                                        {" "}from the official team roster. They will no longer be an official member of this project.
                                                                    </>
                                                                }
                                                                confirmLabel="Remove member"
                                                                tone="destructive"
                                                                onConfirm={() =>
                                                                    handleRemoveStudent(
                                                                        String(member.user_id),
                                                                        selectedTeam.team_id
                                                                    )
                                                                }
                                                                trigger={
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        disabled={
                                                                            actionLoading ===
                                                                            `remove-${member.user_id}`
                                                                        }
                                                                        aria-busy={
                                                                            actionLoading ===
                                                                            `remove-${member.user_id}`
                                                                        }
                                                                        className="text-red-700 hover:bg-red-50 hover:text-red-800"
                                                                    >
                                                                        {actionLoading ===
                                                                        `remove-${member.user_id}` ? (
                                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                                        ) : null}
                                                                        Remove
                                                                    </Button>
                                                                }
                                                            />
                                                        ) : null
                                                    }
                                                />
                                            )}
                                            {teamContextError && !teamContext && (
                                                <p className="mt-2 text-xs text-amber-700">
                                                    Live roster details are unavailable; showing the last loaded team roster.
                                                </p>
                                            )}
                                        </div>

                                        {selectedTeam.project && (
                                            <div>
                                                {teamContextLoading ? (
                                                    <TeamContextPanelSkeleton label="Finalization readiness" />
                                                ) : teamContextError ? (
                                                    <p className="text-sm text-rose-700">
                                                        {teamContextError}
                                                    </p>
                                                ) : teamContext ? (
                                                    <FinalizationReadiness
                                                        readiness={teamContext.readiness}
                                                    />
                                                ) : null}
                                            </div>
                                        )}

                                        {selectedTeam.project && (
                                            <div>
                                                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                                                    Project support
                                                </h3>
                                                {teamContextLoading ? (
                                                    <TeamContextPanelSkeleton label="Project support" />
                                                ) : teamContextError ? (
                                                    <p className="text-sm text-rose-700">
                                                        {teamContextError}
                                                    </p>
                                                ) : visibleSupportSummary ? (
                                                    <ProjectSupportSummary
                                                        support={visibleSupportSummary}
                                                    />
                                                ) : null}
                                                {showMentorManagement && (
                                                <Disclosure
                                                    summary="Manage mentor support"
                                                    className="mt-3 shadow-none"
                                                >
                                                <div className="space-y-3">
                                                    {mentorDataLoading ? (
                                                        <div className="flex items-center gap-2 text-sm text-slate-600">
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                            Loading support...
                                                        </div>
                                                    ) : (
                                                        <>
                                                            {mentorDataError && (
                                                                <p className="text-sm text-red-600">
                                                                    {mentorDataError}
                                                                </p>
                                                            )}
                                                            {pendingMentorRequests.length > 0 && (
                                                                <div className="space-y-2">
                                                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                                        Pending requests
                                                                    </p>
                                                                    {pendingMentorRequests.map((request) => (
                                                                        <div
                                                                            key={request.mentor_request_id}
                                                                            className="rounded border border-slate-200 bg-white p-2 text-sm"
                                                                        >
                                                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                                                <span className="min-w-0 flex-1 text-slate-700 [overflow-wrap:anywhere]">
                                                                                    {request.mentor?.email ||
                                                                                        `Mentor #${request.mentor_fk}`}
                                                                                </span>
                                                                                <ConfirmActionDialog
                                                                                    title="Cancel mentor request?"
                                                                                    description={
                                                                                        <>
                                                                                            This withdraws the pending request to{" "}
                                                                                            <span className="font-medium text-slate-800">
                                                                                                {request.mentor?.email ||
                                                                                                    `Mentor #${request.mentor_fk}`}
                                                                                            </span>
                                                                                            . They will no longer be able to accept it. You can send a new request later.
                                                                                        </>
                                                                                    }
                                                                                    confirmLabel="Cancel request"
                                                                                    tone="destructive"
                                                                                    onConfirm={() =>
                                                                                        handleCancelMentorRequest(
                                                                                            request
                                                                                        )
                                                                                    }
                                                                                    trigger={
                                                                                        <Button
                                                                                            variant="outline"
                                                                                            size="sm"
                                                                                            className="h-7 shrink-0 text-xs"
                                                                                            disabled={
                                                                                                mentorActionLoading ===
                                                                                                `cancel-mentor-${request.mentor_request_id}`
                                                                                            }
                                                                                            aria-busy={
                                                                                                mentorActionLoading ===
                                                                                                `cancel-mentor-${request.mentor_request_id}`
                                                                                            }
                                                                                        >
                                                                                            {mentorActionLoading ===
                                                                                            `cancel-mentor-${request.mentor_request_id}` ? (
                                                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                                                            ) : null}
                                                                                            Cancel
                                                                                        </Button>
                                                                                    }
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {pendingMentorOffers.length > 0 && (
                                                                <div className="space-y-2">
                                                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                                        Mentor offers
                                                                    </p>
                                                                    {pendingMentorOffers.map((request) => (
                                                                        <div
                                                                            key={request.mentor_request_id}
                                                                            className="rounded border border-blue-100 bg-blue-50 p-2 text-sm"
                                                                        >
                                                                            <p className="font-medium text-slate-800 [overflow-wrap:anywhere]">
                                                                                {request.mentor?.email ||
                                                                                    `Mentor #${request.mentor_fk}`}
                                                                            </p>
                                                                            {request.message && (
                                                                                <p className="mt-1 text-xs text-slate-600">
                                                                                    {request.message}
                                                                                </p>
                                                                            )}
                                                                            <div className="mt-2 flex gap-2">
                                                                                <Button
                                                                                    size="sm"
                                                                                    className="h-7 flex-1 text-xs"
                                                                                    onClick={() =>
                                                                                        handleDecideMentorOffer(
                                                                                            request,
                                                                                            "accept"
                                                                                        )
                                                                                    }
                                                                                    disabled={
                                                                                        mentorActionLoading ===
                                                                                        `accept-mentor-offer-${request.mentor_request_id}`
                                                                                    }
                                                                                    aria-busy={
                                                                                        mentorActionLoading ===
                                                                                        `accept-mentor-offer-${request.mentor_request_id}`
                                                                                    }
                                                                                >
                                                                                    {mentorActionLoading ===
                                                                                    `accept-mentor-offer-${request.mentor_request_id}` ? (
                                                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                                                    ) : null}
                                                                                    Accept
                                                                                </Button>
                                                                                <ConfirmActionDialog
                                                                                    title="Decline mentor offer?"
                                                                                    description={
                                                                                        <>
                                                                                            This declines the support offer from{" "}
                                                                                            <span className="font-medium text-slate-800">
                                                                                                {request.mentor?.email ||
                                                                                                    `Mentor #${request.mentor_fk}`}
                                                                                            </span>
                                                                                            . Your team can request mentor support again later.
                                                                                        </>
                                                                                    }
                                                                                    confirmLabel="Decline offer"
                                                                                    tone="destructive"
                                                                                    onConfirm={() =>
                                                                                        handleDecideMentorOffer(
                                                                                            request,
                                                                                            "decline"
                                                                                        )
                                                                                    }
                                                                                    trigger={
                                                                                        <Button
                                                                                            size="sm"
                                                                                            variant="outline"
                                                                                            className="h-7 flex-1 text-xs"
                                                                                            disabled={
                                                                                                mentorActionLoading ===
                                                                                                `decline-mentor-offer-${request.mentor_request_id}`
                                                                                            }
                                                                                            aria-busy={
                                                                                                mentorActionLoading ===
                                                                                                `decline-mentor-offer-${request.mentor_request_id}`
                                                                                            }
                                                                                        >
                                                                                            {mentorActionLoading ===
                                                                                            `decline-mentor-offer-${request.mentor_request_id}` ? (
                                                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                                                            ) : null}
                                                                                            Decline
                                                                                        </Button>
                                                                                    }
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {selectedTeamCanRequestMentor && !acceptedMentor && (
                                                                <div className="space-y-2 border-t border-slate-200 pt-3">
                                                                    <Select
                                                                        value={selectedMentorId}
                                                                        onValueChange={setSelectedMentorId}
                                                                        disabled={
                                                                            mentorActionLoading ===
                                                                                "request-mentor" ||
                                                                            availableMentors.length === 0
                                                                        }
                                                                    >
                                                                        <SelectTrigger>
                                                                            <SelectValue placeholder="Select mentor" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value={NO_MENTOR}>
                                                                                Select mentor
                                                                            </SelectItem>
                                                                            {availableMentors.map((mentor) => (
                                                                                <SelectItem
                                                                                    key={mentor.user_id}
                                                                                    value={String(mentor.user_id)}
                                                                                >
                                                                                    {mentorDirectoryLabel(mentor)}
                                                                                </SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                    <Textarea
                                                                        value={mentorMessage}
                                                                        onChange={(event) =>
                                                                            setMentorMessage(event.target.value)
                                                                        }
                                                                        placeholder="Optional note to the mentor"
                                                                        rows={2}
                                                                    />
                                                                    {availableMentors.length === 0 && (
                                                                        <p className="text-xs text-slate-500">
                                                                            No active mentors are available to request right now.
                                                                        </p>
                                                                    )}
                                                                    <Button
                                                                        className="w-full"
                                                                        onClick={handleRequestMentor}
                                                                        disabled={
                                                                            selectedMentorId === NO_MENTOR ||
                                                                            mentorActionLoading ===
                                                                                "request-mentor"
                                                                        }
                                                                    >
                                                                        {mentorActionLoading === "request-mentor" ? (
                                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                                        ) : null}
                                                                        Request mentor
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                                </Disclosure>
                                                )}
                                            </div>
                                        )}

                                        {/* Interested Students (only for leaders) */}
                                        {selectedTeam.is_leader &&
                                            !selectedTeamIsLocked &&
                                            selectedTeam.interested_students
                                                .length > 0 && (
                                                <div>
                                                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                                                        Join requests
                                                    </h3>
                                                    <ul className="space-y-3">
                                                        {selectedTeam.interested_students.map(
                                                            (student) => {
                                                                const interestBusy =
                                                                    actionLoading ===
                                                                        `accept-${student.user_id}` ||
                                                                    actionLoading ===
                                                                        `reject-${student.user_id}`;
                                                                const studentHasCourse =
                                                                    student.course_fk !== undefined &&
                                                                    student.course_fk !== null;
                                                                const studentAcceptanceBlockedReason =
                                                                    !selectedProjectAllowsNewExploration
                                                                        ? selectedProjectPhase === "finalization"
                                                                            ? "This project is in finalization. Staff can resolve official workflows, but new exploration is closed."
                                                                            : "This project is in commitment. Existing explorations can commit, but new interest acceptance is closed."
                                                                        : "";
                                                                const interestedAt =
                                                                    formatShortDateTime(student.created_at);
                                                                return (
                                                                <li
                                                                    key={
                                                                        student.user_id
                                                                    }
                                                                    className="rounded border border-blue-100 bg-blue-50 p-3"
                                                                >
                                                                    <button
                                                                        type="button"
                                                                        className="mb-2 flex w-full items-start justify-between rounded text-left outline-none hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-slate-400"
                                                                        aria-label={`View profile for ${student.email}`}
                                                                        onClick={() =>
                                                                            handleViewStudentProfile(
                                                                                student.user_id,
                                                                                student.email,
                                                                                getStudentCourseLabel(student),
                                                                                getStudentDepartmentLabel(student)
                                                                            )
                                                                        }
                                                                    >
                                                                        <div className="flex items-center min-w-0 flex-1">
                                                                            <div className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center text-[10px] font-bold text-blue-700 mr-2 flex-shrink-0">
                                                                                {student.email
                                                                                    .charAt(
                                                                                        0
                                                                                    )
                                                                                    .toUpperCase()}
                                                                            </div>
                                                                            <span className="text-sm text-slate-700 [overflow-wrap:anywhere]">
                                                                                {
                                                                                    student.email
                                                                                }
                                                                            </span>
                                                                        </div>
                                                                    </button>
                                                                     <p className="text-xs text-slate-500 mb-2 ml-8">
                                                                         Course: {getStudentCourseLabel(student)}
                                                                     </p>
                                                                     <p className="text-xs text-slate-500 mb-2 ml-8">
                                                                         Home department: {getStudentDepartmentLabel(student)}
                                                                     </p>
                                                                     {interestedAt && (
                                                                         <p className="text-xs text-slate-500 mb-2 ml-8">
                                                                             Interested since {interestedAt}
                                                                         </p>
                                                                     )}
                                                                     {student.message && (
                                                                        <p className="text-xs text-slate-600 italic mb-2 ml-8">
                                                                            "
                                                                            {
                                                                                student.message
                                                                            }
                                                                            "
                                                                        </p>
                                                                    )}
                                                                    {studentAcceptanceBlockedReason && (
                                                                        <p className="mb-2 ml-8 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                                                                            {studentAcceptanceBlockedReason}
                                                                        </p>
                                                                    )}
                                                                    <div
                                                                        className="flex gap-2 ml-8"
                                                                        onClick={(
                                                                            e
                                                                        ) =>
                                                                            e.stopPropagation()
                                                                        }
                                                                    >
                                                                        <Button
                                                                            size="sm"
                                                                            onClick={() => {
                                                                                setAcceptInterestError("");
                                                                                setAcceptTarget({
                                                                                    studentId:
                                                                                        student.user_id,
                                                                                    teamId: selectedTeam.team_id,
                                                                                    email: student.email,
                                                                                    courseLabel:
                                                                                        getStudentCourseLabel(
                                                                                            student
                                                                                        ),
                                                                                    courseMode:
                                                                                        getStudentCourseMode(
                                                                                            selectedTeam,
                                                                                            student
                                                                                        ),
                                                                                })
                                                                            }}
                                                                            disabled={
                                                                                interestBusy ||
                                                                                !!studentAcceptanceBlockedReason
                                                                            }
                                                                            aria-busy={
                                                                                actionLoading ===
                                                                                `accept-${student.user_id}`
                                                                            }
                                                                            title={
                                                                                studentAcceptanceBlockedReason ||
                                                                                (studentHasCourse
                                                                                    ? undefined
                                                                                    : "Accepting this student starts marketplace exploration before staff routing.")
                                                                            }
                                                                            className="h-7 text-xs flex-1"
                                                                        >
                                                                            {actionLoading ===
                                                                            `accept-${student.user_id}` ? (
                                                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                                            ) : null}
                                                                            Start exploration
                                                                        </Button>
                                                                         <Button
                                                                             size="sm"
                                                                             variant="outline"
                                                                             onClick={() => {
                                                                                 setRejectError("");
                                                                                 setRejectReason("");
                                                                                 setRejectTarget({
                                                                                     studentId: student.user_id,
                                                                                     teamId: selectedTeam.team_id,
                                                                                     email: student.email,
                                                                                 });
                                                                             }}
                                                                             disabled={
                                                                                 interestBusy
                                                                             }
                                                                             aria-busy={
                                                                                 actionLoading ===
                                                                                 `reject-${student.user_id}`
                                                                             }
                                                                            className="h-7 text-xs flex-1"
                                                                        >
                                                                            {actionLoading ===
                                                                            `reject-${student.user_id}` ? (
                                                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                                            ) : null}
                                                                            Reject
                                                                        </Button>
                                                                    </div>
                                                                </li>
                                                                );
                                                            }
                                                        )}
                                                    </ul>
                                                </div>
                                            )}
                                        {selectedTeam.is_leader &&
                                            !selectedTeamIsLocked &&
                                            (selectedTeam.exploring_students || [])
                                                .length > 0 && (
                                                <div>
                                                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                                                        Exploring students
                                                    </h3>
                                                    <ul className="space-y-3">
                                                        {(selectedTeam.exploring_students || []).map((student) => {
                                                            const status = (student.status || "exploring").toLowerCase();
                                                            const studentConfirmed = hasStudentCommitmentConfirmation(student);
                                                            const teamConfirmed = hasTeamCommitmentConfirmation(student);
                                                            const startedAt = formatShortDateTime(student.created_at);
                                                            const updatedAt = formatShortDateTime(student.updated_at);
                                                            const busy =
                                                                actionLoading ===
                                                                `commit-exploration-${student.exploration_id}`;
                                                            const cancelBusy =
                                                                actionLoading ===
                                                                `cancel-exploration-${student.exploration_id}`;
                                                            const commitmentDisabled =
                                                                !student.exploration_id ||
                                                                status === "pending_commitment" ||
                                                                status === "committed" ||
                                                                !selectedProjectAllowsCommitment ||
                                                                teamConfirmed ||
                                                                busy ||
                                                                cancelBusy;
                                                            const cancelDisabled =
                                                                !student.exploration_id ||
                                                                status === "committed" ||
                                                                busy ||
                                                                cancelBusy;
                                                            const commitmentLabel =
                                                                status === "pending_commitment"
                                                                    ? "Awaiting staff routing"
                                                                    : status === "committed"
                                                                    ? "Committed"
                                                                    : selectedProjectIsFinalization
                                                                    ? "Finalization"
                                                                    : studentConfirmed && teamConfirmed
                                                                    ? "Commitment confirmed"
                                                                    : teamConfirmed
                                                                    ? "Waiting for student"
                                                                    : "Confirm commitment";
                                                            return (
                                                                <li
                                                                    key={student.exploration_id || student.user_id}
                                                                    className="rounded border border-emerald-100 bg-emerald-50 p-3"
                                                                >
                                                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                                        <button
                                                                            type="button"
                                                                            className="min-w-0 text-left"
                                                                            aria-label={`View profile for ${student.email}`}
                                                                            onClick={() =>
                                                                                handleViewStudentProfile(
                                                                                    student.user_id,
                                                                                    student.email,
                                                                                    getStudentCourseLabel(student),
                                                                                    getStudentDepartmentLabel(student)
                                                                                )
                                                                            }
                                                                        >
                                                                            <span className="block text-sm font-medium text-slate-800 [overflow-wrap:anywhere]">
                                                                                {student.email}
                                                                            </span>
                                                                             <span className="block text-xs text-slate-500">
                                                                                 Course: {getStudentCourseLabel(student)}
                                                                             </span>
                                                                             <span className="block text-xs text-slate-500">
                                                                                 Home department: {getStudentDepartmentLabel(student)}
                                                                             </span>
                                                                             {(startedAt || updatedAt) && (
                                                                                 <span className="block text-xs text-slate-500">
                                                                                     {startedAt ? `Exploring since ${startedAt}` : ""}
                                                                                     {startedAt && updatedAt ? " - " : ""}
                                                                                     {updatedAt ? `Updated ${updatedAt}` : ""}
                                                                                 </span>
                                                                             )}
                                                                         </button>
                                                                        <span className={`w-fit shrink-0 rounded border px-2 py-0.5 text-xs font-medium ${getExplorationStatusClass(status)}`}>
                                                                            {getExplorationStatusLabel(status)}
                                                                        </span>
                                                                    </div>
                                                                    {student.message && (
                                                                        <p className="mt-2 text-xs italic text-slate-600">
                                                                            "{student.message}"
                                                                        </p>
                                                                    )}
                                                                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                                                                        <ConfirmActionDialog
                                                                            title={
                                                                                status === "pending_commitment"
                                                                                    ? "Cancel commitment routing?"
                                                                                    : "Stop exploring with this student?"
                                                                            }
                                                                            description={
                                                                                status === "pending_commitment"
                                                                                    ? `This withdraws ${student.email} from the pending course-routing review and ends this project's active exploration relationship with them. It does not change official team membership.`
                                                                                    : `This removes ${student.email} from this project's active exploration list. It does not change official team membership, and exploration can be restarted later.`
                                                                            }
                                                                            confirmLabel={
                                                                                status === "pending_commitment"
                                                                                    ? "Cancel routing"
                                                                                    : "Stop exploring"
                                                                            }
                                                                            tone="destructive"
                                                                            onConfirm={() =>
                                                                                student.exploration_id
                                                                                    ? handleCancelExploration(
                                                                                          student.exploration_id,
                                                                                          status === "pending_commitment"
                                                                                              ? "Team cancelled the pending marketplace commitment routing request."
                                                                                              : "Team stopped marketplace exploration."
                                                                                      )
                                                                                    : Promise.resolve()
                                                                            }
                                                                            trigger={
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="outline"
                                                                                    className="h-7 bg-white text-xs"
                                                                                    disabled={cancelDisabled}
                                                                                    aria-busy={cancelBusy}
                                                                                >
                                                                                    {cancelBusy ? (
                                                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                                                    ) : null}
                                                                                    {status === "pending_commitment"
                                                                                        ? "Cancel routing"
                                                                                        : "Stop exploring"}
                                                                                </Button>
                                                                            }
                                                                        />
                                                                        <Button
                                                                            size="sm"
                                                                            className="h-7 text-xs"
                                                                            onClick={() =>
                                                                                student.exploration_id
                                                                                    ? createProjectCommitment(
                                                                                          student.exploration_id,
                                                                                          "Team leader requested marketplace commitment confirmation."
                                                                                      )
                                                                                    : undefined
                                                                            }
                                                                            disabled={
                                                                                commitmentDisabled
                                                                            }
                                                                            aria-busy={busy}
                                                                        >
                                                                            {busy ? (
                                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                                            ) : null}
                                                                            {commitmentLabel}
                                                                        </Button>
                                                                    </div>
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                    <div className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-3">
                                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                             <div>
                                                                 <p className="text-sm font-medium text-slate-800">
                                                                     Commitment roster proposal
                                                                 </p>
                                                                 <p className="mt-1 text-xs leading-5 text-slate-600">
                                                                     Propose all mutually confirmed candidates for course routing. Same-course proposals go straight to instructor review; mixed or no-course proposals go to staff routing.
                                                                 </p>
                                                             </div>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-8 w-full text-xs sm:w-auto"
                                                                onClick={handleConfirmCommitmentRoster}
                                                                disabled={
                                                                    !selectedTeamCanConfirmRoster ||
                                                                    actionLoading ===
                                                                        `confirm-roster-${selectedTeam.team_id}`
                                                                }
                                                                aria-busy={
                                                                    actionLoading ===
                                                                    `confirm-roster-${selectedTeam.team_id}`
                                                                }
                                                            >
                                                                {actionLoading ===
                                                                `confirm-roster-${selectedTeam.team_id}` ? (
                                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                                 ) : null}
                                                                 {selectedTeamRosterAlreadyConfirmed ? (
                                                                     "Proposal sent"
                                                                 ) : selectedTeamMutuallyConfirmedCandidates.length === 0 ? (
                                                                     "Need confirmations"
                                                                 ) : (
                                                                     "Send roster proposal"
                                                                 )}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        {selectedTeam.is_leader && (
                                            <div>
                                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                                                    Pending invitations
                                                </h3>
                                                {teamInviteListLoading ? (
                                                    <p className="text-sm text-slate-600">
                                                        Loading pending invites...
                                                    </p>
                                                ) : teamInviteListError ? (
                                                    <p className="text-sm text-red-600">
                                                        {teamInviteListError}
                                                    </p>
                                                ) : teamInviteList.length === 0 ? (
                                                    <p className="text-sm text-slate-500">
                                                        No pending invites.
                                                    </p>
                                                ) : (
                                                    <ul className="space-y-2">
                                                        {teamInviteList.map((invite) => {
                                                            const inviteeEmail =
                                                                invite.invitee?.email ??
                                                                `User #${invite.user_fk}`;
                                                            const inviteAcceptancePaused =
                                                                selectedProjectIsFinalization ||
                                                                selectedProjectStatus === "pending_review" ||
                                                                selectedProjectStatus ===
                                                                    "pending_admin_course_routing";
                                                            return (
                                                                <li
                                                                    key={invite.invite_id}
                                                                    className="flex flex-col gap-2 rounded border border-slate-100 bg-slate-50 p-2 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between"
                                                                >
                                                                    <span className="min-w-0 flex-1">
                                                                        <span className="block [overflow-wrap:anywhere]">
                                                                            {inviteeEmail}
                                                                        </span>
                                                                        {inviteAcceptancePaused && (
                                                                            <span className="block text-xs text-amber-700">
                                                                                {selectedProjectIsFinalization
                                                                                    ? "Accepting is unavailable while this project is in finalization."
                                                                                    : "Accepting is temporarily unavailable during review."}
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                    <ConfirmActionDialog
                                                                        title="Revoke pending invitation?"
                                                                        description={
                                                                            <>
                                                                                This withdraws the invitation sent to{" "}
                                                                                <span className="font-medium text-slate-800">
                                                                                    {inviteeEmail}
                                                                                </span>
                                                                                . They will no longer be able to accept it. You can invite them again later.
                                                                            </>
                                                                        }
                                                                        confirmLabel="Revoke invitation"
                                                                        tone="destructive"
                                                                        onConfirm={() =>
                                                                            handleRevokeTeamInvite(
                                                                                invite.invite_id
                                                                            )
                                                                        }
                                                                        trigger={
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                disabled={
                                                                                    revokingInviteId ===
                                                                                    invite.invite_id
                                                                                }
                                                                                aria-busy={
                                                                                    revokingInviteId ===
                                                                                    invite.invite_id
                                                                                }
                                                                                className="h-7 shrink-0 self-end text-xs sm:self-auto"
                                                                            >
                                                                                {revokingInviteId ===
                                                                                invite.invite_id ? (
                                                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                                                ) : null}
                                                                                Revoke
                                                                            </Button>
                                                                        }
                                                                    />
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog
                open={!!acceptTarget}
                onOpenChange={(open) => {
                    if (!open) {
                        setAcceptTarget(null);
                        setAcceptInterestError("");
                    }
                }}
            >
                <DialogContent className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>Start exploration</DialogTitle>
                        <DialogDescription>
                            {getAcceptDialogDescription()}
                        </DialogDescription>
                    </DialogHeader>
                    {acceptTarget?.email && (
                        <div className="space-y-1 text-sm text-slate-700">
                            <p>Student: {acceptTarget.email}</p>
                            {acceptTarget.courseLabel && (
                                <p>Course: {acceptTarget.courseLabel}</p>
                            )}
                        </div>
                    )}
                    {acceptInterestError && (
                        <p className="text-sm text-red-600">{acceptInterestError}</p>
                    )}
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setAcceptTarget(null);
                                setAcceptInterestError("");
                            }}
                            disabled={
                                !!acceptTarget &&
                                actionLoading ===
                                    `accept-${acceptTarget.studentId}`
                            }
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => {
                                if (!acceptTarget) return;
                                handleAcceptStudent(
                                    acceptTarget.studentId,
                                    acceptTarget.teamId
                                );
                            }}
                            disabled={
                                !!acceptTarget &&
                                actionLoading ===
                                    `accept-${acceptTarget.studentId}`
                            }
                        >
                            {!!acceptTarget &&
                            actionLoading === `accept-${acceptTarget.studentId}` ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : null}
                            Start exploration
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={!!inviteAcceptTarget}
                onOpenChange={(open) => {
                    if (!open) {
                        setInviteAcceptTarget(null);
                        setInviteAcceptError("");
                    }
                }}
            >
                <DialogContent className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>Accept team invitation</DialogTitle>
                        <DialogDescription>
                            {userHasCourse
                                ? "Accepting this invite moves you into marketplace exploration with this team. You can commit later when both sides are ready."
                                : "Accepting this invite starts marketplace exploration. Staff routing happens only after final commitment."}
                        </DialogDescription>
                    </DialogHeader>
                    {inviteAcceptTarget?.capstoneTitle && (
                        <p className="text-sm text-slate-700">
                            Capstone: {inviteAcceptTarget.capstoneTitle}
                        </p>
                    )}
                    {inviteAcceptError && (
                        <p className="text-sm text-red-600">{inviteAcceptError}</p>
                    )}
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setInviteAcceptTarget(null);
                                setInviteAcceptError("");
                            }}
                            disabled={
                                !!inviteAcceptTarget &&
                                actionLoading ===
                                    `accept-invite-${inviteAcceptTarget.inviteId}`
                            }
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirmAcceptInvite}
                            disabled={
                                !!inviteAcceptTarget &&
                                actionLoading ===
                                    `accept-invite-${inviteAcceptTarget.inviteId}`
                            }
                        >
                            {!!inviteAcceptTarget &&
                            actionLoading ===
                                `accept-invite-${inviteAcceptTarget.inviteId}` ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : null}
                            Accept invitation
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={isReassignOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        setIsReassignOpen(false);
                        setReassignError("");
                    }
                }}
            >
                <DialogContent className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>Reassign team leader</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="reassign-team-leader">Select teammate</Label>
                        <select
                            id="reassign-team-leader"
                            value={reassignChoice}
                            onChange={(event) =>
                                setReassignChoice(event.target.value)
                            }
                            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                        >
                            <option value="">Choose teammate</option>
                            {(selectedTeam?.team_members || [])
                                .filter((member) => !isCurrentUserId(member.user_id))
                                .map((member, index) => (
                                    <option
                                        key={member.user_id}
                                        value={String(index + 1)}
                                    >
                                        {member.email}
                                    </option>
                                ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <Label>Reason <span className="font-normal text-slate-500">(optional)</span></Label>
                        <Input
                            value={reassignReason}
                            onChange={(event) =>
                                setReassignReason(event.target.value)
                            }
                            placeholder="Optional reason"
                        />
                    </div>
                    {reassignError && (
                        <p className="text-sm text-red-600">{reassignError}</p>
                    )}
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsReassignOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleConfirmReassignLeadership}>
                            Reassign
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={showWithdrawReviewModal}
                onOpenChange={(open) => {
                    if (!open) {
                        setShowWithdrawReviewModal(false);
                    }
                }}
            >
                <DialogContent className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>Reopen capstone for edits</DialogTitle>
                        <DialogDescription>
                            This closes the project to new student interest and lets your
                            team edit the capstone again. You will need to resubmit when
                            the team is ready.
                        </DialogDescription>
                    </DialogHeader>
                    {withdrawReviewError && (
                        <p className="text-sm text-red-600">{withdrawReviewError}</p>
                    )}
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowWithdrawReviewModal(false)}
                            disabled={withdrawReviewLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleWithdrawReview}
                            disabled={withdrawReviewLoading}
                        >
                            {withdrawReviewLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : null}
                            Reopen for edits
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={showAbandonProjectModal}
                onOpenChange={(open) => {
                    if (!open) {
                        setShowAbandonProjectModal(false);
                        setAbandonProjectError("");
                    }
                }}
            >
                <DialogContent className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>Abandon project</DialogTitle>
                        <DialogDescription>
                            This archives your solo project and clears your team membership so you can explore or commit to another project. During finalization, only an instructor or admin can disband a project.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedTeam?.project?.title && (
                        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                            {selectedTeam.project.title}
                        </p>
                    )}
                    {abandonProjectError && (
                        <p className="text-sm text-red-600">{abandonProjectError}</p>
                    )}
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowAbandonProjectModal(false);
                                setAbandonProjectError("");
                            }}
                            disabled={actionLoading === "abandon-project"}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAbandonProject}
                            disabled={actionLoading === "abandon-project"}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {actionLoading === "abandon-project" ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : null}
                            Abandon project
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(rejectTarget)}
                onOpenChange={(open) => {
                    if (!open) {
                        setRejectTarget(null);
                        setRejectReason("");
                        setRejectError("");
                    }
                }}
            >
                <DialogContent className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>Decline join request</DialogTitle>
                        <DialogDescription>
                            This only declines marketplace exploration for this project. Staff or instructors can still make course and approval decisions later.
                        </DialogDescription>
                    </DialogHeader>
                    {rejectTarget?.email && (
                        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                            {rejectTarget.email}
                        </p>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="reject-interest-reason">Reason</Label>
                        <Textarea
                            id="reject-interest-reason"
                            value={rejectReason}
                            onChange={(event) => {
                                setRejectReason(event.target.value);
                                if (rejectError) setRejectError("");
                            }}
                            placeholder="Briefly note why this student is not moving into exploration."
                            rows={3}
                        />
                    </div>
                    {rejectError && (
                        <p className="text-sm text-red-600">{rejectError}</p>
                    )}
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setRejectTarget(null);
                                setRejectReason("");
                                setRejectError("");
                            }}
                            disabled={
                                rejectTarget
                                    ? actionLoading === `reject-${rejectTarget.studentId}`
                                    : false
                            }
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleRejectStudent}
                            disabled={
                                !rejectReason.trim() ||
                                (rejectTarget
                                    ? actionLoading === `reject-${rejectTarget.studentId}`
                                    : false)
                            }
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {rejectTarget &&
                            actionLoading === `reject-${rejectTarget.studentId}` ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : null}
                            Decline request
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={showFinalizeModal}
                onOpenChange={(open) => {
                    if (!open) {
                        setShowFinalizeModal(false);
                        setFinalizeError("");
                    }
                }}
            >
                <DialogContent className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>Finalize team</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-slate-600">
                        This closes recruiting after required routing and review
                        have cleared. Students cannot reopen recruiting, change
                        membership, or undo finalization afterward. An instructor
                        or admin must disband the team to reverse it.
                    </p>
                    {teamContext ? (
                        <FinalizationReadiness readiness={teamContext.readiness} />
                    ) : teamContextLoading ? (
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading finalization readiness...
                        </div>
                    ) : null}
                    {finalizeSupportMissing && (
                        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                            This course requires an accepted mentor or confirmed external partner before finalization.
                        </p>
                    )}
                    {finalizeError && (
                        <p className="text-sm text-red-600">{finalizeError}</p>
                    )}
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowFinalizeModal(false)}
                            disabled={finalizeLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleFinalizeTeam}
                            disabled={finalizeLoading}
                            className="bg-emerald-600 hover:bg-emerald-700"
                        >
                            {finalizeLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : null}
                            Finalize
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Invite Teammate Modal */}
            <Dialog
                open={showInviteModal}
                onOpenChange={handleCloseInviteModal}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogTitle>Invite teammate</DialogTitle>
                    <div className="space-y-4 pt-4">
                        {selectedTeamIsRecruiting && (
                            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                Invited students can accept or decline from their
                                Home.
                            </p>
                        )}
                        {!selectedProjectAllowsNewExploration && (
                            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                Team invites are paused because this project is outside its marketplace exploration phase.
                            </p>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <Input
                                id="email"
                                type="email"
                                value={inviteEmail}
                                onChange={(e) => {
                                    setInviteEmail(e.target.value);
                                    setEmailError("");
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        handleInviteSubmit();
                                    }
                                }}
                                placeholder="student@uwaterloo.ca"
                            />
                            {emailError && (
                                <p className="text-sm text-red-600">
                                    {emailError}
                                </p>
                            )}
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={handleCloseInviteModal}
                                disabled={inviteLoading}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="default"
                                onClick={handleInviteSubmit}
                                disabled={inviteLoading}
                                aria-busy={inviteLoading}
                            >
                                {inviteLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : null}
                                Send invitation
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <StudentProfileDialog
                student={profileStudent}
                open={profileStudent !== null}
                onOpenChange={(open) => {
                    if (!open) setProfileStudent(null);
                }}
            />
        </PageShell>
    );
}
