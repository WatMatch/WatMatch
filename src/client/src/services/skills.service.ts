import { apiFetch, buildApiUrl, readApiError } from "@/lib/api-client";

export interface Skill {
    skill_id: number;
    name: string;
    created_at?: string;
    updated_at?: string;
}

interface SkillsResponse {
    success: boolean;
    data: Skill[];
}

export async function fetchSkills(): Promise<Skill[]> {
    const response = await apiFetch(buildApiUrl("/api/v1/skills/"));

    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to fetch skills"));
    }

    const result: SkillsResponse = await response.json();
    return result.data || [];
}

export async function createSkill(payload: { name: string }): Promise<Skill> {
    const response = await apiFetch(buildApiUrl("/api/v1/skills/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to create skill"));
    }

    const result = await response.json();
    return result.data as Skill;
}

export async function updateSkill(
    skillId: number,
    payload: { name?: string }
): Promise<Skill> {
    const response = await apiFetch(buildApiUrl(`/api/v1/skills/${skillId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to update skill"));
    }

    const result = await response.json();
    return result.data as Skill;
}
