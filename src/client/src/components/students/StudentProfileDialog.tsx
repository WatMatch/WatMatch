"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
    ExternalLink,
    Github,
    Linkedin,
    Loader2,
    Mail,
    UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { TaxonomyChipList } from "@/components/ui/taxonomy-chip";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    fetchStudentProfileById,
    type StudentProfile,
} from "@/services/users.service";

export interface StudentProfileIdentity {
    userId: string | number;
    email: string;
    courseLabel?: string | null;
    departmentLabel?: string | null;
    isLeader?: boolean;
}

interface StudentProfileDialogProps {
    student: StudentProfileIdentity | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface ProfileLink {
    label: string;
    href: string;
    icon: typeof ExternalLink;
}

function compactList(values?: string[] | null): string[] {
    return Array.isArray(values)
        ? values.map((value) => value.trim()).filter(Boolean)
        : [];
}

function safeExternalUrl(value?: string | null): string | null {
    if (!value) return null;
    try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:"
            ? url.toString()
            : null;
    } catch {
        return null;
    }
}

function profileLinks(profile: StudentProfile | null): ProfileLink[] {
    if (!profile) return [];
    return [
        {
            label: "Portfolio",
            href: safeExternalUrl(profile.portfolio_url),
            icon: ExternalLink,
        },
        {
            label: "LinkedIn",
            href: safeExternalUrl(profile.linkedin_url),
            icon: Linkedin,
        },
        {
            label: "GitHub",
            href: safeExternalUrl(profile.github_url),
            icon: Github,
        },
    ].filter((link): link is ProfileLink => Boolean(link.href));
}

function hasProfileContent(profile: StudentProfile | null): boolean {
    if (!profile) return false;
    return Boolean(
        profile.headline ||
            profile.about_me ||
            profile.availability ||
            compactList(profile.skills).length ||
            compactList(profile.preferred_roles).length ||
            compactList(profile.project_interests).length ||
            (profile.interested_departments || []).length ||
            profileLinks(profile).length
    );
}

function ProfileLoadingState() {
    return (
        <div className="space-y-5 py-2" aria-label="Loading student profile">
            <div className="flex items-center gap-3">
                <div className="h-12 w-12 animate-pulse rounded-full bg-slate-200" />
                <div className="flex-1 space-y-2">
                    <div className="h-4 w-48 max-w-full animate-pulse rounded bg-slate-200" />
                    <div className="h-3 w-32 animate-pulse rounded bg-slate-100" />
                </div>
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            </div>
            <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
            <div className="flex gap-2">
                <div className="h-7 w-20 animate-pulse rounded-full bg-slate-100" />
                <div className="h-7 w-24 animate-pulse rounded-full bg-slate-100" />
                <div className="h-7 w-16 animate-pulse rounded-full bg-slate-100" />
            </div>
        </div>
    );
}

/**
 * Canonical read-only student profile summary. Identity is supplied only by an
 * already-authorized team, recruiting, course, or partner context; profile
 * content is still protected by the relationship-aware backend endpoint.
 */
