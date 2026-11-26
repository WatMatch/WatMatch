"use client";

import {
    createContext,
    useContext,
    useState,
    useCallback,
    ReactNode,
} from "react";

interface UserData {
    user_id: string;
    email: string;
    course_fk: string | number | null;
    role: string;
    active_role?: string;
    default_role?: string;
    assigned_roles?: string[];
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

    // User details exist only in memory after /auth/me succeeds for this session.
    const setUserData = useCallback((userData: UserData | null) => {
        setUser(userData);
    }, []);

    const clearUser = useCallback(() => setUser(null), []);

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
