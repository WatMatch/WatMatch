import { apiFetch, buildApiUrl } from "@/lib/api-client";

export interface Team {
    team_id: number;
    project: {
        capstone_id: string;
        title: string;
        description: string;
        status: string;
    } | null;
    team_members: {
        user_id: string;
        email: string;
        name?: string;
        message?: string;
        created_at?: string;
    }[];
    interested_students: {
        user_id: string;
        email: string;
        name?: string;
        message?: string;
        created_at?: string;
    }[];
    is_leader: boolean;
    leader_fk?: number;
}

/**
 * Fetch all teams
 */
export async function fetchTeams(): Promise<unknown> {
    const response = await apiFetch(buildApiUrl("/api/v1/teams"));

    if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
    }

    return await response.json();
}

/**
 * Fetch team by ID
 */
export async function fetchTeamById(teamId: number): Promise<Team> {
    const response = await apiFetch(buildApiUrl(`/api/v1/teams/${teamId}`));

    if (!response.ok) {
        throw new Error(`Failed to fetch team: ${response.status}`);
    }

    return await response.json();
}

/**
 * Accept a student into a team (leader only)
 */
export async function acceptStudent(
    leaderId: number,
    studentId: number,
    teamId: number
): Promise<void> {
    const response = await apiFetch(buildApiUrl("/api/v1/teams/accept"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            leader_id: leaderId,
            student_id: studentId,
            team_id: teamId,
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to accept student: ${response.status}`);
    }
}

/**
 * Reject a student from a team (leader only)
 */
export async function rejectStudent(
    leaderId: number,
    studentId: number,
    teamId: number
): Promise<void> {
    const response = await apiFetch(buildApiUrl("/api/v1/teams/reject"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            leader_id: leaderId,
            student_id: studentId,
            team_id: teamId,
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to reject student: ${response.status}`);
    }
}

/**
 * Remove a student from a team (leader only)
 */
export async function removeStudent(
    leaderId: number,
    studentId: number,
    teamId: number
): Promise<void> {
    const response = await apiFetch(buildApiUrl("/api/v1/teams/remove"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            leader_id: leaderId,
            student_id: studentId,
            team_id: teamId,
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to remove student: ${response.status}`);
    }
}

/**
 * Leave a team
 */
export async function leaveTeam(userId: number, teamId: number): Promise<void> {
    const response = await apiFetch(buildApiUrl("/api/v1/teams/leave"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            user_id: userId,
            team_id: teamId,
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to leave team: ${response.status}`);
    }
}

/**
 * Invite a teammate by email
 */
export async function inviteTeammate(
    teamId: number,
    email: string
): Promise<void> {
    const response = await apiFetch(buildApiUrl("/api/v1/invites"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            team_id: teamId,
            email: email,
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to send invite: ${response.status}`);
    }
}

/**
 * Accept a team invite
 */
export async function acceptInvite(inviteId: string): Promise<void> {
    const response = await apiFetch(buildApiUrl("/api/v1/invites/accept"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            invite_id: inviteId,
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to accept invite: ${response.status}`);
    }
}

/**
 * Decline a team invite
 */
export async function declineInvite(inviteId: string): Promise<void> {
    const response = await apiFetch(buildApiUrl("/api/v1/invites/decline"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            invite_id: inviteId,
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to decline invite: ${response.status}`);
    }
}
