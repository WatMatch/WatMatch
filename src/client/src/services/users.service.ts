import { apiFetch, buildApiUrl, readApiError } from "@/lib/api-client";
import type { MarketplacePhase, MarketplacePhaseContext } from "./marketplace.service";

export interface PendingInterest {
    exploration_id?: number;
    status?: string;
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
    explorations?: unknown[];
    commitment_requests?: unknown[];
    marketplace?: unknown;
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
        capstone_fk: number | null;
        members: number[];
        status: string;
        course_fk: number;
    } | null;
    capstone: {
        capstone_id: number;
        user_fk: number;
        title: string;
        description: string;
        status: string;
        marketplace_phase?: MarketplacePhase;
        marketplace_phase_context?: MarketplacePhaseContext | null;
        can_express_interest?: boolean;
        can_invite?: boolean;
        can_commit?: boolean;
        disciplines: string[];
        skills: string[];
        approval: boolean;
        team_fk: number;
    } | null;
    marketplace_phase?: MarketplacePhase;
    acceptance_blocked_reason?: string;
}

export interface UserInvitesData {
    data: TeamInvite[];
}

export interface InstructorRosterEntry {
    user_id: number;
    email: string;
    course_fk: number | null;
    home_department_fk?: number | null;
    home_department_id?: number | null;
    home_department?:
        | string
        | {
              department_id?: number;
              name?: string;
              active?: boolean;
          }
        | null;
    active_team_fk: number | null;
    team: {
        team_id: number;
        leader_fk: number;
        status: string;
        capstone_fk: number | null;
        course_fk?: number | null;
    } | null;
    capstone: {
        capstone_id: number;
        title: string;
        status: string;
        approval: boolean;
        course_fk?: number | null;
    } | null;
}

export interface AdminStudentEntry {
    user_id: number;
    email: string;
    role: string;
    course_fk: number | null;
    home_department_fk?: number | null;
    home_department_id?: number | null;
    active_team_fk: number | null;
    active: boolean;
    created_at?: string;
    course: {
        course_id: number;
        code: string;
        name: string;
        active: boolean;
        active_terms?: string[];
        activation_mode?: "auto" | "force_active" | "force_inactive";
        department_fk?: number | null;
        routing_kind?: "standard" | "interdisciplinary";
        requires_project_support?: boolean;
    } | null;
    home_department?: {
        department_id: number;
        name: string;
        active: boolean;
    } | null;
}

export type AdminUserEntry = AdminStudentEntry;

export type AdminManagedRole =
    | "student"
    | "instructor"
    | "admin"
    | "academic_advisor"
    | "enrollment_operator"
    | "external_partner"
    | "mentor";

export interface UserImportSummary {
    created: number;
    updated: number;
    unchanged: number;
    errors: Array<{
        row: number;
        email?: string;
        error: string;
    }>;
}

/**
 * Fetch current user's capstone/team data
 */
export async function fetchUserCapstone(): Promise<UserCapstoneData> {
    const response = await apiFetch(buildApiUrl("/api/v1/users/me/capstone"));

    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch user capstone"));
    }

    return await response.json();
}

/**
 * Fetch current user's pending interests
 */
export async function fetchUserInterests(): Promise<UserInterestsData> {
    const response = await apiFetch(buildApiUrl("/api/v1/users/me/interests"));

    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch user interests"));
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
        throw new Error(await readApiError(response, "Failed to fetch user invites"));
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
        throw new Error(await readApiError(response, "Failed to fetch user"));
    }

    return await response.json();
}

export async function fetchInstructorCourseRoster(): Promise<{
    data: InstructorRosterEntry[];
}> {
    const response = await apiFetch(
        buildApiUrl("/api/v1/users/instructor/course-roster")
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch course roster"));
    }
    const payload = await response.json();
    return { data: payload.data || [] };
}

