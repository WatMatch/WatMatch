"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Loader2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { MultiSelect } from "@/components/ui/multiselect";
import {
    deliverableTypeOptions,
    disciplines as fallbackDepartmentOptions,
    skills as fallbackSkillOptions,
} from "@/components/forms/project/config";
import { fetchCourses, type Course } from "@/services/courses.service";
import { fetchDepartments } from "@/services/departments.service";
import { fetchSkills } from "@/services/skills.service";
import {
    courseMultiSelectOptions,
    courseTargetTagsFromIds,
    legacyTargetCourseTags as getLegacyTargetCourseTags,
    numericCourseIds,
    targetCourseIdsFromOpportunity,
    toMultiSelectOptions,
    uniqueStrings,
} from "@/lib/opportunity-options";
import {
    createMyPartnerOpportunity,
    fetchMyPartnerOpportunityPage,
    fetchMyPartnerProfile,
    fetchMyPartnerTeams,
    saveMyPartnerProfile,
    updateMyPartnerOpportunity,
    type PartnerOpportunity,
    type PartnerOpportunityStatus,
    type PartnerTeam,
} from "@/services/partners.service";
import {
    fetchStudentProfileById,
    type StudentProfile,
} from "@/services/users.service";
import { buildTermOptions, withExistingTerm } from "@/lib/term-options";

const projectStartTermOptions = buildTermOptions();

