import { useState, useEffect } from "react";
import {
    fetchUserCapstone,
    fetchUserInterests,
    fetchUserInvites,
    type TeamInvite,
} from "@/services/users.service";
import {
    acceptStudent as acceptStudentService,
    rejectStudent as rejectStudentService,
    removeStudent as removeStudentService,
    leaveTeam as leaveTeamService,
    acceptInvite as acceptInviteService,
    declineInvite as declineInviteService,
} from "@/services/teams.service";
import { withdrawInterest as withdrawInterestService } from "@/services/interests.service";

interface Student {
    user_id: string;
    email: string;
    name?: string;
    message?: string;
    created_at?: string;
}

interface Project {
    capstone_id: string;
    title: string;
    description: string;
    status: string;
}

export interface PendingInterest {
    team_id: number;
    capstone_id: number;
    project_name: string;
    project_description?: string;
    message?: string;
    created_at: string;
}

export interface TeamData {
    team_id: number;
    project: Project | null;
    team_members: Student[];
    interested_students: Student[];
    is_leader: boolean;
    leader_fk?: number;
}

export function useTeam(userId?: string) {
    const [teams, setTeams] = useState<TeamData[]>([]);
    const [pendingInterests, setPendingInterests] = useState<PendingInterest[]>(
        []
    );
    const [invites, setInvites] = useState<TeamInvite[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchDashboard = async () => {
        if (!userId) return;
        setLoading(true);
        try {
            console.log("🔍 Fetching dashboard for user:", userId);

            const data = await fetchUserCapstone();
            console.log("✅ Capstone data:", data);
            console.log("🔍 Teams data with leader_fk:", data.teams);

            setTeams((data.teams as TeamData[]) || []);

            if (!data.teams || data.teams.length === 0) {
                console.log("🔍 Fetching interests...");
                const interestsData = await fetchUserInterests();
                console.log("✅ Interests data:", interestsData);
                setPendingInterests(interestsData.data || []);
            } else {
                setPendingInterests([]);
            }

            // Fetch invites
            console.log("🔍 Fetching invites...");
            const invitesData = await fetchUserInvites(userId);
            console.log("✅ Invites data:", invitesData);
            setInvites(invitesData.data || []);
        } catch (err) {
            console.error("💥 Error loading dashboard:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        console.log("🎬 Dashboard mounted, user:", userId);
        fetchDashboard();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    const acceptStudent = async (student_id: string, team_id: number) => {
        if (!userId) return;
        setActionLoading(`accept-${student_id}`);
        try {
            await acceptStudentService(
                parseInt(userId),
                parseInt(student_id),
                team_id
            );
            await fetchDashboard();
            return { success: true };
        } catch (err) {
            console.error("Error accepting student:", err);
            return { success: false, error: err };
        } finally {
            setActionLoading(null);
        }
    };

    const rejectStudent = async (student_id: string, team_id: number) => {
        if (!userId) return;
        setActionLoading(`reject-${student_id}`);
        try {
            await rejectStudentService(
                parseInt(userId),
                parseInt(student_id),
                team_id
            );
            await fetchDashboard();
            return { success: true };
        } catch (err) {
            console.error("Error rejecting student:", err);
            return { success: false, error: err };
        } finally {
            setActionLoading(null);
        }
    };

    const removeStudent = async (student_id: string, team_id: number) => {
        if (!userId) return;
        setActionLoading(`remove-${student_id}`);
        try {
            await removeStudentService(
                parseInt(userId),
                parseInt(student_id),
                team_id
            );
            await fetchDashboard();
            return { success: true };
        } catch (err) {
            console.error("Error removing student:", err);
            return { success: false, error: err };
        } finally {
            setActionLoading(null);
        }
    };

    const withdrawInterest = async (capstone_id: string) => {
        setActionLoading(`withdraw-${capstone_id}`);
        try {
            await withdrawInterestService(capstone_id);
            await fetchDashboard();
            return { success: true };
        } catch (err) {
            console.error("Error withdrawing interest:", err);
            return { success: false, error: err };
        } finally {
            setActionLoading(null);
        }
    };

    const leaveTeam = async (team_id: number) => {
        if (!userId) return;
        if (!confirm("Are you sure you want to leave this team?"))
            return { success: false };

        setActionLoading("leave-team");
        try {
            await leaveTeamService(parseInt(userId), team_id);
            await fetchDashboard();
            return { success: true };
        } catch (err) {
            console.error("Error leaving team:", err);
            return { success: false, error: err };
        } finally {
            setActionLoading(null);
        }
    };

    const acceptInvite = async (invite_id: string) => {
        setActionLoading(`accept-invite-${invite_id}`);
        try {
            await acceptInviteService(invite_id);
            await fetchDashboard();
            return { success: true };
        } catch (err) {
            console.error("Error accepting invite:", err);
            return { success: false, error: err };
        } finally {
            setActionLoading(null);
        }
    };

    const declineInvite = async (invite_id: string) => {
        setActionLoading(`decline-${invite_id}`);
        try {
            await declineInviteService(invite_id);
            await fetchDashboard();
            return { success: true };
        } catch (err) {
            console.error("Error declining invite:", err);
            return { success: false, error: err };
        } finally {
            setActionLoading(null);
        }
    };

    return {
        teams,
        pendingInterests,
        invites,
        loading,
        actionLoading,
        acceptStudent,
        rejectStudent,
        removeStudent,
        withdrawInterest,
        leaveTeam,
        acceptInvite,
        declineInvite,
        refetch: fetchDashboard,
    };
}
