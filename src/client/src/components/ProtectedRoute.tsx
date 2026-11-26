"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { userContext } from "@/contexts/UserContext";
import { apiFetch, buildApiUrl, rememberVerifiedWorkspace } from "@/lib/api-client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/workspace";

const VerifiedWorkspace = createContext(false);

function VerifySession({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { isLoggedIn, isInitialized, sessionId, logout } = useAuth();
    const { setUser } = userContext();
    const [verifiedSession, setVerifiedSession] = useState<string | null>(null);
    const [error, setError] = useState<{ title: string; message: string } | null>(null);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setVerifiedSession(null);
        setError(null);
        setUser(null);
        if (!isInitialized) return;
        if (!isLoggedIn || !sessionId) {
            router.replace("/login");
            return;
        }
        async function verify() {
            try {
                const response = await apiFetch(buildApiUrl("/api/v1/auth/me"));
                if (cancelled) return;
                if (!response.ok) {
                    setError(response.status === 403 ? {
                        title: "WatMatch access is not enabled",
                        message: "Your sign-in succeeded, but this account does not have access. Contact the WatMatch team, or sign out and use an approved account.",
                    } : response.status === 401 ? {
                        title: "Sign-in could not be verified",
                        message: "Please sign out and sign in again, or retry.",
                    } : {
                        title: "WatMatch is temporarily unavailable",
                        message: "We could not check your access. Please retry later. Your workspace will open only after this check succeeds.",
                    });
                    return;
                }
                const payload = await response.json();
                if (cancelled) return;
                if (!payload?.data?.user_id || !payload.data.role) throw new Error("Invalid account response");
                rememberVerifiedWorkspace(payload.data.role);
                setUser(payload.data);
                setVerifiedSession(sessionId);
            } catch {
                if (!cancelled) setError({ title: "WatMatch is temporarily unavailable", message: "We could not check your access. Check your connection and retry." });
            }
        }
        void verify();
        return () => { cancelled = true; };
    }, [isInitialized, isLoggedIn, sessionId, router, setUser, attempt]);

    if (isInitialized && isLoggedIn && sessionId && verifiedSession === sessionId) {
        return <VerifiedWorkspace.Provider value={true}>{children}</VerifiedWorkspace.Provider>;
    }
    if (error && isLoggedIn) return (
        <div className="flex min-h-[28rem] items-center justify-center px-4 py-10">
            <section className="w-full max-w-md space-y-4">
                <Notice tone="danger" title={error.title}>{error.message}</Notice>
                <div className="flex gap-3">
                    <Button type="button" onClick={() => setAttempt(value => value + 1)}>Retry</Button>
                    <Button type="button" variant="outline" onClick={() => { void logout().catch(() => setError({ title: "Sign-out failed", message: "Check your connection and try signing out again." })); }}>Sign out</Button>
                </div>
            </section>
        </div>
    );
    return (
        <div className="flex min-h-[28rem] items-center justify-center gap-2 text-sm text-slate-600" role="status" aria-live="polite">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Checking your access…
        </div>
    );
}

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const verifiedByParent = useContext(VerifiedWorkspace);
    return verifiedByParent ? <>{children}</> : <VerifySession>{children}</VerifySession>;
}
