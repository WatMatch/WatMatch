import { apiFetch, buildApiUrl, readApiError } from "@/lib/api-client";

export type MarketplacePhase = "exploration" | "commitment" | "finalization";
export type CourseOfferingStatus = "draft" | "active" | "inactive" | "archived";

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

export interface Course {
    course_id: number;
    code: string;
    name: string;
    active?: boolean;
    stored_active?: boolean;
    active_for_current_term?: boolean;
    available_for_current_term?: boolean;
    active_terms?: string[];
    activation_mode?: "auto" | "force_active" | "force_inactive";
    department_fk?: number | null;
    department_id?: number | null;
    ecosystem_fk?: number | null;
    ecosystem_id?: number | null;
    department?: {
        department_id: number;
        name: string;
        faculty_fk?: number | null;
        faculty?: {
            faculty_id: number;
            name: string;
            active?: boolean;
        } | null;
        active?: boolean;
    } | null;
    ecosystem?: {
        ecosystem_id: number;
        name: string;
        description?: string | null;
        active?: boolean;
        marketplace_phase_override?: MarketplacePhase | null;
        marketplace_phase_override_reason?: string | null;
        marketplace_phase_override_updated_by_fk?: number | null;
        marketplace_phase_override_updated_at?: string | null;
        effective_marketplace_phase?: MarketplacePhase;
        marketplace_phase_context?: MarketplacePhaseContext;
    } | null;
    routing_kind?: "standard" | "interdisciplinary";
    current_marketplace_term?: string | null;
    current_offering?: CourseOffering | null;
    offering_status?: CourseOfferingStatus | null;
    effective_title?: string | null;
    effective_name?: string | null;
    effective_topic?: string | null;
    effective_description?: string | null;
    effective_routing_kind?: "standard" | "interdisciplinary";
    effective_ecosystem_id?: number | null;
    effective_ecosystem?: ProjectEcosystem | null;
    effective_requires_project_support?: boolean | null;
    retired_for_routing?: boolean;
    marketplace_phase_override?: MarketplacePhase | null;
    marketplace_phase_override_reason?: string | null;
    marketplace_phase_override_updated_by_fk?: number | null;
    marketplace_phase_override_updated_at?: string | null;
    effective_marketplace_phase?: MarketplacePhase;
    marketplace_phase_context?: MarketplacePhaseContext;
    can_set_course_phase_override?: boolean;
    requires_project_support?: boolean;
    active_instructor_count?: number;
    default_pipeline_course_id?: number | null;
    pipeline_next_courses?: CoursePipelineEdge[];
    created_at?: string;
}

export interface CoursePipelineEdge {
    course_pipeline_edge_id: number;
    from_course_fk: number;
    to_course_fk: number;
    active?: boolean;
    is_default?: boolean;
    notes?: string | null;
    course?: Course | null;
    to_course?: Course | null;
}

export interface CourseOfferingHeldWith {
    course_offering_fk: number;
    held_with_course_fk: number;
    held_with_offering_fk?: number | null;
    notes?: string | null;
    course?: Course | null;
    held_with_course?: Course | null;
}

export interface CourseOffering {
    course_offering_id: number;
    course_fk: number;
    term: string;
    title_override?: string | null;
    description?: string | null;
    topic?: string | null;
    section_label?: string | null;
    status: CourseOfferingStatus;
    routing_kind_override?: "standard" | "interdisciplinary" | null;
    ecosystem_fk?: number | null;
    ecosystem_id?: number | null;
    ecosystem?: ProjectEcosystem | null;
    requires_project_support?: boolean | null;
    student_registration_notes?: string | null;
    admin_routing_notes?: string | null;
    source_url?: string | null;
    held_with?: CourseOfferingHeldWith[];
    held_with_course_ids?: number[];
    held_with_courses?: Course[];
    course?: Course | null;
    created_at?: string | null;
    updated_at?: string | null;
}

