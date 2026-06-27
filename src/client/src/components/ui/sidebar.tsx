"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { userContext } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multiselect";
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
import { Settings, User, LogOut, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface SidebarProps {
    className?: string;
    onNavigate?: () => void;
}

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
    const menuRef = useRef<HTMLDivElement>(null);
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

    const isActive = (path: string) => pathname === path;

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
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showMenu]);

    const navItems = isInstructor
        ? [
              { href: "/dashboard", label: "Dashboard" },
              { href: "/discover", label: "Discover Projects" },
              { href: "/finalized-capstones", label: "Finalized Projects" },
              { href: "/external-opportunities", label: "External Opportunities" },
              { href: "/past-capstones", label: "Previous Capstones" },
          ]
        : isAdmin
        ? [
              { href: "/dashboard", label: "Admin Dashboard" },
              { href: "/discover", label: "Discover Projects" },
              { href: "/finalized-capstones", label: "Finalized Projects" },
              { href: "/external-opportunities", label: "External Opportunities" },
              { href: "/past-capstones", label: "Previous Capstones" },
          ]
        : isAcademicAdvisor
        ? [
              { href: "/dashboard", label: "Advisor Dashboard" },
          ]
        : isEnrollmentOperator
        ? [
              { href: "/dashboard", label: "Enrollment Dashboard" },
          ]
        : isExternalPartner
        ? [
              { href: "/dashboard", label: "Partner Dashboard" },
              { href: "/discover", label: "Discover Projects" },
              { href: "/finalized-capstones", label: "Finalized Projects" },
              { href: "/external-opportunities", label: "External Opportunities" },
          ]
        : isMentor
        ? [
              { href: "/dashboard", label: "Mentor Dashboard" },
              { href: "/discover", label: "Discover Projects" },
              { href: "/finalized-capstones", label: "Finalized Projects" },
          ]
        : isStudent
        ? [
              { href: "/dashboard", label: "My Dashboard" },
              { href: "/discover", label: "Discover Projects" },
              { href: "/finalized-capstones", label: "Finalized Projects" },
              { href: "/external-opportunities", label: "External Opportunities" },
              { href: "/project-form", label: "Submit Project" },
              { href: "/past-capstones", label: "Previous Capstones" },
          ]
        : [
              { href: "/discover", label: "Discover Projects" },
              { href: "/finalized-capstones", label: "Finalized Projects" },
              { href: "/external-opportunities", label: "External Opportunities" },
              { href: "/past-capstones", label: "Previous Capstones" },
          ];

    return (
        <aside
            className={cn(
                "w-64 bg-slate-100 border-r border-slate-200 flex flex-col h-full",
                className
            )}
        >
            <div className="p-6 border-b border-slate-200">
                <Link href="/" className="inline-flex items-center">
                    <Image
                        src="/logo-horizontal.png"
                        alt="WatMatch"
                        width={170}
                        height={36}
                        priority
                    />
                </Link>
            </div>
            <nav className="flex-1 p-4 space-y-2">
                {navItems.map(({ href, label }) => (
                    <Link
                        key={href}
                        href={href}
                        onClick={onNavigate}
                        className={`block px-4 py-2 rounded-md transition ${
                            isActive(href)
                                ? "bg-slate-200 text-slate-900 font-medium"
                                : "text-slate-700 hover:bg-slate-200/50 hover:text-slate-900"
                        }`}
                    >
                        {label}
                    </Link>
                ))}
            </nav>
            <div
                className="p-4 border-t border-slate-200 relative"
                ref={menuRef}
            >
                {user?.email && (
                    <>
                        <div
                            className="flex items-center justify-between px-2 py-1 rounded-md hover:bg-slate-200 transition-colors cursor-pointer"
                            onClick={() => setShowMenu(!showMenu)}
                        >
                            <span className="text-sm text-slate-600 truncate">
                                {user.email}
                            </span>
                            <div className="h-8 w-8 flex items-center justify-center">
                                <Settings className="h-4 w-4 text-slate-600" />
                            </div>
                        </div>

                        {showMenu && (
                            <div className="absolute bottom-full left-2 right-2 mb-2 bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden">
                                <button
                                    onClick={() => {
                                        setShowMenu(false);
                                        handleOpenProfileModal();
                                    }}
                                    className={`w-full items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-100 transition-colors ${
                                        isStudent ? "flex" : "hidden"
                                    }`}
                                >
                                    <User className="h-4 w-4" />
                                    Profile
                                </button>
                                <button
                                    onClick={() => {
                                        setShowMenu(false);
                                        handleLogout();
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-100 transition-colors border-t border-slate-200"
                                >
                                    <LogOut className="h-4 w-4" />
                                    Logout
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Profile Modal */}
            <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                    <DialogTitle>Edit Profile</DialogTitle>
                    {isLoadingProfile ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                        </div>
                    ) : (
                        <div className="space-y-6 pt-4">
                            {profileError && (
                                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                    {profileError}
                                </div>
                            )}

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
                                    <Label>Availability</Label>
                                    <Select
                                        value={availability || "none"}
                                        onValueChange={(value) =>
                                            setAvailability(value === "none" ? "" : value)
                                        }
                                    >
                                        <SelectTrigger>
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

                            <div className="space-y-2">
                                <Label htmlFor="skills">Skills</Label>
                                <MultiSelect
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
                                />
                                <p className="text-xs text-slate-500">
                                    {skills.length}/{MAX_SKILLS} selected
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Preferred Roles</Label>
                                    <MultiSelect
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
                                    />
                                    <p className="text-xs text-slate-500">
                                        {preferredRoles.length}/{MAX_ROLES} selected
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Interested Departments</Label>
                                    <MultiSelect
                                        options={departments.map((department) => ({
                                            label: department.name,
                                            value: String(department.department_id),
                                        }))}
                                        value={interestedDepartmentIds}
                                        onChange={setInterestedDepartmentIds}
                                        placeholder="Departments you would enjoy working with"
                                        maxSelected={MAX_DEPARTMENTS}
                                    />
                                    <p className="text-xs text-slate-500">
                                        {interestedDepartmentIds.length}/{MAX_DEPARTMENTS} selected
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Project Interests</Label>
                                <MultiSelect
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
                                />
                                <p className="text-xs text-slate-500">
                                    {projectInterests.length}/{MAX_INTERESTS} selected
                                </p>
                            </div>

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
                                <Label>Visibility</Label>
                                <Select
                                    value={profileVisibility}
                                    onValueChange={(value) =>
                                        setProfileVisibility(
                                            value as "team_network" | "students" | "private"
                                        )
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="team_network">
                                            Team network
                                        </SelectItem>
                                        <SelectItem value="students">
                                            All students
                                        </SelectItem>
                                        <SelectItem value="private">
                                            Private
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

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
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
