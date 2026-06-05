"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { userContext } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multiselect";
import { skills as skillOptions } from "@/components/forms/project/config";
import {
    updateStudentProfile,
    fetchStudentProfile,
} from "@/services/users.service";
import { Settings, User, LogOut, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export default function Sidebar() {
    const pathname = usePathname();
    const { logout } = useAuth();
    const { clearUser, user } = userContext();
    const normalizedRole = user?.role?.toLowerCase();
    const isInstructor = normalizedRole === "instructor";
    const isStudent =
        normalizedRole === "student" || normalizedRole === "leader";
    const isAdmin = normalizedRole === "admin";
    const [showMenu, setShowMenu] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [aboutMe, setAboutMe] = useState("");
    const [skills, setSkills] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingProfile, setIsLoadingProfile] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const MAX_ABOUT_ME_LENGTH = 250;

    const isActive = (path: string) => pathname === path;

    const handleLogout = () => {
        clearUser();
        logout();
    };

    const loadProfile = async () => {
        setIsLoadingProfile(true);
        try {
            const profile = await fetchStudentProfile();
            if (profile) {
                setAboutMe(profile.about_me || "");
                setSkills(profile.skills || []);
            } else {
                setAboutMe("");
                setSkills([]);
            }
        } catch (error) {
            console.error("Failed to load profile:", error);
        } finally {
            setIsLoadingProfile(false);
        }
    };

    const handleSaveProfile = async () => {
        setIsSaving(true);
        try {
            await updateStudentProfile({
                about_me: aboutMe || null,
                skills: skills.length > 0 ? skills : null,
            });
            setShowProfileModal(false);
        } catch (error) {
            console.error("Failed to save profile:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleOpenProfileModal = () => {
        setShowProfileModal(true);
        loadProfile();
    };

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
              { href: "/project-form", label: "Submit Project" },
              { href: "/past-capstones", label: "Previous Capstones" },
          ]
        : isAdmin
        ? [
              { href: "/dashboard", label: "Admin Dashboard" },
              { href: "/discover", label: "Discover Projects" },
              { href: "/past-capstones", label: "Previous Capstones" },
          ]
        : isStudent
        ? [
              { href: "/dashboard", label: "My Dashboard" },
              { href: "/discover", label: "Discover Projects" },
              { href: "/project-form", label: "Submit Project" },
              { href: "/past-capstones", label: "Previous Capstones" },
          ]
        : [
              { href: "/discover", label: "Discover Projects" },
              { href: "/project-form", label: "Submit Project" },
              { href: "/past-capstones", label: "Previous Capstones" },
          ];

    return (
        <aside className="w-64 bg-slate-100 border-r border-slate-200 flex flex-col h-full">
            <div className="p-6 border-b border-slate-200">
                <Link href="/" className="text-2xl font-bold text-slate-900">
                    WatMatch
                </Link>
            </div>
            <nav className="flex-1 p-4 space-y-2">
                {navItems.map(({ href, label }) => (
                    <Link
                        key={href}
                        href={href}
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
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
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
                <DialogContent className="sm:max-w-2xl">
                    <DialogTitle>Edit Profile</DialogTitle>
                    {isLoadingProfile ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                        </div>
                    ) : (
                        <div className="space-y-6 pt-4">
                            {/* About Me Section */}
                            <div className="space-y-2">
                                <Label htmlFor="aboutMe">About Me</Label>
                                <div className="relative">
                                    <Textarea
                                        id="aboutMe"
                                        value={aboutMe}
                                        onChange={(e) =>
                                            setAboutMe(e.target.value)
                                        }
                                        placeholder="Tell us about yourself..."
                                        className="min-h-[120px] resize-none"
                                        maxLength={MAX_ABOUT_ME_LENGTH}
                                    />
                                    <div className="absolute bottom-2 right-2 text-xs text-slate-500">
                                        {aboutMe.length}/{MAX_ABOUT_ME_LENGTH}
                                    </div>
                                </div>
                            </div>

                            {/* Skills Section */}
                            <div className="space-y-2">
                                <Label htmlFor="skills">Skills</Label>
                                <MultiSelect
                                    options={skillOptions.map((s) => ({
                                        label: s,
                                        value: s,
                                    }))}
                                    value={skills}
                                    onChange={setSkills}
                                    placeholder="Search and select skills..."
                                />
                            </div>

                            {/* Save Button */}
                            <div className="flex justify-end pt-4">
                                <Button
                                    onClick={handleSaveProfile}
                                    disabled={
                                        aboutMe.length > MAX_ABOUT_ME_LENGTH ||
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
