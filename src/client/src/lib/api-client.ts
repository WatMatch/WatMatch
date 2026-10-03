export interface FetchOptions extends RequestInit {
    headers?: Record<string, string>;
}

let isRefreshing = false;
let failedQueue: Array<{
    resolve: (token: string) => void;
    reject: (error: Error) => void;
}> = [];

const RAW_API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || "/api/v1";
const API_BASE_URL = RAW_API_BASE_URL.replace(/\/$/, "");
const API_ORIGIN_URL = API_BASE_URL.replace(/\/api\/v1$/, "");
const TRANSIENT_FETCH_RETRY_DELAY_MS = 250;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeApiUrl = (base: string): string => {
    if (base.startsWith("http")) {
        return base;
    }
    if (base.startsWith("/api/v1")) {
        return `${API_ORIGIN_URL}${base}`;
    }
    return `${API_BASE_URL}${base.startsWith("/") ? base : `/${base}`}`;
};

const processQueue = (error: Error | null, token: string | null = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else if (token) {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

const clearLocalAuth = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("userData");
};

const isSafeRequestMethod = (method?: string) => {
    const normalized = (method || "GET").toUpperCase();
    return normalized === "GET" || normalized === "HEAD";
};

const isTransientFetchError = (error: unknown) =>
    error instanceof TypeError &&
    /failed to fetch|networkerror|load failed/i.test(error.message);

const fetchWithTransientRetry = async (
    url: string,
    options: RequestInit,
    canRetry: boolean
) => {
    try {
        return await fetch(url, options);
    } catch (error) {
        if (!canRetry || !isTransientFetchError(error)) {
            throw error;
        }
        await delay(TRANSIENT_FETCH_RETRY_DELAY_MS);
        return fetch(url, options);
    }
};

const refreshAccessToken = async (): Promise<string> => {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) {
        throw new Error("No refresh token available");
    }

    const response = await fetch(buildApiUrl("/api/v1/auth/refresh"), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
        throw new Error("Failed to refresh token");
    }

    const data = await response.json();
    const newAccessToken = data.data.access_token;
    const newRefreshToken = data.data.refresh_token;

    localStorage.setItem("accessToken", newAccessToken);
    if (newRefreshToken) {
        localStorage.setItem("refreshToken", newRefreshToken);
    }

    return newAccessToken;
};

export const apiFetch = async (
    url: string,
    options: FetchOptions = {}
): Promise<Response> => {
    const token = localStorage.getItem("accessToken");
    const canRetryTransientFetch = isSafeRequestMethod(options.method);

    // Add authorization header if token exists
    const headers = {
        ...options.headers,
        ...(token && { Authorization: `Bearer ${token}` }),
    };

    // Make the initial request
    let response = await fetchWithTransientRetry(url, {
        ...options,
        headers,
    }, canRetryTransientFetch);

    // If we get a 401, try to refresh the token
    if (response.status === 401) {
        if (isRefreshing) {
            // If already refreshing, wait for the new token
            return new Promise((resolve, reject) => {
                failedQueue.push({ resolve, reject });
            }).then((newToken) => {
                // Retry the request with new token
                return fetchWithTransientRetry(url, {
                    ...options,
                    headers: {
                        ...options.headers,
                        Authorization: `Bearer ${newToken}`,
                    },
                }, canRetryTransientFetch);
            });
        }

        isRefreshing = true;

        try {
            const newToken = await refreshAccessToken();
            processQueue(null, newToken);
            isRefreshing = false;

            // Retry the original request with new token
            response = await fetchWithTransientRetry(url, {
                ...options,
                headers: {
                    ...options.headers,
                    Authorization: `Bearer ${newToken}`,
                },
            }, canRetryTransientFetch);
        } catch (error) {
            processQueue(error as Error, null);
            isRefreshing = false;

            // Clear tokens and redirect to login
            clearLocalAuth();
            window.location.href = "/login";

            throw error;
        }
    }

    if (response.status === 403) {
        const errorData = await response.clone().json().catch(() => ({}));
        const detail =
            errorData && typeof errorData === "object" && "detail" in errorData
                ? String((errorData as { detail?: unknown }).detail || "")
                : "";
        if (detail.toLowerCase().includes("user account is inactive")) {
            clearLocalAuth();
            window.location.href = "/login";
        }
    }

    return response;
};

export const buildApiUrl = (
    base: string,
    params?: Record<string, string | number | boolean | undefined | null>
): string => {
    const normalizedUrl = normalizeApiUrl(base);
    const isRelative = normalizedUrl.startsWith("/");
    // Use a parsing base only; relative URLs stay on the browser's current origin.
    const url = new URL(normalizedUrl, "http://watmatch.invalid");

    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.append(key, String(value));
            }
        });
    }

    return isRelative ? `${url.pathname}${url.search}${url.hash}` : url.toString();
};

export const readApiError = async (
    response: Response,
    fallback: string
): Promise<string> => {
    const errorData = await response.json().catch(() => ({}));
    if (
        errorData &&
        typeof errorData === "object" &&
        "detail" in errorData
    ) {
        const detail = (errorData as { detail?: unknown }).detail;
        if (typeof detail === "string" && detail.trim()) {
            return detail;
        }
        if (Array.isArray(detail) && detail.length > 0) {
            return detail
                .map((entry) =>
                    typeof entry === "string"
                        ? entry
                        : JSON.stringify(entry)
                )
                .join("; ");
        }
    }
    return `${fallback}: ${response.status}`;
};
