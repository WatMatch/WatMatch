"use client";

import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/ui/navbar";
import Sidebar from "@/components/ui/sidebar";
import UserMenu from "@/components/ui/user-menu";
import { ReactNode } from "react";

export default function LayoutContent({ children }: { children: ReactNode }) {
    const { isLoggedIn } = useAuth();

    if (isLoggedIn) {
        return (
            <div className="flex h-screen">
                <Sidebar />
                <main className="flex-1 overflow-auto flex flex-col">
                    <div className="flex-1 overflow-auto bg-slate-50 p-4">{children}</div>
                </main>
            </div>
        );
    }

    return (
        <>
            <Navbar />
            <div className="flex-1 overflow-auto">{children}</div>
        </>
    );
}
