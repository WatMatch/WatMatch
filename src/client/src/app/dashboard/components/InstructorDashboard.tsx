"use client";

import { useState } from "react";
import {
    BookOpenCheck,
    ContactRound,
    Home,
    Menu,
    Settings2,
    UsersRound,
    type LucideIcon,
} from "lucide-react";
import { userContext } from "@/contexts/UserContext";
import { getRoleCapabilities } from "@/lib/role-capabilities";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PageHeader, PageShell, WorkspaceTabs } from "@/components/ui/workspace";
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
    icon?: LucideIcon;
};

export function InstructorDashboard() {
    const { user } = userContext();
    const isAdmin = (user?.role || "").toLowerCase() === "admin";
    const capabilities = getRoleCapabilities(user?.role);
    const [activeTab, setActiveTab] = useState<DashboardTab>("home");
    const [menuOpen, setMenuOpen] = useState(false);

    const primaryTabs: DashboardTabDefinition[] = isAdmin
        ? [
              { id: "home", label: "Overview", icon: Home },
              { id: "approvals", label: "Reviews", icon: BookOpenCheck },
              { id: "teams", label: "Teams", icon: UsersRound },
              { id: "enrollment", label: "Users", icon: ContactRound },
              { id: "marketplace", label: "Marketplace", icon: Settings2 },
          ]
        : [
              { id: "home", label: "Course home", icon: Home },
              { id: "approvals", label: "Reviews", icon: BookOpenCheck },
              { id: "teams", label: "Teams", icon: UsersRound },
              { id: "roster", label: "Roster", icon: ContactRound },
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
              { id: "mentors", label: "Mentor directory" },
              { id: "audit", label: "Course activity" },
          ];
    const isSecondaryActive = secondaryTabs.some((tab) => tab.id === activeTab);
    const adminSecondaryGroups = [
        { label: "Work", ids: ["routing", "submissionEnrollment"] as DashboardTab[] },
        { label: "Catalog", ids: ["courses", "departments", "skills"] as DashboardTab[] },
        { label: "People", ids: ["partners", "mentors", "roster"] as DashboardTab[] },
        { label: "Marketplace", ids: ["past"] as DashboardTab[] },
        { label: "Governance", ids: ["audit"] as DashboardTab[] },
    ];
    const courseLabel = user?.course?.code
        ? `${user.course.code}${user.course.name ? ` - ${user.course.name}` : ""}`
        : "No course assigned";

    const renderSecondaryTabButton = (tab: DashboardTabDefinition) => (
        <button
            key={tab.id}
            type="button"
            onClick={() => {
                setActiveTab(tab.id);
                setMenuOpen(false);
            }}
            aria-current={activeTab === tab.id ? "page" : undefined}
            className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60 ${
                activeTab === tab.id
                    ? "bg-slate-100 text-slate-950"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
            }`}
        >
            {tab.label}
        </button>
    );

    return (
        <PageShell>
            <PageHeader
                eyebrow={isAdmin ? "Platform administration" : `Instructor • ${courseLabel}`}
                title={isAdmin ? "Administration" : "Course workspace"}
                description={
                    isAdmin
                        ? "Review operational work, manage platform resources, and inspect audited changes."
                        : "Review submissions, manage course teams, and follow the work that needs your attention."
                }
            />

            <div className="flex min-w-0 items-center gap-1 border-b border-slate-200/80 pb-3">
                <WorkspaceTabs
                    tabs={primaryTabs}
                    activeTab={activeTab}
                    onChange={setActiveTab}
                    className="min-w-0 flex-1"
                    label={isAdmin ? "Administration sections" : "Course workspace sections"}
                />
                <Popover open={menuOpen} onOpenChange={setMenuOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            variant={isSecondaryActive ? "secondary" : "ghost"}
                            className="self-start"
                            aria-label="More dashboard sections"
                            aria-expanded={menuOpen}
                        >
                            <Menu className="h-4 w-4" />
                            <span>More</span>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-64 p-2">
                        {isAdmin ? (
                            <div className="space-y-3">
                                {adminSecondaryGroups.map((group) => (
                                    <div key={group.label}>
                                        <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{group.label}</p>
                                        <div className="space-y-0.5">
                                            {group.ids.map((id) => {
                                                const tab = secondaryTabs.find((item) => item.id === id);
                                                return tab ? renderSecondaryTabButton(tab) : null;
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-1">{secondaryTabs.map(renderSecondaryTabButton)}</div>
                        )}
                    </PopoverContent>
                </Popover>
            </div>

            <div className="min-w-0">
                {activeTab === "home" ? (
                    isAdmin ? <OperationsWorkbenchSection /> : <InstructorCourseHomeSection onNavigate={setActiveTab} />
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
        </PageShell>
    );
}
