"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Loader2, Crown, UserPlus } from "lucide-react";
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
    finalizeTeam,
    inviteTeammate,
    reassignLeader,
    revokeInvite,
    type TeamPendingInvite,
} from "@/services/teams.service";
import {
    fetchStudentProfileById,
    type StudentProfile,
} from "@/services/users.service";
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

function profileList(values?: string[] | null): string[] {
    return Array.isArray(values) ? values.filter(Boolean) : [];
}

function profileLinks(profile: StudentProfile | null) {
    if (!profile) return [];
    return [
        { label: "Portfolio", href: profile.portfolio_url },
        { label: "LinkedIn", href: profile.linkedin_url },
        { label: "GitHub", href: profile.github_url },
    ].filter((link): link is { label: string; href: string } => Boolean(link.href));
}

function hasProfileContent(profile: StudentProfile | null): boolean {
    if (!profile) return false;
    return Boolean(
        profile.headline ||
            profile.about_me ||
            profile.availability ||
            profileList(profile.skills).length ||
            profileList(profile.preferred_roles).length ||
            profileList(profile.project_interests).length ||
            (profile.interested_departments || []).length ||
            profileLinks(profile).length
    );
}

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

type ReadinessItem = {
    label: string;
    ready: boolean;
    detail: string;
};

