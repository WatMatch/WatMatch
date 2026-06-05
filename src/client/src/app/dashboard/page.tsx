"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { userContext } from "@/contexts/UserContext";
import { InstructorDashboard } from "./components/InstructorDashboard";
import { StudentDashboard } from "./components/StudentDashboard";

function DashboardContent() {
    const { user } = userContext();
    const normalizedRole = user?.role?.toLowerCase();
    const isInstructor = normalizedRole === "instructor";
    const isAdmin = normalizedRole === "admin";
    const isStudent = normalizedRole === "student";

    if (isInstructor || isAdmin) {
        return <InstructorDashboard />;
    }

    if (isStudent) {
        return <StudentDashboard />;
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center px-8">
            <div className="max-w-lg text-center space-y-3">
                <h2 className="text-2xl font-semibold text-slate-900">
                    Access Restricted
                </h2>
                <p className="text-slate-600">
                    This dashboard is not available for your role.
                </p>
            </div>
        </div>
    );
}

export default function DashboardPage() {
    return (
        <ProtectedRoute>
            <DashboardContent />
        </ProtectedRoute>
    );
}
