import { apiFetch, buildApiUrl, readApiError } from "@/lib/api-client";
import type { Course } from "./courses.service";

export type PartnerOpportunityStatus = "draft" | "published" | "archived";

export interface PartnerProfile {
    partner_user_fk: number;
    display_name: string;
    organization: string;
    contact_email: string;
    website?: string | null;
    bio?: string | null;
    areas: string[];
    created_at?: string;
    updated_at?: string;
    partner_user_email?: string;
    partner_user_active?: boolean;
}

export interface PartnerOpportunity {
    partner_opportunity_id: number;
    partner_user_fk: number;
    title: string;
    organization: string;
    description: string;
    primary_contact?: string | null;
    phone?: string | null;
    how_heard_about_capstone?: string | null;
    organization_description?: string | null;
    organization_size?: string | null;
    project_start_date?: string | null;
    problem_area?: string | null;
    main_objectives?: string | null;
    scope_of_work?: string | null;
    deliverable_types?: string[];
    deliverables?: string | null;
    meeting_frequency?: string | null;
    resources_needed?: string | null;
    disciplines: string[];
    skills: string[];
    target_course_tags: string[];
    target_course_ids?: number[];
    target_courses?: Course[];
    preferred_team_size?: string | null;
    max_active_teams?: number | null;
    contact_email: string;
    contact_url?: string | null;
    ip_acknowledged?: boolean;
    nda_acknowledged?: boolean;
    matching_acknowledged?: boolean;
    status: PartnerOpportunityStatus;
    archived_at?: string | null;
    created_at?: string;
    updated_at?: string;
    active_team_count?: number;
    is_available?: boolean;
}

export interface PartnerOpportunityListResponse {
    success: boolean;
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
    data: PartnerOpportunity[];
}

export interface PartnerTeamMember {
    user_id: number;
    email: string;
    course_fk?: number | null;
    home_department_fk?: number | null;
    home_department_id?: number | null;
    home_department?: {
        department_id: number;
        name: string;
        active?: boolean;
    } | null;
}

export interface PartnerTeam {
    team_id: number;
    leader_fk?: number | null;
    status?: string | null;
    created_at?: string;
    capstone: {
        capstone_id?: number | null;
        title?: string | null;
        status?: string | null;
        partner_opportunity_fk?: number | null;
    } | null;
    opportunity: {
        partner_opportunity_id?: number;
        title?: string | null;
        organization?: string | null;
        status?: PartnerOpportunityStatus;
    } | null;
    team_members: PartnerTeamMember[];
}

export interface PartnerProfilePayload {
    display_name: string;
    organization: string;
    contact_email: string;
    website?: string | null;
    bio?: string | null;
    areas?: string[];
    reason?: string | null;
}

export type AdminPartnerProfilePayload = PartnerProfilePayload & {
    reason: string;
};

export interface PartnerOpportunityPayload {
    partner_user_id?: number;
    title: string;
    organization: string;
    description?: string | null;
    primary_contact?: string | null;
    phone?: string | null;
    how_heard_about_capstone?: string | null;
    organization_description?: string | null;
    organization_size?: string | null;
    project_start_date?: string | null;
    problem_area?: string | null;
    main_objectives?: string | null;
    scope_of_work?: string | null;
    deliverable_types?: string[];
    deliverables?: string | null;
    meeting_frequency?: string | null;
    resources_needed?: string | null;
    disciplines?: string[];
    skills?: string[];
    target_course_tags?: string[];
    target_course_ids?: number[];
    preferred_team_size?: string | null;
    max_active_teams?: number | null;
    contact_email: string;
    contact_url?: string | null;
    ip_acknowledged?: boolean;
    nda_acknowledged?: boolean;
    matching_acknowledged?: boolean;
    status?: PartnerOpportunityStatus;
    reason?: string | null;
}

export type AdminPartnerOpportunityPayload = PartnerOpportunityPayload & {
    reason: string;
};

async function parseData<T>(response: Response, fallback: string): Promise<T> {
    if (!response.ok) {
        throw new Error(await readApiError(response, fallback));
    }
    const payload = await response.json();
    return payload.data as T;
}

export async function fetchPartnerOpportunities(filters?: {
    search?: string;
    discipline?: string;
    skill?: string;
    status?: string;
    targetCourseId?: number;
    page?: number;
    pageSize?: number;
}): Promise<PartnerOpportunity[]> {
    const payload = await fetchPartnerOpportunityPage(filters);
    return payload.data;
}

export async function fetchPartnerOpportunityPage(filters?: {
    search?: string;
    discipline?: string;
    skill?: string;
    status?: string;
    targetCourseId?: number;
    page?: number;
    pageSize?: number;
}): Promise<PartnerOpportunityListResponse> {
    const response = await apiFetch(
        buildApiUrl("/api/v1/partners/opportunities", {
            page: filters?.page || 1,
            page_size: filters?.pageSize || 12,
            search: filters?.search || undefined,
            discipline: filters?.discipline || undefined,
            skill: filters?.skill || undefined,
            status: filters?.status || "published",
            target_course_id: filters?.targetCourseId || undefined,
        })
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch external opportunities"));
    }
    return response.json();
}