function FinalizationReadinessChecklist({ items }: { items: ReadinessItem[] }) {
    if (items.length === 0) return null;
    const readyCount = items.filter((item) => item.ready).length;
    return (
        <div className="rounded border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Finalization Readiness
                </h3>
                <span className="text-xs text-slate-500">
                    {readyCount}/{items.length} ready
                </span>
            </div>
            <ul className="mt-3 space-y-2">
                {items.map((item) => (
                    <li key={item.label} className="flex gap-2 text-sm">
                        <span
                            className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                                item.ready ? "bg-emerald-500" : "bg-amber-400"
                            }`}
                            aria-hidden="true"
                        />
                        <div>
                            <p className="font-medium text-slate-800">{item.label}</p>
                            <p className="text-xs text-slate-600">{item.detail}</p>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
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
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState("");
    const [emailError, setEmailError] = useState("");
    const [inviteLoading, setInviteLoading] = useState(false);
    const [showStudentProfileModal, setShowStudentProfileModal] =
        useState(false);
    const [selectedStudentProfile, setSelectedStudentProfile] =
        useState<StudentProfile | null>(null);
    const [selectedStudentEmail, setSelectedStudentEmail] = useState("");
    const [loadingStudentProfile, setLoadingStudentProfile] = useState(false);
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
    const scrollContainerRef = useRef<HTMLDivElement>(null);

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
        const normalized = (status || "").toLowerCase();
        const labels: Record<string, string> = {
            draft: "Draft",
            approved_recruiting: "Approved - Recruiting",
            pending_review: "Awaiting Instructor Review",
            pending_admin_course_routing: "Awaiting Course Routing",
            approved: "Finalized",
            complete: "Complete",
            rejected: "Rejected",
            changes_requested: "Changes Requested",
        };
        return labels[normalized] || "In Review";
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
            interested: "Request Sent",
            invited: "Invited",
            exploring: "Exploring",
            pending_commitment: "Awaiting Staff Routing",
            withdrawn: "Withdrawn",
            declined: "Declined",
            not_selected: "Not Selected",
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

    const handleViewStudentProfile = async (userId: string, email: string) => {
        setShowStudentProfileModal(true);
        setSelectedStudentEmail(email);
        setLoadingStudentProfile(true);
        setSelectedStudentProfile(null);

        try {
            const profile = await fetchStudentProfileById(userId);
            setSelectedStudentProfile(profile);
        } catch (error) {
            console.error("Failed to load student profile:", error);
        } finally {
            setLoadingStudentProfile(false);
        }
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
            await loadMentorDataForTeam(selectedTeam);
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
            await loadMentorDataForTeam(selectedTeam);
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
            await loadMentorDataForTeam(selectedTeam);
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
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
            </div>
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
    const acceptedMentor = mentorSupportSummary?.accepted_mentor;
    const pendingMentorRequests = mentorRequests.filter(
        (request) =>
            request.status === "pending" && request.request_source !== "mentor_offer"
    );
    const pendingMentorOffers = mentorRequests.filter(
        (request) =>
            request.status === "pending" && request.request_source === "mentor_offer"
    );
    const blockedMentorIds = new Set(
        mentorRequests
            .filter((request) => request.status === "pending" || request.status === "accepted")
            .map((request) => Number(request.mentor_fk))
    );
    const availableMentors = mentorOptions.filter(
        (mentor) => !blockedMentorIds.has(Number(mentor.user_id))
    );
    const finalizeSupportMissing =
        mentorSupportSummary?.requires_project_support !== false &&
        mentorSupportSummary?.has_support !== true;
    const selectedTeamPendingRoutingCount = selectedTeam
        ? pendingCommitments.filter(
              (request) => Number(request.team_fk) === Number(selectedTeam.team_id)
          ).length +
          (selectedTeam.exploring_students || []).filter(
              (student) => (student.status || "").toLowerCase() === "pending_commitment"
          ).length
        : 0;
    const selectedTeamUnresolvedConfirmedExplorations = (
        selectedTeam?.exploring_students || []
    ).filter((student) => {
        const status = (student.status || "exploring").toLowerCase();
        return (
            ["exploring", "pending_commitment"].includes(status) &&
            hasStudentCommitmentConfirmation(student) &&
            hasTeamCommitmentConfirmation(student)
        );
    });
    const selectedTeamLeaderLooksValid = Boolean(
        selectedTeam &&
            selectedTeam.team_members.length > 0 &&
            (selectedTeam.leader_fk || selectedTeam.is_leader)
    );
    const selectedTeamEnrollmentLooksValid = Boolean(
        selectedTeam &&
            selectedTeam.team_members.length > 0 &&
            selectedTeam.team_members.every((member) => {
                const courseId =
                    member.enrollment_course?.course_id ??
                    member.enrollment_course_fk ??
                    member.course?.course_id ??
                    member.course_fk;
                const course = member.enrollment_course || member.course;
                return Boolean(courseId) &&
                    course?.active !== false &&
                    (
                        course?.active_instructor_count === undefined ||
                        Number(course.active_instructor_count) > 0
                    );
            })
    );
    const finalizationReadinessItems: ReadinessItem[] =
        selectedTeam?.is_leader && selectedTeam.project
            ? [
                  {
                      label: "Capstone approved for recruiting",
                      ready: selectedTeamIsRecruiting,
                      detail: selectedTeamIsRecruiting
                          ? "Instructor review has approved this project for recruiting."
                          : "Only approved recruiting projects can be finalized.",
                  },
                  {
                      label: "Required support satisfied",
                      ready: !finalizeSupportMissing,
                      detail: mentorDataLoading
                          ? "Checking mentor and external partner support..."
                          : !finalizeSupportMissing
                            ? "Mentor/external partner support is attached or not required."
                            : "Attach an accepted mentor or confirmed external partner first.",
                  },
                  {
                      label: "No pending staff routing",
                      ready: selectedTeamPendingRoutingCount === 0,
                      detail:
                          selectedTeamPendingRoutingCount === 0
                              ? "No final commitment routing is waiting on staff."
                              : `${selectedTeamPendingRoutingCount} commitment routing item${selectedTeamPendingRoutingCount === 1 ? "" : "s"} must be resolved first.`,
                  },
                  {
                      label: "No unresolved confirmed explorations",
                      ready: selectedTeamUnresolvedConfirmedExplorations.length === 0,
                      detail:
                          selectedTeamUnresolvedConfirmedExplorations.length === 0
                              ? "No mutually confirmed exploration is still awaiting commitment resolution."
                              : "Resolve mutually confirmed explorations before finalizing.",
                  },
                  {
                      label: "Team identity valid",
                      ready: selectedTeamLeaderLooksValid,
                      detail: selectedTeamLeaderLooksValid
                          ? "The team has confirmed members and a leader."
                          : "A finalized team needs at least one member and a leader.",
                  },
                  {
                      label: "Official enrollment recorded",
                      ready: selectedTeamEnrollmentLooksValid,
                      detail: selectedTeamEnrollmentLooksValid
                          ? "Every official member has an enrollment course recorded."
                          : "Every official member needs an active staffed enrollment course before finalization.",
                  },
              ]
            : [];

    return (
        <div className="min-h-full bg-slate-50 px-2 py-4 sm:px-4">
            {/* Header */}
            <div className="mx-auto mb-4 flex w-full max-w-6xl flex-col gap-2">
                <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                    Student Dashboard
                </h1>
                <p className="text-sm text-slate-500">
                    Track your team, invitations, and capstone review status.
                </p>
            </div>

            {/* Content */}
            <div className="relative">
                {/* top fade */}
                <div className="absolute top-0 left-0 w-full h-4 bg-gradient-to-b from-slate-50 to-transparent z-10 pointer-events-none" />

                <div
                    ref={scrollContainerRef}
                    className="py-2 scrollbar-none"
                >
                    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
                        {teamActionError && (
                            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {teamActionError}
                            </div>
                        )}
                        {courseSetupMessage && (
                            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                    <p className="min-w-0 break-words">{courseSetupMessage}</p>
                                </div>
                            </div>
                        )}
                        {false && (savedPastLoading || savedPastError || savedPastCapstones.length > 0) && (
                            <section className="mb-2">
                                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <h2 className="text-xl font-semibold text-slate-900">
                                            Saved Inspiration
                                        </h2>
                                        <p className="text-sm text-slate-500">
                                            Historical bookmarks are separate from project interest and team commitment.
                                        </p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => router.push("/past-capstones")}
                                        className="w-full sm:w-auto"
                                    >
                                        Browse Past Capstones
                                    </Button>
                                </div>
                                {savedPastError && (
                                    <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                        {savedPastError}
                                    </div>
                                )}
                                {savedPastLoading ? (
                                    <div className="flex items-center gap-2 text-sm text-slate-500">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Loading saved capstones...
                                    </div>
                                ) : savedPastCapstones.length > 0 ? (
                                    <div className="grid gap-3 md:grid-cols-2">
                                        {savedPastCapstones.map((capstone) => (
                                            <Card
                                                key={`${capstone.source_type}-${capstone.source_id || capstone.id}`}
                                                className="cursor-pointer gap-0 rounded-lg border border-slate-200 bg-white p-0 shadow-sm transition hover:border-slate-300 hover:shadow-md"
                                                onClick={() => router.push("/past-capstones")}
                                            >
                                                <div className="flex flex-col gap-3 p-4">
                                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                        <CardTitle className="min-w-0 break-words text-base leading-snug text-slate-900">
                                                            {capstone.title}
                                                        </CardTitle>
                                                        <span className="w-fit shrink-0 rounded border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                                                            {getSavedPastSourceLabel(capstone)}
                                                        </span>
                                                    </div>
                                                    <p className="line-clamp-2 text-sm leading-6 text-slate-600">
                                                        {capstone.description}
                                                    </p>
                                                    <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                                                        <span className="rounded bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                                                            {capstone.completed_term || capstone.year}
                                                        </span>
                                                        {(capstone.department || []).slice(0, 2).map((department) => (
                                                            <span
                                                                key={department}
                                                                className="max-w-full break-words rounded bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                                                            >
                                                                {department}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                ) : null}
                            </section>
                        )}
                        {/* CASE 1 & 3: USER HAS TEAM(S) */}
                        {hasTeams &&
                            teams.map((teamData, index) => (
                                <Card
                                    key={teamData.team_id}
                                    className="w-full cursor-pointer border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md"
                                    onClick={() => setSelectedTeam(teamData)}
                                >
                                    <div className="flex flex-col gap-4 p-4 sm:p-6">
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                            <CardTitle className="min-w-0 text-lg leading-snug text-slate-900 sm:text-xl">
                                                {teamData.project
                                                    ? teamData.project.title
                                                    : `Team ${index + 1}`}
                                            </CardTitle>
                                            {teamData.project && (
                                                <span
                                                    className={`shrink-0 rounded border px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(
                                                        teamData.project.status
                                                    )}`}
                                                >
                                                    {getStatusLabel(teamData.project.status)}
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-sm leading-6 text-slate-600 line-clamp-4 sm:line-clamp-3">
                                            {teamData.project
                                                ? teamData.project.description
                                                : "This team doesn't have a capstone project yet."}
                                        </p>

                                        <div className="flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="rounded bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                                                    {
                                                        teamData.team_members
                                                            .length
                                                    }{" "}
                                                    member
                                                    {teamData.team_members
                                                        .length !== 1
                                                        ? "s"
                                                        : ""}
                                                </span>
                                                {teamData.is_leader && (
                                                    <span className="rounded bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
                                                        Leader
                                                    </span>
                                                )}
                                                {teamData.is_leader &&
                                                    teamData.interested_students
                                                        .length > 0 && (
                                                        <span className="rounded bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
                                                                {
                                                                    teamData
                                                                        .interested_students
                                                                        .length
                                                                }{" "}
                                                                pending
                                                        </span>
                                                    )}
                                            </div>
                                            <span className="text-xs font-medium text-slate-500">
                                                Open details
                                            </span>
                                        </div>
                                    </div>
                                </Card>
                            ))}

                        {/* CASE 2: USER HAS MARKETPLACE EXPLORATIONS */}
                        {!hasTeams && (hasMarketplaceCards || pendingCommitments.length > 0 || resolvedMarketplaceCards.length > 0) && (
                            <>
                                <div className="mt-6 mb-3">
                                    <h2 className="text-xl font-semibold text-slate-900">
                                        Marketplace Exploration
                                    </h2>
                                    <p className="text-sm text-slate-500 mt-1">
                                        Explore multiple projects, then commit to one when you and the team are ready. Current phase: {marketplacePhase}.
                                    </p>
                                </div>

                                {pendingCommitments.map((request) => (
                                    <Card
                                        key={`commitment-${request.commitment_request_id}`}
                                        className="w-full border border-amber-200 bg-white shadow-sm"
                                    >
                                        <div className="flex flex-col gap-4 p-4 sm:p-6">
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                <CardTitle className="min-w-0 text-lg leading-snug text-slate-900 sm:text-xl">
                                                    Commitment request pending
                                                </CardTitle>
                                                <span className="shrink-0 rounded border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                                    Awaiting Staff Routing
                                                </span>
                                            </div>
                                            <p className="text-sm leading-6 text-slate-600 line-clamp-4 sm:line-clamp-3">
                                                Staff will route this commitment to an active staffed capstone course.
                                            </p>
                                            {request.comments && (
                                                <p className="rounded border border-slate-100 bg-slate-50 px-3 py-2 text-xs italic text-slate-500 line-clamp-2">
                                                    Note: {request.comments}
                                                </p>
                                            )}
                                        </div>
                                    </Card>
                                ))}

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
                                        (studentConfirmed && !teamConfirmed) ||
                                        actionLoading ===
                                            `commit-exploration-${exploration.exploration_id}`;
                                    const commitmentDescription =
                                        status === "pending_commitment"
                                            ? "Both sides confirmed. Staff course routing is pending."
                                            : status === "committed"
                                            ? "Your commitment has been approved."
                                            : status === "exploring" && studentConfirmed && !teamConfirmed
                                            ? "You confirmed commitment. Waiting for the team."
                                            : status === "exploring" && teamConfirmed && !studentConfirmed
                                            ? "The team confirmed commitment. Confirm when you are ready."
                                            : status === "exploring"
                                            ? "You and the team are exploring fit."
                                            : status === "invited"
                                            ? "This team invited you to explore."
                                            : "No final commitment yet.";
                                    const commitmentButtonLabel = explorationIsFinalization
                                        ? "Finalization"
                                        : pendingCommitments.length > 0
                                        ? "Staff Routing Pending"
                                        : studentConfirmed && !teamConfirmed
                                        ? "Waiting for Team"
                                        : "Confirm Commitment";
                                    return (
                                    <Card
                                        key={`${exploration.capstone_fk}-${exploration.status}`}
                                        className="w-full border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md"
                                    >
                                        <div className="flex flex-col gap-4 p-4 sm:p-6">
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                <CardTitle className="min-w-0 text-lg leading-snug text-slate-900 sm:text-xl">
                                                    {title}
                                                </CardTitle>
                                                <span className={`shrink-0 rounded border px-2.5 py-1 text-xs font-semibold ${getExplorationStatusClass(status)}`}>
                                                    {getExplorationStatusLabel(status)}
                                                </span>
                                            </div>

                                            <p className="text-sm leading-6 text-slate-600 line-clamp-4 sm:line-clamp-3">
                                                {description}
                                            </p>
                                            {exploration.message && (
                                                <p className="rounded border border-slate-100 bg-slate-50 px-3 py-2 text-xs italic text-slate-500 line-clamp-2">
                                                    Your note: {exploration.message}
                                                </p>
                                            )}
                                            <div className="flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                                                <CardDescription className="text-xs">
                                                    {commitmentDescription}
                                                </CardDescription>
                                                <div className="flex flex-col gap-2 sm:flex-row">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            withdrawInterest(String(capstoneId));
                                                        }}
                                                        disabled={
                                                            status === "committed" ||
                                                            actionLoading ===
                                                            `withdraw-${capstoneId}`
                                                        }
                                                        className="h-8 w-full text-xs sm:w-auto"
                                                    >
                                                        {actionLoading ===
                                                        `withdraw-${capstoneId}` ? (
                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                        ) : (
                                                            "Withdraw"
                                                        )}
                                                    </Button>
                                                    {canShowCommit && (
                                                        <Button
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                createProjectCommitment(
                                                                    Number(exploration.exploration_id),
                                                                    "Student requested final project commitment."
                                                                );
                                                            }}
                                                            disabled={
                                                                commitDisabled
                                                            }
                                                            className="h-8 w-full text-xs sm:w-auto"
                                                        >
                                                            {actionLoading ===
                                                            `commit-exploration-${exploration.exploration_id}` ? (
                                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                            ) : (
                                                                commitmentButtonLabel
                                                            )}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                    );
                                })}
                                {resolvedMarketplaceCards.length > 0 && (
                                    <details className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm">
                                        <summary className="cursor-pointer font-medium text-slate-700">
                                            Show resolved marketplace history ({resolvedMarketplaceCards.length})
                                        </summary>
                                        <div className="mt-3 space-y-2">
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
                                                        <span className={`w-fit rounded border px-2 py-0.5 text-xs font-medium ${getExplorationStatusClass(status)}`}>
                                                            {getExplorationStatusLabel(status)}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </details>
                                )}
                            </>
                        )}

                        {/* TEAM INVITES SECTION */}
                        {hasInvites && (
                            <>
                                <div className="mt-6 mb-3">
                                    <h2 className="text-xl font-semibold text-slate-900">
                                        Team Invitations
                                    </h2>
                                    <p className="text-sm text-slate-500 mt-1">
                                        You've been invited to join these teams
                                    </p>
                                </div>
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
                                    <Card
                                        key={invite.invite_id}
                                        className="w-full border border-blue-200 bg-white shadow-sm transition hover:border-blue-300 hover:shadow-md"
                                    >
                                        <div className="flex flex-col gap-4 p-4 sm:p-6">
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                <CardTitle className="min-w-0 text-lg leading-snug text-slate-900 sm:text-xl">
                                                    {capstone?.title
                                                        ? capstone.title
                                                        : `Team ${invite.team_fk} (No capstone yet)`}
                                                </CardTitle>
                                                {capstone?.status ? (
                                                    <span
                                                        className={`shrink-0 rounded border px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(
                                                            capstone.status
                                                        )}`}
                                                    >
                                                        {getStatusLabel(capstone.status)}
                                                    </span>
                                                ) : (
                                                    <span className="shrink-0 rounded bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                                        Team Forming
                                                    </span>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <p className="text-sm leading-6 text-slate-600 line-clamp-4 sm:line-clamp-3">
                                                    {capstone?.description ||
                                                        "This team has not submitted a capstone yet."}
                                                </p>
                                                {acceptanceBlockedReason && (
                                                    <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                                        {acceptanceBlockedReason} You can decline now or accept later.
                                                    </p>
                                                )}
                                            </div>

                                            <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:justify-end">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        declineInvite(
                                                            invite.invite_id
                                                        );
                                                    }}
                                                    disabled={
                                                        inviteBusy
                                                    }
                                                    className="h-8 w-full text-xs sm:w-auto"
                                                >
                                                    {actionLoading ===
                                                    `decline-${invite.invite_id}` ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                    ) : (
                                                        "Decline"
                                                    )}
                                                </Button>
                                                <Button
                                                    variant="default"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
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
                                                    className="h-8 w-full text-xs sm:w-auto"
                                                >
                                                    {actionLoading ===
                                                    `accept-invite-${invite.invite_id}` ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                    ) : (
                                                        "Accept"
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </Card>
                                    );
                                })}
                            </>
                        )}

                        {/* CASE 4: NO TEAM AND NO INTERESTS AND NO INVITES */}
                        {!hasTeams && !hasPendingInterests && !hasMarketplaceCards && !hasInvites && pendingCommitments.length === 0 && (
                            <Card className="w-full border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-12">
                                <p className="mb-2 text-base text-slate-600 sm:text-lg">
                                    You haven't joined any team or expressed
                                    interest in any projects yet.
                                </p>
                                <p className="text-slate-400">
                                    {!userHasCourse
                                        ? "Browse available projects and express interest. An advisor can assign your course if a team accepts you."
                                        : userCourseInactive
                                        ? "Browse available projects and submit a course request before creating a course-owned team."
                                        : "Browse available projects and express your interest to join a team!"}
                                </p>
                                <div className="mt-4 flex justify-center">
                                    <Button
                                        onClick={async () => {
                                            if (!canUseCourseFlows) {
                                                return;
                                            }
                                            const result =
                                                await createEmptyTeam();
                                            if (!result?.success) {
                                                console.error(
                                                    "Failed to create empty team"
                                                );
                                            }
                                        }}
                                        disabled={
                                            actionLoading === "create-team" ||
                                            !canUseCourseFlows
                                        }
                                        title={
                                            canUseCourseFlows
                                                ? undefined
                                                : userHasCourse
                                                ? "Active course assignment required"
                                                : "Course assignment required"
                                        }
                                        className="w-full sm:w-auto"
                                    >
                                        {actionLoading === "create-team"
                                            ? "Creating Team..."
                                            : "Create Team Without Capstone"}
                                    </Button>
                                </div>
                            </Card>
                        )}
                    </div>
                </div>

                {/* bottom fade */}
                <div className="absolute bottom-0 left-0 w-full h-4 bg-gradient-to-t from-slate-50 to-transparent z-10 pointer-events-none" />
            </div>

            {/* Modal for Team Details */}
            <Dialog
                open={!!selectedTeam}
                onOpenChange={(open) => !open && setSelectedTeam(null)}
            >
                <DialogContent
                    className="
                        fixed z-50
                        left-1/2 top-1/2
                        -translate-x-1/2 -translate-y-1/2
                        w-full sm:max-w-5xl
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
                            <div className="p-8 pr-12 border-b border-slate-100 bg-slate-50/50">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <DialogTitle className="break-words text-2xl font-bold leading-tight text-slate-900">
                                                {selectedTeam.project
                                                    ? selectedTeam.project.title
                                                    : `Team ${selectedTeam.team_id}`}
                                            </DialogTitle>
                                        </div>
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
                                                        -{" "}
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
                            <div className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    {/* LEFT COLUMN: Description */}
                                    <div className="md:col-span-2 space-y-6">
                                        <div>
                                            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-3">
                                                About the Project
                                            </h3>
                                            {selectedTeam.project ? (
                                                <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                                                    {
                                                        selectedTeam.project
                                                            .description
                                                    }
                                                </p>
                                            ) : (
                                                <p className="text-yellow-700 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                                                    This team doesn't have a
                                                    capstone project yet.
                                                </p>
                                            )}
                                        </div>

                                        {selectedTeam.project?.status?.toLowerCase() ===
                                            "changes_requested" && (
                                            <div className="space-y-3">
                                                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                                                    Instructor Feedback
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
                                                    Rejection Reason
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
                                                            ? "Draft Submission"
                                                            : "Revise and Resubmit"}
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
                                                            ? "Edit and Submit for Review"
                                                            : "Open Revision Form"}
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
                                                    Finalize Team
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
                                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                    ) : null}
                                                    Reopen for Edits
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
                                                    <UserPlus className="w-4 h-4 mr-2" />
                                                    Invite Teammate
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
                                                                Reassign Leader
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
                                                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                                ) : null}
                                                                Leave Team
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
                                                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                                ) : null}
                                                                Abandon Project
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
                                                Team Members
                                            </h3>
                                            <ul className="space-y-2">
                                                {(() => {
                                                    let leaderUserId =
                                                        selectedTeam.leader_fk;

                                                    if (
                                                        !leaderUserId &&
                                                        selectedTeam.is_leader &&
                                                        Number.isInteger(currentUserId)
                                                    ) {
                                                        leaderUserId = currentUserId;
                                                    }

                                                    const sortedMembers = [
                                                        ...selectedTeam.team_members,
                                                    ].sort((a, b) => {
                                                        const aIsLeader =
                                                            parseInt(
                                                                a.user_id
                                                            ) === leaderUserId;
                                                        const bIsLeader =
                                                            parseInt(
                                                                b.user_id
                                                            ) === leaderUserId;
                                                        if (aIsLeader) return -1;
                                                        if (bIsLeader) return 1;
                                                        return 0;
                                                    });

                                                    return sortedMembers.map(
                                                        (member) => {
                                                            const isCurrentUser =
                                                                isCurrentUserId(
                                                                    member.user_id
                                                                );

                                                            // Convert both to numbers for comparison to avoid type mismatch
                                                            const memberIdNum =
                                                                parseInt(
                                                                    member.user_id
                                                                );
                                                            const leaderIdNum =
                                                                leaderUserId
                                                                    ? parseInt(
                                                                          String(
                                                                              leaderUserId
                                                                          )
                                                                      )
                                                                    : null;
                                                            const isLeaderMember =
                                                                leaderIdNum !==
                                                                    null &&
                                                                memberIdNum ===
                                                                    leaderIdNum;


                                                            return (
                                                                <li
                                                                    key={
                                                                        member.user_id
                                                                    }
                                                                    className="flex items-center justify-between text-sm text-slate-700 bg-slate-50 p-2 rounded border border-slate-100"
                                                                >
                                                                    <div className="flex items-center min-w-0 flex-1">
                                                                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 mr-2 flex-shrink-0">
                                                                            {member.email
                                                                                .charAt(
                                                                                    0
                                                                                )
                                                                                .toUpperCase()}
                                                                        </div>
                                                                        <span className="break-all">
                                                                            {
                                                                                member.email
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                    <p className="ml-2 hidden max-w-[18rem] break-all text-xs text-slate-500 md:block">
                                                                        {getStudentCourseLabel(member)}
                                                                    </p>
                                                                    {isLeaderMember && (
                                                                        <Crown className="w-4 h-4 text-yellow-500 ml-2 flex-shrink-0" />
                                                                    )}
                                                                    {selectedTeam.is_leader &&
                                                                        !selectedTeamIsLocked &&
                                                                        !isCurrentUser && (
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() =>
                                                                                    handleRemoveStudent(
                                                                                        member.user_id,
                                                                                        selectedTeam.team_id
                                                                                    )
                                                                                }
                                                                                disabled={
                                                                                    actionLoading ===
                                                                                    `remove-${member.user_id}`
                                                                                }
                                                                                className="ml-2 h-7 text-xs flex-shrink-0"
                                                                            >
                                                                                {actionLoading ===
                                                                                `remove-${member.user_id}` ? (
                                                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                                                ) : (
                                                                                    "Remove"
                                                                                )}
                                                                            </Button>
                                                                        )}
                                                                </li>
                                                            );
                                                        }
                                                    );
                                                })()}
                                            </ul>
                                        </div>

                                        {selectedTeam.is_leader && selectedTeam.project && (
                                            <div>
                                                <FinalizationReadinessChecklist
                                                    items={finalizationReadinessItems}
                                                />
                                            </div>
                                        )}

                                        {selectedTeam.is_leader && selectedTeam.project && (
                                            <div>
                                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                                                    Project Support
                                                </h3>
                                                <div className="space-y-3 rounded border border-slate-200 bg-slate-50 p-3">
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
                                                            {acceptedMentor ? (
                                                                <div className="rounded border border-emerald-100 bg-emerald-50 p-2 text-sm text-emerald-800">
                                                                    Mentor:{" "}
                                                                    <span className="break-all font-medium">
                                                                        {acceptedMentor.mentor_email ||
                                                                            `Mentor #${acceptedMentor.mentor_fk}`}
                                                                    </span>
                                                                </div>
                                                            ) : mentorSupportSummary?.external_partner_support_confirmed ? (
                                                                <div className="rounded border border-emerald-100 bg-emerald-50 p-2 text-sm text-emerald-800">
                                                                    External partner support confirmed.
                                                                </div>
                                                            ) : mentorSupportSummary?.requires_project_support === false ? (
                                                                <div className="rounded border border-slate-200 bg-white p-2 text-sm text-slate-600">
                                                                    This course does not require mentor or partner support before finalization.
                                                                </div>
                                                            ) : (
                                                                <div className="rounded border border-amber-100 bg-amber-50 p-2 text-sm text-amber-800">
                                                                    Finalization requires an accepted mentor or confirmed external partner.
                                                                </div>
                                                            )}

                                                            {pendingMentorRequests.length > 0 && (
                                                                <div className="space-y-2">
                                                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                                        Pending Requests
                                                                    </p>
                                                                    {pendingMentorRequests.map((request) => (
                                                                        <div
                                                                            key={request.mentor_request_id}
                                                                            className="rounded border border-slate-200 bg-white p-2 text-sm"
                                                                        >
                                                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                                                <span className="break-all text-slate-700">
                                                                                    {request.mentor?.email ||
                                                                                        `Mentor #${request.mentor_fk}`}
                                                                                </span>
                                                                                <Button
                                                                                    variant="outline"
                                                                                    size="sm"
                                                                                    className="h-7 text-xs"
                                                                                    onClick={() =>
                                                                                        handleCancelMentorRequest(
                                                                                            request
                                                                                        )
                                                                                    }
                                                                                    disabled={
                                                                                        mentorActionLoading ===
                                                                                        `cancel-mentor-${request.mentor_request_id}`
                                                                                    }
                                                                                >
                                                                                    {mentorActionLoading ===
                                                                                    `cancel-mentor-${request.mentor_request_id}` ? (
                                                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                                                    ) : (
                                                                                        "Cancel"
                                                                                    )}
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {pendingMentorOffers.length > 0 && (
                                                                <div className="space-y-2">
                                                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                                        Mentor Offers
                                                                    </p>
                                                                    {pendingMentorOffers.map((request) => (
                                                                        <div
                                                                            key={request.mentor_request_id}
                                                                            className="rounded border border-blue-100 bg-blue-50 p-2 text-sm"
                                                                        >
                                                                            <p className="break-all font-medium text-slate-800">
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
                                                                                >
                                                                                    {mentorActionLoading ===
                                                                                    `accept-mentor-offer-${request.mentor_request_id}` ? (
                                                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                                                    ) : (
                                                                                        "Accept"
                                                                                    )}
                                                                                </Button>
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="outline"
                                                                                    className="h-7 flex-1 text-xs"
                                                                                    onClick={() =>
                                                                                        handleDecideMentorOffer(
                                                                                            request,
                                                                                            "decline"
                                                                                        )
                                                                                    }
                                                                                    disabled={
                                                                                        mentorActionLoading ===
                                                                                        `decline-mentor-offer-${request.mentor_request_id}`
                                                                                    }
                                                                                >
                                                                                    {mentorActionLoading ===
                                                                                    `decline-mentor-offer-${request.mentor_request_id}` ? (
                                                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                                                    ) : (
                                                                                        "Decline"
                                                                                    )}
                                                                                </Button>
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
                                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                        ) : null}
                                                                        Request Mentor
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Interested Students (only for leaders) */}
                                        {selectedTeam.is_leader &&
                                            !selectedTeamIsLocked &&
                                            selectedTeam.interested_students
                                                .length > 0 && (
                                                <div>
                                                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                                                        Interested Students
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
                                                                    className="bg-blue-50 p-3 rounded border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors"
                                                                    onClick={() =>
                                                                        handleViewStudentProfile(
                                                                            student.user_id,
                                                                            student.email
                                                                        )
                                                                    }
                                                                >
                                                                    <div className="flex items-start justify-between mb-2">
                                                                        <div className="flex items-center min-w-0 flex-1">
                                                                            <div className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center text-[10px] font-bold text-blue-700 mr-2 flex-shrink-0">
                                                                                {student.email
                                                                                    .charAt(
                                                                                        0
                                                                                    )
                                                                                    .toUpperCase()}
                                                                            </div>
                                                                            <span className="text-sm text-slate-700 break-all">
                                                                                {
                                                                                    student.email
                                                                                }
                                                                            </span>
                                                                        </div>
                                                                    </div>
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
                                                                            ) : (
                                                                                "Start Exploration"
                                                                            )}
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
                                                                            className="h-7 text-xs flex-1"
                                                                        >
                                                                            {actionLoading ===
                                                                            `reject-${student.user_id}` ? (
                                                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                                            ) : (
                                                                                "Reject"
                                                                            )}
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
                                                        Exploring Candidates
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
                                                                (teamConfirmed && !studentConfirmed) ||
                                                                busy ||
                                                                cancelBusy;
                                                            const cancelDisabled =
                                                                !student.exploration_id ||
                                                                status === "committed" ||
                                                                busy ||
                                                                cancelBusy;
                                                            const commitmentLabel =
                                                                status === "pending_commitment"
                                                                    ? "Awaiting Staff Routing"
                                                                    : status === "committed"
                                                                    ? "Committed"
                                                                    : selectedProjectIsFinalization
                                                                    ? "Finalization"
                                                                    : teamConfirmed && !studentConfirmed
                                                                    ? "Waiting for Student"
                                                                    : studentConfirmed && !teamConfirmed
                                                                    ? "Confirm Commitment"
                                                                    : "Confirm Commitment";
                                                            return (
                                                                <li
                                                                    key={student.exploration_id || student.user_id}
                                                                    className="rounded border border-emerald-100 bg-emerald-50 p-3"
                                                                >
                                                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                                        <button
                                                                            type="button"
                                                                            className="min-w-0 text-left"
                                                                            onClick={() =>
                                                                                handleViewStudentProfile(
                                                                                    student.user_id,
                                                                                    student.email
                                                                                )
                                                                            }
                                                                        >
                                                                            <span className="block break-all text-sm font-medium text-slate-800">
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
                                                                        <span className={`w-fit rounded border px-2 py-0.5 text-xs font-medium ${getExplorationStatusClass(status)}`}>
                                                                            {getExplorationStatusLabel(status)}
                                                                        </span>
                                                                    </div>
                                                                    {student.message && (
                                                                        <p className="mt-2 text-xs italic text-slate-600">
                                                                            "{student.message}"
                                                                        </p>
                                                                    )}
                                                                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            className="h-7 bg-white text-xs"
                                                                            onClick={() =>
                                                                                student.exploration_id
                                                                                    ? handleCancelExploration(
                                                                                          student.exploration_id,
                                                                                          "Team stopped marketplace exploration."
                                                                                      )
                                                                                    : undefined
                                                                            }
                                                                            disabled={cancelDisabled}
                                                                        >
                                                                            {cancelBusy ? (
                                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                                            ) : status === "pending_commitment" ? (
                                                                                "Cancel Routing"
                                                                            ) : (
                                                                                "Stop Exploring"
                                                                            )}
                                                                        </Button>
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
                                                                        >
                                                                            {busy ? (
                                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                                            ) : (
                                                                                commitmentLabel
                                                                            )}
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
                                                                className="h-8 whitespace-nowrap text-xs"
                                                                onClick={handleConfirmCommitmentRoster}
                                                                disabled={
                                                                    !selectedTeamCanConfirmRoster ||
                                                                    actionLoading ===
                                                                        `confirm-roster-${selectedTeam.team_id}`
                                                                }
                                                            >
                                                                {actionLoading ===
                                                                `confirm-roster-${selectedTeam.team_id}` ? (
                                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                                 ) : selectedTeamRosterAlreadyConfirmed ? (
                                                                     "Proposal Sent"
                                                                 ) : selectedTeamMutuallyConfirmedCandidates.length === 0 ? (
                                                                     "Need Confirmations"
                                                                 ) : (
                                                                     "Send Roster Proposal"
                                                                 )}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        {selectedTeam.is_leader && (
                                            <div>
                                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                                                    Pending Invites
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
                                                                    className="flex items-center justify-between gap-2 rounded border border-slate-100 bg-slate-50 p-2 text-sm text-slate-700"
                                                                >
                                                                    <span className="min-w-0">
                                                                        <span className="block break-all">
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
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() =>
                                                                            handleRevokeTeamInvite(
                                                                                invite.invite_id
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            revokingInviteId ===
                                                                            invite.invite_id
                                                                        }
                                                                        className="h-7 text-xs"
                                                                    >
                                                                        {revokingInviteId ===
                                                                        invite.invite_id ? (
                                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                                        ) : (
                                                                            "Revoke"
                                                                        )}
                                                                    </Button>
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
                        <DialogTitle>Start Exploration</DialogTitle>
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
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : null}
                            Start Exploration
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
                        <DialogTitle>Accept Team Invite</DialogTitle>
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
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : null}
                            Accept Invite
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
                        <DialogTitle>Reassign Team Leader</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label>Select teammate</Label>
                        <select
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
                        <Label>Reason (optional)</Label>
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
                        <DialogTitle>Reopen Capstone for Edits</DialogTitle>
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
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : null}
                            Reopen for Edits
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
                        <DialogTitle>Abandon Project</DialogTitle>
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
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : null}
                            Abandon Project
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
                        <DialogTitle>Decline Student Interest</DialogTitle>
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
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            Decline Interest
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
                        <DialogTitle>Finalize Team</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-slate-600">
                        This closes recruiting after required routing and review
                        have cleared. Students cannot reopen recruiting, change
                        membership, or undo finalization afterward. An instructor
                        or admin must disband the team to reverse it.
                    </p>
                    <FinalizationReadinessChecklist items={finalizationReadinessItems} />
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
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
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
                    <DialogTitle>Invite Teammate</DialogTitle>
                    <div className="space-y-4 pt-4">
                        {selectedTeamIsRecruiting && (
                            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                Invited students can accept or decline from their
                                dashboard.
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
                            >
                                {inviteLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        Sending...
                                    </>
                                ) : (
                                    "Send Invite"
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Student Profile Modal */}
            <Dialog
                open={showStudentProfileModal}
                onOpenChange={setShowStudentProfileModal}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    <DialogTitle>Student Profile</DialogTitle>
                    {loadingStudentProfile ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                        </div>
                    ) : (
                        <div className="space-y-6 pt-4">
                            {/* Student Email */}
                            <div className="space-y-2">
                                <Label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                                    Email
                                </Label>
                                <p className="text-sm text-slate-700">
                                    {selectedStudentEmail}
                                </p>
                            </div>

                            {(selectedStudentProfile?.headline ||
                                selectedStudentProfile?.availability) && (
                                <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                                    {selectedStudentProfile?.headline && (
                                        <p className="text-base font-medium text-slate-900">
                                            {selectedStudentProfile.headline}
                                        </p>
                                    )}
                                    {selectedStudentProfile?.availability && (
                                        <p className="mt-1 text-sm text-slate-600">
                                            {selectedStudentProfile.availability}
                                        </p>
                                    )}
                                </div>
                            )}

                            {selectedStudentProfile?.about_me && (
                                <div className="space-y-2">
                                    <Label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                                        About Me
                                    </Label>
                                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                        {selectedStudentProfile.about_me}
                                    </p>
                                </div>
                            )}

                            {profileList(selectedStudentProfile?.skills).length > 0 && (
                                <div className="space-y-2">
                                    <Label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                                        Skills
                                    </Label>
                                    <div className="flex flex-wrap gap-2">
                                        {profileList(selectedStudentProfile?.skills).map(
                                            (skill) => (
                                                <span
                                                    key={skill}
                                                    className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full"
                                                >
                                                    {skill}
                                                </span>
                                            )
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                {profileList(selectedStudentProfile?.preferred_roles)
                                    .length > 0 && (
                                    <div className="space-y-2">
                                        <Label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                                            Preferred Roles
                                        </Label>
                                        <div className="flex flex-wrap gap-2">
                                            {profileList(
                                                selectedStudentProfile?.preferred_roles
                                            ).map((role) => (
                                                    <span
                                                        key={role}
                                                        className="px-3 py-1 bg-emerald-100 text-emerald-700 text-sm rounded-full"
                                                    >
                                                        {role}
                                                    </span>
                                                ))}
                                        </div>
                                    </div>
                                )}
                                {profileList(selectedStudentProfile?.project_interests)
                                    .length > 0 && (
                                    <div className="space-y-2">
                                        <Label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                                            Project Interests
                                        </Label>
                                        <div className="flex flex-wrap gap-2">
                                            {profileList(
                                                selectedStudentProfile?.project_interests
                                            ).map((interest) => (
                                                <span
                                                    key={interest}
                                                    className="px-3 py-1 bg-amber-100 text-amber-800 text-sm rounded-full"
                                                >
                                                    {interest}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {(selectedStudentProfile?.interested_departments || [])
                                .length > 0 && (
                                <div className="space-y-2">
                                    <Label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                                        Interested Departments
                                    </Label>
                                    <div className="flex flex-wrap gap-2">
                                        {(
                                            selectedStudentProfile?.interested_departments ||
                                            []
                                        ).map((department) => (
                                            <span
                                                key={department.department_id}
                                                className="px-3 py-1 bg-slate-100 text-slate-700 text-sm rounded-full"
                                            >
                                                {department.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {profileLinks(selectedStudentProfile).length > 0 && (
                                <div className="space-y-2">
                                    <Label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                                        Links
                                    </Label>
                                    <div className="flex flex-wrap gap-2">
                                        {profileLinks(selectedStudentProfile).map((link) => (
                                            <a
                                                key={link.label}
                                                href={link.href}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
                                            >
                                                {link.label}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {!hasProfileContent(selectedStudentProfile) && (
                                <div className="text-center py-8 text-slate-500">
                                    This student hasn't set up their profile yet.
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

