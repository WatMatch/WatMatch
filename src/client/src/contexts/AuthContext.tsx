"use client";

import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    ReactNode,
} from "react";

interface AuthContextType {
    isLoggedIn: boolean;
    isInitialized: boolean;
    login: () => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        // Tokens are shared between tabs. Reload the workspace when another tab
        // switches roles so its navigation, drafts and caches cannot stay stale.
        const syncWorkspace = (event: StorageEvent) => {
            if (event.key !== "userData") return;
            if (!event.newValue) {
                window.location.replace("/login");
                return;
            }
            try {
                const previous = event.oldValue ? JSON.parse(event.oldValue) : null;
                const next = JSON.parse(event.newValue);
                if (previous?.role !== next?.role || previous?.user_id !== next?.user_id) {
                    window.location.replace("/dashboard");
                }
            } catch {
                window.location.replace("/login");
            }
        };
        window.addEventListener("storage", syncWorkspace);
        return () => window.removeEventListener("storage", syncWorkspace);
    }, []);

    useEffect(() => {
        // Check if user has valid token on mount
        const token = localStorage.getItem("accessToken");
        if (token) {
            setIsLoggedIn(true);
        }
        setIsInitialized(true);
    }, []);

    const login = useCallback(() => setIsLoggedIn(true), []);
    const logout = useCallback(() => {
        setIsLoggedIn(false);
        // Clear tokens from localStorage
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("userData");
    }, []);

    return (
        <AuthContext.Provider
            value={{ isLoggedIn, isInitialized, login, logout }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
