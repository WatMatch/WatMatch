import useSWR from "swr";
import { buildApiUrl } from "@/lib/api-client";
import {
    fetchPastCapstones,
    fetchPastCapstoneMetadata,
    type PastCapstone,
    type PastCapstoneApiResponse,
    type PastCapstoneMetadataResponse,
} from "@/services/capstones.service";

interface UsePastCapstonesOptions {
    page: number;
    pageSize: number;
    search?: string;
    department?: string;
    year?: string;
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

    const parseDepartment = (value: unknown): string[] => {
        if (Array.isArray(value)) {
            return value
                .map((entry) =>
                    typeof entry === "string"
                        ? entry.trim()
                        : entry !== null && entry !== undefined
                        ? String(entry).trim()
                        : ""
                )
                .filter((entry) => entry.length > 0);
        }

        if (typeof value === "string") {
            const raw = value.trim();
            if (!raw) return [];

            if (raw.startsWith("{") && raw.endsWith("}")) {
                const inner = raw.slice(1, -1).trim();
                if (!inner) return [];
                return inner
                    .split(",")
                    .map((entry) => entry.trim().replace(/^"|"$/g, ""))
                    .filter((entry) => entry.length > 0);
            }

            if (raw.includes(",")) {
                return raw
                    .split(",")
                    .map((entry) => entry.trim())
                    .filter((entry) => entry.length > 0);
            }

            return [raw];
        }

        return [];
    };

    const departmentValues = parseDepartment(capstone.department);

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
    const search = urlObj.searchParams.get("search") || undefined;
    const department = urlObj.searchParams.get("department") || undefined;
    const year = urlObj.searchParams.get("year") || undefined;
    return await fetchPastCapstones(page, pageSize, {
        search,
        department,
        year,
    });
};

export function usePastCapstones({
    page,
    pageSize,
    search,
    department,
    year,
}: UsePastCapstonesOptions) {
    const url = buildApiUrl("/api/v1/capstones/past", {
        page,
        page_size: pageSize,
        search: search || undefined,
        department:
            department && department !== "All" ? department : undefined,
        year: year && year !== "All" ? year : undefined,
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

    const {
        data: metadata,
        isLoading: metadataLoading,
        error: metadataError,
    } = useSWR<PastCapstoneMetadataResponse>(
        buildApiUrl("/api/v1/capstones/past/metadata"),
        () => fetchPastCapstoneMetadata(),
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
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
        metadataLoading,
        totalPages,
        error: error ? "Could not load past capstones." : null,
        metadataError: metadataError
            ? "Could not load past capstone metadata."
            : null,
        departments: metadata?.data?.departments ?? [],
        years: metadata?.data?.years ?? [],
    };
}
