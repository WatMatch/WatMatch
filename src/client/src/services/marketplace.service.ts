import { apiFetch, buildApiUrl, readApiError } from "@/lib/api-client";

export type MarketplacePhase = "exploration" | "commitment" | "finalization";

export interface MarketplacePhaseContext {
    global_phase?: MarketplacePhase;
    effective_phase: MarketplacePhase;
    override_source?: "global" | "course" | "ecosystem";
    course_id?: number | null;
    ecosystem_id?: number | null;
    reason?: string | null;
    updated_by_fk?: number | null;
    updated_at?: string | null;
}

export interface MarketplaceSettings {
    setting_id?: number;
    current_term: string;
    current_season?: "Winter" | "Spring" | "Fall" | null;
    phase: MarketplacePhase;
    exploration_starts_at?: string | null;
    commitment_starts_at?: string | null;
    finalization_starts_at?: string | null;
    can_student_abandon_solo_project?: boolean;
    updated_at?: string | null;
    updated_by_fk?: number | null;
    override_reason?: string | null;
}

export interface MarketplaceStudentSummary {
    user_id: number;
    email: string;
    course_fk?: number | null;
    enrollment_course_fk?: number | null;
    enrollment_course?: MarketplaceCourseSummary | null;
    home_department_id?: number | null;
    home_department?:
        | string
        | {
              department_id: number;
              name: string;
              active?: boolean;
          }
        | null;
}

export interface MarketplaceTeamSummary {
    team_id: number;
    leader_fk?: number | null;
    course_fk?: number | null;
    status?: string | null;
    capstone_fk?: number | null;
    commitment_roster_confirmed_at?: string | null;
    commitment_roster_confirmed_by_fk?: number | null;
    commitment_roster_note?: string | null;
}

export interface MarketplaceCapstoneSummary {
    capstone_id: number;
    title: string;
    description?: string | null;
    status?: string | null;
    marketplace_phase?: MarketplacePhase;
    marketplace_phase_context?: MarketplacePhaseContext | null;
    can_express_interest?: boolean;
    can_invite?: boolean;
    can_commit?: boolean;
    completed_at?: string | null;
    completed_by_fk?: number | null;
    completed_term?: string | null;
    completion_notes?: string | null;
    course_fk?: number | null;
    team_fk?: number | null;
    closeout_decision?: CapstoneCloseoutDecision | null;
    closeout_decided_at?: string | null;
    closeout_applied_at?: string | null;
    continued_to_course_fk?: number | null;
    continued_to_term?: string | null;
    published_past_capstone_fk?: number | null;
    published_watmatch_past_capstone_fk?: number | null;
    carry_over_read_only?: boolean;
}

export interface MarketplaceCourseSummary {
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
    marketplace_phase_override?: MarketplacePhase | null;
    marketplace_phase_override_reason?: string | null;
    marketplace_phase_context?: MarketplacePhaseContext | null;
    effective_marketplace_phase?: MarketplacePhase;
    requires_project_support?: boolean;
    active_instructor_count?: number;
}

export interface MarketplaceCourseActivationPreview {
    target_term: string;
    target_season: "Winter" | "Spring" | "Fall";
    counts: {
        will_activate: number;
        will_deactivate: number;
        force_active: number;
        force_inactive: number;
        blocked_missing_instructor: number;
    };
    will_activate: MarketplaceCourseSummary[];
    will_deactivate: MarketplaceCourseSummary[];
    force_active: MarketplaceCourseSummary[];
    force_inactive: MarketplaceCourseSummary[];
    blocked_missing_instructor: MarketplaceCourseSummary[];
}

export interface MarketplaceCourseHealthRow extends MarketplaceCourseSummary {
    pending_review_count: number;
    pending_routing_count: number;
    pending_commitment_count: number;
    course_reassignment_count: number;
    pipeline_issue_count: number;
    ready_for_review: boolean;
    health_status:
        | "ready"
        | "inactive"
        | "missing_instructor"
        | "force_inactive"
        | "pipeline_issue"
        | "workload"
        | string;
}

export type CapstoneCloseoutDecision =
    | "continue_to_course"
    | "publish_completed"
    | "carry_over_read_only"
    | "archive"
    | "clear_decision";

