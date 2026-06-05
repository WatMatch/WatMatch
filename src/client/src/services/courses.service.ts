import { apiFetch, buildApiUrl, readApiError } from "@/lib/api-client";

export interface Course {
    course_id: number;
    code: string;
    name: string;
    term?: string | null;
    active?: boolean;
    created_at?: string;
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

export async function createCourse(payload: {
    code: string;
    name: string;
    term?: string;
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
    payload: { code?: string; name?: string; term?: string; active?: boolean }
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
