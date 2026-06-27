import useSWR from "swr";
import { buildApiUrl } from "@/lib/api-client";
import {
    fetchCapstones,
    fetchCapstoneMetadata,
    fetchFinalizedCapstones,
    fetchFinalizedCapstoneMetadata,
    createCapstone as createCapstoneService,
    type CapstoneApiResponse,
} from "@/services/capstones.service";

interface UseCapstonesOptions {
    page: number;
    pageSize: number;
    search?: string;
    department?: string;
    year?: string;
    enabled?: boolean;
}

const fetcher = async (url: string): Promise<CapstoneApiResponse> => {
    const urlObj = new URL(url);
    const page = parseInt(urlObj.searchParams.get("page") || "1");
    const pageSize = parseInt(urlObj.searchParams.get("page_size") || "10");
    const search = urlObj.searchParams.get("search") || undefined;
    const department = urlObj.searchParams.get("department") || undefined;
    const year = urlObj.searchParams.get("year") || undefined;
    return await fetchCapstones(page, pageSize, { search, department, year });
};

const finalizedFetcher = async (url: string): Promise<CapstoneApiResponse> => {
    const urlObj = new URL(url);
    const page = parseInt(urlObj.searchParams.get("page") || "1");
    const pageSize = parseInt(urlObj.searchParams.get("page_size") || "10");
    const search = urlObj.searchParams.get("search") || undefined;
    const department = urlObj.searchParams.get("department") || undefined;
    const year = urlObj.searchParams.get("year") || undefined;
    return await fetchFinalizedCapstones(page, pageSize, { search, department, year });
};

export function useCapstones({
    page,
    pageSize,
    search,
    department,
    year,
    enabled = true,
}: UseCapstonesOptions) {
    const url = enabled
        ? buildApiUrl("/api/v1/capstones/all", {
              page,
              page_size: pageSize,
              search: search || undefined,
              department: department && department !== "All" ? department : undefined,
              year: year && year !== "All" ? year : undefined,
          })
        : null;

    const { data, error, isLoading, mutate } = useSWR<CapstoneApiResponse>(
        url,
        fetcher,
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
        }
    );

    const {
        data: metadata,
        isLoading: metadataLoading,
        error: metadataError,
    } = useSWR(
        enabled ? "capstone-metadata" : null,
        fetchCapstoneMetadata,
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
        }
    );

    return {
        projects: data?.data ?? [],
        totalPages: Math.max(1, data?.total_pages ?? 1),
        isLoading,
        error: error ? "Could not load capstones." : null,
        departments: metadata?.departments ?? [],
        years: metadata?.years ?? [],
        metadataLoading,
        metadataError: metadataError ? "Could not load metadata." : null,
        mutate,
    };
}

export function useFinalizedCapstones({
    page,
    pageSize,
    search,
    department,
    year,
    enabled = true,
}: UseCapstonesOptions) {
    const url = enabled
        ? buildApiUrl("/api/v1/capstones/all/finalized", {
              page,
              page_size: pageSize,
              search: search || undefined,
              department: department && department !== "All" ? department : undefined,
              year: year && year !== "All" ? year : undefined,
          })
        : null;

    const { data, error, isLoading, mutate } = useSWR<CapstoneApiResponse>(
        url,
        finalizedFetcher,
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
        }
    );

    const {
        data: metadata,
        isLoading: metadataLoading,
        error: metadataError,
    } = useSWR(
        enabled ? "finalized-capstone-metadata" : null,
        fetchFinalizedCapstoneMetadata,
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
        }
    );

    return {
        projects: data?.data ?? [],
        totalPages: Math.max(1, data?.total_pages ?? 1),
        isLoading,
        error: error ? "Could not load finalized capstones." : null,
        departments: metadata?.departments ?? [],
        years: metadata?.years ?? [],
        metadataLoading,
        metadataError: metadataError ? "Could not load finalized metadata." : null,
        mutate,
    };
}

// Re-export createCapstone for use in components
export const createCapstone = createCapstoneService;
