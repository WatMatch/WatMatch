import { apiFetch, buildApiUrl } from "@/lib/api-client";

export interface PendingInterest {
    team_id: number;
    capstone_id: number;
    project_name: string;
    project_description?: string;
    message?: string;
    created_at: string;
}

export interface UserCapstoneData {
    teams: unknown[];
    is_leader: boolean;
}

export interface UserInterestsData {
    data: PendingInterest[];
}

export interface TeamInvite {
    invite_id: string;
    team_fk: number;
    user_fk: number;
    team: {
        team_id: number;
        leader_fk: number;
        capstone_fk: number;
        members: number[];
        interested: number[];
        status: string;
        course_fk: number;
    };
    capstone: {
        capstone_id: number;
        user_fk: number;
        title: string;
        description: string;
        status: string;
        disciplines: string[];
        skills: string[];
        approval: boolean;
        team_fk: number;
    };
}

export interface UserInvitesData {
    data: TeamInvite[];
}

/**
 * Fetch current user's capstone/team data
 */
export async function fetchUserCapstone(): Promise<UserCapstoneData> {
    const response = await apiFetch(buildApiUrl("/api/v1/users/me/capstone"));

    if (!response.ok) {
        throw new Error(`Failed to fetch user capstone: ${response.status}`);
    }

    return await response.json();
}

/**
 * Fetch current user's pending interests
 */
export async function fetchUserInterests(): Promise<UserInterestsData> {
    const response = await apiFetch(buildApiUrl("/api/v1/users/me/interests"));

    if (!response.ok) {
        throw new Error(`Failed to fetch user interests: ${response.status}`);
    }

    return await response.json();
}

/**
 * Fetch current user's team invites
 */
export async function fetchUserInvites(
    userId: string
): Promise<UserInvitesData> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/invites/user/${userId}`)
    );

    if (!response.ok) {
        throw new Error(`Failed to fetch user invites: ${response.status}`);
    }

    const result = await response.json();
    return {
        data: result.data || [],
    };
}

/**
 * Fetch user by ID
 */
export async function fetchUserById(userId: string): Promise<unknown> {
    const response = await apiFetch(buildApiUrl(`/api/v1/users/${userId}`));

    if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
    }

    return await response.json();
}

export interface StudentProfile {
    about_me: string | null;
    skills: string[] | null;
}

/**
 * Fetch student profile
 */
export async function fetchStudentProfile(): Promise<StudentProfile | null> {
    try {
        const response = await apiFetch(buildApiUrl("/api/v1/student-profile"));

        if (!response.ok) {
            if (response.status === 404) {
                return null; // Profile doesn't exist yet
            }
            throw new Error(`Failed to fetch profile: ${response.status}`);
        }

        const result = await response.json();
        return result.data || null;
    } catch (error) {
        console.error("Error fetching student profile:", error);
        return null;
    }
}

/**
 * Fetch student profile by user ID
 */
export async function fetchStudentProfileById(
    userId: string
): Promise<StudentProfile | null> {
    try {
        const response = await apiFetch(
            buildApiUrl(`/api/v1/student-profile/${userId}`)
        );

        if (!response.ok) {
            if (response.status === 404) {
                return null; // Profile doesn't exist yet
            }
            throw new Error(`Failed to fetch profile: ${response.status}`);
        }

        const result = await response.json();
        return result.data || null;
    } catch (error) {
        console.error("Error fetching student profile:", error);
        return null;
    }
}

/**
 * Update student profile (about me and skills)
 */
export async function updateStudentProfile(data: {
    about_me?: string | null;
    skills?: string[] | null;
}): Promise<void> {
    const response = await apiFetch(buildApiUrl("/api/v1/student-profile"), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        throw new Error(`Failed to update profile: ${response.status}`);
    }
}