export interface CloneCourseOfferingsResult {
    source_term: string;
    target_term: string;
    target_status: Exclude<CourseOfferingStatus, "archived">;
    overwrite_existing: boolean;
    source_count: number;
    created_count: number;
    updated_count: number;
    skipped_count: number;
    unresolved_held_with_count: number;
    created_or_updated_offering_ids?: number[];
    skipped?: Array<{
        source_offering_id?: number;
        existing_offering_id?: number;
        course_id?: number;
        section_label?: string | null;
    }>;
    offerings?: CourseOffering[];
}

export interface ProjectEcosystem {
    ecosystem_id: number;
    name: string;
    description?: string | null;
    active?: boolean;
    marketplace_phase_override?: MarketplacePhase | null;
    marketplace_phase_override_reason?: string | null;
    marketplace_phase_override_updated_by_fk?: number | null;
    marketplace_phase_override_updated_at?: string | null;
    effective_marketplace_phase?: MarketplacePhase;
    marketplace_phase_context?: MarketplacePhaseContext;
    can_set_ecosystem_phase_override?: boolean;
    created_at?: string;
    updated_at?: string | null;
}

interface CoursesResponse {
    success: boolean;
    data: Course[];
}

export async function fetchCourses(activeOnly = false): Promise<Course[]> {
    const response = await apiFetch(
        buildApiUrl("/api/v1/courses/", { active_only: activeOnly })
    );

    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch courses"));
    }

    const result: CoursesResponse = await response.json();
    return result.data || [];
}

export async function fetchProjectEcosystems(activeOnly = false): Promise<ProjectEcosystem[]> {
    const response = await apiFetch(
        buildApiUrl("/api/v1/courses/ecosystems", { active_only: activeOnly })
    );

    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch project ecosystems"));
    }

    const result: { success: boolean; data: ProjectEcosystem[] } = await response.json();
    return result.data || [];
}

export async function createCourse(payload: {
    code: string;
    name: string;
    active_terms?: string[];
    activation_mode?: "auto" | "force_active" | "force_inactive";
    department_id?: number | null;
    ecosystem_id?: number | null;
    routing_kind?: "standard" | "interdisciplinary";
    marketplace_phase_override?: MarketplacePhase | null;
    marketplace_phase_override_reason?: string | null;
    requires_project_support?: boolean;
}): Promise<Course> {
    const response = await apiFetch(buildApiUrl("/api/v1/courses/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to create course"));
    }

    const result = await response.json();
    return result.data as Course;
}

