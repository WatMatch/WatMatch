import { apiFetch, buildApiUrl, readApiError } from "@/lib/api-client";
import type { MarketplacePhaseContext } from "./courses.service";

interface CapstoneCourseSummary {
    course_id: number;
    code: string;
    name: string;
    active?: boolean;
    active_terms?: string[];
    activation_mode?: "auto" | "force_active" | "force_inactive";
    department_fk?: number | null;
    ecosystem_fk?: number | null;
    department?: {
        department_id: number;
        name: string;
        active?: boolean;
    } | null;
    ecosystem?: {
        ecosystem_id: number;
        name: string;
        description?: string | null;
        active?: boolean;
    } | null;
    routing_kind?: "standard" | "interdisciplinary";
    requires_project_support?: boolean;
}

type SubmissionTrack = "home_course" | "interdisciplinary";

export interface MentorUserSummary {
    user_id: number;
    email: string;
    active?: boolean;
    profile?: MentorProfile | null;
}

export interface MentorProfile {
    mentor_fk?: number;
    display_name?: string | null;
    primary_department_fk?: number | null;
    primary_department?: {
        department_id: number;
        name: string;
        active?: boolean;
    } | null;
    departments?: Array<{
        department_id: number;
        name: string;
        active?: boolean;
    }>;
    affiliation?: string | null;
    bio?: string | null;
    availability_terms?: string[];
    expertise_tags?: string[];
    max_active_projects?: number | null;
    active_project_count?: number;
    updated_at?: string | null;
}

export interface AcceptedMentorSummary {
    mentor_request_id: number;
    mentor_fk: number;
    mentor_email?: string | null;
    accepted_at?: string | null;
    request_source?: string | null;
    profile?: MentorProfile | null;
}

export interface CapstoneSupportSummary {
    requires_project_support?: boolean;
    has_support?: boolean;
    accepted_mentor?: AcceptedMentorSummary | null;
    pending_mentor_request_count?: number;
    pending_mentor_offer_count?: number;
    external_partner_support_confirmed?: boolean;
    external_partner_support_confirmed_at?: string | null;
    external_partner?: {
        name?: string | null;
        organization?: string | null;
        email?: string | null;
    } | null;
}

export interface MentorRequest {
    mentor_request_id: number;
    capstone_fk: number;
    team_fk?: number | null;
    mentor_fk: number;
    requested_by_fk?: number | null;
    request_source: "team_request" | "staff_request" | "mentor_offer";
    status: "pending" | "accepted" | "declined" | "cancelled";
    message?: string | null;
    response_note?: string | null;
    decided_by_fk?: number | null;
    decided_at?: string | null;
    created_at?: string;
    updated_at?: string;
    mentor?: {
        user_id: number;
        email: string;
        active?: boolean;
        profile?: MentorProfile | null;
    } | null;
    requested_by?: {
        user_id?: number | null;
        email?: string | null;
        role?: string | null;
    } | null;
    capstone?: (Capstone & { team_fk?: number | null; course_fk?: number | null }) | null;
    team?: {
        team_id: number;
        leader_fk?: number | null;
        course_fk?: number | null;
        status?: string;
    } | null;
}

export interface MentorDashboardData {
    profile?: MentorProfile | null;
    pending_requests: MentorRequest[];
    accepted_projects: MentorRequest[];
    offers: MentorRequest[];
}