export interface CapstoneCloseoutSummary {
    capstone_id: number;
    title: string;
    description?: string | null;
    status?: string | null;
    completed_at?: string | null;
    completed_by_fk?: number | null;
    completed_term?: string | null;
    completion_notes?: string | null;
    course_fk?: number | null;
    team_fk?: number | null;
    team_status?: string | null;
    closeout_decision?: CapstoneCloseoutDecision | null;
    closeout_decided_at?: string | null;
    closeout_applied_at?: string | null;
    closeout_notes?: string | null;
    continued_to_course_fk?: number | null;
    continued_to_term?: string | null;
    continued_member_enrollment_routes?: Record<string, number> | null;
    published_past_capstone_fk?: number | null;
    published_watmatch_past_capstone_fk?: number | null;
    carry_over_read_only?: boolean;
    departments?: Array<{ department_id: number; name: string; active?: boolean }> | null;
    members?: Array<{
        user_id?: number;
        email?: string;
        course_fk?: number | null;
        enrollment_course_fk?: number | null;
        enrollment_course?: {
            course_id: number;
            code?: string;
            name?: string;
            active?: boolean;
            routing_kind?: string;
            ecosystem_fk?: number | null;
        } | null;
        is_leader?: boolean;
        home_department?: string | null;
    }> | null;
    support?: Record<string, unknown> | null;
    invalid_reason?: string | null;
}

export interface MarketplaceReadinessBlocker {
    [key: string]: unknown;
}

export interface MarketplaceActivityBlocker {
    capstone_id: number;
    title?: string | null;
    status?: string | null;
    team_fk?: number | null;
    team_status?: string | null;
    activity_count?: number | null;
    status_counts?: Record<string, number> | null;
    explorations?: Array<{
        exploration_id?: number;
        status?: string | null;
        student_fk?: number | null;
        student_email?: string | null;
        updated_at?: string | null;
        student_commitment_confirmed?: boolean;
        team_commitment_confirmed?: boolean;
    }> | null;
}

export interface MarketplaceReadinessCounts {
    pending_capstone_reviews: number;
    pending_commitments: number;
    pending_enrollment_requests: number;
    support_gaps: number;
    closeout_required: number;
    invalid_pending_continuations: number;
    unresolved_marketplace_activity: number;
    invalid_member_enrollments?: number;
    phase_overrides?: number;
}

export interface MarketplaceReadiness {
    current_settings?: MarketplaceSettings | null;
    target_term: string;
    target_phase: MarketplacePhase;
    term_changed: boolean;
    transition?: {
        from_term?: string | null;
        from_phase?: MarketplacePhase | null;
        to_term?: string | null;
        to_phase?: MarketplacePhase | null;
        term_changed?: boolean;
        phase_changed?: boolean;
        normal?: boolean;
        override_required?: boolean;
    };
    course_activation_preview?: MarketplaceCourseActivationPreview | null;
    has_blockers: boolean;
    has_attention_items?: boolean;
    counts: MarketplaceReadinessCounts;
    attention_counts?: MarketplaceReadinessCounts;
    blocking_counts?: MarketplaceReadinessCounts;
    blockers: {
        pending_capstone_reviews: MarketplaceReadinessBlocker[];
        pending_commitments: MarketplaceReadinessBlocker[];
        pending_enrollment_requests: MarketplaceReadinessBlocker[];
        support_gaps: CapstoneCloseoutSummary[];
        closeout_required: CapstoneCloseoutSummary[];
        invalid_pending_continuations: CapstoneCloseoutSummary[];
        unresolved_marketplace_activity: MarketplaceActivityBlocker[];
        invalid_member_enrollments?: MarketplaceReadinessBlocker[];
        phase_overrides?: MarketplaceReadinessBlocker[];
    };
}

export interface EnrollmentWorkloadCounts {
    pending_commitments: number;
    submission_enrollment_requests: number;
    course_reassignment_requests: number;
    pending_course_routing: number;
    pending_reviews: number;
    active_no_course_students: number;
    unstaffed_active_courses: number;
}

export interface EnrollmentWorkloadSummary {
    marketplace?: MarketplaceSettings | null;
    counts: EnrollmentWorkloadCounts;
    global_counts?: EnrollmentWorkloadCounts;
    filtered_counts?: EnrollmentWorkloadCounts;
    oldest_pending_at?: string | null;
    filtered_attention_count?: number;
    cleanup?: {
        cancelled_stale_commitments?: number;
    };
    filters?: {
        search?: string | null;
        course_id?: number | null;
        department_id?: number | null;
        queue_type?: string | null;
    };
    attention_items: Array<{
        kind: string;
        label: string;
        entity_id: number | string;
        student_email?: string | null;
        project_title?: string | null;
        created_at?: string | null;
        recommended_course_fk?: number | null;
    }>;
    course_health?: MarketplaceCourseHealthRow[];
}

