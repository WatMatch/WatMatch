import useSWR from "swr";
import { buildApiUrl } from "@/lib/api-client";
import {
    fetchPastCapstones,
    type PastCapstone,
    type PastCapstoneApiResponse,
} from "@/services/capstones.service";

interface UsePastCapstonesOptions {
    page: number;
    pageSize: number;
}

const formatCapstone = (raw: unknown, index: number): PastCapstone => {
    const capstone = (raw ?? {}) as Record<string, unknown>;
    const safeString = (value: unknown, fallback: string) => {
        if (Array.isArray(value)) {
            const joined = value
                .map((entry) =>
                    typeof entry === "string"
                        ? entry.trim()
                        : entry !== null && entry !== undefined
                        ? String(entry).trim()
                        : ""
                )
                .filter((part) => part.length > 0)
                .join(", ");

            if (joined.length > 0) {
                return joined;
            }
        }

        if (typeof value === "string" && value.trim().length > 0) {
            return value;
        }

        return fallback;
    };

    const numericYear = Number(capstone.year);

    const departmentValues = Array.isArray(capstone.department)
        ? (capstone.department as unknown[])
              .map((value) =>
                  typeof value === "string"
                      ? value.trim()
                      : value !== null && value !== undefined
                      ? String(value).trim()
                      : ""
              )
              .filter((value) => value.length > 0)
        : [];

    return {
        id: String(
            capstone.past_capstone_id ??
                capstone.capstone_id ??
                capstone.id ??
                `past-capstone-${index}`
        ),
        title: safeString(capstone.title, "Untitled Project"),
        description: safeString(
            capstone.description,
            "No description provided."
        ),
        department:
            departmentValues.length > 0
                ? departmentValues
                : ["Unknown Department"],
        year:
            Number.isFinite(numericYear) && numericYear > 0
                ? numericYear
                : new Date().getFullYear(),
        students: Array.isArray(capstone.students)
            ? (capstone.students as string[])
            : Array.isArray(capstone.team_members)
            ? (capstone.team_members as string[])
            : [],
    };
};

const fetcher = async (url: string): Promise<PastCapstoneApiResponse> => {
    const urlObj = new URL(url);
    const page = parseInt(urlObj.searchParams.get("page") || "1");
    const pageSize = parseInt(urlObj.searchParams.get("page_size") || "10");
    return await fetchPastCapstones(page, pageSize);
};

export function usePastCapstones({ page, pageSize }: UsePastCapstonesOptions) {
    const url = buildApiUrl("/api/v1/capstones/past", {
        page,
        page_size: pageSize,
    });

    const { data, error, isLoading } = useSWR<PastCapstoneApiResponse>(
        url,
        fetcher,
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            keepPreviousData: true,
            dedupingInterval: Infinity,
        }
    );

    const records: unknown[] = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data)
        ? data
        : [];

    const pastCapstones = records.map(formatCapstone);

    const remoteTotalPages = Number(data?.total_pages ?? data?.totalPages);
    const totalPages =
        Number.isFinite(remoteTotalPages) && remoteTotalPages > 0
            ? remoteTotalPages
            : 1;

    return {
        pastCapstones,
        loading: isLoading,
        totalPages,
        error: error ? "Could not load past capstones." : null,
    };
}