export interface Capstone {
    capstone_id: string;
    user_fk?: string | number;
    title?: string;
    description?: string;
    department?: string;
    year?: number;
    students?: string[];
    status?: string;
    public_status?: string;
    disciplines?: string[];
    department_ids?: number[];
    departments?: Array<{
        department_id: number;
        name: string;
        active?: boolean;
    }>;
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
    project_start_date?: string;
    uw_resources?: string;
    org_resources?: string;
    other_resources?: string;
    how_heard_about_capstone?: string;
    proposed_team_members?: string;
    submission_track?: SubmissionTrack;
    requested_course_fk?: number | null;
    course_fk?: number | null;
    course?: CapstoneCourseSummary | null;
    coordinating_course?: CapstoneCourseSummary | null;
    ecosystem_fk?: number | null;
    ecosystem_id?: number | null;
    ecosystem?: {
        ecosystem_id: number;
        name: string;
        description?: string | null;
        active?: boolean;
    } | null;
    created_at?: string;
    completed_at?: string | null;
    completed_by_fk?: number | null;
    completed_term?: string | null;
    completion_notes?: string | null;
    marketplace_phase?: "exploration" | "commitment" | "finalization";
    marketplace_phase_context?: MarketplacePhaseContext | null;
    marketplace_action_state?: "actionable" | "read_only" | "finalized" | string;
    read_only_reason?: string | null;
    closeout_decision?: "continue_to_course" | "publish_completed" | "carry_over_read_only" | "archive" | null;
    closeout_decided_at?: string | null;
    closeout_applied_at?: string | null;
    continued_to_course_fk?: number | null;
    continued_to_term?: string | null;
    published_past_capstone_fk?: number | null;
    published_watmatch_past_capstone_fk?: number | null;
    carry_over_read_only?: boolean;
    can_shortlist?: boolean;
    can_express_interest?: boolean;
    can_invite?: boolean;
    can_offer_mentor?: boolean;
    can_offer_mentor_support?: boolean;
    can_commit?: boolean;
    external_partner_name?: string | null;
    external_partner_organization?: string | null;
    external_partner_email?: string | null;
    external_partner_website?: string | null;
    external_partner_support_confirmed?: boolean;
    external_partner_support_confirmed_at?: string | null;
    support_summary?: CapstoneSupportSummary;
}

export interface CapstoneApiResponse {
    success: boolean;
    page?: number;
    page_size?: number;
    total?: number;
    total_pages?: number;
    data: Capstone[];
}

export interface CourseRoutingMember {
    user_id: number;
    email: string;
    role?: string;
    is_leader?: boolean;
    course_id?: number | null;
    course_code?: string | null;
    course_name?: string | null;
    home_department_id?: number | null;
    home_department?: string | null;
}

export interface CourseRoutingItem {
    capstone: Capstone & {
        team_fk?: number | null;
        course_fk?: number | null;
        course_routing_notes?: string | null;
    };
    team?: {
        team_id: number;
        leader_fk?: number | null;
        course_fk?: number | null;
        status?: string;
    } | null;
    target_course?: {
        course_id: number;
        code: string;
        name: string;
        active?: boolean;
        active_terms?: string[];
        activation_mode?: "auto" | "force_active" | "force_inactive";
        department_fk?: number | null;
        department?: {
            department_id: number;
            name: string;
            active?: boolean;
        } | null;
        routing_kind?: "standard" | "interdisciplinary";
    } | null;
    members: CourseRoutingMember[];
    pending_reassignments?: Array<Record<string, unknown>>;
}

export interface CourseRoutingApiResponse {
    success: boolean;
    message?: string;
    page?: number;
    page_size?: number;
    total?: number;
    total_pages?: number;
    data: CourseRoutingItem[];
}

export interface ProjectSubmissionEnrollmentItem {
    request: {
        request_id: number;
        student_fk: number;
        from_course_fk?: number | null;
        to_course_fk?: number | null;
        request_source?: string | null;
        proposal_payload?: Record<string, unknown> | null;
        comments?: string | null;
        created_at?: string;
    };
    student?: {
        user_id: number;
        email: string;
        course_fk?: number | null;
        home_department_id?: number | null;
        home_department?: string | null;
    } | null;
    from_course?: CapstoneCourseSummary | null;
    requested_course?: CapstoneCourseSummary | null;
    requested_by?: {
        user_id?: number | null;
        email?: string | null;
        role?: string | null;
    } | null;
}

export interface ProjectSubmissionEnrollmentApiResponse {
    success: boolean;
    message?: string;
    page?: number;
    page_size?: number;
    total?: number;
    total_pages?: number;
    data: ProjectSubmissionEnrollmentItem[];
}

