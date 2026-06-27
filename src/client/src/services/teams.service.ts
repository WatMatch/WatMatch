import { apiFetch, buildApiUrl, readApiError } from "@/lib/api-client";

async function errorMessage(response: Response, fallback: string): Promise<string> {
    return readApiError(response, fallback);
}

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
        course_fk?: number | null;
        course?: {
            course_id?: number;
            code?: string;
            name?: string;
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
            active_terms?: string[];
            activation_mode?: "auto" | "force_active" | "force_inactive";
            department_fk?: number | null;
            routing_kind?: "standard" | "interdisciplinary";
            ecosystem_fk?: number | null;
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
        message?: string;
        created_at?: string;
    }[];
    member_details?: {
        user_id?: string | number;
        email?: string;
        course_fk?: number | null;
        course?: {
            course_id?: number;
            code?: string;
            name?: string;
            active_terms?: string[];
            activation_mode?: "auto" | "force_active" | "force_inactive";
            department_fk?: number | null;
            routing_kind?: "standard" | "interdisciplinary";
            ecosystem_fk?: number | null;
        } | null;
        enrollment_course_fk?: number | null;
        enrollment_course?: {
            course_id?: number;
            code?: string;
            name?: string;
            active_terms?: string[];
            activation_mode?: "auto" | "force_active" | "force_inactive";
            department_fk?: number | null;
            routing_kind?: "standard" | "interdisciplinary";
            ecosystem_fk?: number | null;
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
    }[];
    interested_students: {
        user_id: string;
        email: string;
        name?: string;
        course_fk?: number | null;
        course?: {
            course_id?: number;
            code?: string;
            name?: string;
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
        message?: string;
        created_at?: string;
    }[];
    is_leader: boolean;
    leader_fk?: number;
}

export interface TeamPendingInvite {
    invite_id: string;
    team_fk: number;
    user_fk: number;
    created_at?: string;
    invitee?: {
        user_id: number;
        email: string;
        role?: string;
        course_fk?: number | null;
    } | null;
}

/**
 * Fetch all teams
 */
export async function fetchTeams(): Promise<unknown> {
    const response = await apiFetch(buildApiUrl("/api/v1/teams"));

    if (!response.ok) {
        throw new Error(await errorMessage(response, "Failed to fetch teams"));
    }

    return await response.json();
}

/**
 * Accept a student into a team (leader only)
 */
export async function acceptStudent(
    studentId: number,
    teamId: number
): Promise<void> {
    const response = await apiFetch(buildApiUrl("/api/v1/teams/accept"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            student_id: studentId,
            team_id: teamId,
        }),
    });

    if (!response.ok) {
        throw new Error(await errorMessage(response, "Failed to accept student"));
    }
}

/**
 * Reject a student from a team (leader only)
 */
export async function rejectStudent(
    studentId: number,
    teamId: number,
    reason: string
): Promise<void> {
    const response = await apiFetch(buildApiUrl("/api/v1/teams/reject"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            student_id: studentId,
            team_id: teamId,
            reason: reason.trim(),
        }),
    });

    if (!response.ok) {
        throw new Error(await errorMessage(response, "Failed to reject student"));
    }
}

/**
 * Remove a student from a team (leader only)
 */
export async function removeStudent(
    studentId: number,
    teamId: number
): Promise<void> {
    const response = await apiFetch(buildApiUrl("/api/v1/teams/remove"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            student_id: studentId,
            team_id: teamId,
        }),
    });

    if (!response.ok) {
        throw new Error(await errorMessage(response, "Failed to remove student"));
    }
}

/**
 * Leave a team
 */
export async function leaveTeam(teamId: number): Promise<void> {
    const response = await apiFetch(buildApiUrl("/api/v1/teams/leave"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            team_id: teamId,
        }),
    });

    if (!response.ok) {
        throw new Error(await errorMessage(response, "Failed to leave team"));
    }
}

