export interface FetchOptions extends RequestInit {
    headers?: Record<string, string>;
}

let isRefreshing = false;
let failedQueue: Array<{
    resolve: (token: string) => void;
    reject: (error: Error) => void;
}> = [];

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

const RAW_API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";
const API_BASE_URL = RAW_API_BASE_URL.replace(/\/$/, "");
const API_ORIGIN_URL = API_BASE_URL.replace(/\/api\/v1$/, "");

const normalizeApiUrl = (base: string): string => {
    if (base.startsWith("http")) {
        return base;
    }
    if (base.startsWith("/api/v1")) {
        return `${API_ORIGIN_URL}${base}`;
    }
    return `${API_BASE_URL}${base.startsWith("/") ? base : `/${base}`}`;
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

    localStorage.setItem("accessToken", newAccessToken);

    return newAccessToken;
};

export const apiFetch = async (
    url: string,
    options: FetchOptions = {}
): Promise<Response> => {
    const token = localStorage.getItem("accessToken");

    // Add authorization header if token exists
    const headers = {
        ...options.headers,
        ...(token && { Authorization: `Bearer ${token}` }),
    };

    // Make the initial request
    let response = await fetch(url, {
        ...options,
        headers,
    });

    // If we get a 401, try to refresh the token
    if (response.status === 401) {
        if (isRefreshing) {
            // If already refreshing, wait for the new token
            return new Promise((resolve, reject) => {
                failedQueue.push({ resolve, reject });
            }).then((newToken) => {
                // Retry the request with new token
                return fetch(url, {
                    ...options,
                    headers: {
                        ...options.headers,
                        Authorization: `Bearer ${newToken}`,
                    },
                });
            });
        }

        isRefreshing = true;

        try {
            const newToken = await refreshAccessToken();
            processQueue(null, newToken);
            isRefreshing = false;

            // Retry the original request with new token
            response = await fetch(url, {
                ...options,
                headers: {
                    ...options.headers,
                    Authorization: `Bearer ${newToken}`,
                },
            });
        } catch (error) {
            processQueue(error as Error, null);
            isRefreshing = false;

            // Clear tokens and redirect to login
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
            localStorage.removeItem("userData");
            window.location.href = "/login";

            throw error;
        }
    }

    return response;
};

export const buildApiUrl = (
    base: string,
    params?: Record<string, string | number | boolean | undefined | null>
): string => {
    const url = new URL(normalizeApiUrl(base));

    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.append(key, String(value));
            }
        });
    }

    return url.toString();
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
