"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { userContext } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multiselect";
import { taxonomyChipClassName } from "@/components/ui/taxonomy-chip";
import { skills as skillOptions } from "@/components/forms/project/config";
import { fetchDepartments, type Department } from "@/services/departments.service";
import { fetchSkills } from "@/services/skills.service";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    updateStudentProfile,
    fetchStudentProfile,
} from "@/services/users.service";
import { fetchMyPartnerProfile } from "@/services/partners.service";
import {
    Archive,
    BriefcaseBusiness,
    CheckCircle2,
    Compass,
    GraduationCap,
    Handshake,
    History,
    LayoutDashboard,
    Loader2,
    LogOut,
    PlusCircle,
    Settings,
    ShieldCheck,
    User,
    type LucideIcon,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface SidebarProps {
    className?: string;
    onNavigate?: () => void;
}

type NavItem = {
    href: string;
    label: string;
    icon: LucideIcon;
};

export default function Sidebar({ className, onNavigate }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { logout } = useAuth();
    const { clearUser, user } = userContext();
    const normalizedRole = user?.role?.toLowerCase();
    const isInstructor = normalizedRole === "instructor";
    const isStudent = normalizedRole === "student";
    const isAdmin = normalizedRole === "admin";
    const isAcademicAdvisor = normalizedRole === "academic_advisor";
    const isEnrollmentOperator = normalizedRole === "enrollment_operator";
    const isExternalPartner = normalizedRole === "external_partner";
    const isMentor = normalizedRole === "mentor";
    const [showMenu, setShowMenu] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [headline, setHeadline] = useState("");
    const [aboutMe, setAboutMe] = useState("");
    const [skills, setSkills] = useState<string[]>([]);
    const [preferredRoles, setPreferredRoles] = useState<string[]>([]);
    const [projectInterests, setProjectInterests] = useState<string[]>([]);
    const [interestedDepartmentIds, setInterestedDepartmentIds] = useState<string[]>([]);
    const [availability, setAvailability] = useState("");
    const [portfolioUrl, setPortfolioUrl] = useState("");
    const [linkedinUrl, setLinkedinUrl] = useState("");
    const [githubUrl, setGithubUrl] = useState("");
    const [profileVisibility, setProfileVisibility] = useState<"team_network" | "students" | "private">("team_network");
    const [departments, setDepartments] = useState<Department[]>([]);
    const [profileSkillOptions, setProfileSkillOptions] = useState<string[]>(skillOptions);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingProfile, setIsLoadingProfile] = useState(false);
    const [profileError, setProfileError] = useState("");
    const [partnerOrganization, setPartnerOrganization] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const accountButtonRef = useRef<HTMLButtonElement>(null);
    const menuItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const MAX_HEADLINE_LENGTH = 120;
    const MAX_ABOUT_ME_LENGTH = 600;
    const MAX_SKILLS = 25;
    const MAX_ROLES = 8;
    const MAX_INTERESTS = 10;
    const MAX_DEPARTMENTS = 12;
    const roleOptions = [
        "Frontend/UI",
        "Backend/API",
        "Data/ML",
        "Embedded/Hardware",
        "CAD/Mechanical",
        "Research",
        "Project Management",
        "Design/UX",
        "Testing/QA",
    ];
    const projectInterestOptions = [
        "Accessibility",
        "AI/ML",
        "Climate",
        "Education",
        "Healthcare",
        "Infrastructure",
        "Manufacturing",
        "Robotics",
        "Sustainability",
        "Transportation",
    ];

    const isActive = (path: string) =>
        pathname === path || pathname.startsWith(`${path}/`);

    const handleLogout = () => {
        clearUser();
        logout();
        router.replace("/login");
    };

    const loadProfile = async () => {
        setIsLoadingProfile(true);
        setProfileError("");
        try {
            const profile = await fetchStudentProfile();
            if (profile) {
                setHeadline(profile.headline || "");
                setAboutMe(profile.about_me || "");
                setSkills(profile.skills || []);
                setPreferredRoles(profile.preferred_roles || []);
                setProjectInterests(profile.project_interests || []);
                setInterestedDepartmentIds(
                    (profile.interested_department_ids || []).map(String)
                );
                setAvailability(profile.availability || "");
                setPortfolioUrl(profile.portfolio_url || "");
                setLinkedinUrl(profile.linkedin_url || "");
                setGithubUrl(profile.github_url || "");
                setProfileVisibility(profile.profile_visibility || "team_network");
            } else {
                setHeadline("");
                setAboutMe("");
                setSkills([]);
                setPreferredRoles([]);
                setProjectInterests([]);
                setInterestedDepartmentIds([]);
                setAvailability("");
                setPortfolioUrl("");
                setLinkedinUrl("");
                setGithubUrl("");
                setProfileVisibility("team_network");
            }
        } catch (error) {
            console.error("Failed to load profile:", error);
            setProfileError(
                error instanceof Error
                    ? error.message
                    : "Failed to load profile. Please try again."
            );
        } finally {
            setIsLoadingProfile(false);
        }
    };

    const handleSaveProfile = async () => {
        setIsSaving(true);
        setProfileError("");
        try {
            await updateStudentProfile({
                headline: headline || null,
                about_me: aboutMe || null,
                skills: skills.length > 0 ? skills : null,
                preferred_roles:
                    preferredRoles.length > 0 ? preferredRoles : null,
                project_interests:
                    projectInterests.length > 0 ? projectInterests : null,
                interested_department_ids: interestedDepartmentIds.map(Number),
                availability: availability || null,
                portfolio_url: portfolioUrl || null,
                linkedin_url: linkedinUrl || null,
                github_url: githubUrl || null,
                profile_visibility: profileVisibility,
            });
            setShowProfileModal(false);
        } catch (error) {
            console.error("Failed to save profile:", error);
            setProfileError(
                error instanceof Error
                    ? error.message
                    : "Failed to save profile. Please try again."
            );
        } finally {
            setIsSaving(false);
        }
    };

    const handleOpenProfileModal = () => {
        setProfileError("");
        setShowProfileModal(true);
        loadProfile();
    };

    useEffect(() => {
        if (!isExternalPartner) return;

        let cancelled = false;
        fetchMyPartnerProfile()
            .then((profile) => {
                if (!cancelled) {
                    setPartnerOrganization(profile?.organization?.trim() || null);
                }
            })
            .catch(() => {
                if (!cancelled) setPartnerOrganization(null);
            });

        return () => {
            cancelled = true;
        };
    }, [isExternalPartner, user?.user_id]);

    useEffect(() => {
        if (!showProfileModal) return;
        let cancelled = false;
        Promise.all([fetchDepartments(true), fetchSkills()])
            .then(([departmentRows, skillRows]) => {
                if (cancelled) return;
                setDepartments(departmentRows);
                setProfileSkillOptions(skillRows.map((skill) => skill.name));
            })
            .catch((error) => {
                console.error("Failed to load profile options:", error);
            });
        return () => {
            cancelled = true;
        };
    }, [showProfileModal]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(event.target as Node)
            ) {
                setShowMenu(false);
            }
        };

        if (showMenu) {
            document.addEventListener("mousedown", handleClickOutside);
            const frame = window.requestAnimationFrame(() => {
                menuItemRefs.current.find((item) => item && !item.disabled)?.focus();
            });

            const handleEscape = (event: KeyboardEvent) => {
                if (event.key !== "Escape") return;
                event.preventDefault();
                setShowMenu(false);
                accountButtonRef.current?.focus();
            };
            document.addEventListener("keydown", handleEscape);

            return () => {
                window.cancelAnimationFrame(frame);
                document.removeEventListener("mousedown", handleClickOutside);
                document.removeEventListener("keydown", handleEscape);
            };
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showMenu]);

    const handleAccountMenuKeyDown = (
        event: React.KeyboardEvent<HTMLDivElement>
    ) => {
        const enabledItems = menuItemRefs.current.filter(
            (item): item is HTMLButtonElement => Boolean(item && !item.disabled)
        );
        if (!enabledItems.length) return;
        const currentIndex = enabledItems.indexOf(
            document.activeElement as HTMLButtonElement
        );
        let nextIndex: number | null = null;
        if (event.key === "ArrowDown") {
            nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % enabledItems.length;
        } else if (event.key === "ArrowUp") {
            nextIndex =
                currentIndex < 0
                    ? enabledItems.length - 1
                    : (currentIndex - 1 + enabledItems.length) % enabledItems.length;
        } else if (event.key === "Home") {
            nextIndex = 0;
        } else if (event.key === "End") {
            nextIndex = enabledItems.length - 1;
        }
        if (nextIndex === null) return;
        event.preventDefault();
        enabledItems[nextIndex].focus();
    };

    const navItems: NavItem[] = isInstructor
        ? [
              { href: "/dashboard", label: "Course workspace", icon: GraduationCap },
              { href: "/discover", label: "Discover", icon: Compass },
              { href: "/finalized-capstones", label: "Finalized", icon: CheckCircle2 },
              { href: "/external-opportunities", label: "Opportunities", icon: Handshake },
              { href: "/past-capstones", label: "Archive", icon: History },
          ]
        : isAdmin
        ? [
              { href: "/dashboard", label: "Operations", icon: ShieldCheck },
              { href: "/discover", label: "Discover", icon: Compass },
              { href: "/finalized-capstones", label: "Finalized", icon: CheckCircle2 },
              { href: "/external-opportunities", label: "Opportunities", icon: Handshake },
              { href: "/past-capstones", label: "Archive", icon: History },
          ]
        : isAcademicAdvisor
        ? [
              { href: "/dashboard", label: "Routing workbench", icon: BriefcaseBusiness },
          ]
        : isEnrollmentOperator
        ? [
              { href: "/dashboard", label: "Enrollment workbench", icon: BriefcaseBusiness },
          ]
        : isExternalPartner
        ? [
              { href: "/dashboard", label: "Partner workspace", icon: LayoutDashboard },
              { href: "/external-opportunities", label: "Opportunities", icon: Handshake },
              { href: "/discover", label: "Discover", icon: Compass },
              { href: "/finalized-capstones", label: "Finalized", icon: CheckCircle2 },
          ]
        : isMentor
        ? [
              { href: "/dashboard", label: "Mentor workspace", icon: LayoutDashboard },
              { href: "/discover", label: "Discover", icon: Compass },
              { href: "/finalized-capstones", label: "My projects", icon: CheckCircle2 },
          ]
        : isStudent
        ? [
              { href: "/dashboard", label: "Home", icon: LayoutDashboard },
              { href: "/discover", label: "Discover", icon: Compass },
              { href: "/external-opportunities", label: "Opportunities", icon: Handshake },
              { href: "/project-form", label: "Submit project", icon: PlusCircle },
              { href: "/finalized-capstones", label: "Finalized", icon: CheckCircle2 },
              { href: "/past-capstones", label: "Archive", icon: History },
          ]
        : [
              { href: "/discover", label: "Discover", icon: Compass },
              { href: "/external-opportunities", label: "Opportunities", icon: Handshake },
              { href: "/finalized-capstones", label: "Finalized", icon: CheckCircle2 },
              { href: "/past-capstones", label: "Archive", icon: Archive },
          ];

    const roleLabel = isAdmin
        ? "Administrator"
        : isAcademicAdvisor
          ? "Academic advisor"
          : isEnrollmentOperator
            ? "Enrollment operator"
            : isExternalPartner
              ? "External partner"
              : isMentor
                ? "Mentor"
                : isInstructor
                  ? "Instructor"
                  : isStudent
                    ? "Student"
                    : "WatMatch user";
    const contextLabel =
        (isExternalPartner ? partnerOrganization : null) || user?.course?.code || roleLabel;

    return (
        <aside
            className={cn(
                "flex h-full w-[15.25rem] shrink-0 flex-col border-r border-slate-200/90 bg-[#f4f6f8]",
                className
            )}
        >
            <div className="flex h-[72px] items-center border-b border-slate-200/90 px-5">
                <Link
                    href="/dashboard"
                    onClick={onNavigate}
                    className="inline-flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/70 focus-visible:ring-offset-2"
                >
                    <Image
                        src="/logo-horizontal.png"
                        alt="WatMatch"
                        width={148}
                        height={34}
                        className="h-auto w-[148px]"
                        priority
                    />
                </Link>
            </div>
            <nav aria-label="Primary navigation" className="flex-1 overflow-y-auto px-3 py-4">
                <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Workspace
                </p>
                <div className="space-y-1">
                {navItems.map(({ href, label, icon: Icon }) => (
                    <Link
                        key={href}
                        href={href}
                        onClick={onNavigate}
                        aria-current={isActive(href) ? "page" : undefined}
                        className={`flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-slate-400/70 focus-visible:ring-offset-2 ${
                            isActive(href)
                                ? "bg-white font-medium text-slate-950 shadow-sm ring-1 ring-slate-200/80"
                                : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-950"
                        }`}
                    >
                        <Icon aria-hidden="true" className={`size-4 shrink-0 ${isActive(href) ? "text-slate-900" : "text-slate-400"}`} />
                        {label}
                    </Link>
                ))}
                </div>
            </nav>
            <div
                className="relative border-t border-slate-200/90 p-3"
                ref={menuRef}
            >
                {user?.email && (
                    <>
                        <button
                            ref={accountButtonRef}
                            type="button"
                            onClick={() => setShowMenu(!showMenu)}
                            title={
                                partnerOrganization
                                    ? `${partnerOrganization} · ${user.email}`
                                    : user.email
                            }
                            aria-haspopup="menu"
                            aria-expanded={showMenu}
                            aria-controls="account-menu"
                            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-left outline-none transition-colors hover:bg-slate-200/70 focus-visible:ring-2 focus-visible:ring-slate-400/70 focus-visible:ring-offset-2"
                        >
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-semibold uppercase text-white">
                                {roleLabel.charAt(0)}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-xs font-medium text-slate-800">{roleLabel}</span>
                                <span className="block truncate text-[11px] text-slate-500">
                                    {contextLabel !== roleLabel ? `${contextLabel} · ` : ""}{user.email}
                                </span>
                            </span>
                            <Settings className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                        </button>

                        {showMenu && (
                            <div
                                id="account-menu"
                                role="menu"
                                aria-label="Account actions"
                                onKeyDown={handleAccountMenuKeyDown}
                                className="absolute bottom-full left-3 right-3 mb-2 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-[var(--wm-shadow-floating)]"
                            >
                                {isStudent ? (
                                    <button
                                        ref={(node) => {
                                            menuItemRefs.current[0] = node;
                                        }}
                                        type="button"
                                        role="menuitem"
                                        onClick={() => {
                                            setShowMenu(false);
                                            handleOpenProfileModal();
                                        }}
                                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none transition-colors hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400/70"
                                    >
                                        <User className="h-4 w-4" aria-hidden="true" />
                                        Profile
                                    </button>
                                ) : null}
                                <button
                                    ref={(node) => {
                                        menuItemRefs.current[isStudent ? 1 : 0] = node;
                                    }}
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                        setShowMenu(false);
                                        handleLogout();
                                    }}
                                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none transition-colors hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400/70"
                                >
                                    <LogOut className="h-4 w-4" aria-hidden="true" />
                                    Logout
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Profile Modal */}
            <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
                <DialogContent
                    className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"
                    onCloseAutoFocus={(event) => {
                        if (accountButtonRef.current?.isConnected) {
                            event.preventDefault();
                            accountButtonRef.current.focus();
                        }
                    }}
                >
                    <DialogHeader>
                        <DialogTitle>Edit student profile</DialogTitle>
                        <DialogDescription>
                            This is the same profile teammates and authorized course or project collaborators see.
                        </DialogDescription>
                    </DialogHeader>
                    {isLoadingProfile ? (
                        <div className="space-y-4 py-2" aria-label="Loading your student profile">
                            <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
                                <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-5 pt-1">
                            {profileError && (
                                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                    {profileError}
                                </div>
                            )}

                            <div className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                                    {(user?.email || "?").charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="break-all text-sm font-semibold text-slate-950">
                                        {user?.email}
                                    </p>
                                    <p className="mt-1 text-xs leading-5 text-slate-600">
                                        {user?.course?.code
                                            ? `${user.course.code}${user.course.name ? ` - ${user.course.name}` : ""}`
                                            : "No course assigned"}
                                    </p>
                                    {headline && (
                                        <p className="mt-2 text-sm leading-5 text-slate-700">
                                            {headline}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <section className="rounded-xl border border-slate-200 bg-white p-4">
                                <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                                    Profile basics
                                </h3>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
                                <div className="space-y-2">
                                    <Label htmlFor="headline">Headline</Label>
                                    <Input
                                        id="headline"
                                        value={headline}
                                        onChange={(event) =>
                                            setHeadline(event.target.value)
                                        }
                                        placeholder="Systems student interested in robotics and product design"
                                        maxLength={MAX_HEADLINE_LENGTH}
                                    />
                                    <p className="text-xs text-slate-500">
                                        {headline.length}/{MAX_HEADLINE_LENGTH}
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="profile-availability">Availability</Label>
                                    <Select
                                        value={availability || "none"}
                                        onValueChange={(value) =>
                                            setAvailability(value === "none" ? "" : value)
                                        }
                                    >
                                        <SelectTrigger id="profile-availability">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Not specified</SelectItem>
                                            <SelectItem value="Actively looking for a team">
                                                Actively looking
                                            </SelectItem>
                                            <SelectItem value="Open to one more teammate">
                                                Open to teammates
                                            </SelectItem>
                                            <SelectItem value="Exploring project fits">
                                                Exploring fits
                                            </SelectItem>
                                            <SelectItem value="Not looking right now">
                                                Not looking
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="aboutMe">About Me</Label>
                                <div className="relative">
                                    <Textarea
                                        id="aboutMe"
                                        value={aboutMe}
                                        onChange={(e) =>
                                            setAboutMe(e.target.value)
                                        }
                                        placeholder="Tell teammates what you like building, how you work, and what kind of capstone would make you excited."
                                        className="min-h-[140px] resize-none"
                                        maxLength={MAX_ABOUT_ME_LENGTH}
                                    />
                                    <div className="absolute bottom-2 right-2 text-xs text-slate-500">
                                        {aboutMe.length}/{MAX_ABOUT_ME_LENGTH}
                                    </div>
                                </div>
                            </div>
                            </section>

                            <section className="rounded-xl border border-slate-200 bg-white p-4">
                                <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                                    Skills and interests
                                </h3>
                            <div className="space-y-2">
                                <Label htmlFor="skills">Skills</Label>
                                <MultiSelect
                                    id="skills"
                                    options={profileSkillOptions.map((s) => ({
                                        label: s,
                                        value: s,
                                    }))}
                                    value={skills}
                                    onChange={setSkills}
                                    placeholder="Search and select skills..."
                                    maxSelected={MAX_SKILLS}
                                    allowCustom
                                    customLabel="Add skill"
                                    chipClassName={() => taxonomyChipClassName("skill")}
                                />
                                <p className="text-xs text-slate-500">
                                    {skills.length}/{MAX_SKILLS} selected
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="profile-preferred-roles">Preferred Roles</Label>
                                    <MultiSelect
                                        id="profile-preferred-roles"
                                        options={roleOptions.map((role) => ({
                                            label: role,
                                            value: role,
                                        }))}
                                        value={preferredRoles}
                                        onChange={setPreferredRoles}
                                        placeholder="What would you like to own?"
                                        maxSelected={MAX_ROLES}
                                        allowCustom
                                        customLabel="Add role"
                                        chipClassName={() => taxonomyChipClassName("role")}
                                    />
                                    <p className="text-xs text-slate-500">
                                        {preferredRoles.length}/{MAX_ROLES} selected
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="profile-interested-departments">Interested Departments</Label>
                                    <MultiSelect
                                        id="profile-interested-departments"
                                        options={departments.map((department) => ({
                                            label: department.name,
                                            value: String(department.department_id),
                                        }))}
                                        value={interestedDepartmentIds}
                                        onChange={setInterestedDepartmentIds}
                                        placeholder="Departments you would enjoy working with"
                                        maxSelected={MAX_DEPARTMENTS}
                                        chipClassName={() =>
                                            taxonomyChipClassName("discipline")
                                        }
                                    />
                                    <p className="text-xs text-slate-500">
                                        {interestedDepartmentIds.length}/{MAX_DEPARTMENTS} selected
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="profile-project-interests">Project Interests</Label>
                                <MultiSelect
                                    id="profile-project-interests"
                                    options={projectInterestOptions.map((interest) => ({
                                        label: interest,
                                        value: interest,
                                    }))}
                                    value={projectInterests}
                                    onChange={setProjectInterests}
                                    placeholder="Domains or problems you want to explore"
                                    maxSelected={MAX_INTERESTS}
                                    allowCustom
                                    customLabel="Add interest"
                                    chipClassName={() => taxonomyChipClassName("interest")}
                                />
                                <p className="text-xs text-slate-500">
                                    {projectInterests.length}/{MAX_INTERESTS} selected
                                </p>
                            </div>
                            </section>

                            <section className="rounded-xl border border-slate-200 bg-white p-4">
                                <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                                    Links and visibility
                                </h3>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                <div className="space-y-2">
                                    <Label htmlFor="portfolioUrl">Portfolio</Label>
                                    <Input
                                        id="portfolioUrl"
                                        value={portfolioUrl}
                                        onChange={(event) =>
                                            setPortfolioUrl(event.target.value)
                                        }
                                        placeholder="https://..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="linkedinUrl">LinkedIn</Label>
                                    <Input
                                        id="linkedinUrl"
                                        value={linkedinUrl}
                                        onChange={(event) =>
                                            setLinkedinUrl(event.target.value)
                                        }
                                        placeholder="https://linkedin.com/in/..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="githubUrl">GitHub</Label>
                                    <Input
                                        id="githubUrl"
                                        value={githubUrl}
                                        onChange={(event) =>
                                            setGithubUrl(event.target.value)
                                        }
                                        placeholder="https://github.com/..."
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="profile-visibility">Visibility</Label>
                                <Select
                                    value={profileVisibility}
                                    onValueChange={(value) =>
                                        setProfileVisibility(
                                            value as "team_network" | "students" | "private"
                                        )
                                    }
                                >
                                    <SelectTrigger id="profile-visibility">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="team_network">
                                            Team and recruiting network
                                        </SelectItem>
                                        <SelectItem value="students">
                                            All WatMatch students
                                        </SelectItem>
                                        <SelectItem value="private">
                                            Official team only
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs leading-5 text-slate-500">
                                    {profileVisibility === "students"
                                        ? "Any signed-in student can view this profile. Authorized course and project staff retain access."
                                        : profileVisibility === "private"
                                          ? "Only you, your official teammates, and authorized course or administrative staff can view it."
                                          : "Official teammates and active recruiting, course, or project relationships can view it."}
                                </p>
                            </div>
                            </section>

                            <div className="flex justify-end pt-4">
                                <Button
                                    onClick={handleSaveProfile}
                                    disabled={
                                        headline.length > MAX_HEADLINE_LENGTH ||
                                        aboutMe.length > MAX_ABOUT_ME_LENGTH ||
                                        skills.length > MAX_SKILLS ||
                                        preferredRoles.length > MAX_ROLES ||
                                        projectInterests.length > MAX_INTERESTS ||
                                        interestedDepartmentIds.length > MAX_DEPARTMENTS ||
                                        isSaving
                                    }
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        "Save"
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </aside>
    );
}
