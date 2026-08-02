"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { userContext } from "@/contexts/UserContext";
import { apiFetch, buildApiUrl } from "@/lib/api-client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/workspace";

export default function ProtectedRoute({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const { isLoggedIn, isInitialized, logout } = useAuth();
    const { user, setUser } = userContext();
    const [hasValidatedSession, setHasValidatedSession] = useState(false);
    const [connectionError, setConnectionError] = useState("");

    useEffect(() => {
        if (isInitialized && !isLoggedIn) {
            setHasValidatedSession(false);
            setUser(null);
            router.replace("/login");
        }
    }, [isLoggedIn, isInitialized, router, setUser]);

    useEffect(() => {
        if (!isInitialized || !isLoggedIn) {
            setHasValidatedSession(false);
            setConnectionError("");
            return;
        }

        let cancelled = false;
        async function refreshCurrentUser() {
            try {
                if (!cancelled) {
                    setHasValidatedSession(false);
                    setConnectionError("");
                }
                const response = await apiFetch(buildApiUrl("/api/v1/auth/me"));
                if (!response.ok) {
                    if (response.status === 401 || response.status === 403) {
                        if (!cancelled) {
                            setHasValidatedSession(false);
                            setUser(null);
                        }
                        logout();
                        router.replace("/login");
                        return;
                    }
                    if (!cancelled) {
                        setConnectionError("Could not validate your session. Please refresh and try again.");
                    }
                    return;
                }
                const payload = await response.json();
                if (!cancelled && payload?.data) {
                    setUser(payload.data);
                    setHasValidatedSession(true);
                    setConnectionError("");
                } else if (!cancelled) {
                    setConnectionError("Could not load your user details. Please refresh and try again.");
                }
            } catch {
                if (!cancelled) {
                    setHasValidatedSession(false);
                    setConnectionError(
                        "Could not reach the WatMatch backend. Start the backend and refresh this page."
                    );
                }
            }
        }

        refreshCurrentUser();
        return () => {
            cancelled = true;
        };
    }, [isInitialized, isLoggedIn, logout, router, setUser]);

    // Wait for auth to initialize before rendering
    if (!isInitialized) {
        return null;
    }

    if (!isLoggedIn) {
        return null;
    }

    if (!hasValidatedSession && !user) {
        if (connectionError) {
            return (
                <div className="flex min-h-[28rem] items-center justify-center px-4 py-10">
                    <section className="w-full max-w-md space-y-4">
                        <Notice tone="danger" title="WatMatch is not reachable">{connectionError}</Notice>
                        <Button type="button" onClick={() => window.location.reload()}>Retry connection</Button>
                    </section>
                </div>
            );
        }
        return (
            <div
                className="flex min-h-[28rem] items-center justify-center px-4 py-10"
                role="status"
                aria-live="polite"
            >
                <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Opening your workspace…
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