function normalizeCapstoneRows(rows: Capstone[] = []): Capstone[] {
    return rows.map((row) => {
        const normalized = { ...row };
        if (!normalized.disciplines?.length && Array.isArray(normalized.departments)) {
            normalized.disciplines = normalized.departments
                .map((department) => department.name)
                .filter(Boolean);
        }
        if (!normalized.department && Array.isArray(normalized.disciplines)) {
            normalized.department = normalized.disciplines[0] || undefined;
        }
        if (!normalized.year && normalized.created_at) {
            const parsedYear = Number(normalized.created_at.slice(0, 4));
            if (!Number.isNaN(parsedYear)) {
                normalized.year = parsedYear;
            }
        }
        return normalized;
    });
}

export interface ApprovalHistoryRecord {
    approval_id: number;
    capstone_fk: number;
    instructor_fk: number | null;
    instructor_display?: string | null;
    instructor_name?: string | null;
    instructor_email?: string | null;
    action: string;
    comments: string | null;
    created_at: string;
}

export interface FullCapstoneDetails {
    capstone_id: string;
    title?: string;
    description?: string;
    status?: string;
    disciplines?: string[];
    department_ids?: number[];
    departments?: Array<{
        department_id: number;
        name: string;
        active?: boolean;
    }>;
    skills?: string[];
    problem_area?: string;
    main_objectives?: string;
    scope_of_work?: string;
    deliverables?: string;
    success_criteria?: string;
    validation_plan?: string;
    stakeholders?: string;
    risks_constraints?: string;
    public_evaluation_acknowledged?: boolean;
    ip_acknowledged?: boolean;
    confidentiality_acknowledged?: boolean;
    meeting_frequency?: string;
    project_start_date?: string;
    uw_resources?: string;
    org_resources?: string;
    other_resources?: string;
    how_heard_about_capstone?: string;
    deliverable_types?: string[];
    proposed_team_members?: string;
    submission_track?: SubmissionTrack;
    requested_course_fk?: number | null;
    course_fk?: number | null;
    course?: CapstoneCourseSummary | null;
    coordinating_course?: CapstoneCourseSummary | null;
    requested_course?: CapstoneCourseSummary | null;
    ecosystem_fk?: number | null;
    ecosystem_id?: number | null;
    ecosystem?: {
        ecosystem_id: number;
        name: string;
        description?: string | null;
        active?: boolean;
    } | null;
    support_summary?: CapstoneSupportSummary;
    organization_name?: string;
    primary_contact?: string;
    email?: string;
    phone?: string;
    website?: string;
    organization_description?: string;
    organization_size?: string;
    sector?: string;
    partner_opportunity_fk?: number | null;
    partner_opportunity_snapshot?: Record<string, unknown> | null;
    external_partner_name?: string | null;
    external_partner_organization?: string | null;
    external_partner_email?: string | null;
    external_partner_website?: string | null;
    external_partner_notes?: string | null;
    external_partner_support_confirmed?: boolean;
    external_partner_support_confirmed_at?: string | null;
}

/**
 * Fetch all capstones with pagination
 */
export async function fetchCapstones(
    page: number,
    pageSize: number,
    filters?: {
        search?: string;
        department?: string;
        year?: string;
    }
): Promise<CapstoneApiResponse> {
    const url = buildApiUrl("/api/v1/capstones/all", {
        page,
        page_size: pageSize,
        search: filters?.search || undefined,
        department:
            filters?.department && filters.department !== "All"
                ? filters.department
                : undefined,
        year: filters?.year && filters.year !== "All" ? filters.year : undefined,
    });

    const response = await apiFetch(url);
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch capstones"));
    }

    const data: CapstoneApiResponse = await response.json();
    if (!data.success) {
        throw new Error("Failed to fetch capstones");
    }
    return {
        ...data,
        data: normalizeCapstoneRows(data.data || []),
    };
}

export async function fetchFinalizedCapstones(
    page: number,
    pageSize: number,
    filters?: {
        search?: string;
        department?: string;
        year?: string;
    }
): Promise<CapstoneApiResponse> {
    const url = buildApiUrl("/api/v1/capstones/all/finalized", {
        page,
        page_size: pageSize,
        search: filters?.search || undefined,
        department:
            filters?.department && filters.department !== "All"
                ? filters.department
                : undefined,
        year: filters?.year && filters.year !== "All" ? filters.year : undefined,
    });

    const response = await apiFetch(url);
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch finalized capstones"));
    }

    const data: CapstoneApiResponse = await response.json();
    if (!data.success) {
        throw new Error("Failed to fetch finalized capstones");
    }
    return {
        ...data,
        data: normalizeCapstoneRows(data.data || []),
    };
}

