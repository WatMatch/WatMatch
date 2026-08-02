"use client";

import {
    createContext,
    useContext,
    useState,
    useCallback,
    useEffect,
    ReactNode,
} from "react";

interface UserData {
    user_id: string;
    email: string;
    course_fk: string | number | null;
    role: string;
    course_active?: boolean | null;
    home_department_fk?: string | number | null;
    home_department_id?: string | number | null;
    home_department?: {
        department_id: number;
        name: string;
        active: boolean;
    } | null;
    course?: {
        course_id: number;
        code: string;
        name: string;
        active: boolean;
        active_terms?: string[];
        activation_mode?: "auto" | "force_active" | "force_inactive";
        department_fk?: number | null;
        routing_kind?: "standard" | "interdisciplinary";
        requires_project_support?: boolean;
    } | null;
}

interface UserContextType {
    user: UserData | null;
    setUser: (user: UserData | null) => void;
    clearUser: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<UserData | null>(null);

    useEffect(() => {
        const cachedUser = localStorage.getItem("userData");
        if (!cachedUser) return;

        try {
            setUser(JSON.parse(cachedUser) as UserData);
        } catch {
            localStorage.removeItem("userData");
        }
    }, []);

    const setUserData = useCallback((userData: UserData | null) => {
        setUser(userData);
        if (userData) {
            localStorage.setItem("userData", JSON.stringify(userData));
        } else {
            localStorage.removeItem("userData");
        }
    }, []);

    const clearUser = useCallback(() => {
        setUser(null);
        localStorage.removeItem("userData");
    }, []);

    return (
        <UserContext.Provider value={{ user, setUser: setUserData, clearUser }}>
            {children}
        </UserContext.Provider>
    );
}

export function userContext() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error("userContext must be used within a UserProvider");
    }
    return context;
}