export async function fetchAdminUsers(): Promise<AdminUserEntry[]> {
    const pageSize = 200;
    const users: AdminUserEntry[] = [];
    let page = 1;
    let totalPages = 1;

    do {
        const response = await apiFetch(
            buildApiUrl("/api/v1/users/admin/users", {
                page,
                page_size: pageSize,
            })
        );
        if (!response.ok) {
            throw new Error(await readApiError(response, "Failed to fetch users"));
        }
        const payload = await response.json();
        users.push(...((payload.data || []) as AdminUserEntry[]));
        totalPages = Math.max(1, Number(payload.total_pages || 1));
        page += 1;
    } while (page <= totalPages);

    return users;
}

export async function createAdminUser(payload: {
    email: string;
    role: AdminManagedRole;
    course_id?: number | null;
    home_department_id?: number | null;
    active?: boolean;
    reason: string;
}): Promise<AdminUserEntry> {
    const response = await apiFetch(buildApiUrl("/api/v1/users/admin/users"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to create user"));
    }
    const result = await response.json();
    return result.data;
}

export async function setAdminUserCourse(
    userId: number,
    payload: { course_id?: number | null; reason: string }
): Promise<AdminUserEntry> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/users/admin/users/${userId}/course`),
        {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to update user course"));
    }
    const result = await response.json();
    return result.data;
}

export async function setAdminUserActive(
    userId: number,
    payload: { active: boolean; force?: boolean; reason: string }
): Promise<AdminUserEntry> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/users/admin/users/${userId}/active`),
        {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to update user status"));
    }
    const result = await response.json();
    return result.data;
}

export async function updateAdminUser(
    userId: number,
    payload: {
        email: string;
        role: AdminManagedRole;
        course_id?: number | null;
        home_department_id?: number | null;
        active: boolean;
        reason: string;
    }
): Promise<AdminUserEntry> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/users/admin/users/${userId}`),
        {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to update user"));
    }
    const result = await response.json();
    return result.data;
}

export async function deleteAdminUser(
    userId: number,
    reason: string
): Promise<void> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/users/admin/users/${userId}/delete`),
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason }),
        }
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to delete user"));
    }
}

export async function importAdminUsersCsv(csvText: string): Promise<UserImportSummary> {
    const response = await apiFetch(buildApiUrl("/api/v1/users/admin/users/import"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv_text: csvText }),
    });
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to import users"));
    }
    const result = await response.json();
    return result.data;
}

export interface StudentProfile {
    student_fk?: number;
    headline?: string | null;
    about_me: string | null;
    skills: string[] | null;
    preferred_roles?: string[] | null;
    project_interests?: string[] | null;
    interested_department_ids?: number[] | null;
    interested_departments?: Array<{
        department_id: number;
        name: string;
        active?: boolean;
    }> | null;
    availability?: string | null;
    portfolio_url?: string | null;
    linkedin_url?: string | null;
    github_url?: string | null;
    profile_visibility?: "team_network" | "students" | "private";
}

/**
 * Fetch student profile
 */
export async function fetchStudentProfile(): Promise<StudentProfile | null> {
    const response = await apiFetch(buildApiUrl("/api/v1/student-profile"));

    if (!response.ok) {
        if (response.status === 404) {
            return null; // Profile doesn't exist yet
        }
        throw new Error(await readApiError(response, "Failed to fetch profile"));
    }

    const result = await response.json();
    return result.data || null;
}

/**
 * Fetch student profile by user ID
 */
export async function fetchStudentProfileById(
    userId: string
): Promise<StudentProfile | null> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/student-profile/${userId}`)
    );

    if (!response.ok) {
        if (response.status === 404) {
            return null; // Profile doesn't exist yet
        }
        throw new Error(await readApiError(response, "Failed to fetch profile"));
    }

    const result = await response.json();
    return result.data || null;
}

/**
 * Update student profile (about me and skills)
 */
export async function updateStudentProfile(data: {
    headline?: string | null;
    about_me?: string | null;
    skills?: string[] | null;
    preferred_roles?: string[] | null;
    project_interests?: string[] | null;
    interested_department_ids?: number[] | null;
    availability?: string | null;
    portfolio_url?: string | null;
    linkedin_url?: string | null;
    github_url?: string | null;
    profile_visibility?: "team_network" | "students" | "private";
}): Promise<void> {
    const response = await apiFetch(buildApiUrl("/api/v1/student-profile"), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to update profile"));
    }
}
