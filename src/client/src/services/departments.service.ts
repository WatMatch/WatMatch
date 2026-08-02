import { apiFetch, buildApiUrl, readApiError } from "@/lib/api-client";

export interface Faculty {
    faculty_id: number;
    name: string;
    active: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface Department {
    department_id: number;
    name: string;
    faculty_fk?: number | null;
    faculty_id?: number | null;
    faculty?: Faculty | null;
    active: boolean;
    created_at?: string;
    updated_at?: string;
}

interface DepartmentsResponse {
    success: boolean;
    data: Department[];
}

interface FacultiesResponse {
    success: boolean;
    data: Faculty[];
}

export async function fetchFaculties(activeOnly = false): Promise<Faculty[]> {
    const response = await apiFetch(
        buildApiUrl("/api/v1/departments/faculties/", { active_only: activeOnly })
    );

    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch faculties"));
    }

    const result: FacultiesResponse = await response.json();
    return result.data || [];
}

export async function fetchDepartments(activeOnly = false): Promise<Department[]> {
    const response = await apiFetch(
        buildApiUrl("/api/v1/departments/", { active_only: activeOnly })
    );

    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch departments"));
    }

    const result: DepartmentsResponse = await response.json();
    return result.data || [];
}

export async function createDepartment(payload: {
    name: string;
    faculty_id?: number | null;
}): Promise<Department> {
    const response = await apiFetch(buildApiUrl("/api/v1/departments/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to create department"));
    }

    const result = await response.json();
    return result.data as Department;
}

export async function updateDepartment(
    departmentId: number,
    payload: {
        name?: string;
        active?: boolean;
        faculty_id?: number | null;
        reason?: string;
    }
): Promise<Department> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/departments/${departmentId}`),
        {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }
    );

    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to update department"));
    }

    const result = await response.json();
    return result.data as Department;
}
