"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { ClerkProvider, useAuth as useClerkAuth, useClerk } from "@clerk/nextjs";
import { SWRConfig } from "swr";
import { listenForWorkspaceChanges, registerSessionTokenGetter } from "@/lib/api-client";

interface AuthContextType {
    isLoggedIn: boolean;
    isInitialized: boolean;
    isConfigured: boolean;
    sessionId: string | null;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function clearLegacyStorage() {
    // Old demo credentials must never restore a session or account details.
    try {
        for (const key of ["accessToken", "refreshToken", "userData"]) localStorage.removeItem(key);
    } catch {
        // Browsers can deny storage access. Authentication does not depend on it.
    }
}

function ClerkAuthBridge({ children }: { children: ReactNode }) {
    const { isLoaded, isSignedIn, sessionId, getToken } = useClerkAuth();
    const { signOut } = useClerk();
    const [readySession, setReadySession] = useState<string | null | undefined>(undefined);
    const currentSession = sessionId ?? null;

    useEffect(clearLegacyStorage, []);
    useEffect(() => {
        if (!isLoaded) return;
        const unregister = registerSessionTokenGetter(() => getToken(), currentSession);
        setReadySession(currentSession);
        return unregister;
    }, [isLoaded, currentSession, getToken]);
    useEffect(() => {
        if (currentSession) return listenForWorkspaceChanges(currentSession);
    }, [currentSession]);

    const logout = useCallback(async () => {
        clearLegacyStorage();
        await signOut({ redirectUrl: "/login" });
    }, [signOut]);

    return (
        <AuthContext.Provider value={{
            isLoggedIn: Boolean(isSignedIn),
            isInitialized: Boolean(isLoaded && readySession === currentSession),
            isConfigured: true,
            sessionId: currentSession,
            logout,
        }}>
            {/* Account changes discard user state and all account-specific SWR data. */}
            <SWRConfig key={currentSession ?? "signed-out"} value={{ provider: () => new Map() }}>
                {children}
            </SWRConfig>
        </AuthContext.Provider>
    );
}

function UnconfiguredAuth({ children }: { children: ReactNode }) {
    useEffect(clearLegacyStorage, []);
    return (
        <AuthContext.Provider value={{ isLoggedIn: false, isInitialized: true, isConfigured: false, sessionId: null, logout: async () => {} }}>
            {children}
        </AuthContext.Provider>
    );
}

export function AuthProvider({ children, publishableKey }: { children: ReactNode; publishableKey?: string }) {
    if (!publishableKey) return <UnconfiguredAuth>{children}</UnconfiguredAuth>;
    return (
        <ClerkProvider publishableKey={publishableKey} signInUrl="/login" signInForceRedirectUrl="/dashboard" signUpForceRedirectUrl="/dashboard">
            <ClerkAuthBridge>{children}</ClerkAuthBridge>
        </ClerkProvider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
    return context;
}