/**
 * Fetch a single capstone by ID
 */
export async function fetchCapstoneById(
    capstoneId: string
): Promise<FullCapstoneDetails | null> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/capstones/${capstoneId}/full`)
    );

    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch capstone metadata"));
    }

    const payload = await response.json();
    if (payload && typeof payload === "object" && "data" in payload) {
        return (payload as { data?: FullCapstoneDetails | null }).data ?? null;
    }
    return payload as FullCapstoneDetails | null;
}

/**
 * Create a new capstone project
 */
export async function createCapstone(data: {
    user_id: number;
    course_id: number;
    submission_track?: SubmissionTrack;
    team_id?: number;
    title: string;
    description: string;
    project_start_date?: string | null;
    project_disciplines?: string[];
    department_ids?: number[];
    skills_required?: string[];
    problem_area?: string | null;
    main_objectives?: string | null;
    scope_of_work?: string | null;
    deliverables?: string | null;
    success_criteria?: string | null;
    validation_plan?: string | null;
    stakeholders?: string | null;
    risks_constraints?: string | null;
    public_evaluation_acknowledged?: boolean;
    ip_acknowledged?: boolean;
    confidentiality_acknowledged?: boolean;
    meeting_frequency?: string | null;
    uw_resources?: string | null;
    org_resources?: string | null;
    other_resources?: string | null;
    how_heard_about_capstone?: string | null;
    deliverable_types?: string[];
    proposed_team_members?: string | null;
    organization_name?: string | null;
    primary_contact?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    organization_description?: string | null;
    organization_size?: string | null;
    sector?: string | null;
    partner_opportunity_id?: number | null;
    external_partner_name?: string | null;
    external_partner_organization?: string | null;
    external_partner_email?: string | null;
    external_partner_website?: string | null;
    external_partner_notes?: string | null;
    external_partner_confirmed?: boolean;
    finalization_override?: boolean;
    finalization_override_reason?: string | null;
}): Promise<unknown> {
    const response = await apiFetch(buildApiUrl("/api/v1/capstones/create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to submit project"));
    }

    return response.json();
}

/**
 * Approve a capstone (instructor only)
 */
export async function approveCapstone(
    capstoneId: string,
    comments?: string
): Promise<void> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/capstones/${capstoneId}/approve`),
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                comments: comments?.trim() || null,
            }),
        }
    );

    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to approve capstone"));
    }
}

/**
 * Reject a capstone (instructor only)
 */
export async function rejectCapstone(
    capstoneId: string,
    comments?: string
): Promise<void> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/capstones/${capstoneId}/reject`),
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                comments: comments?.trim() || null,
            }),
        }
    );

    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to reject capstone"));
    }
}

/**
 * Request changes on a capstone (instructor only)
 */
export async function requestCapstoneChanges(
    capstoneId: string,
    comments: string
): Promise<void> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/capstones/${capstoneId}/request-changes`),
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                comments,
            }),
        }
    );

    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to request changes"));
    }
}

/**
 * Fetch capstones pending review (instructor only)
 */
export async function fetchPendingCapstones(
    page: number,
    pageSize: number
): Promise<CapstoneApiResponse> {
    const url = buildApiUrl("/api/v1/capstones/review", {
        page,
        page_size: pageSize,
    });

    const response = await apiFetch(url);
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch review capstones"));
    }

    const data: CapstoneApiResponse = await response.json();
    if (!data.success) {
        throw new Error("Failed to fetch capstones");
    }

    return data;
}

