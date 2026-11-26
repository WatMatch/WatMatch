import { apiFetch, buildApiUrl, readApiError } from "@/lib/api-client";

export interface FeedbackDraft {
    entry_id: string;
    milestone: string;
    comment: string;
}

export interface MilestoneFeedback extends FeedbackDraft {
    created_at: string;
}

function feedbackUrl(capstoneId: number) {
    return buildApiUrl(`/api/v1/capstones/${capstoneId}/milestone-feedback`);
}

export async function listMilestoneFeedback(capstoneId: number): Promise<MilestoneFeedback[]> {
    const response = await apiFetch(feedbackUrl(capstoneId), { cache: "no-store" });
    if (!response.ok) throw new Error(await readApiError(response, "Could not load feedback."));
    return response.json();
}

export async function addMilestoneFeedback(capstoneId: number, draft: FeedbackDraft): Promise<MilestoneFeedback> {
    const response = await apiFetch(feedbackUrl(capstoneId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
    });
    if (!response.ok) throw new Error(await readApiError(response, "Could not record feedback."));
    return response.json();
}
