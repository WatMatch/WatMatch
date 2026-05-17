"use client";

import {
    createContext,
    useContext,
    useState,
    useEffect,
    ReactNode,
} from "react";

interface UserData {
    user_id: string;
    email: string;
    course_fk: string;
    role: string;
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
        // Restore user data from localStorage on mount
        const storedUser = localStorage.getItem("userData");
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    const setUserData = (userData: UserData | null) => {
        setUser(userData);
        if (userData) {
            localStorage.setItem("userData", JSON.stringify(userData));
        } else {
            localStorage.removeItem("userData");
        }
    };

    const clearUser = () => {
        setUser(null);
        localStorage.removeItem("userData");
    };

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