export async function fetchCourseRoutingCapstones(
    page: number,
    pageSize: number,
    params?: {
        search?: string | null;
        course_id?: number | null;
        department_id?: number | null;
    }
): Promise<CourseRoutingApiResponse> {
    const response = await apiFetch(
        buildApiUrl("/api/v1/capstones/course-routing", {
            page,
            page_size: pageSize,
            search: params?.search || undefined,
            course_id: params?.course_id ? String(params.course_id) : undefined,
            department_id: params?.department_id ? String(params.department_id) : undefined,
        })
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch course routing queue"));
    }
    const data: CourseRoutingApiResponse = await response.json();
    if (!data.success) {
        throw new Error("Failed to fetch course routing queue");
    }
    return data;
}

export async function routeCapstoneCourse(
    capstoneId: string,
    data: {
        target_course_id: number;
        comments?: string | null;
    }
): Promise<void> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/capstones/${capstoneId}/route-course`),
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        }
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to route capstone course"));
    }
}

export async function requestProjectSubmissionEnrollment(data: {
    target_course_id: number;
    comments?: string | null;
}): Promise<ProjectSubmissionEnrollmentItem> {
    const response = await apiFetch(
        buildApiUrl("/api/v1/capstones/submission-enrollment-requests"),
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        }
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to request course enrollment"));
    }
    const payload = await response.json();
    return payload.data;
}

export async function fetchProjectSubmissionEnrollmentRequests(
    page: number,
    pageSize: number,
    params?: {
        search?: string | null;
        course_id?: number | null;
        department_id?: number | null;
    }
): Promise<ProjectSubmissionEnrollmentApiResponse> {
    const response = await apiFetch(
        buildApiUrl("/api/v1/capstones/submission-enrollment-requests", {
            page,
            page_size: pageSize,
            search: params?.search || undefined,
            course_id: params?.course_id ? String(params.course_id) : undefined,
            department_id: params?.department_id ? String(params.department_id) : undefined,
        })
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch submission enrollment requests"));
    }
    const data: ProjectSubmissionEnrollmentApiResponse = await response.json();
    if (!data.success) {
        throw new Error("Failed to fetch submission enrollment requests");
    }
    return data;
}

export async function decideProjectSubmissionEnrollmentRequest(
    requestId: number,
    data: {
        decision: "approve" | "reject" | "cancel";
        target_course_id?: number | null;
        comments?: string | null;
    }
): Promise<void> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/capstones/submission-enrollment-requests/${requestId}/decision`),
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        }
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to save submission enrollment decision"));
    }
}

export async function fetchActiveMentors(params?: {
    search?: string;
    department_id?: number | null;
    availability_term?: string | null;
}): Promise<MentorUserSummary[]> {
    const response = await apiFetch(
        buildApiUrl("/api/v1/capstones/mentors/active", {
            search: params?.search?.trim() || undefined,
            department_id: params?.department_id || undefined,
            availability_term: params?.availability_term || undefined,
        })
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch active mentors"));
    }
    const payload = await response.json();
    return (payload.data || []) as MentorUserSummary[];
}

export async function updateMentorProfile(payload: {
    mentor_id?: number | null;
    display_name?: string | null;
    primary_department_id?: number | null;
    department_ids?: number[] | null;
    affiliation?: string | null;
    bio?: string | null;
    availability_terms?: string[] | null;
    expertise_tags?: string[] | null;
    max_active_projects?: number | null;
}): Promise<MentorProfile> {
    const endpoint = payload.mentor_id
        ? `/api/v1/capstones/mentors/${payload.mentor_id}/profile`
        : "/api/v1/capstones/mentor/profile";
    const response = await apiFetch(buildApiUrl(endpoint), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to save mentor profile"));
    }
    const result = await response.json();
    return result.data as MentorProfile;
}

export async function fetchMentorDashboard(): Promise<MentorDashboardData> {
    const response = await apiFetch(buildApiUrl("/api/v1/capstones/mentor/dashboard"));
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch mentor dashboard"));
    }
    const payload = await response.json();
    const data = payload.data || {};
    return {
        profile: (data.profile || null) as MentorProfile | null,
        pending_requests: (data.pending_requests || []) as MentorRequest[],
        accepted_projects: (data.accepted_projects || []) as MentorRequest[],
        offers: (data.offers || []) as MentorRequest[],
    };
}

