"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function ProtectedRoute({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const { isLoggedIn, isInitialized } = useAuth();

    useEffect(() => {
        if (isInitialized && !isLoggedIn) {
            router.push("/login");
        }
    }, [isLoggedIn, isInitialized, router]);

    // Wait for auth to initialize before rendering
    if (!isInitialized) {
        return null;
    }

    if (!isLoggedIn) {
        return null;
    }

    return <>{children}</>;
}
