import { apiFetch, buildApiUrl } from "@/lib/api-client";

export interface Capstone {
    capstone_id: string;
    title?: string;
    description?: string;
    department?: string;
    year?: number;
    students?: string[];
    status?: string;
    disciplines?: string[];
    skills?: string[];
}

export interface CapstoneApiResponse {
    success: boolean;
    page?: number;
    page_size?: number;
    total?: number;
    total_pages?: number;
    data: Capstone[];
}

/**
 * Fetch all capstones with pagination
 */
export async function fetchCapstones(
    page: number,
    pageSize: number
): Promise<CapstoneApiResponse> {
    const url = buildApiUrl("/api/v1/capstones/all", {
        page,
        page_size: pageSize,
    });

    const response = await apiFetch(url);
    if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
    }

    const data: CapstoneApiResponse = await response.json();
    if (!data.success) {
        throw new Error("Failed to fetch capstones");
    }

    return data;
}

/**
 * Fetch a single capstone by ID
 */
export async function fetchCapstoneById(capstoneId: string): Promise<unknown> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/capstones/${capstoneId}`)
    );

    if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
    }

    return await response.json();
}

/**
 * Create a new capstone project
 */
export async function createCapstone(data: {
    title: string;
    description: string;
}): Promise<unknown> {
    const response = await apiFetch(buildApiUrl("/api/v1/capstones/create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Submission failed:", response.status, errorData);
        throw new Error(errorData.detail || "Failed to submit project");
    }

    return response.json();
}

/**
 * Approve a capstone (instructor only)
 */
export async function approveCapstone(capstoneId: string): Promise<void> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/capstones/${capstoneId}/approve`),
        {
            method: "POST",
        }
    );

    if (!response.ok) {
        throw new Error(`Failed to approve capstone: ${response.status}`);
    }
}

/**
 * Reject a capstone (instructor only)
 */
export async function rejectCapstone(capstoneId: string): Promise<void> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/capstones/${capstoneId}/reject`),
        {
            method: "POST",
        }
    );

    if (!response.ok) {
        throw new Error(`Failed to reject capstone: ${response.status}`);
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
        throw new Error(`Failed to request changes: ${response.status}`);
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
        throw new Error(`Backend error: ${response.status}`);
    }

    const data: CapstoneApiResponse = await response.json();
    if (!data.success) {
        throw new Error("Failed to fetch capstones");
    }

    return data;
}

// Past Capstones

export interface PastCapstone {
    id: string;
    title: string;
    description: string;
    department: string[];
    year: number;
    students: string[] | null;
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

/**
 * Fetch past capstones with pagination
 */
export async function fetchPastCapstones(
    page: number,
    pageSize: number
): Promise<PastCapstoneApiResponse> {
    const url = buildApiUrl("/api/v1/capstones/past", {
        page,
        page_size: pageSize,
    });

    const response = await apiFetch(url);
    if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
    }

    return await response.json();
}
