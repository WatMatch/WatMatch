"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";

function AdminDashboardContent() {
    const router = useRouter();
    useEffect(() => {
        router.replace("/dashboard");
    }, [router]);

    return (
        <div className="flex min-h-[20rem] items-center justify-center">
            <p className="text-sm text-slate-600">Opening administration…</p>
        </div>
    );
}

export default function AdminDashboardPage() {
    return (
        <ProtectedRoute>
            <AdminDashboardContent />
        </ProtectedRoute>
    );
}
