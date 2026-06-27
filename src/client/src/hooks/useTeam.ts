import { useState, useEffect } from "react";
import {
    fetchUserCapstone,
    fetchUserInterests,
    fetchUserInvites,
    type TeamInvite,
} from "@/services/users.service";
import {
    acceptStudent as acceptStudentService,
    createEmptyTeam as createEmptyTeamService,
    rejectStudent as rejectStudentService,
    removeStudent as removeStudentService,
    leaveTeam as leaveTeamService,
    abandonSoloProject as abandonSoloProjectService,
    acceptInvite as acceptInviteService,
    declineInvite as declineInviteService,
} from "@/services/teams.service";
import { withdrawInterest as withdrawInterestService } from "@/services/interests.service";
import {
    cancelProjectExploration as cancelProjectExplorationService,
    confirmTeamCommitmentRoster as confirmTeamCommitmentRosterService,
    createProjectCommitment as createProjectCommitmentService,
    type MarketplacePhase,
    type MarketplacePhaseContext,
    type ProjectCommitmentRequest,
    type ProjectExploration,
} from "@/services/marketplace.service";

interface Student {
    user_id: string;
    email: string;
    name?: string;
    course_fk?: number | null;
    course?: {
        course_id?: number;
        code?: string;
        name?: string;
        active?: boolean;
        active_instructor_count?: number;
        active_terms?: string[];
        activation_mode?: "auto" | "force_active" | "force_inactive";
        department_fk?: number | null;
        routing_kind?: "standard" | "interdisciplinary";
    } | null;
    enrollment_course_fk?: number | null;
    enrollment_course?: {
        course_id?: number;
        code?: string;
        name?: string;
        active?: boolean;
        active_instructor_count?: number;
        active_terms?: string[];
        activation_mode?: "auto" | "force_active" | "force_inactive";
        department_fk?: number | null;
        routing_kind?: "standard" | "interdisciplinary";
    } | null;
    home_department_id?: number | null;
    home_department?:
        | string
        | {
              department_id?: number;
              name?: string;
              active?: boolean;
          }
        | null;
    exploration_id?: number;
    status?: string;
    message?: string;
    student_commitment_confirmed_at?: string | null;
    student_commitment_confirmed_by_fk?: number | null;
    team_commitment_confirmed_at?: string | null;
    team_commitment_confirmed_by_fk?: number | null;
    student_commitment_confirmed?: boolean;
    team_commitment_confirmed?: boolean;
    created_at?: string;
    updated_at?: string;
}

interface Project {
    capstone_id: string;
    title: string;
    description: string;
    status: string;
    marketplace_phase?: MarketplacePhase;
    marketplace_phase_context?: MarketplacePhaseContext | null;
    can_invite?: boolean;
    can_commit?: boolean;
    can_express_interest?: boolean;
}

export interface PendingInterest {
    exploration_id?: number;
    status?: string;
    team_id: number;
    capstone_id: number;
    project_name: string;
    project_description?: string;
    message?: string;
    student_commitment_confirmed_at?: string | null;
    team_commitment_confirmed_at?: string | null;
    student_commitment_confirmed?: boolean;
    team_commitment_confirmed?: boolean;
    created_at: string;
    updated_at?: string;
}

export interface TeamData {
    team_id: number;
    project: Project | null;
    team_members: Student[];
    interested_students: Student[];
    exploring_students?: Student[];
    is_leader: boolean;
    leader_fk?: number;
    status?: string;
    commitment_roster_confirmed_at?: string | null;
    commitment_roster_confirmed_by_fk?: number | null;
    commitment_roster_note?: string | null;
}