export async function fetchCapstoneMentorRequests(
    capstoneId: string | number
): Promise<{
    requests: MentorRequest[];
    support_summary: CapstoneSupportSummary;
}> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/capstones/${capstoneId}/mentor-requests`)
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch mentor requests"));
    }
    const payload = await response.json();
    const data = payload.data;
    return {
        requests: (Array.isArray(data)
            ? data
            : data?.requests || data?.mentor_requests || []) as MentorRequest[],
        support_summary: (payload.support_summary || data?.support_summary || {}) as CapstoneSupportSummary,
    };
}

export async function requestMentor(
    capstoneId: string | number,
    payload: { mentor_id: number; message?: string | null }
): Promise<MentorRequest> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/capstones/${capstoneId}/mentor-requests`),
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to request mentor"));
    }
    const result = await response.json();
    return result.data as MentorRequest;
}

export async function offerMentor(
    capstoneId: string | number,
    payload: { message?: string | null } = {}
): Promise<MentorRequest> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/capstones/${capstoneId}/mentor-offer`),
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to offer mentorship"));
    }
    const result = await response.json();
    return result.data as MentorRequest;
}

export async function decideMentorRequest(
    requestId: number,
    payload: {
        decision: "accept" | "decline";
        response_note?: string | null;
    }
): Promise<MentorRequest> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/capstones/mentor-requests/${requestId}/decision`),
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to save mentor decision"));
    }
    const result = await response.json();
    return result.data as MentorRequest;
}

export async function decideMentorOffer(
    requestId: number,
    payload: {
        decision: "accept" | "decline";
        response_note?: string | null;
    }
): Promise<MentorRequest> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/capstones/mentor-offers/${requestId}/decision`),
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to save mentor offer decision"));
    }
    const result = await response.json();
    return result.data as MentorRequest;
}

export async function cancelMentorRequest(
    requestId: number,
    payload: { reason?: string | null } = {}
): Promise<MentorRequest> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/capstones/mentor-requests/${requestId}/cancel`),
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to cancel mentor request"));
    }
    const result = await response.json();
    return result.data as MentorRequest;
}

export async function fetchCapstoneMetadata(): Promise<{
    departments: string[];
    years: string[];
}> {
    const response = await apiFetch(buildApiUrl("/api/v1/capstones/all/metadata"));
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch capstone metadata"));
    }
    const payload = await response.json();
    const data = payload?.data || {};
    return {
        departments: Array.isArray(data.departments) ? data.departments : [],
        years: Array.isArray(data.years) ? data.years : [],
    };
}

export async function fetchFinalizedCapstoneMetadata(): Promise<{
    departments: string[];
    years: string[];
}> {
    const response = await apiFetch(buildApiUrl("/api/v1/capstones/all/finalized/metadata"));
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch finalized metadata"));
    }
    const payload = await response.json();
    const data = payload?.data || {};
    return {
        departments: Array.isArray(data.departments) ? data.departments : [],
        years: Array.isArray(data.years) ? data.years : [],
    };
}

export async function deleteCapstone(
    capstoneId: string,
    reason: string
): Promise<void> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/capstones/${capstoneId}/archive`),
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                reason: reason?.trim() || null,
            }),
        }
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to delete capstone"));
    }
}

export async function fetchCapstoneApprovalHistory(
    capstoneId: string
): Promise<ApprovalHistoryRecord[]> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/approvals/capstone/${capstoneId}`)
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch approval history"));
    }
    const payload = await response.json();
    return payload.data || [];
}