export async function fetchPartnerOpportunity(
    opportunityId: number
): Promise<PartnerOpportunity> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/partners/opportunities/${opportunityId}`)
    );
    return parseData<PartnerOpportunity>(response, "Failed to fetch external opportunity");
}

export async function fetchMyPartnerProfile(): Promise<PartnerProfile | null> {
    const response = await apiFetch(buildApiUrl("/api/v1/partners/me/profile"));
    return parseData<PartnerProfile | null>(response, "Failed to fetch partner profile");
}

export async function saveMyPartnerProfile(
    payload: PartnerProfilePayload
): Promise<PartnerProfile> {
    const response = await apiFetch(buildApiUrl("/api/v1/partners/me/profile"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    return parseData<PartnerProfile>(response, "Failed to save partner profile");
}

export async function fetchMyPartnerOpportunities(): Promise<PartnerOpportunity[]> {
    const payload = await fetchMyPartnerOpportunityPage();
    return payload.data;
}

export async function fetchMyPartnerOpportunityPage(filters?: {
    page?: number;
    pageSize?: number;
}): Promise<PartnerOpportunityListResponse> {
    const response = await apiFetch(
        buildApiUrl("/api/v1/partners/me/opportunities", {
            page: filters?.page || 1,
            page_size: filters?.pageSize || 10,
        })
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch your external opportunities"));
    }
    return response.json();
}

export async function fetchMyPartnerTeams(): Promise<PartnerTeam[]> {
    const response = await apiFetch(buildApiUrl("/api/v1/partners/me/teams"));
    return parseData<PartnerTeam[]>(response, "Failed to fetch partnered teams");
}

export async function createMyPartnerOpportunity(
    payload: PartnerOpportunityPayload
): Promise<PartnerOpportunity> {
    const response = await apiFetch(buildApiUrl("/api/v1/partners/me/opportunities"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    return parseData<PartnerOpportunity>(response, "Failed to create external opportunity");
}

export async function updateMyPartnerOpportunity(
    opportunityId: number,
    payload: PartnerOpportunityPayload
): Promise<PartnerOpportunity> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/partners/me/opportunities/${opportunityId}`),
        {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }
    );
    return parseData<PartnerOpportunity>(response, "Failed to update external opportunity");
}

export async function fetchAdminPartnerProfiles(): Promise<PartnerProfile[]> {
    const pageSize = 200;
    const profiles: PartnerProfile[] = [];
    let page = 1;
    let totalPages = 1;

    do {
        const response = await apiFetch(
            buildApiUrl("/api/v1/partners/admin/profiles", {
                page,
                page_size: pageSize,
            })
        );
        if (!response.ok) {
            throw new Error(await readApiError(response, "Failed to fetch partner profiles"));
        }
        const payload = await response.json();
        profiles.push(...((payload.data || []) as PartnerProfile[]));
        totalPages = Math.max(1, Number(payload.total_pages || 1));
        page += 1;
    } while (page <= totalPages);

    return profiles;
}

export async function saveAdminPartnerProfile(
    partnerUserId: number,
    payload: AdminPartnerProfilePayload
): Promise<PartnerProfile> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/partners/admin/profiles/${partnerUserId}`),
        {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }
    );
    return parseData<PartnerProfile>(response, "Failed to save partner profile");
}

export async function fetchAdminPartnerOpportunities(filters?: {
    page?: number;
    pageSize?: number;
}): Promise<PartnerOpportunity[]> {
    const payload = await fetchAdminPartnerOpportunityPage(filters);
    return payload.data;
}

export async function fetchAdminPartnerOpportunityPage(filters?: {
    page?: number;
    pageSize?: number;
}): Promise<PartnerOpportunityListResponse> {
    const response = await apiFetch(
        buildApiUrl("/api/v1/partners/admin/opportunities", {
            page: filters?.page || 1,
            page_size: filters?.pageSize || 20,
        })
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch external opportunities"));
    }
    return response.json();
}

export async function createAdminPartnerOpportunity(
    payload: AdminPartnerOpportunityPayload
): Promise<PartnerOpportunity> {
    const response = await apiFetch(buildApiUrl("/api/v1/partners/admin/opportunities"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    return parseData<PartnerOpportunity>(response, "Failed to create external opportunity");
}

export async function updateAdminPartnerOpportunity(
    opportunityId: number,
    payload: AdminPartnerOpportunityPayload
): Promise<PartnerOpportunity> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/partners/admin/opportunities/${opportunityId}`),
        {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }
    );
    return parseData<PartnerOpportunity>(response, "Failed to update external opportunity");
}
