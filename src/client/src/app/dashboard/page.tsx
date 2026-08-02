"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { userContext } from "@/contexts/UserContext";
import { InstructorDashboard } from "./components/InstructorDashboard";
import { StudentDashboard } from "./components/StudentDashboard";
import { ExternalPartnerDashboard } from "./components/ExternalPartnerDashboard";
import { AcademicAdvisorDashboard } from "./components/AcademicAdvisorDashboard";
import { MentorDashboard } from "./components/MentorDashboard";
import { EnrollmentOperatorDashboard } from "./components/EnrollmentOperatorDashboard";
import { ShieldAlert } from "lucide-react";
import { EmptyState, PageShell } from "@/components/ui/workspace";

function DashboardContent() {
    const { user } = userContext();
    const normalizedRole = user?.role?.toLowerCase();
    const isInstructor = normalizedRole === "instructor";
    const isAdmin = normalizedRole === "admin";
    const isStudent = normalizedRole === "student";
    const isExternalPartner = normalizedRole === "external_partner";
    const isAcademicAdvisor = normalizedRole === "academic_advisor";
    const isEnrollmentOperator = normalizedRole === "enrollment_operator";
    const isMentor = normalizedRole === "mentor";

    if (isInstructor || isAdmin) {
        return <InstructorDashboard />;
    }

    if (isStudent) {
        return <StudentDashboard />;
    }

    if (isExternalPartner) {
        return <ExternalPartnerDashboard />;
    }

    if (isAcademicAdvisor) {
        return <AcademicAdvisorDashboard />;
    }

    if (isEnrollmentOperator) {
        return <EnrollmentOperatorDashboard />;
    }

    if (isMentor) {
        return <MentorDashboard />;
    }

    return (
        <PageShell className="flex min-h-[28rem] items-center justify-center">
            <EmptyState icon={ShieldAlert} title="Dashboard unavailable" description="Your current role does not have a dashboard workspace." className="w-full max-w-lg" />
        </PageShell>
    );
}

export default function DashboardPage() {
    return (
        <ProtectedRoute>
            <DashboardContent />
        </ProtectedRoute>
    );
}