export interface ProjectExploration {
    exploration_id: number;
    capstone_fk: number;
    team_fk: number;
    student_fk: number;
    status:
        | "shortlisted"
        | "interested"
        | "invited"
        | "exploring"
        | "pending_commitment"
        | "withdrawn"
        | "declined"
        | "not_selected"
        | "expired"
        | "committed";
    source?: string | null;
    priority_rank?: number | null;
    message?: string | null;
    student_commitment_confirmed_at?: string | null;
    student_commitment_confirmed_by_fk?: number | null;
    team_commitment_confirmed_at?: string | null;
    team_commitment_confirmed_by_fk?: number | null;
    student_commitment_confirmed?: boolean;
    team_commitment_confirmed?: boolean;
    commitment_confirmed_by_both?: boolean;
    created_at?: string;
    updated_at?: string;
    student?: MarketplaceStudentSummary | null;
    team?: MarketplaceTeamSummary | null;
    capstone?: MarketplaceCapstoneSummary | null;
}

export interface ProjectCommitmentRequest {
    commitment_request_id: number;
    exploration_fk?: number | null;
    capstone_fk: number;
    team_fk: number;
    student_fk: number;
    status: "pending" | "approved" | "rejected" | "cancelled";
    requested_by_fk?: number | null;
    decision_route?:
        | "course_enrolled"
        | "interdisciplinary"
        | "other_course"
        | null;
    target_course_fk?: number | null;
    comments?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface ProjectCommitmentConfirmationResponse {
    exploration?: ProjectExploration | null;
    explorations?: ProjectExploration[];
    commitment_request?: ProjectCommitmentRequest | null;
    commitment_requests?: ProjectCommitmentRequest[];
    affected_commitment_request_ids?: number[];
    routed_students?: MarketplaceStudentSummary[];
    awaiting_side?: "student" | "team" | "roster" | null;
    roster_confirmation_required?: boolean;
    roster_confirmed?: boolean;
    direct_routed?: boolean;
    committed_count?: number;
    routed_count?: number;
    review_reopened?: boolean;
    target_course?: {
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
    } | null;
    coordinating_course?: MarketplaceCourseSummary | null;
    capstone?: MarketplaceCapstoneSummary | null;
    team?: MarketplaceTeamSummary | null;
}

export interface ProjectCommitmentQueueItem {
    request: ProjectCommitmentRequest;
    exploration?: ProjectExploration | null;
    student?: MarketplaceStudentSummary | null;
    official_members?: Array<MarketplaceStudentSummary & { is_leader?: boolean | null }> | null;
    team?: MarketplaceTeamSummary | null;
    capstone?: MarketplaceCapstoneSummary | null;
    team_pending_count?: number | null;
    recommended_course?: {
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
    requested_by?: {
        user_id?: number;
        email?: string;
        role?: string;
    } | null;
}

export interface StudentExplorationPayload {
    success: boolean;
    data: ProjectExploration[];
    commitment_requests: ProjectCommitmentRequest[];
    marketplace?: MarketplaceSettings | null;
}

export async function fetchMarketplaceSettings(): Promise<MarketplaceSettings> {
    const response = await apiFetch(buildApiUrl("/api/v1/marketplace/settings"));
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch marketplace settings"));
    }
    const payload = await response.json();
    return payload.data;
}

export async function updateMarketplaceSettings(
    settings: MarketplaceSettings
): Promise<MarketplaceSettings> {
    const response = await apiFetch(buildApiUrl("/api/v1/marketplace/settings"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
    });
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to update marketplace settings"));
    }
    const payload = await response.json();
    return payload.data;
}

export async function fetchMarketplaceReadiness(params?: {
    current_term?: string | null;
    phase?: MarketplacePhase | null;
}): Promise<MarketplaceReadiness> {
    const response = await apiFetch(
        buildApiUrl("/api/v1/marketplace/readiness", {
            current_term: params?.current_term || undefined,
            phase: params?.phase || undefined,
        })
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch marketplace readiness"));
    }
    const payload = await response.json();
    return payload.data;
}

export async function fetchEnrollmentWorkloadSummary(params?: {
    search?: string | null;
    course_id?: number | null;
    department_id?: number | null;
    queue_type?: string | null;
}): Promise<EnrollmentWorkloadSummary> {
    const response = await apiFetch(
        buildApiUrl("/api/v1/marketplace/workload", {
            search: params?.search || undefined,
            course_id: params?.course_id ? String(params.course_id) : undefined,
            department_id: params?.department_id ? String(params.department_id) : undefined,
            queue_type: params?.queue_type || undefined,
        })
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch enrollment workload"));
    }
    const payload = await response.json();
    return payload.data;
}

