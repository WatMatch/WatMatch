export interface FetchOptions extends RequestInit {
    headers?: Record<string, string>;
}

type SessionTokenGetter = () => Promise<string | null>;
let sessionTokenGetter: SessionTokenGetter | null = null;
let sessionId: string | null = null;
let expectedWorkspace: string | null = null;
let workspaceVersion = 0;

export function rememberVerifiedWorkspace(role: string) {
    expectedWorkspace = role;
}

function reloadWorkspace() {
    workspaceVersion++;
    sessionTokenGetter = null;
    window.location.replace("/dashboard");
}

export function listenForWorkspaceChanges(id: string) {
    const key = "watmatch.workspace." + id;
    const onStorage = (event: StorageEvent) => {
        if (event.key === key && event.newValue) reloadWorkspace();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
}

/** Register only after Clerk has loaded. Cleanup cannot remove a newer session. */
export const registerSessionTokenGetter = (getter: SessionTokenGetter, id: string | null = null) => {
    if (id !== sessionId) {
        sessionId = id;
        expectedWorkspace = null;
        workspaceVersion++;
    }
    sessionTokenGetter = getter;
    return () => {
        if (sessionTokenGetter === getter) sessionTokenGetter = null;
    };
};

const RAW_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
const API_BASE_URL = RAW_API_BASE_URL.replace(/\/$/, "");
const API_ORIGIN_URL = API_BASE_URL.replace(/\/api\/v1$/, "");

const normalizeApiUrl = (base: string): string => {
    if (/^https?:\/\//i.test(base)) return base;
    if (base.startsWith("/api/v1")) return `${API_ORIGIN_URL}${base}`;
    return `${API_BASE_URL}${base.startsWith("/") ? base : `/${base}`}`;
};

/** Resolve relative catalog keys without making them depend on a browser global. */
export const parseApiUrl = (url: string): URL => new URL(url, "http://watmatch.invalid");

const trustedApiUrl = (url: string): URL => {
    const browserOrigin = typeof window === "undefined" ? "http://watmatch.invalid" : window.location.origin;
    const base = new URL(API_BASE_URL, browserOrigin);
    const target = new URL(url, browserOrigin);
    const basePath = base.pathname.replace(/\/$/, "");
    if (!/^https?:$/.test(target.protocol) || target.username || target.password ||
        target.origin !== base.origin ||
        !(target.pathname === basePath || target.pathname.startsWith(`${basePath}/`))) {
        throw new Error("Refusing to send a session token outside the configured WatMatch API.");
    }
    return target;
};

export const apiFetch = async (
    url: string,
    options: FetchOptions = {}
): Promise<Response> => {
    // Validate before asking Clerk for a token. Never forward tokens to arbitrary URLs.
    trustedApiUrl(url);
    const getter = sessionTokenGetter;
    const version = workspaceVersion;
    if (!getter) throw new Error("Sign-in is not ready. Please wait and try again.");
    const token = await getter();
    // A sign-out/account switch while getToken was pending invalidates this request.
    if (getter !== sessionTokenGetter || version !== workspaceVersion) throw new Error("Your session changed. Please try again.");
    const headers = new Headers(options.headers);
    headers.delete("Authorization");
    headers.delete("X-WatMatch-Workspace");
    if (expectedWorkspace) headers.set("X-WatMatch-Workspace", expectedWorkspace);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    // Clerk renews its own tokens. Do not replay requests after a 401, especially writes.
    // Redirects cannot forward credentials outside the checked API path.
    const response = await fetch(url, { ...options, headers, credentials: "omit", redirect: "error" });
    if (getter !== sessionTokenGetter || version !== workspaceVersion) throw new Error("Your workspace changed. Please try again.");
    if (response.status === 409 && response.headers.get("X-WatMatch-Workspace-Changed") === "1") {
        reloadWorkspace();
        throw new Error("Your workspace changed in another tab.");
    }
    return response;
};

export async function switchActiveRole(role: "instructor" | "mentor") {
    const response = await apiFetch(buildApiUrl("/auth/switch-role"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
    });
    if (!response.ok) throw new Error(await readApiError(response, "Could not switch workspace"));
    const data = await response.json();
    if (data?.data?.active_role !== role) throw new Error("Could not confirm the selected workspace.");
    // The server stores the selection. This notice only tells other tabs to re-fetch.
    try {
        const key = "watmatch.workspace." + sessionId;
        localStorage.setItem(key, "changed");
        localStorage.removeItem(key);
    } catch {
        // A stale tab still gets a conflict from the API before a workspace action.
    }
    reloadWorkspace();
}

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