export function useTeam(userId?: string) {
    const [teams, setTeams] = useState<TeamData[]>([]);
    const [pendingInterests, setPendingInterests] = useState<PendingInterest[]>(
        []
    );
    const [invites, setInvites] = useState<TeamInvite[]>([]);
    const [explorations, setExplorations] = useState<ProjectExploration[]>([]);
    const [commitmentRequests, setCommitmentRequests] = useState<ProjectCommitmentRequest[]>([]);
    const [marketplace, setMarketplace] = useState<unknown>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const getErrorMessage = (err: unknown, fallback: string) =>
        err instanceof Error ? err.message : fallback;

    const fetchDashboard = async () => {
        if (!userId) {
            setTeams([]);
            setPendingInterests([]);
            setInvites([]);
            setExplorations([]);
            setCommitmentRequests([]);
            setMarketplace(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const data = await fetchUserCapstone();
            const nextTeams = (data.teams as TeamData[]) || [];
            setExplorations(
                Array.isArray(data.explorations)
                    ? (data.explorations as ProjectExploration[])
                    : []
            );
            setCommitmentRequests(
                Array.isArray(data.commitment_requests)
                    ? (data.commitment_requests as ProjectCommitmentRequest[])
                    : []
            );
            setMarketplace(data.marketplace || null);

            setTeams(nextTeams);

            if (nextTeams.length === 0) {
                const interestsData = await fetchUserInterests();
                setPendingInterests(interestsData.data || []);
            } else {
                setPendingInterests([]);
            }
        } catch (err) {
            console.error("Error loading dashboard:", err);
            setTeams([]);
            setPendingInterests([]);
            setInvites([]);
            setExplorations([]);
            setCommitmentRequests([]);
            setMarketplace(null);
            setError(getErrorMessage(err, "Could not load dashboard."));
            setLoading(false);
            return;
        }

        try {
            const invitesData = await fetchUserInvites(userId);
            setInvites(invitesData.data || []);
        } catch (err) {
            console.error("Error loading invites:", err);
            setInvites([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboard();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    const acceptStudent = async (student_id: string, team_id: number) => {
        if (!userId) return;
        setActionLoading(`accept-${student_id}`);
        setError(null);
        try {
            await acceptStudentService(parseInt(student_id), team_id);
            await fetchDashboard();
            return { success: true };
        } catch (err) {
            console.error("Error accepting student:", err);
            setError(getErrorMessage(err, "Could not accept student."));
            return { success: false, error: err };
        } finally {
            setActionLoading(null);
        }
    };

    const rejectStudent = async (student_id: string, team_id: number, reason: string) => {
        if (!userId) return;
        setActionLoading(`reject-${student_id}`);
        setError(null);
        try {
            await rejectStudentService(parseInt(student_id), team_id, reason);
            await fetchDashboard();
            return { success: true };
        } catch (err) {
            console.error("Error rejecting student:", err);
            setError(getErrorMessage(err, "Could not reject student."));
            return { success: false, error: err };
        } finally {
            setActionLoading(null);
        }
    };

    const removeStudent = async (student_id: string, team_id: number) => {
        if (!userId) return;
        setActionLoading(`remove-${student_id}`);
        setError(null);
        try {
            await removeStudentService(parseInt(student_id), team_id);
            await fetchDashboard();
            return { success: true };
        } catch (err) {
            console.error("Error removing student:", err);
            setError(getErrorMessage(err, "Could not remove student."));
            return { success: false, error: err };
        } finally {
            setActionLoading(null);
        }
    };

    const withdrawInterest = async (capstone_id: string) => {
        setActionLoading(`withdraw-${capstone_id}`);
        setError(null);
        try {
            await withdrawInterestService(capstone_id);
            await fetchDashboard();
            return { success: true };
        } catch (err) {
            console.error("Error withdrawing interest:", err);
            setError(getErrorMessage(err, "Could not withdraw interest."));
            return { success: false, error: err };
        } finally {
            setActionLoading(null);
        }
    };

    const leaveTeam = async (team_id: number) => {
        if (!userId) return;

        setActionLoading("leave-team");
        setError(null);
        try {
            await leaveTeamService(team_id);
            await fetchDashboard();
            return { success: true };
        } catch (err) {
            console.error("Error leaving team:", err);
            setError(getErrorMessage(err, "Could not leave team."));
            return { success: false, error: err };
        } finally {
            setActionLoading(null);
        }
    };

    const abandonSoloProject = async (team_id: number) => {
        if (!userId) return;

        setActionLoading("abandon-project");
        setError(null);
        try {
            await abandonSoloProjectService(team_id);
            await fetchDashboard();
            return { success: true };
        } catch (err) {
            console.error("Error abandoning project:", err);
            setError(getErrorMessage(err, "Could not abandon project."));
            return { success: false, error: err };
        } finally {
            setActionLoading(null);
        }
    };

    const createEmptyTeam = async () => {
        if (!userId) return { success: false };
        setActionLoading("create-team");
        setError(null);
        try {
            await createEmptyTeamService();
            await fetchDashboard();
            return { success: true };
        } catch (err) {
            console.error("Error creating empty team:", err);
            setError(getErrorMessage(err, "Could not create team."));
            return { success: false, error: err };
        } finally {
            setActionLoading(null);
        }
    };

    const acceptInvite = async (invite_id: string) => {
        setActionLoading(`accept-invite-${invite_id}`);
        setError(null);
        try {
            const payload = await acceptInviteService(invite_id);
            await fetchDashboard();
            return { success: true, data: payload };
        } catch (err) {
            console.error("Error accepting invite:", err);
            setError(getErrorMessage(err, "Could not accept invite."));
            return { success: false, error: err };
        } finally {
            setActionLoading(null);
        }
    };

    const declineInvite = async (invite_id: string) => {
        setActionLoading(`decline-${invite_id}`);
        setError(null);
        try {
            await declineInviteService(invite_id);
            await fetchDashboard();
            return { success: true };
        } catch (err) {
            console.error("Error declining invite:", err);
            setError(getErrorMessage(err, "Could not decline invite."));
            return { success: false, error: err };
        } finally {
            setActionLoading(null);
        }
    };

    const createProjectCommitment = async (
        explorationId: number,
        comments?: string | null
    ) => {
        setActionLoading(`commit-exploration-${explorationId}`);
        setError(null);
        try {
            const payload = await createProjectCommitmentService({
                exploration_id: explorationId,
                comments: comments?.trim() || null,
            });
            await fetchDashboard();
            return { success: true, data: payload };
        } catch (err) {
            console.error("Error confirming marketplace commitment:", err);
            setError(getErrorMessage(err, "Could not confirm commitment."));
            return { success: false, error: err };
        } finally {
            setActionLoading(null);
        }
    };

    const confirmTeamCommitmentRoster = async (
        teamId: number,
        comments?: string | null
    ) => {
        setActionLoading(`confirm-roster-${teamId}`);
        setError(null);
        try {
            const payload = await confirmTeamCommitmentRosterService({
                team_id: teamId,
                comments: comments?.trim() || null,
            });
            await fetchDashboard();
            return { success: true, data: payload };
        } catch (err) {
            console.error("Error confirming commitment roster:", err);
            setError(getErrorMessage(err, "Could not confirm commitment roster."));
            return { success: false, error: err };
        } finally {
            setActionLoading(null);
        }
    };

    const cancelProjectExploration = async (
        explorationId: number,
        reason?: string | null
    ) => {
        setActionLoading(`cancel-exploration-${explorationId}`);
        setError(null);
        try {
            await cancelProjectExplorationService(
                explorationId,
                reason?.trim() || null
            );
            await fetchDashboard();
            return { success: true };
        } catch (err) {
            console.error("Error cancelling project exploration:", err);
            setError(getErrorMessage(err, "Could not cancel exploration."));
            return { success: false, error: err };
        } finally {
            setActionLoading(null);
        }
    };

    return {
        teams,
        pendingInterests,
        explorations,
        commitmentRequests,
        marketplace,
        invites,
        loading,
        actionLoading,
        error,
        clearError: () => setError(null),
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
        refetch: fetchDashboard,
    };
}
