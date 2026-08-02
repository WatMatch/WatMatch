import useSWR from "swr";
import { buildApiUrl } from "@/lib/api-client";
import {
    fetchPastCapstones,
    fetchPastCapstoneMetadata,
    fetchPastWatmatchCapstones,
    fetchPastWatmatchCapstoneMetadata,
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
    source?: "scraped" | "watmatch";
    savedOnly?: boolean;
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
    const pastCapstoneId =
        typeof capstone.past_capstone_id === "number"
            ? capstone.past_capstone_id
            : undefined;
    const pastWatmatchCapstoneId =
        typeof capstone.past_watmatch_capstone_id === "number"
            ? capstone.past_watmatch_capstone_id
            : undefined;
    const sourceType =
        capstone.source_type === "watmatch" || pastWatmatchCapstoneId
            ? "watmatch"
            : "historical";
    const rawSourceId =
        typeof capstone.source_id === "number"
            ? capstone.source_id
            : pastWatmatchCapstoneId ?? pastCapstoneId;

    return {
        id: String(
            pastCapstoneId ??
                pastWatmatchCapstoneId ??
                capstone.capstone_id ??
                capstone.id ??
                `past-capstone-${index}`
        ),
        shortlist_id:
            typeof capstone.shortlist_id === "number"
                ? capstone.shortlist_id
                : undefined,
        source_type: sourceType,
        source_id: typeof rawSourceId === "number" ? rawSourceId : undefined,
        past_capstone_id: pastCapstoneId,
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
        source_fk:
            typeof capstone.source_fk === "number"
                ? capstone.source_fk
                : null,
        source_capstone_fk:
            typeof capstone.source_capstone_fk === "number"
                ? capstone.source_capstone_fk
                : null,
        source_team_fk:
            typeof capstone.source_team_fk === "number"
                ? capstone.source_team_fk
                : null,
        past_watmatch_capstone_id: pastWatmatchCapstoneId,
        completed_term:
            typeof capstone.completed_term === "string"
                ? capstone.completed_term
                : null,
        skills: Array.isArray(capstone.skills)
            ? (capstone.skills as string[]).filter((entry) => typeof entry === "string" && entry.trim())
            : [],
        deliverable_types: Array.isArray(capstone.deliverable_types)
            ? (capstone.deliverable_types as string[]).filter((entry) => typeof entry === "string" && entry.trim())
            : [],
        mentor_name:
            typeof capstone.mentor_name === "string"
                ? capstone.mentor_name
                : null,
        external_partner_name:
            typeof capstone.external_partner_name === "string"
                ? capstone.external_partner_name
                : null,
        external_partner_organization:
            typeof capstone.external_partner_organization === "string"
                ? capstone.external_partner_organization
                : null,
        is_shortlisted: capstone.is_shortlisted === true,
        shortlisted_at:
            typeof capstone.shortlisted_at === "string"
                ? capstone.shortlisted_at
                : null,
    };
};

const fetcher = async (url: string): Promise<PastCapstoneApiResponse> => {
    const urlObj = new URL(url);
    const page = parseInt(urlObj.searchParams.get("page") || "1");
    const pageSize = parseInt(urlObj.searchParams.get("page_size") || "10");
    const search = urlObj.searchParams.get("search") || undefined;
    const department = urlObj.searchParams.get("department") || undefined;
    const year = urlObj.searchParams.get("year") || undefined;
    const savedOnly = urlObj.searchParams.get("saved_only") === "true";
    const isWatmatchNative = urlObj.pathname.includes("/past/watmatch");
    const fetchRecords = isWatmatchNative ? fetchPastWatmatchCapstones : fetchPastCapstones;
    return await fetchRecords(page, pageSize, {
        search,
        department,
        year,
        savedOnly,
    });
};

export function usePastCapstones({
    page,
    pageSize,
    search,
    department,
    year,
    source = "scraped",
    savedOnly = false,
}: UsePastCapstonesOptions) {
    const isWatmatchNative = source === "watmatch";
    const url = buildApiUrl(isWatmatchNative ? "/api/v1/capstones/past/watmatch" : "/api/v1/capstones/past", {
        page,
        page_size: pageSize,
        search: search || undefined,
        department:
            department && department !== "All" ? department : undefined,
        year: year && year !== "All" ? year : undefined,
        saved_only: savedOnly || undefined,
    });

    const { data, error, isLoading, mutate } = useSWR<PastCapstoneApiResponse>(
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
        buildApiUrl(isWatmatchNative ? "/api/v1/capstones/past/watmatch/metadata" : "/api/v1/capstones/past/metadata"),
        () => isWatmatchNative ? fetchPastWatmatchCapstoneMetadata() : fetchPastCapstoneMetadata(),
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
        mutate,
    };
}
