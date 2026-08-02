export interface OperationsQueueFilters {
    search?: string;
    courseId?: number | null;
    departmentId?: number | null;
}

export function matchesSearch(search: string | undefined, values: Array<string | null | undefined>) {
    const normalized = (search || "").trim().toLowerCase();
    if (!normalized) return true;
    return values.some((value) => (value || "").toLowerCase().includes(normalized));
}

export function matchesOptionalId(targetId: number | null | undefined, values: Array<number | null | undefined>) {
    if (!targetId) return true;
    return values.some((value) => Number(value) === Number(targetId));
}

