import { apiFetch, buildApiUrl, readApiError } from "@/lib/api-client";

export interface AuditLogRow {
    audit_id: number;
    actor_fk: number | null;
    actor_email?: string | null;
    actor_role: string | null;
    action: string;
    entity_type: string;
    entity_id: string;
    reason: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
    context?: {
        team_id?: number | null;
        team_label?: string | null;
        capstone_id?: number | null;
        capstone_title?: string | null;
        course_ids?: number[];
        courses?: Array<{
            course_id: number;
            code: string;
            name: string;
            active?: boolean;
            active_terms?: string[];
            activation_mode?: "auto" | "force_active" | "force_inactive";
            department_fk?: number | null;
            routing_kind?: "standard" | "interdisciplinary";
        }>;
    };
}

export interface AuditLogResponse {
    rows: AuditLogRow[];
    total: number;
    limit: number;
    filters: {
        actions: string[];
        entity_types: string[];
    };
}

export async function fetchAuditLog(params?: {
    entity_type?: string;
    action?: string;
    actor_search?: string;
    course_id?: number;
    team_id?: number;
    context_search?: string;
    limit?: number;
}): Promise<AuditLogResponse> {
    const response = await apiFetch(
        buildApiUrl("/api/v1/approvals/audit-log", {
            entity_type: params?.entity_type || undefined,
            action: params?.action || undefined,
            actor_search: params?.actor_search || undefined,
            course_id: params?.course_id || undefined,
            team_id: params?.team_id || undefined,
            context_search: params?.context_search || undefined,
            limit: params?.limit || 200,
        })
    );
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch audit log"));
    }
    const payload = await response.json();
    return {
        rows: payload.data || [],
        total: Number(payload.total || 0),
        limit: Number(payload.limit || params?.limit || 200),
        filters: {
            actions: payload.filters?.actions || [],
            entity_types: payload.filters?.entity_types || [],
        },
    };
}
