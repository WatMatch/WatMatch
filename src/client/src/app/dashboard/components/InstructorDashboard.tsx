"use client";

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { userContext } from "@/contexts/UserContext";
import { getRoleCapabilities } from "@/lib/role-capabilities";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PendingCapstonesSection } from "./PendingCapstonesSection";
import { InstructorCourseHomeSection } from "./InstructorCourseHomeSection";
import { CapstoneTeamsSection } from "./CapstoneTeamsSection";
import { InstructorRosterSection } from "./InstructorRosterSection";
import { AuditLogSection } from "./AuditLogSection";
import { AdminCoursesSection } from "./AdminCoursesSection";
import { AdminDepartmentsSection } from "./AdminDepartmentsSection";
import { AdminSkillsSection } from "./AdminSkillsSection";
import { AdminEnrollmentSection } from "./AdminEnrollmentSection";
import { AdminPastCapstonesSection } from "./AdminPastCapstonesSection";
import { AdminExternalPartnersSection } from "./AdminExternalPartnersSection";
import { AdminCourseRoutingSection } from "./AdminCourseRoutingSection";
import { ProjectSubmissionEnrollmentRequestsSection } from "./ProjectSubmissionEnrollmentRequestsSection";
import { MarketplaceSettingsSection } from "./MarketplaceSettingsSection";
import { MentorDirectorySection } from "./MentorDirectorySection";
import { AdminFinalizationOverrideSection } from "./AdminFinalizationOverrideSection";
import { OperationsWorkbenchSection } from "./OperationsWorkbenchSection";

type DashboardTab =
    | "home"
    | "approvals"
    | "teams"
    | "roster"
    | "audit"
    | "routing"
    | "marketplace"
    | "submissionEnrollment"
    | "courses"
    | "departments"
    | "skills"
    | "enrollment"
    | "partners"
    | "mentors"
    | "past";

type DashboardTabDefinition = {
    id: DashboardTab;
    label: string;
};

export function InstructorDashboard() {
    const { user } = userContext();
    const isAdmin = (user?.role || "").toLowerCase() === "admin";
    const capabilities = getRoleCapabilities(user?.role);
    const [activeTab, setActiveTab] = useState<DashboardTab>(isAdmin ? "approvals" : "home");
    const [menuOpen, setMenuOpen] = useState(false);
    useEffect(() => {
        if (isAdmin && activeTab === "home") {
            setActiveTab("approvals");
        }
    }, [activeTab, isAdmin]);
    const primaryTabs: DashboardTabDefinition[] = isAdmin
        ? [
              { id: "approvals", label: "Approvals" },
              { id: "teams", label: "Teams" },
              { id: "enrollment", label: "Users" },
              { id: "marketplace", label: "Marketplace" },
          ]
        : [
              { id: "home", label: "Course Home" },
              { id: "approvals", label: "Approvals" },
              { id: "teams", label: "Teams" },
              { id: "roster", label: "Roster" },
          ];
    const secondaryTabs: DashboardTabDefinition[] = isAdmin
        ? [
              { id: "routing", label: "Course Routing" },
              { id: "submissionEnrollment", label: "Submission Enrollment" },
              { id: "courses", label: "Courses" },
              { id: "departments", label: "Departments" },
              { id: "skills", label: "Skills" },
              { id: "partners", label: "External Partners" },
              { id: "mentors", label: "Mentor Directory" },
              { id: "past", label: "Past Capstones" },
              { id: "roster", label: "Roster" },
              { id: "audit", label: "Audit Log" },
          ]
        : [
              { id: "mentors", label: "Mentor Directory" },
              { id: "audit", label: "Audit Log" },
          ];
    const isSecondaryActive = secondaryTabs.some((tab) => tab.id === activeTab);

    const tabButtonClass = (active: boolean, compact = false) =>
        `inline-flex items-center ${
            compact ? "w-full justify-start px-3" : "px-4"
        } py-2 rounded-md text-sm font-medium transition ${
            active
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
        }`;

    const renderTabButton = (tab: DashboardTabDefinition, compact = false) => (
        <button
            key={tab.id}
            type="button"
            onClick={() => {
                setActiveTab(tab.id);
                if (compact) {
                    setMenuOpen(false);
                }
            }}
            className={tabButtonClass(activeTab === tab.id, compact)}
        >
            {tab.label}
        </button>
    );

    return (
        <div className="min-h-screen bg-slate-50 px-2 sm:px-4">
            <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 py-6 sm:py-8">
                <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                    {isAdmin ? "Admin Dashboard" : "Instructor Dashboard"}
                </h1>

                <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
                    {primaryTabs.map((tab) => renderTabButton(tab))}
                    <Popover open={menuOpen} onOpenChange={setMenuOpen}>
                        <PopoverTrigger asChild>
                            <button
                                type="button"
                                className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                                    isSecondaryActive
                                        ? "bg-slate-900 text-white"
                                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                }`}
                                aria-label="More dashboard sections"
                            >
                                <Menu className="h-4 w-4" />
                                <span>More</span>
                            </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-64 p-2">
                            <div className="space-y-1">
                                {secondaryTabs.map((tab) => renderTabButton(tab, true))}
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

                {activeTab === "home" ? (
                    <InstructorCourseHomeSection onNavigate={setActiveTab} />
                ) : activeTab === "approvals" ? (
                    <PendingCapstonesSection />
                ) : activeTab === "teams" ? (
                    <CapstoneTeamsSection />
                ) : activeTab === "roster" ? (
                    <InstructorRosterSection />
                ) : activeTab === "marketplace" ? (
                    <div className="space-y-6">
                        <MarketplaceSettingsSection canEdit={capabilities.canManageMarketplaceSettings} />
                        {capabilities.canCreateFinalizationExceptionProposal && (
                            <AdminFinalizationOverrideSection />
                        )}
                        {capabilities.canViewOperationsWorkbench && <OperationsWorkbenchSection />}
                    </div>
                ) : activeTab === "routing" ? (
                    <AdminCourseRoutingSection />
                ) : activeTab === "submissionEnrollment" ? (
                    <ProjectSubmissionEnrollmentRequestsSection />
                ) : activeTab === "courses" ? (
                    <AdminCoursesSection />
                ) : activeTab === "departments" ? (
                    <AdminDepartmentsSection />
                ) : activeTab === "skills" ? (
                    <AdminSkillsSection />
                ) : activeTab === "enrollment" ? (
                    <AdminEnrollmentSection />
                ) : activeTab === "partners" ? (
                    <AdminExternalPartnersSection />
                ) : activeTab === "mentors" ? (
                    <MentorDirectorySection />
                ) : activeTab === "past" ? (
                    <AdminPastCapstonesSection />
                ) : (
                    <AuditLogSection />
                )}
            </div>
        </div>
    );
}