export async function updateCourse(
    courseId: number,
    payload: {
        code?: string;
        name?: string;
        active_terms?: string[];
        activation_mode?: "auto" | "force_active" | "force_inactive";
        department_id?: number | null;
        ecosystem_id?: number | null;
        routing_kind?: "standard" | "interdisciplinary";
        marketplace_phase_override?: MarketplacePhase | null;
        marketplace_phase_override_reason?: string | null;
        requires_project_support?: boolean;
    }
): Promise<Course> {
    const response = await apiFetch(buildApiUrl(`/api/v1/courses/${courseId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to update course"));
    }

    const result = await response.json();
    return result.data as Course;
}

export async function fetchCourseOfferings(params?: {
    term?: string | null;
    course_id?: number | null;
}): Promise<CourseOffering[]> {
    const response = await apiFetch(
        buildApiUrl("/api/v1/courses/offerings", {
            term: params?.term || undefined,
            course_id: params?.course_id || undefined,
        })
    );

    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch course offerings"));
    }

    const result: { success: boolean; data: CourseOffering[] } = await response.json();
    return result.data || [];
}

export async function upsertCourseOffering(payload: {
    course_offering_id?: number | null;
    course_id: number;
    term: string;
    title_override?: string | null;
    description?: string | null;
    topic?: string | null;
    section_label?: string | null;
    status?: CourseOfferingStatus;
    routing_kind_override?: "standard" | "interdisciplinary" | null;
    ecosystem_id?: number | null;
    requires_project_support?: boolean | null;
    student_registration_notes?: string | null;
    admin_routing_notes?: string | null;
    source_url?: string | null;
    held_with_course_ids?: number[];
}): Promise<CourseOffering> {
    const offeringId = payload.course_offering_id;
    const response = await apiFetch(
        buildApiUrl(
            offeringId
                ? `/api/v1/courses/offerings/${offeringId}`
                : "/api/v1/courses/offerings"
        ),
        {
            method: offeringId ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                course_id: payload.course_id,
                term: payload.term,
                title_override: payload.title_override ?? null,
                description: payload.description ?? null,
                topic: payload.topic ?? null,
                section_label: payload.section_label ?? null,
                status: payload.status || "draft",
                routing_kind_override: payload.routing_kind_override ?? null,
                ecosystem_id: payload.ecosystem_id ?? null,
                requires_project_support: payload.requires_project_support ?? null,
                student_registration_notes: payload.student_registration_notes ?? null,
                admin_routing_notes: payload.admin_routing_notes ?? null,
                source_url: payload.source_url ?? null,
                held_with_course_ids: payload.held_with_course_ids || [],
            }),
        }
    );

    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to save course offering"));
    }

    const result = await response.json();
    return result.data as CourseOffering;
}

export async function cloneCourseOfferings(payload: {
    source_term: string;
    target_term: string;
    target_status?: Exclude<CourseOfferingStatus, "archived">;
    overwrite_existing?: boolean;
    reason?: string | null;
}): Promise<CloneCourseOfferingsResult> {
    const response = await apiFetch(buildApiUrl("/api/v1/courses/offerings/clone"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            source_term: payload.source_term,
            target_term: payload.target_term,
            target_status: payload.target_status || "draft",
            overwrite_existing: payload.overwrite_existing === true,
            reason: payload.reason ?? null,
        }),
    });

    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to clone course offerings"));
    }

    const result = await response.json();
    return result.data as CloneCourseOfferingsResult;
}

export async function updateProjectEcosystem(
    ecosystemId: number,
    payload: {
        description?: string | null;
        active?: boolean;
        marketplace_phase_override?: MarketplacePhase | null;
        marketplace_phase_override_reason?: string | null;
    }
): Promise<ProjectEcosystem> {
    const body: {
        description: string | null;
        active?: boolean;
        marketplace_phase_override: MarketplacePhase | null;
        marketplace_phase_override_reason: string | null;
    } = {
        description: payload.description ?? null,
        marketplace_phase_override: payload.marketplace_phase_override ?? null,
        marketplace_phase_override_reason: payload.marketplace_phase_override_reason ?? null,
    };
    if ("active" in payload) {
        body.active = payload.active;
    }

    const response = await apiFetch(buildApiUrl(`/api/v1/courses/ecosystems/${ecosystemId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to update project ecosystem"));
    }

    const result = await response.json();
    return result.data as ProjectEcosystem;
}

export async function upsertCoursePipelineEdge(payload: {
    course_pipeline_edge_id?: number | null;
    from_course_id: number;
    to_course_id: number;
    active?: boolean;
    is_default?: boolean;
    notes?: string | null;
}): Promise<CoursePipelineEdge> {
    const edgeId = payload.course_pipeline_edge_id;
    const response = await apiFetch(
        buildApiUrl(
            edgeId
                ? `/api/v1/courses/pipeline-edges/${edgeId}`
                : "/api/v1/courses/pipeline-edges"
        ),
        {
            method: edgeId ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                from_course_id: payload.from_course_id,
                to_course_id: payload.to_course_id,
                active: payload.active !== false,
                is_default: payload.is_default === true,
                notes: payload.notes ?? null,
            }),
        }
    );

    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to save pipeline edge"));
    }

    const result = await response.json();
    return result.data as CoursePipelineEdge;
}
