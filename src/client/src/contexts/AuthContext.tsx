"use client";

import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    ReactNode,
} from "react";
import { revokeBrowserSession } from "@/lib/api-client";

interface AuthContextType {
    isLoggedIn: boolean;
    isInitialized: boolean;
    login: () => void;
    logout: () => Promise<void>;
    logoutWarning: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [logoutWarning, setLogoutWarning] = useState<string | null>(null);

    useEffect(() => {
        // Check if user has valid token on mount
        const token = localStorage.getItem("accessToken");
        if (token) {
            setIsLoggedIn(true);
        }
        setIsInitialized(true);
    }, []);

    const login = useCallback(() => {
        setLogoutWarning(null);
        setIsLoggedIn(true);
    }, []);
    const logout = useCallback(async () => {
        const revoked = await revokeBrowserSession();
        setLogoutWarning(revoked ? null : "You are signed out on this browser. WatMatch could not confirm that your server session was revoked.");
        setIsLoggedIn(false);
    }, []);

    return (
        <AuthContext.Provider
            value={{ isLoggedIn, isInitialized, login, logout, logoutWarning }}
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
