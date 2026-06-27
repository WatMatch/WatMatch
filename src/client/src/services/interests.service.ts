import { apiFetch, buildApiUrl, readApiError } from "@/lib/api-client";

/**
 * Submit interest in a capstone project
 */
export async function submitInterest(
    projectId: string,
    message: string
): Promise<void> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/interests/${projectId}`),
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: message.trim() }),
        }
    );

    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to submit interest"));
    }
}

/**
 * Withdraw interest from a capstone project
 */
export async function withdrawInterest(capstoneId: string): Promise<void> {
    const response = await apiFetch(
        buildApiUrl(`/api/v1/interests/${capstoneId}`),
        {
            method: "DELETE",
        }
    );

    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to withdraw interest"));
    }
}
