import useSWR from "swr";
import { buildApiUrl } from "@/lib/api-client";
import {
    fetchCapstones,
    createCapstone as createCapstoneService,
    type CapstoneApiResponse,
} from "@/services/capstones.service";

interface UseCapstonesOptions {
    page: number;
    pageSize: number;
    enabled?: boolean;
}

const fetcher = async (url: string): Promise<CapstoneApiResponse> => {
    const urlObj = new URL(url);
    const page = parseInt(urlObj.searchParams.get("page") || "1");
    const pageSize = parseInt(urlObj.searchParams.get("page_size") || "10");
    return await fetchCapstones(page, pageSize);
};

export function useCapstones({
    page,
    pageSize,
    enabled = true,
}: UseCapstonesOptions) {
    const url = enabled
        ? buildApiUrl("/api/v1/capstones/all", {
              page,
              page_size: pageSize,
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

    return {
        projects: data?.data ?? [],
        totalPages: Math.max(1, data?.total_pages ?? 1),
        isLoading,
        error: error ? "Could not load capstones." : null,
        mutate,
    };
}

// Re-export createCapstone for use in components
export const createCapstone = createCapstoneService;