function splitTags(value: string): string[] {
    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

function joinTags(value?: string[] | null): string {
    return (value || []).join(", ");
}

interface OpportunityFormState {
    title: string;
    organization: string;
    description: string;
    primaryContact: string;
    phone: string;
    howHeardAboutCapstone: string;
    organizationDescription: string;
    organizationSize: string;
    projectStartDate: string;
    problemArea: string;
    mainObjectives: string;
    scopeOfWork: string;
    deliverableTypes: string[];
    deliverables: string;
    meetingFrequency: string;
    resourcesNeeded: string;
    disciplines: string[];
    skills: string[];
    targetCourseIds: string[];
    legacyTargetCourseTags: string[];
    preferredTeamSize: string;
    maxActiveTeams: string;
    contactEmail: string;
    contactUrl: string;
    ipAcknowledged: boolean;
    ndaAcknowledged: boolean;
    matchingAcknowledged: boolean;
    status: PartnerOpportunityStatus;
}

const emptyOpportunity: OpportunityFormState = {
    title: "",
    organization: "",
    description: "",
    primaryContact: "",
    phone: "",
    howHeardAboutCapstone: "",
    organizationDescription: "",
    organizationSize: "",
    projectStartDate: "",
    problemArea: "",
    mainObjectives: "",
    scopeOfWork: "",
    deliverableTypes: [],
    deliverables: "",
    meetingFrequency: "",
    resourcesNeeded: "",
    disciplines: [],
    skills: [],
    targetCourseIds: [],
    legacyTargetCourseTags: [],
    preferredTeamSize: "",
    maxActiveTeams: "",
    contactEmail: "",
    contactUrl: "",
    ipAcknowledged: false,
    ndaAcknowledged: false,
    matchingAcknowledged: false,
    status: "draft" as PartnerOpportunityStatus,
};

function formatPartnerStatus(status: PartnerOpportunityStatus): string {
    if (status === "draft") return "Draft";
    if (status === "published") return "Published";
    if (status === "archived") return "Archived";
    return "Unknown";
}

function profileList(values?: string[] | null): string[] {
    return Array.isArray(values) ? values.filter(Boolean) : [];
}

function profileLinks(profile: StudentProfile | null) {
    if (!profile) return [];
    return [
        { label: "Portfolio", href: profile.portfolio_url },
        { label: "LinkedIn", href: profile.linkedin_url },
        { label: "GitHub", href: profile.github_url },
    ].filter((link): link is { label: string; href: string } => Boolean(link.href));
}

function hasProfileContent(profile: StudentProfile | null): boolean {
    if (!profile) return false;
    return Boolean(
        profile.headline ||
            profile.about_me ||
            profile.availability ||
            profileList(profile.skills).length ||
            profileList(profile.preferred_roles).length ||
            profileList(profile.project_interests).length ||
            (profile.interested_departments || []).length ||
            profileLinks(profile).length
    );
}

export function ExternalPartnerDashboard() {
    const [profile, setProfile] = useState({
        displayName: "",
        organization: "",
        contactEmail: "",
        website: "",
        bio: "",
        areas: "",
    });
    const [opportunities, setOpportunities] = useState<PartnerOpportunity[]>([]);
    const [partnerTeams, setPartnerTeams] = useState<PartnerTeam[]>([]);
    const [opportunityPage, setOpportunityPage] = useState(1);
    const [opportunityTotalPages, setOpportunityTotalPages] = useState(1);
    const [form, setForm] = useState(emptyOpportunity);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [showStudentProfileModal, setShowStudentProfileModal] = useState(false);
    const [selectedStudentEmail, setSelectedStudentEmail] = useState("");
    const [selectedStudentProfile, setSelectedStudentProfile] =
        useState<StudentProfile | null>(null);
    const [loadingStudentProfile, setLoadingStudentProfile] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [departmentOptions, setDepartmentOptions] = useState<string[]>(
        fallbackDepartmentOptions
    );
    const [skillOptions, setSkillOptions] = useState<string[]>(
        fallbackSkillOptions
    );
    const [courses, setCourses] = useState<Course[]>([]);

    const deliverableOptions = useMemo(
        () => toMultiSelectOptions(deliverableTypeOptions),
        []
    );
    const departmentMultiSelectOptions = useMemo(
        () => toMultiSelectOptions(departmentOptions),
        [departmentOptions]
    );
    const skillMultiSelectOptions = useMemo(
        () => toMultiSelectOptions(skillOptions),
        [skillOptions]
    );
    const targetCourseOptions = useMemo(
        () => courseMultiSelectOptions(courses),
        [courses]
    );

    const loadData = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [profileData, opportunityPayload, teamsData] = await Promise.all([
                fetchMyPartnerProfile(),
                fetchMyPartnerOpportunityPage({
                    page: opportunityPage,
                    pageSize: 10,
                }),
                fetchMyPartnerTeams(),
            ]);
            if (profileData) {
                setProfile({
                    displayName: profileData.display_name || "",
                    organization: profileData.organization || "",
                    contactEmail: profileData.contact_email || "",
                    website: profileData.website || "",
                    bio: profileData.bio || "",
                    areas: joinTags(profileData.areas),
                });
                setForm((previous) => ({
                    ...previous,
                    organization: previous.organization || profileData.organization || "",
                    contactEmail: previous.contactEmail || profileData.contact_email || "",
                    contactUrl: previous.contactUrl || profileData.website || "",
                }));
            }
            setOpportunities(opportunityPayload.data || []);
            setPartnerTeams(teamsData || []);
            setOpportunityTotalPages(
                Math.max(1, opportunityPayload.total_pages || 1)
            );
        } catch (loadError) {
            console.error(loadError);
            setError(
                loadError instanceof Error
                    ? loadError.message
                    : "Could not load external partner data."
            );
        } finally {
            setLoading(false);
        }
    }, [opportunityPage]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        let isMounted = true;

        async function loadStandardOptions() {
            try {
                const [departmentRows, skillRows, courseRows] = await Promise.all([
                    fetchDepartments(true),
                    fetchSkills(),
                    fetchCourses(true),
                ]);
                if (!isMounted) return;
                if (departmentRows.length) {
                    setDepartmentOptions(
                        uniqueStrings(departmentRows.map((department) => department.name))
                    );
                }
                if (skillRows.length) {
                    setSkillOptions(uniqueStrings(skillRows.map((skill) => skill.name)));
                }
                setCourses(courseRows);
            } catch (optionsError) {
                console.error("Failed to load standardized opportunity options:", optionsError);
            }
        }

        loadStandardOptions();
        return () => {
            isMounted = false;
        };
    }, []);

    const saveProfile = async () => {
        setSaving(true);
        setError("");
        setNotice("");
        try {
            await saveMyPartnerProfile({
                display_name: profile.displayName,
                organization: profile.organization,
                contact_email: profile.contactEmail,
                website: profile.website || null,
                bio: profile.bio || null,
                areas: splitTags(profile.areas),
            });
            setNotice("Profile saved.");
            await loadData();
        } catch (saveError) {
            console.error(saveError);
            setError(saveError instanceof Error ? saveError.message : "Failed to save profile.");
        } finally {
            setSaving(false);
        }
    };

    const startEdit = (opportunity: PartnerOpportunity) => {
        const relatedCourses = courses.length
            ? courses
            : opportunity.target_courses || [];
        const targetCourseIds = targetCourseIdsFromOpportunity(
            opportunity,
            relatedCourses
        );
        setEditingId(opportunity.partner_opportunity_id);
        setForm({
            title: opportunity.title || "",
            organization: opportunity.organization || "",
            description: opportunity.description || "",
            primaryContact: opportunity.primary_contact || "",
            phone: opportunity.phone || "",
            howHeardAboutCapstone: opportunity.how_heard_about_capstone || "",
            organizationDescription: opportunity.organization_description || "",
            organizationSize: opportunity.organization_size || "",
            projectStartDate: opportunity.project_start_date || "",
            problemArea: opportunity.problem_area || "",
            mainObjectives: opportunity.main_objectives || "",
            scopeOfWork: opportunity.scope_of_work || "",
            deliverableTypes: uniqueStrings(opportunity.deliverable_types),
            deliverables: opportunity.deliverables || "",
            meetingFrequency: opportunity.meeting_frequency || "",
            resourcesNeeded: opportunity.resources_needed || "",
            disciplines: uniqueStrings(opportunity.disciplines),
            skills: uniqueStrings(opportunity.skills),
            targetCourseIds,
            legacyTargetCourseTags: getLegacyTargetCourseTags(
                opportunity.target_course_tags,
                targetCourseIds,
                relatedCourses
            ),
            preferredTeamSize: opportunity.preferred_team_size || "",
            maxActiveTeams: opportunity.max_active_teams
                ? String(opportunity.max_active_teams)
                : "",
            contactEmail: opportunity.contact_email || "",
            contactUrl: opportunity.contact_url || "",
            ipAcknowledged: opportunity.ip_acknowledged === true,
            ndaAcknowledged: opportunity.nda_acknowledged === true,
            matchingAcknowledged: opportunity.matching_acknowledged === true,
            status: opportunity.status,
        });
    };

    const openStudentProfile = async (studentId: number, email: string) => {
        setSelectedStudentEmail(email);
        setSelectedStudentProfile(null);
        setShowStudentProfileModal(true);
        setLoadingStudentProfile(true);
        try {
            setSelectedStudentProfile(await fetchStudentProfileById(String(studentId)));
        } catch (profileError) {
            console.error(profileError);
            setError(
                profileError instanceof Error
                    ? profileError.message
                    : "Could not load student profile."
            );
        } finally {
            setLoadingStudentProfile(false);
        }
    };

    const saveOpportunity = async () => {
        setSaving(true);
        setError("");
        setNotice("");
        try {
            const targetCourseTags = uniqueStrings([
                ...courseTargetTagsFromIds(form.targetCourseIds, courses),
                ...form.legacyTargetCourseTags,
            ]);
            const payload = {
                title: form.title,
                organization: form.organization,
                description: form.description || form.problemArea || form.title,
                primary_contact: form.primaryContact || null,
                phone: form.phone || null,
                how_heard_about_capstone: form.howHeardAboutCapstone || null,
                organization_description: form.organizationDescription || null,
                organization_size: form.organizationSize || null,
                project_start_date: form.projectStartDate || null,
                problem_area: form.problemArea || null,
                main_objectives: form.mainObjectives || null,
                scope_of_work: form.scopeOfWork || null,
                deliverable_types: form.deliverableTypes,
                deliverables: form.deliverables || null,
                meeting_frequency: form.meetingFrequency || null,
                resources_needed: form.resourcesNeeded || null,
                disciplines: form.disciplines,
                skills: form.skills,
                target_course_tags: targetCourseTags,
                target_course_ids: numericCourseIds(form.targetCourseIds),
                preferred_team_size: form.preferredTeamSize || null,
                max_active_teams: form.maxActiveTeams
                    ? Number(form.maxActiveTeams)
                    : null,
                contact_email: form.contactEmail,
                contact_url: form.contactUrl || null,
                ip_acknowledged: form.ipAcknowledged,
                nda_acknowledged: form.ndaAcknowledged,
                matching_acknowledged: form.matchingAcknowledged,
                status: form.status,
            };
            if (editingId) {
                await updateMyPartnerOpportunity(editingId, payload);
                setNotice("Opportunity updated.");
            } else {
                await createMyPartnerOpportunity(payload);
                setNotice(form.status === "published" ? "Opportunity published." : "Opportunity saved as draft.");
                setOpportunityPage(1);
            }
            setEditingId(null);
            setForm({
                ...emptyOpportunity,
                organization: profile.organization,
                contactEmail: profile.contactEmail,
                contactUrl: profile.website,
            });
            await loadData();
        } catch (saveError) {
            console.error(saveError);
            setError(
                saveError instanceof Error
                    ? saveError.message
                    : "Failed to save opportunity."
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 px-2 sm:px-4">
            <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 py-6 sm:py-8">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                        External Partner Dashboard
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Manage your profile and the capstone opportunities students can browse.
                    </p>
                </div>

                {(error || notice) && (
                    <div
                        className={`rounded-md border px-3 py-2 text-sm ${
                            error
                                ? "border-red-200 bg-red-50 text-red-700"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        }`}
                    >
                        {error || notice}
                    </div>
                )}

                <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle>Partner Profile</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Display Name</Label>
                                <Input
                                    value={profile.displayName}
                                    onChange={(event) =>
                                        setProfile((previous) => ({
                                            ...previous,
                                            displayName: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Organization</Label>
                                <Input
                                    value={profile.organization}
                                    onChange={(event) =>
                                        setProfile((previous) => ({
                                            ...previous,
                                            organization: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Contact Email</Label>
                                <Input
                                    type="email"
                                    value={profile.contactEmail}
                                    onChange={(event) =>
                                        setProfile((previous) => ({
                                            ...previous,
                                            contactEmail: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Website</Label>
                                <Input
                                    value={profile.website}
                                    onChange={(event) =>
                                        setProfile((previous) => ({
                                            ...previous,
                                            website: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Areas</Label>
                            <Input
                                value={profile.areas}
                                onChange={(event) =>
                                    setProfile((previous) => ({
                                        ...previous,
                                        areas: event.target.value,
                                    }))
                                }
                                placeholder="Biomedical Engineering, Modelling, Health"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Bio</Label>
                            <Textarea
                                value={profile.bio}
                                onChange={(event) =>
                                    setProfile((previous) => ({
                                        ...previous,
                                        bio: event.target.value,
                                    }))
                                }
                            />
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                            <Button
                                onClick={saveProfile}
                                disabled={saving}
                                className="w-full sm:w-auto"
                            >
                                {saving ? "Saving..." : "Save Profile"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle>
                            {editingId ? "Edit Opportunity" : "Create Opportunity"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Title</Label>
                                <Input value={form.title} onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Organization</Label>
                                <Input value={form.organization} onChange={(event) => setForm((previous) => ({ ...previous, organization: event.target.value }))} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea rows={5} value={form.description} onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))} />
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Primary Contact</Label>
                                <Input value={form.primaryContact} onChange={(event) => setForm((previous) => ({ ...previous, primaryContact: event.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Phone</Label>
                                <Input value={form.phone} onChange={(event) => setForm((previous) => ({ ...previous, phone: event.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Organization Size</Label>
                                <Select value={form.organizationSize} onValueChange={(value) => setForm((previous) => ({ ...previous, organizationSize: value }))}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select size" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Small (1-50)">Small (1-50)</SelectItem>
                                        <SelectItem value="Medium (51-100)">Medium (51-100)</SelectItem>
                                        <SelectItem value="Large (500+)">Large (500+)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Project Start Date</Label>
                                <Select
                                    value={form.projectStartDate}
                                    onValueChange={(value) => setForm((previous) => ({ ...previous, projectStartDate: value }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select starting term" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {withExistingTerm(projectStartTermOptions, form.projectStartDate).map((term) => (
                                            <SelectItem key={term} value={term}>
                                                {term}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>How did you hear about capstone?</Label>
                            <Input value={form.howHeardAboutCapstone} onChange={(event) => setForm((previous) => ({ ...previous, howHeardAboutCapstone: event.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Organization Description</Label>
                            <Textarea rows={4} value={form.organizationDescription} onChange={(event) => setForm((previous) => ({ ...previous, organizationDescription: event.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Problem Area</Label>
                            <Textarea rows={4} value={form.problemArea} onChange={(event) => setForm((previous) => ({ ...previous, problemArea: event.target.value }))} />
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Main Objectives</Label>
                                <Textarea rows={4} value={form.mainObjectives} onChange={(event) => setForm((previous) => ({ ...previous, mainObjectives: event.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Scope of Work</Label>
                                <Textarea rows={4} value={form.scopeOfWork} onChange={(event) => setForm((previous) => ({ ...previous, scopeOfWork: event.target.value }))} />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Deliverable Types</Label>
                                <MultiSelect
                                    options={deliverableOptions}
                                    value={form.deliverableTypes}
                                    onChange={(value) =>
                                        setForm((previous) => ({
                                            ...previous,
                                            deliverableTypes: value,
                                        }))
                                    }
                                    placeholder="Select deliverables"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Meeting Frequency</Label>
                                <Select value={form.meetingFrequency} onValueChange={(value) => setForm((previous) => ({ ...previous, meetingFrequency: value }))}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select frequency" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="weekly">Weekly</SelectItem>
                                        <SelectItem value="biweekly">Bi-weekly</SelectItem>
                                        <SelectItem value="monthly">Monthly</SelectItem>
                                        <SelectItem value="end_of_term_presentation">End of term presentation only</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Deliverable Details</Label>
                                <Textarea rows={4} value={form.deliverables} onChange={(event) => setForm((previous) => ({ ...previous, deliverables: event.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Resources Needed</Label>
                                <Textarea rows={4} value={form.resourcesNeeded} onChange={(event) => setForm((previous) => ({ ...previous, resourcesNeeded: event.target.value }))} />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                            <div className="space-y-2">
                                <Label>Disciplines</Label>
                                <MultiSelect
                                    options={departmentMultiSelectOptions}
                                    value={form.disciplines}
                                    onChange={(value) =>
                                        setForm((previous) => ({
                                            ...previous,
                                            disciplines: value,
                                        }))
                                    }
                                    placeholder="Select departments"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Skills</Label>
                                <MultiSelect
                                    options={skillMultiSelectOptions}
                                    value={form.skills}
                                    onChange={(value) =>
                                        setForm((previous) => ({
                                            ...previous,
                                            skills: value,
                                        }))
                                    }
                                    placeholder="Select skills"
                                    allowCustom
                                    customLabel="Add skill"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Target Courses</Label>
                                <MultiSelect
                                    options={targetCourseOptions}
                                    value={form.targetCourseIds}
                                    onChange={(value) =>
                                        setForm((previous) => ({
                                            ...previous,
                                            targetCourseIds: value,
                                        }))
                                    }
                                    placeholder="Select courses"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <div className="space-y-2">
                                <Label>Team Size</Label>
                                <Input value={form.preferredTeamSize} onChange={(event) => setForm((previous) => ({ ...previous, preferredTeamSize: event.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Max Active Teams</Label>
                                <Input type="number" min={1} value={form.maxActiveTeams} onChange={(event) => setForm((previous) => ({ ...previous, maxActiveTeams: event.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Contact Email</Label>
                                <Input type="email" value={form.contactEmail} onChange={(event) => setForm((previous) => ({ ...previous, contactEmail: event.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select value={form.status} onValueChange={(value) => setForm((previous) => ({ ...previous, status: value as PartnerOpportunityStatus }))}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="draft">Draft</SelectItem>
                                        <SelectItem value="published">Published</SelectItem>
                                        <SelectItem value="archived">Archived</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Contact Link</Label>
                            <Input value={form.contactUrl} onChange={(event) => setForm((previous) => ({ ...previous, contactUrl: event.target.value }))} />
                        </div>
                        <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                            <Label>Policies and Agreements</Label>
                            <label className="flex items-start gap-3 text-sm text-slate-700">
                                <Checkbox checked={form.ipAcknowledged} onCheckedChange={(checked) => setForm((previous) => ({ ...previous, ipAcknowledged: checked === true }))} />
                                <span>I acknowledge the University intellectual property policy and will contact University staff if IP transfer needs to be discussed.</span>
                            </label>
                            <label className="flex items-start gap-3 text-sm text-slate-700">
                                <Checkbox checked={form.ndaAcknowledged} onCheckedChange={(checked) => setForm((previous) => ({ ...previous, ndaAcknowledged: checked === true }))} />
                                <span>I acknowledge that NDAs and other agreements must be discussed with University staff and/or capstone instructors.</span>
                            </label>
                            <label className="flex items-start gap-3 text-sm text-slate-700">
                                <Checkbox checked={form.matchingAcknowledged} onCheckedChange={(checked) => setForm((previous) => ({ ...previous, matchingAcknowledged: checked === true }))} />
                                <span>I acknowledge that submitting an opportunity does not guarantee matching with a student team.</span>
                            </label>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                            <Button
                                onClick={saveOpportunity}
                                disabled={saving}
                                className="w-full sm:w-auto"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {saving ? "Saving..." : editingId ? "Update Opportunity" : "Publish Opportunity"}
                            </Button>
                            {editingId && (
                                <Button
                                    variant="outline"
                                    onClick={() => { setEditingId(null); setForm(emptyOpportunity); }}
                                    className="w-full sm:w-auto"
                                >
                                    Cancel
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle>Your Opportunities</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <p className="text-sm text-slate-600">Loading opportunities...</p>
                        ) : opportunities.length === 0 ? (
                            <p className="text-sm text-slate-600">No opportunities yet.</p>
                        ) : (
                            <div className="space-y-3">
                                {opportunities.map((opportunity) => {
                                    const activeCount = Number(opportunity.active_team_count || 0);
                                    const isFull = opportunity.is_available === false;
                                    return (
                                        <div
                                            key={opportunity.partner_opportunity_id}
                                            className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_auto]"
                                        >
                                            <div className="min-w-0">
                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                    <p className="font-medium leading-snug text-slate-900">
                                                        {opportunity.title}
                                                    </p>
                                                    <span className="w-fit rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                                                        {formatPartnerStatus(opportunity.status)}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-sm text-slate-600">
                                                    {opportunity.organization}
                                                </p>
                                                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                                    {opportunity.max_active_teams && (
                                                        <span className="rounded bg-slate-100 px-2 py-1 text-slate-700">
                                                            {activeCount}/{opportunity.max_active_teams} teams
                                                        </span>
                                                    )}
                                                    {isFull && (
                                                        <span className="rounded bg-amber-100 px-2 py-1 font-medium text-amber-800">
                                                            Full
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <Button
                                                variant="outline"
                                                onClick={() => startEdit(opportunity)}
                                                className="w-full md:w-auto"
                                            >
                                                <Pencil className="w-4 h-4 mr-2" />
                                                Edit
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        <div className="flex flex-col items-center justify-center gap-3 pt-4 sm:flex-row">
                            <Button
                                variant="outline"
                                onClick={() =>
                                    setOpportunityPage((current) =>
                                        Math.max(1, current - 1)
                                    )
                                }
                                disabled={loading || opportunityPage <= 1}
                                className="w-full sm:w-auto"
                            >
                                Previous
                            </Button>
                            <span className="text-sm text-slate-600">
                                Page {opportunityPage} of {opportunityTotalPages}
                            </span>
                            <Button
                                variant="outline"
                                onClick={() =>
                                    setOpportunityPage((current) =>
                                        Math.min(opportunityTotalPages, current + 1)
                                    )
                                }
                                disabled={
                                    loading ||
                                    opportunityPage >= opportunityTotalPages
                                }
                                className="w-full sm:w-auto"
                            >
                                Next
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle>Partnered Teams</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <p className="text-sm text-slate-600">Loading teams...</p>
                        ) : partnerTeams.length === 0 ? (
                            <p className="text-sm text-slate-600">
                                No teams are linked to your opportunities yet.
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {partnerTeams.map((team) => (
                                    <div
                                        key={team.team_id}
                                        className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                                    >
                                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="min-w-0">
                                                <p className="font-medium text-slate-900">
                                                    {team.capstone?.title || "Untitled capstone"}
                                                </p>
                                                <p className="mt-1 text-sm text-slate-600">
                                                    {team.opportunity?.title || "External opportunity"}
                                                </p>
                                            </div>
                                            <span className="w-fit rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                                                {team.status || "forming"}
                                            </span>
                                        </div>
                                        <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                                            {team.team_members.map((member) => (
                                                <div
                                                    key={member.user_id}
                                                    className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="break-all text-sm font-medium text-slate-800">
                                                            {member.email}
                                                        </p>
                                                        {member.home_department?.name && (
                                                            <p className="text-xs text-slate-500">
                                                                {member.home_department.name}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            openStudentProfile(
                                                                member.user_id,
                                                                member.email
                                                            )
                                                        }
                                                        className="shrink-0"
                                                    >
                                                        <Eye className="mr-2 h-4 w-4" />
                                                        Profile
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Dialog
                    open={showStudentProfileModal}
                    onOpenChange={setShowStudentProfileModal}
                >
                    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                        <DialogTitle>Student Profile</DialogTitle>
                        {loadingStudentProfile ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                            </div>
                        ) : (
                            <div className="space-y-6 pt-4">
                                <div className="space-y-2">
                                    <Label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                                        Email
                                    </Label>
                                    <p className="break-all text-sm text-slate-700">
                                        {selectedStudentEmail}
                                    </p>
                                </div>
                                {(selectedStudentProfile?.headline ||
                                    selectedStudentProfile?.availability) && (
                                    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                                        {selectedStudentProfile?.headline && (
                                            <p className="text-base font-medium text-slate-900">
                                                {selectedStudentProfile.headline}
                                            </p>
                                        )}
                                        {selectedStudentProfile?.availability && (
                                            <p className="mt-1 text-sm text-slate-600">
                                                {selectedStudentProfile.availability}
                                            </p>
                                        )}
                                    </div>
                                )}
                                {selectedStudentProfile?.about_me && (
                                    <div className="space-y-2">
                                        <Label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                                            About Me
                                        </Label>
                                        <p className="whitespace-pre-wrap text-sm text-slate-700">
                                            {selectedStudentProfile.about_me}
                                        </p>
                                    </div>
                                )}
                                {profileList(selectedStudentProfile?.skills).length > 0 && (
                                    <div className="space-y-2">
                                        <Label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                                            Skills
                                        </Label>
                                        <div className="flex flex-wrap gap-2">
                                            {profileList(selectedStudentProfile?.skills).map((skill) => (
                                                <span
                                                    key={skill}
                                                    className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700"
                                                >
                                                    {skill}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    {profileList(selectedStudentProfile?.preferred_roles).length > 0 && (
                                        <div className="space-y-2">
                                            <Label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                                                Preferred Roles
                                            </Label>
                                            <div className="flex flex-wrap gap-2">
                                                {profileList(selectedStudentProfile?.preferred_roles).map((role) => (
                                                    <span
                                                        key={role}
                                                        className="rounded-full bg-emerald-100 px-3 py-1 text-sm text-emerald-700"
                                                    >
                                                        {role}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {profileList(selectedStudentProfile?.project_interests).length > 0 && (
                                        <div className="space-y-2">
                                            <Label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                                                Project Interests
                                            </Label>
                                            <div className="flex flex-wrap gap-2">
                                                {profileList(selectedStudentProfile?.project_interests).map((interest) => (
                                                    <span
                                                        key={interest}
                                                        className="rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-800"
                                                    >
                                                        {interest}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {(selectedStudentProfile?.interested_departments || []).length > 0 && (
                                    <div className="space-y-2">
                                        <Label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                                            Interested Departments
                                        </Label>
                                        <div className="flex flex-wrap gap-2">
                                            {(selectedStudentProfile?.interested_departments || []).map((department) => (
                                                <span
                                                    key={department.department_id}
                                                    className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
                                                >
                                                    {department.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {profileLinks(selectedStudentProfile).length > 0 && (
                                    <div className="space-y-2">
                                        <Label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                                            Links
                                        </Label>
                                        <div className="flex flex-wrap gap-2">
                                            {profileLinks(selectedStudentProfile).map((link) => (
                                                <a
                                                    key={link.label}
                                                    href={link.href}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
                                                >
                                                    {link.label}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {!hasProfileContent(selectedStudentProfile) && (
                                    <div className="py-8 text-center text-slate-500">
                                        This student hasn't set up their profile yet.
                                    </div>
                                )}
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
