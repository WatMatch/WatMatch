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
    course_active?: boolean | null;
    course?: {
        course_id: number;
        code: string;
        name: string;
        term?: string | null;
        active: boolean;
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