export function StudentProfileSummary({
    student,
    profile,
}: {
    student: StudentProfileIdentity;
    profile: StudentProfile | null;
}) {
    const links = profileLinks(profile);
    const skills = compactList(profile?.skills);
    const roles = compactList(profile?.preferred_roles);
    const interests = compactList(profile?.project_interests);
    const departments = (profile?.interested_departments || [])
        .map((department) => department.name?.trim())
        .filter((name): name is string => Boolean(name));

    return (
        <div className="space-y-5">
            <div className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                    {(student.email || "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="break-all text-sm font-semibold text-slate-950">
                        {student.email}
                    </p>
                    {(student.courseLabel || student.departmentLabel) && (
                        <p className="mt-1 text-xs leading-5 text-slate-600">
                            {[student.courseLabel, student.departmentLabel]
                                .filter(Boolean)
                                .join(" · ")}
                        </p>
                    )}
                    {profile?.headline && (
                        <p className="mt-2 text-sm leading-5 text-slate-700">
                            {profile.headline}
                        </p>
                    )}
                    {profile?.availability && (
                        <p className="mt-1 text-xs font-medium text-emerald-700">
                            {profile.availability}
                        </p>
                    )}
                </div>
            </div>

            {profile?.about_me && (
                <section aria-labelledby="profile-about-heading">
                    <h3
                        id="profile-about-heading"
                        className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
                    >
                        About
                    </h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                        {profile.about_me}
                    </p>
                </section>
            )}

            {(skills.length > 0 || roles.length > 0) && (
                <div className="grid gap-5 sm:grid-cols-2">
                    {skills.length > 0 && (
                        <section aria-labelledby="profile-skills-heading">
                            <h3
                                id="profile-skills-heading"
                                className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
                            >
                                Skills
                            </h3>
                            <TaxonomyChipList namespace="skill" values={skills} />
                        </section>
                    )}
                    {roles.length > 0 && (
                        <section aria-labelledby="profile-roles-heading">
                            <h3
                                id="profile-roles-heading"
                                className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
                            >
                                Preferred roles
                            </h3>
                            <TaxonomyChipList namespace="role" values={roles} />
                        </section>
                    )}
                </div>
            )}

            {(interests.length > 0 || departments.length > 0) && (
                <div className="grid gap-5 sm:grid-cols-2">
                    {interests.length > 0 && (
                        <section aria-labelledby="profile-interests-heading">
                            <h3
                                id="profile-interests-heading"
                                className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
                            >
                                Project interests
                            </h3>
                            <TaxonomyChipList namespace="interest" values={interests} />
                        </section>
                    )}
                    {departments.length > 0 && (
                        <section aria-labelledby="profile-disciplines-heading">
                            <h3
                                id="profile-disciplines-heading"
                                className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
                            >
                                Interested disciplines
                            </h3>
                            <TaxonomyChipList namespace="discipline" values={departments} />
                        </section>
                    )}
                </div>
            )}

            {links.length > 0 && (
                <section aria-labelledby="profile-links-heading">
                    <h3
                        id="profile-links-heading"
                        className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
                    >
                        Links
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {links.map(({ label, href, icon: Icon }) => (
                            <Button key={label} variant="outline" size="sm" asChild>
                                <a href={href} target="_blank" rel="noreferrer">
                                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                                    {label}
                                </a>
                            </Button>
                        ))}
                    </div>
                </section>
            )}

            {!hasProfileContent(profile) && (
                <div className="rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center">
                    <UserRound className="mx-auto h-5 w-5 text-slate-400" aria-hidden="true" />
                    <p className="mt-2 text-sm font-medium text-slate-700">
                        No profile details yet
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                        Their official team identity is shown above; optional skills and interests have not been added.
                    </p>
                </div>
            )}
        </div>
    );
}

export function StudentProfileDialog({
    student,
    open,
    onOpenChange,
}: StudentProfileDialogProps) {
    const [profile, setProfile] = useState<StudentProfile | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const openerRef = useRef<HTMLElement | null>(null);
    const studentKey = student ? String(student.userId) : null;

    useEffect(() => {
        if (!open || !studentKey) return;

        let cancelled = false;
        setLoading(true);
        setError("");
        setProfile(null);

        fetchStudentProfileById(studentKey)
            .then((result) => {
                if (!cancelled) setProfile(result);
            })
            .catch((requestError) => {
                if (cancelled) return;
                setError(
                    requestError instanceof Error
                        ? requestError.message
                        : "This profile could not be loaded."
                );
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [open, studentKey]);

    const description = useMemo(() => {
        if (!student) return "Authorized student profile details.";
        return `Profile details for ${student.email}.`;
    }, [student]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
                onOpenAutoFocus={() => {
                    const activeElement = document.activeElement;
                    openerRef.current =
                        activeElement instanceof HTMLElement ? activeElement : null;
                }}
                onCloseAutoFocus={(event) => {
                    const opener = openerRef.current;
                    if (!opener?.isConnected) return;
                    event.preventDefault();
                    requestAnimationFrame(() => opener.focus());
                    openerRef.current = null;
                }}
            >
                <DialogHeader>
                    <DialogTitle>Student profile</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                {loading ? (
                    <ProfileLoadingState />
                ) : error ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                        <p className="font-medium">Profile unavailable</p>
                        <p className="mt-1 leading-5">{error}</p>
                    </div>
                ) : student ? (
                    <StudentProfileSummary student={student} profile={profile} />
                ) : (
                    <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
                        <Mail className="h-4 w-4" aria-hidden="true" />
                        Select a student to view their profile.
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