export async function fetchCapstonesNeedingCloseout(params?: {
    include_carried_over?: boolean;
}): Promise<CapstoneCloseoutSummary[]> {
    const response = await apiFetch(
        buildApiUrl("/api/v1/marketplace/closeout", {
            include_carried_over: params?.include_carried_over ? "true" : undefined,
        })
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch closeout capstones"));
    }
    const payload = await response.json();
    return payload.data || [];
}

export async function decideCapstoneCloseout(
    capstoneId: number,
    payload: {
        decision: CapstoneCloseoutDecision;
        target_course_id?: number | null;
        notes: string;
        target_term?: string | null;
        member_enrollment_routes?: Record<string, number> | null;
    }
): Promise<CapstoneCloseoutSummary> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/marketplace/closeout/${capstoneId}/decision`),
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
        throw new Error(await readApiError(response, "Failed to save closeout decision"));
    }
    const result = await response.json();
    return result.data;
}

export async function resolveMarketplaceActivityForFinalization(payload: {
    capstone_id?: number | null;
    reason: string;
}): Promise<{ resolved_count?: number; message?: string }> {
    const response = await apiFetch(
        buildApiUrl("/api/v1/marketplace/readiness/resolve-marketplace-activity"),
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                capstone_id: payload.capstone_id ?? null,
                reason: payload.reason.trim(),
            }),
        }
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to resolve marketplace activity"));
    }
    return await response.json();
}

export async function fetchMyProjectExplorations(): Promise<StudentExplorationPayload> {
    const response = await apiFetch(buildApiUrl("/api/v1/marketplace/explorations/me"));
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch marketplace explorations"));
    }
    return await response.json();
}

export async function saveProjectExploration(payload: {
    capstone_id: number;
    status?: "shortlisted" | "interested";
    message?: string | null;
    priority_rank?: number | null;
    student_id?: number | null;
    override_reason?: string | null;
}): Promise<ProjectExploration> {
    const response = await apiFetch(buildApiUrl("/api/v1/marketplace/explorations"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to save marketplace exploration"));
    }
    const result = await response.json();
    return result.data;
}

export async function createProjectCommitment(payload: {
    exploration_id: number;
    comments?: string | null;
}): Promise<ProjectCommitmentRequest | ProjectCommitmentConfirmationResponse> {
    const response = await apiFetch(buildApiUrl("/api/v1/marketplace/commitments"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to confirm commitment"));
    }
    const result = await response.json();
    return result.data;
}

export async function confirmTeamCommitmentRoster(payload: {
    team_id: number;
    comments?: string | null;
}): Promise<ProjectCommitmentRequest | ProjectCommitmentConfirmationResponse> {
    const response = await apiFetch(buildApiUrl("/api/v1/marketplace/commitments/roster"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to confirm commitment roster"));
    }
    const result = await response.json();
    return result.data;
}

export async function cancelProjectExploration(
    explorationId: number,
    reason?: string | null
): Promise<ProjectExploration> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/marketplace/explorations/${explorationId}/cancel`),
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: reason?.trim() || null }),
        }
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to cancel marketplace exploration"));
    }
    const result = await response.json();
    return result.data;
}

export async function fetchPendingProjectCommitments(
    page = 1,
    pageSize = 10,
    params?: {
        search?: string | null;
        course_id?: number | null;
        department_id?: number | null;
    }
): Promise<{
    data: ProjectCommitmentQueueItem[];
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
}> {
    const response = await apiFetch(
        buildApiUrl("/api/v1/marketplace/commitments/pending", {
            page,
            page_size: pageSize,
            search: params?.search || undefined,
            course_id: params?.course_id ? String(params.course_id) : undefined,
            department_id: params?.department_id ? String(params.department_id) : undefined,
        })
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch commitment requests"));
    }
    return await response.json();
}

export async function decideProjectCommitment(
    commitmentRequestId: number,
    payload: {
        decision: "approve" | "reject" | "cancel";
        decision_route?:
            | "course_enrolled"
            | "interdisciplinary"
            | "other_course"
            | null;
        target_course_id?: number | null;
        member_enrollment_routes?: Record<string, number> | null;
        comments?: string | null;
    }
): Promise<ProjectCommitmentRequest | ProjectCommitmentConfirmationResponse> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/marketplace/commitments/${commitmentRequestId}/decision`),
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to save commitment decision"));
    }
    const result = await response.json();
    return result.data;
}