export async function abandonSoloProject(teamId: number): Promise<void> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/teams/${teamId}/abandon-solo-project`),
        {
            method: "POST",
        }
    );

    if (!response.ok) {
        throw new Error(await errorMessage(response, "Failed to abandon project"));
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
        throw new Error(await errorMessage(response, "Failed to send invite"));
    }
}

export async function fetchTeamInvites(
    teamId: number
): Promise<TeamPendingInvite[]> {
    const response = await apiFetch(buildApiUrl(`/api/v1/invites/team/${teamId}`));

    if (!response.ok) {
        throw new Error(await errorMessage(response, "Failed to fetch team invites"));
    }

    const result = await response.json();
    return Array.isArray(result?.data) ? result.data : [];
}

export async function revokeInvite(inviteId: string): Promise<void> {
    const response = await apiFetch(buildApiUrl("/api/v1/invites/revoke"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            invite_id: inviteId,
        }),
    });

    if (!response.ok) {
        throw new Error(await errorMessage(response, "Failed to revoke invite"));
    }
}

/**
 * Accept a team invite
 */
export async function acceptInvite(inviteId: string): Promise<unknown> {
    const response = await apiFetch(buildApiUrl("/api/v1/invites/accept"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            invite_id: inviteId,
        }),
    });

    if (!response.ok) {
        throw new Error(await errorMessage(response, "Failed to accept invite"));
    }
    return await response.json();
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
        throw new Error(await errorMessage(response, "Failed to decline invite"));
    }
}

export async function createEmptyTeam(): Promise<void> {
    const response = await apiFetch(buildApiUrl("/api/v1/teams/create-empty"), {
        method: "POST",
    });

    if (!response.ok) {
        throw new Error(await errorMessage(response, "Failed to create team"));
    }
}

export async function createManagedTeam(params: {
    studentIds: number[];
    leaderId: number;
    reason?: string;
}): Promise<void> {
    const response = await apiFetch(buildApiUrl("/api/v1/teams/create-managed"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            student_ids: params.studentIds,
            leader_id: params.leaderId,
            reason: params.reason?.trim() || null,
        }),
    });

    if (!response.ok) {
        throw new Error(await errorMessage(response, "Failed to create team"));
    }
}

export async function deleteTeam(
    teamId: number,
    reason?: string
): Promise<void> {
    const response = await apiFetch(buildApiUrl(`/api/v1/teams/${teamId}/disband`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            reason: reason?.trim() || null,
        }),
    });
    if (!response.ok) {
        if (response.status === 403) {
            throw new Error("You are not allowed to delete this team.");
        }
        throw new Error(await errorMessage(response, "Failed to disband team"));
    }
}

export async function addMemberPrivileged(
    teamId: number,
    studentId: number,
    reason?: string
): Promise<void> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/teams/${teamId}/add-member`),
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                student_id: studentId,
                reason: reason?.trim() || null,
            }),
        }
    );
    if (!response.ok) {
        throw new Error(await errorMessage(response, "Failed to add member"));
    }
}

export async function removeMemberPrivileged(
    teamId: number,
    studentId: number,
    reason?: string
): Promise<void> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/teams/${teamId}/remove-member`),
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                student_id: studentId,
                reason: reason?.trim() || null,
            }),
        }
    );
    if (!response.ok) {
        throw new Error(await errorMessage(response, "Failed to remove member"));
    }
}

export async function reassignLeader(
    teamId: number,
    newLeaderId: number,
    reason?: string
): Promise<void> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/teams/${teamId}/reassign-leader`),
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                new_leader_id: newLeaderId,
                reason: reason?.trim() || null,
            }),
        }
    );
    if (!response.ok) {
        throw new Error(await errorMessage(response, "Failed to reassign leader"));
    }
}

export async function finalizeTeam(
    teamId: number,
    reason?: string
): Promise<void> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/teams/${teamId}/finalize`),
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                reason: reason?.trim() || null,
            }),
        }
    );
    if (!response.ok) {
        throw new Error(await errorMessage(response, "Failed to finalize team"));
    }
}