export async function resubmitCapstone(
    capstoneId: string,
    data: {
        title?: string;
        description?: string;
        project_disciplines?: string[];
        department_ids?: number[];
        skills_required?: string[];
        problem_area?: string;
        main_objectives?: string;
        scope_of_work?: string;
        deliverables?: string;
        success_criteria?: string;
        validation_plan?: string;
        stakeholders?: string;
        risks_constraints?: string;
        public_evaluation_acknowledged?: boolean;
        ip_acknowledged?: boolean;
        confidentiality_acknowledged?: boolean;
        meeting_frequency?: string;
        project_start_date?: string;
        uw_resources?: string;
        org_resources?: string;
        other_resources?: string;
        how_heard_about_capstone?: string;
        deliverable_types?: string[];
        proposed_team_members?: string;
        organization_name?: string;
        primary_contact?: string;
        email?: string;
        phone?: string;
        website?: string;
        organization_description?: string;
        organization_size?: string;
        sector?: string;
        partner_opportunity_id?: number | null;
        external_partner_name?: string | null;
        external_partner_organization?: string | null;
        external_partner_email?: string | null;
        external_partner_website?: string | null;
        external_partner_notes?: string | null;
        external_partner_confirmed?: boolean;
        change_summary: string;
    }
): Promise<void> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/capstones/${capstoneId}/resubmit`),
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        }
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to resubmit capstone"));
    }
}

export async function withdrawCapstoneReview(capstoneId: string): Promise<void> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/capstones/${capstoneId}/withdraw-review`),
        {
            method: "POST",
        }
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to reopen capstone for edits"));
    }
}

