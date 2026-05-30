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