export async function completeCapstone(
    capstoneId: string | number,
    payload: {
        notes: string;
        completed_term?: string | null;
    }
): Promise<Capstone | null> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/capstones/${capstoneId}/complete`),
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...payload,
                notes: payload.notes.trim(),
            }),
        }
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to mark capstone complete"));
    }
    const result = await response.json();
    return result?.data ?? null;
}

// Past Capstones

export interface PastCapstone {
    id: string;
    shortlist_id?: number;
    source_type?: "historical" | "watmatch" | "scraped";
    source_id?: number;
    past_capstone_id?: number;
    title: string;
    description: string;
    department: string[];
    year: number;
    students: string[] | null;
    source_fk?: number | null;
    source_capstone_fk?: number | null;
    source_team_fk?: number | null;
    past_watmatch_capstone_id?: number;
    completed_term?: string | null;
    skills?: string[];
    deliverable_types?: string[];
    mentor_name?: string | null;
    external_partner_name?: string | null;
    external_partner_organization?: string | null;
    is_shortlisted?: boolean;
    shortlisted_at?: string | null;
    status?: string;
}

export interface PastCapstoneApiResponse {
    success?: boolean;
    page?: number;
    page_size?: number;
    total?: number;
    total_pages?: number;
    totalPages?: number;
    data?: unknown[];
    results?: unknown[];
}

export interface PastCapstoneMetadataResponse {
    success: boolean;
    data: {
        departments: string[];
        years: string[];
        courses: Array<{
            course_id: number;
            code: string;
            name: string;
        }>;
    };
}

/**
 * Fetch past capstones with pagination
 */
export async function fetchPastCapstones(
    page: number,
    pageSize: number,
    filters?: {
        search?: string;
        department?: string;
        year?: string;
        savedOnly?: boolean;
    }
): Promise<PastCapstoneApiResponse> {
    const url = buildApiUrl("/api/v1/capstones/past", {
        page,
        page_size: pageSize,
        search: filters?.search || undefined,
        department:
            filters?.department && filters.department !== "All"
                ? filters.department
                : undefined,
        year: filters?.year && filters.year !== "All" ? filters.year : undefined,
        saved_only: filters?.savedOnly || undefined,
    });

    const response = await apiFetch(url);
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch past capstones"));
    }

    return await response.json();
}

export async function fetchPastCapstoneMetadata(): Promise<PastCapstoneMetadataResponse> {
    const response = await apiFetch(buildApiUrl("/api/v1/capstones/past/metadata"));
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch past capstone metadata"));
    }
    return await response.json();
}

export async function fetchPastWatmatchCapstones(
    page: number,
    pageSize: number,
    filters?: {
        search?: string;
        department?: string;
        year?: string;
        savedOnly?: boolean;
    }
): Promise<PastCapstoneApiResponse> {
    const url = buildApiUrl("/api/v1/capstones/past/watmatch", {
        page,
        page_size: pageSize,
        search: filters?.search || undefined,
        department:
            filters?.department && filters.department !== "All"
                ? filters.department
                : undefined,
        year: filters?.year && filters.year !== "All" ? filters.year : undefined,
        saved_only: filters?.savedOnly || undefined,
    });

    const response = await apiFetch(url);
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch WatMatch-native past capstones"));
    }

    return await response.json();
}

export async function fetchPastWatmatchCapstoneMetadata(): Promise<PastCapstoneMetadataResponse> {
    const response = await apiFetch(buildApiUrl("/api/v1/capstones/past/watmatch/metadata"));
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch WatMatch-native past capstone metadata"));
    }
    return await response.json();
}

function normalizePastCapstonePayload(row: Partial<PastCapstone>): PastCapstone {
    const sourceType = row.source_type === "watmatch" ? "watmatch" : "historical";
    const sourceId =
        row.source_id ??
        (sourceType === "watmatch"
            ? row.past_watmatch_capstone_id
            : row.past_capstone_id);
    return {
        ...row,
        id: String(row.id ?? sourceId ?? ""),
        source_type: sourceType,
        source_id: sourceId,
        title: row.title || "Untitled Project",
        description: row.description || "No description provided.",
        department: Array.isArray(row.department) && row.department.length > 0 ? row.department : ["Unknown Department"],
        year: Number(row.year) || new Date().getFullYear(),
        students: Array.isArray(row.students) ? row.students : [],
        is_shortlisted: row.is_shortlisted ?? Boolean(row.shortlisted_at),
    };
}

export async function fetchMyPastCapstoneShortlists(limit = 6): Promise<PastCapstone[]> {
    const response = await apiFetch(
        buildApiUrl("/api/v1/capstones/past/shortlists/me", { limit })
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch saved past capstones"));
    }
    const payload = await response.json();
    return ((payload.data || []) as Array<Partial<PastCapstone>>).map(normalizePastCapstonePayload);
}

export async function savePastCapstoneShortlist(payload: {
    source_type: "scraped" | "historical" | "watmatch";
    source_id: number;
}): Promise<unknown> {
    const response = await apiFetch(buildApiUrl("/api/v1/capstones/past/shortlists"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to save past capstone"));
    }
    const result = await response.json();
    return result.data;
}

export async function deletePastCapstoneShortlist(payload: {
    source_type: "scraped" | "historical" | "watmatch";
    source_id: number;
}): Promise<unknown> {
    const response = await apiFetch(buildApiUrl("/api/v1/capstones/past/shortlists"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to remove saved past capstone"));
    }
    const result = await response.json();
    return result.data;
}

export interface PastCapstoneImportSummary {
    created: number;
    updated: number;
    errors: Array<{
        row: number;
        title?: string;
        error: string;
    }>;
}

export async function createAdminPastCapstone(payload: {
    title: string;
    description?: string | null;
    department: string;
    year: string;
    students?: string[];
    source_course_id?: number | null;
    reason: string;
}): Promise<PastCapstone> {
    const response = await apiFetch(buildApiUrl("/api/v1/capstones/admin/past"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            ...payload,
            reason: payload.reason.trim(),
        }),
    });
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to create past capstone"));
    }
    const result = await response.json();
    return result.data;
}

export async function updateAdminPastCapstone(
    pastCapstoneId: number,
    payload: {
        title: string;
        description?: string | null;
        department: string;
        year: string;
        students?: string[];
        source_course_id?: number | null;
        reason: string;
    }
): Promise<PastCapstone> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/capstones/admin/past/${pastCapstoneId}`),
        {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...payload,
                reason: payload.reason.trim(),
            }),
        }
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to update past capstone"));
    }
    const result = await response.json();
    return result.data;
}

export async function deleteAdminPastCapstone(
    pastCapstoneId: number,
    reason: string
): Promise<void> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/capstones/admin/past/${pastCapstoneId}/delete`),
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: reason.trim() }),
        }
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to delete past capstone"));
    }
}

export async function importAdminPastCapstonesCsv(
    csvText: string
): Promise<PastCapstoneImportSummary> {
    const response = await apiFetch(buildApiUrl("/api/v1/capstones/admin/past/import"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv_text: csvText }),
    });
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to import past capstones"));
    }
    const result = await response.json();
    return result.data;
}
