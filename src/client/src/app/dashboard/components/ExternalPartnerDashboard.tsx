"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, ChevronDown, Eye, Loader2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
import { TaxonomyChipList, taxonomyChipClassName } from "@/components/ui/taxonomy-chip";
import {
    ConfirmActionDialog,
    Disclosure,
    StatusBadge,
} from "@/components/ui/workspace";
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
    courseTargetLabel,
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
    type PartnerTeamMember,
} from "@/services/partners.service";
import {
    StudentProfileDialog,
    type StudentProfileIdentity,
} from "@/components/students/StudentProfileDialog";
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

function partnerStatusClass(status: PartnerOpportunityStatus): string {
    if (status === "published") return "bg-emerald-50 text-emerald-800";
    if (status === "draft") return "bg-amber-50 text-amber-800";
    return "bg-slate-100 text-slate-700";
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
    const [profileEditorOpen, setProfileEditorOpen] = useState(false);
    const [opportunityEditorOpen, setOpportunityEditorOpen] = useState(false);
    const [organizationSectionOpen, setOrganizationSectionOpen] = useState(false);
    const [deliverySectionOpen, setDeliverySectionOpen] = useState(false);
    const [targetingSectionOpen, setTargetingSectionOpen] = useState(false);
    const [agreementsSectionOpen, setAgreementsSectionOpen] = useState(false);
    const [profileStudent, setProfileStudent] =
        useState<StudentProfileIdentity | null>(null);
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

    const resetOpportunitySections = () => {
        setOrganizationSectionOpen(false);
        setDeliverySectionOpen(false);
        setTargetingSectionOpen(false);
        setAgreementsSectionOpen(false);
    };

    const revealOpportunityErrorFields = (message: string) => {
        const normalized = message.toLowerCase();
        const includesAny = (values: string[]) =>
            values.some((value) => normalized.includes(value));

        if (
            includesAny([
                "primary_contact",
                "primary contact",
                "phone",
                "how_heard",
                "how heard",
                "organization_description",
                "organization description",
                "organization_size",
                "organization size",
            ])
        ) {
            setOrganizationSectionOpen(true);
        }
        if (
            includesAny([
                "problem_area",
                "problem area",
                "main_objectives",
                "main objectives",
                "scope_of_work",
                "scope of work",
                "deliverable",
                "meeting_frequency",
                "meeting frequency",
                "resources_needed",
                "resources needed",
            ])
        ) {
            setDeliverySectionOpen(true);
        }
        if (
            includesAny([
                "project_start_date",
                "project start",
                "discipline",
                "skill",
                "target_course",
                "target course",
                "preferred_team_size",
                "preferred team size",
                "max_active_teams",
                "max active teams",
            ])
        ) {
            setTargetingSectionOpen(true);
        }
        if (
            includesAny([
                "ip_acknowledged",
                "ip acknowledgement",
                "nda_acknowledged",
                "nda acknowledgement",
                "matching_acknowledged",
                "matching acknowledgement",
                "agreement",
            ])
        ) {
            setAgreementsSectionOpen(true);
        }
    };

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
            setProfileEditorOpen(false);
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
        setError("");
        setNotice("");
        resetOpportunitySections();
        setOpportunityEditorOpen(true);
    };

    const startCreate = () => {
        setEditingId(null);
        setForm({
            ...emptyOpportunity,
            organization: profile.organization,
            contactEmail: profile.contactEmail,
            contactUrl: profile.website,
        });
        setError("");
        setNotice("");
        resetOpportunitySections();
        setOpportunityEditorOpen(true);
    };

    const closeOpportunityEditor = () => {
        setOpportunityEditorOpen(false);
        setEditingId(null);
        setForm({
            ...emptyOpportunity,
            organization: profile.organization,
            contactEmail: profile.contactEmail,
            contactUrl: profile.website,
        });
        resetOpportunitySections();
    };

    const openStudentProfile = (member: PartnerTeamMember) => {
        const course = courses.find(
            (candidate) => candidate.course_id === member.course_fk
        );
        setProfileStudent({
            userId: member.user_id,
            email: member.email,
            courseLabel: course
                ? `${course.code} - ${course.name}`
                : member.course_fk
                  ? `Course #${member.course_fk}`
                  : "No course assigned",
            departmentLabel: member.home_department?.name || null,
        });
    };

    const saveOpportunity = async (rethrowForDialog = false) => {
        setError("");
        setNotice("");

        const requiredFields = [
            {
                value: form.title.trim(),
                message: "Add an opportunity title before saving.",
                fieldId: "opportunity-title",
            },
            {
                value: form.organization.trim(),
                message: "Add the organization name before saving.",
                fieldId: "opportunity-organization",
            },
            {
                value: form.contactEmail.trim(),
                message: "Add a contact email before saving.",
                fieldId: "opportunity-contact-email",
            },
        ];
        const missingField = requiredFields.find((field) => !field.value);
        if (missingField) {
            setError(missingField.message);
            window.requestAnimationFrame(() => {
                document.getElementById(missingField.fieldId)?.focus();
            });
            return;
        }

        if (form.maxActiveTeams) {
            const maxActiveTeams = Number(form.maxActiveTeams);
            if (!Number.isInteger(maxActiveTeams) || maxActiveTeams < 1 || maxActiveTeams > 100) {
                setTargetingSectionOpen(true);
                setError("Max active teams must be a whole number from 1 to 100.");
                window.requestAnimationFrame(() => {
                    document.getElementById("opportunity-max-teams")?.focus();
                });
                return;
            }
        }

        setSaving(true);
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
            setOpportunityEditorOpen(false);
            await loadData();
        } catch (saveError) {
            const message =
                saveError instanceof Error
                    ? saveError.message
                    : "Failed to save opportunity.";
            revealOpportunityErrorFields(message);
            setError(message);
            if (rethrowForDialog) throw new Error(message);
        } finally {
            setSaving(false);
        }
    };

    const organizationDetailCount = [
        form.primaryContact,
        form.phone,
        form.organizationSize,
        form.howHeardAboutCapstone,
        form.organizationDescription,
    ].filter(Boolean).length;
    const deliveryDetailCount = [
        form.problemArea,
        form.mainObjectives,
        form.scopeOfWork,
        form.deliverableTypes.length ? "deliverable-types" : "",
        form.meetingFrequency,
        form.deliverables,
        form.resourcesNeeded,
    ].filter(Boolean).length;
    const targetingDetailCount = [
        form.projectStartDate,
        form.disciplines.length ? "disciplines" : "",
        form.skills.length ? "skills" : "",
        form.targetCourseIds.length ? "target-courses" : "",
        form.preferredTeamSize,
        form.maxActiveTeams,
    ].filter(Boolean).length;
    const agreementCount = [
        form.ipAcknowledged,
        form.ndaAcknowledged,
        form.matchingAcknowledged,
    ].filter(Boolean).length;
    const editingOpportunity = editingId
        ? opportunities.find((opportunity) => opportunity.partner_opportunity_id === editingId)
        : null;
    const isArchivingOpportunity = Boolean(
        editingOpportunity &&
            editingOpportunity.status !== "archived" &&
            form.status === "archived"
    );
    const opportunitySaveLabel = saving
        ? "Saving…"
        : form.status === "published"
          ? editingId
              ? "Save and publish"
              : "Publish opportunity"
          : editingId
            ? "Save changes"
            : "Save draft";

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-1 py-2 sm:px-2 sm:py-4">
                <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Partner workspace
                        </p>
                        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                            Opportunities
                        </h1>
                        <p className="mt-1 max-w-2xl text-sm text-slate-600">
                            Publish project opportunities and follow the student teams connected to your organization.
                        </p>
                    </div>
                    <Button type="button" onClick={startCreate}>
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        New opportunity
                    </Button>
                </header>

                {(error || notice) && (
                    <div
                        role={error ? "alert" : "status"}
                        aria-live="polite"
                        className={`rounded-lg border px-4 py-3 text-sm ${
                            error
                                ? "border-red-200 bg-red-50 text-red-800"
                                : "border-emerald-200 bg-emerald-50 text-emerald-800"
                        }`}
                    >
                        {error || notice}
                    </div>
                )}

                <Dialog open={profileEditorOpen} onOpenChange={setProfileEditorOpen}>
                    <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Edit organization profile</DialogTitle>
                            <DialogDescription>
                                This information identifies your organization across its opportunities.
                            </DialogDescription>
                        </DialogHeader>
                        {error && (
                            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                                {error}
                            </div>
                        )}
                        <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="partner-display-name">Display Name</Label>
                                <Input
                                    id="partner-display-name"
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
                                <Label htmlFor="partner-organization">Organization</Label>
                                <Input
                                    id="partner-organization"
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
                                <Label htmlFor="partner-contact-email">Contact Email</Label>
                                <Input
                                    id="partner-contact-email"
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
                                <Label htmlFor="partner-website">Website</Label>
                                <Input
                                    id="partner-website"
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
                            <Label htmlFor="partner-areas">Areas</Label>
                            <Input
                                id="partner-areas"
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
                            <Label htmlFor="partner-bio">Bio</Label>
                            <Textarea
                                id="partner-bio"
                                value={profile.bio}
                                onChange={(event) =>
                                    setProfile((previous) => ({
                                        ...previous,
                                        bio: event.target.value,
                                    }))
                                }
                            />
                        </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setProfileEditorOpen(false)} disabled={saving}>
                                Cancel
                            </Button>
                            <Button type="button" onClick={saveProfile} disabled={saving}>
                                {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                                {saving ? "Saving…" : "Save profile"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog
                    open={opportunityEditorOpen}
                    onOpenChange={(open) => {
                        if (open) setOpportunityEditorOpen(true);
                        else closeOpportunityEditor();
                    }}
                >
                    <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl sm:p-0">
                        <DialogHeader className="shrink-0 border-b border-slate-200 px-4 py-4 pr-12 sm:px-6">
                            <DialogTitle>
                                {editingId ? "Edit opportunity" : "Create opportunity"}
                            </DialogTitle>
                            <DialogDescription>
                                Complete the required basics first. Open the optional sections only when the project needs more context.
                            </DialogDescription>
                        </DialogHeader>

                        {error && (
                            <div
                                role="alert"
                                className="mx-4 mt-4 shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 sm:mx-6"
                            >
                                {error}
                            </div>
                        )}

                        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6">
                            <section
                                aria-labelledby="opportunity-basics-heading"
                                className="rounded-lg border border-slate-200 bg-white p-4"
                            >
                                <div className="mb-4">
                                    <h3 id="opportunity-basics-heading" className="text-sm font-semibold text-slate-950">
                                        Opportunity basics
                                    </h3>
                                    <p className="mt-1 text-xs leading-5 text-slate-500">
                                        Title, organization, and contact email are required. This summary is what students see first.
                                    </p>
                                </div>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="opportunity-title">
                                                Title <span className="font-normal text-slate-500">(required)</span>
                                            </Label>
                                            <Input
                                                id="opportunity-title"
                                                required
                                                maxLength={300}
                                                value={form.title}
                                                onChange={(event) =>
                                                    setForm((previous) => ({ ...previous, title: event.target.value }))
                                                }
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="opportunity-organization">
                                                Organization <span className="font-normal text-slate-500">(required)</span>
                                            </Label>
                                            <Input
                                                id="opportunity-organization"
                                                required
                                                maxLength={200}
                                                value={form.organization}
                                                onChange={(event) =>
                                                    setForm((previous) => ({ ...previous, organization: event.target.value }))
                                                }
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="opportunity-description">Student-facing summary</Label>
                                        <Textarea
                                            id="opportunity-description"
                                            rows={4}
                                            maxLength={10000}
                                            value={form.description}
                                            onChange={(event) =>
                                                setForm((previous) => ({ ...previous, description: event.target.value }))
                                            }
                                            placeholder="Briefly describe the project and why it matters."
                                        />
                                        <p className="text-xs text-slate-500">
                                            If left blank, WatMatch uses the problem area or title as the summary.
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                        <div className="space-y-2 md:col-span-2">
                                            <Label htmlFor="opportunity-contact-email">
                                                Contact email <span className="font-normal text-slate-500">(required)</span>
                                            </Label>
                                            <Input
                                                id="opportunity-contact-email"
                                                type="email"
                                                required
                                                maxLength={320}
                                                value={form.contactEmail}
                                                onChange={(event) =>
                                                    setForm((previous) => ({ ...previous, contactEmail: event.target.value }))
                                                }
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="opportunity-status">Status</Label>
                                            <Select
                                                value={form.status}
                                                onValueChange={(value) =>
                                                    setForm((previous) => ({
                                                        ...previous,
                                                        status: value as PartnerOpportunityStatus,
                                                    }))
                                                }
                                            >
                                                <SelectTrigger id="opportunity-status">
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
                                        <Label htmlFor="opportunity-contact-link">Contact or project link</Label>
                                        <Input
                                            id="opportunity-contact-link"
                                            maxLength={500}
                                            value={form.contactUrl}
                                            onChange={(event) =>
                                                setForm((previous) => ({ ...previous, contactUrl: event.target.value }))
                                            }
                                            placeholder="https://…"
                                        />
                                    </div>
                                </div>
                            </section>

                            <Disclosure
                                summary={
                                    <span className="flex min-w-0 items-center justify-between gap-3">
                                        <span>Organization &amp; background</span>
                                        <span className="shrink-0 text-xs font-normal text-slate-500">
                                            {organizationDetailCount ? `${organizationDetailCount} added` : "Optional"}
                                        </span>
                                    </span>
                                }
                                open={organizationSectionOpen}
                                onToggle={(event) => setOrganizationSectionOpen(event.currentTarget.open)}
                                contentClassName="space-y-4 bg-slate-50/50"
                            >
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="opportunity-primary-contact">Primary contact</Label>
                                        <Input
                                            id="opportunity-primary-contact"
                                            maxLength={200}
                                            value={form.primaryContact}
                                            onChange={(event) =>
                                                setForm((previous) => ({ ...previous, primaryContact: event.target.value }))
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="opportunity-phone">Phone</Label>
                                        <Input
                                            id="opportunity-phone"
                                            maxLength={50}
                                            value={form.phone}
                                            onChange={(event) =>
                                                setForm((previous) => ({ ...previous, phone: event.target.value }))
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="opportunity-organization-size">Organization size</Label>
                                        <Select
                                            value={form.organizationSize}
                                            onValueChange={(value) =>
                                                setForm((previous) => ({ ...previous, organizationSize: value }))
                                            }
                                        >
                                            <SelectTrigger id="opportunity-organization-size">
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
                                        <Label htmlFor="opportunity-referral">How did you hear about capstone?</Label>
                                        <Input
                                            id="opportunity-referral"
                                            maxLength={1000}
                                            value={form.howHeardAboutCapstone}
                                            onChange={(event) =>
                                                setForm((previous) => ({
                                                    ...previous,
                                                    howHeardAboutCapstone: event.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="opportunity-organization-description">Organization description</Label>
                                    <Textarea
                                        id="opportunity-organization-description"
                                        rows={4}
                                        maxLength={5000}
                                        value={form.organizationDescription}
                                        onChange={(event) =>
                                            setForm((previous) => ({
                                                ...previous,
                                                organizationDescription: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                            </Disclosure>

                            <Disclosure
                                summary={
                                    <span className="flex min-w-0 items-center justify-between gap-3">
                                        <span>Project delivery &amp; cadence</span>
                                        <span className="shrink-0 text-xs font-normal text-slate-500">
                                            {deliveryDetailCount ? `${deliveryDetailCount} added` : "Optional"}
                                        </span>
                                    </span>
                                }
                                open={deliverySectionOpen}
                                onToggle={(event) => setDeliverySectionOpen(event.currentTarget.open)}
                                contentClassName="space-y-4 bg-slate-50/50"
                            >
                                <div className="space-y-2">
                                    <Label htmlFor="opportunity-problem-area">Problem area</Label>
                                    <Textarea
                                        id="opportunity-problem-area"
                                        rows={4}
                                        maxLength={1000}
                                        value={form.problemArea}
                                        onChange={(event) =>
                                            setForm((previous) => ({ ...previous, problemArea: event.target.value }))
                                        }
                                    />
                                </div>
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="opportunity-objectives">Main objectives</Label>
                                        <Textarea
                                            id="opportunity-objectives"
                                            rows={4}
                                            maxLength={3000}
                                            value={form.mainObjectives}
                                            onChange={(event) =>
                                                setForm((previous) => ({ ...previous, mainObjectives: event.target.value }))
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="opportunity-scope">Scope of work</Label>
                                        <Textarea
                                            id="opportunity-scope"
                                            rows={4}
                                            maxLength={3000}
                                            value={form.scopeOfWork}
                                            onChange={(event) =>
                                                setForm((previous) => ({ ...previous, scopeOfWork: event.target.value }))
                                            }
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <div className="space-y-2" role="group" aria-labelledby="opportunity-deliverable-types-label">
                                        <Label id="opportunity-deliverable-types-label">Deliverable types</Label>
                                        <MultiSelect
                                            options={deliverableOptions}
                                            value={form.deliverableTypes}
                                            onChange={(value) =>
                                                setForm((previous) => ({ ...previous, deliverableTypes: value }))
                                            }
                                            placeholder="Select deliverables"
                                            chipClassName={() => taxonomyChipClassName("deliverable")}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="opportunity-meeting-frequency">Meeting frequency</Label>
                                        <Select
                                            value={form.meetingFrequency}
                                            onValueChange={(value) =>
                                                setForm((previous) => ({ ...previous, meetingFrequency: value }))
                                            }
                                        >
                                            <SelectTrigger id="opportunity-meeting-frequency">
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
                                        <Label htmlFor="opportunity-deliverables">Deliverable details</Label>
                                        <Textarea
                                            id="opportunity-deliverables"
                                            rows={4}
                                            maxLength={3000}
                                            value={form.deliverables}
                                            onChange={(event) =>
                                                setForm((previous) => ({ ...previous, deliverables: event.target.value }))
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="opportunity-resources">Resources needed</Label>
                                        <Textarea
                                            id="opportunity-resources"
                                            rows={4}
                                            maxLength={2000}
                                            value={form.resourcesNeeded}
                                            onChange={(event) =>
                                                setForm((previous) => ({ ...previous, resourcesNeeded: event.target.value }))
                                            }
                                        />
                                    </div>
                                </div>
                            </Disclosure>

                            <Disclosure
                                summary={
                                    <span className="flex min-w-0 items-center justify-between gap-3">
                                        <span>Student targeting &amp; project support</span>
                                        <span className="shrink-0 text-xs font-normal text-slate-500">
                                            {targetingDetailCount ? `${targetingDetailCount} added` : "Optional"}
                                        </span>
                                    </span>
                                }
                                open={targetingSectionOpen}
                                onToggle={(event) => setTargetingSectionOpen(event.currentTarget.open)}
                                contentClassName="space-y-4 bg-slate-50/50"
                            >
                                <div className="space-y-2">
                                    <Label htmlFor="opportunity-start-term">Preferred project start term</Label>
                                    <Select
                                        value={form.projectStartDate}
                                        onValueChange={(value) =>
                                            setForm((previous) => ({ ...previous, projectStartDate: value }))
                                        }
                                    >
                                        <SelectTrigger id="opportunity-start-term">
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
                                <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                                    <div className="space-y-2" role="group" aria-labelledby="opportunity-disciplines-label">
                                        <Label id="opportunity-disciplines-label">Disciplines</Label>
                                        <MultiSelect
                                            options={departmentMultiSelectOptions}
                                            value={form.disciplines}
                                            onChange={(value) =>
                                                setForm((previous) => ({ ...previous, disciplines: value }))
                                            }
                                            placeholder="Select departments"
                                            chipClassName={() => taxonomyChipClassName("discipline")}
                                        />
                                    </div>
                                    <div className="space-y-2" role="group" aria-labelledby="opportunity-skills-label">
                                        <Label id="opportunity-skills-label">Skills</Label>
                                        <MultiSelect
                                            options={skillMultiSelectOptions}
                                            value={form.skills}
                                            onChange={(value) =>
                                                setForm((previous) => ({ ...previous, skills: value }))
                                            }
                                            placeholder="Select skills"
                                            allowCustom
                                            customLabel="Add skill"
                                            chipClassName={() => taxonomyChipClassName("skill")}
                                        />
                                    </div>
                                    <div className="space-y-2" role="group" aria-labelledby="opportunity-target-courses-label">
                                        <Label id="opportunity-target-courses-label">Target courses</Label>
                                        <MultiSelect
                                            options={targetCourseOptions}
                                            value={form.targetCourseIds}
                                            onChange={(value) =>
                                                setForm((previous) => ({ ...previous, targetCourseIds: value }))
                                            }
                                            placeholder="Select courses"
                                            chipClassName={() => taxonomyChipClassName("course")}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="opportunity-team-size">Preferred team size</Label>
                                        <Input
                                            id="opportunity-team-size"
                                            maxLength={100}
                                            value={form.preferredTeamSize}
                                            onChange={(event) =>
                                                setForm((previous) => ({ ...previous, preferredTeamSize: event.target.value }))
                                            }
                                            placeholder="For example, 4–6 students"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="opportunity-max-teams">Maximum active teams</Label>
                                        <Input
                                            id="opportunity-max-teams"
                                            type="number"
                                            min={1}
                                            max={100}
                                            step={1}
                                            value={form.maxActiveTeams}
                                            onChange={(event) =>
                                                setForm((previous) => ({ ...previous, maxActiveTeams: event.target.value }))
                                            }
                                            placeholder="No limit"
                                        />
                                        <p className="text-xs text-slate-500">Leave blank when capacity is not capped.</p>
                                    </div>
                                </div>
                            </Disclosure>

                            <Disclosure
                                summary={
                                    <span className="flex min-w-0 items-center justify-between gap-3">
                                        <span>Policies &amp; agreements</span>
                                        <span className="shrink-0 text-xs font-normal text-slate-500">
                                            {agreementCount} of 3 acknowledged
                                        </span>
                                    </span>
                                }
                                open={agreementsSectionOpen}
                                onToggle={(event) => setAgreementsSectionOpen(event.currentTarget.open)}
                                contentClassName="space-y-3 bg-slate-50/50"
                            >
                                <label htmlFor="opportunity-ip-acknowledgement" className="flex items-start gap-3 text-sm leading-5 text-slate-700">
                                    <Checkbox
                                        id="opportunity-ip-acknowledgement"
                                        checked={form.ipAcknowledged}
                                        onCheckedChange={(checked) =>
                                            setForm((previous) => ({ ...previous, ipAcknowledged: checked === true }))
                                        }
                                    />
                                    <span>
                                        I acknowledge the University intellectual property policy and will contact University staff if IP transfer needs to be discussed.
                                    </span>
                                </label>
                                <label htmlFor="opportunity-nda-acknowledgement" className="flex items-start gap-3 text-sm leading-5 text-slate-700">
                                    <Checkbox
                                        id="opportunity-nda-acknowledgement"
                                        checked={form.ndaAcknowledged}
                                        onCheckedChange={(checked) =>
                                            setForm((previous) => ({ ...previous, ndaAcknowledged: checked === true }))
                                        }
                                    />
                                    <span>
                                        I acknowledge that NDAs and other agreements must be discussed with University staff and/or capstone instructors.
                                    </span>
                                </label>
                                <label htmlFor="opportunity-matching-acknowledgement" className="flex items-start gap-3 text-sm leading-5 text-slate-700">
                                    <Checkbox
                                        id="opportunity-matching-acknowledgement"
                                        checked={form.matchingAcknowledged}
                                        onCheckedChange={(checked) =>
                                            setForm((previous) => ({ ...previous, matchingAcknowledged: checked === true }))
                                        }
                                    />
                                    <span>
                                        I acknowledge that submitting an opportunity does not guarantee matching with a student team.
                                    </span>
                                </label>
                            </Disclosure>
                        </div>

                        <DialogFooter className="shrink-0 flex-col gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                            <p className="text-left text-xs leading-5 text-slate-500">
                                Optional details remain saved even while their sections are collapsed.
                            </p>
                            <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                                <Button type="button" variant="outline" onClick={closeOpportunityEditor} disabled={saving}>
                                    Cancel
                                </Button>
                                {isArchivingOpportunity ? (
                                    <ConfirmActionDialog
                                        title="Archive this opportunity?"
                                        description="Students will no longer find this opportunity in the published marketplace. You can edit and publish it again later."
                                        confirmLabel="Archive opportunity"
                                        tone="destructive"
                                        onConfirm={() => saveOpportunity(true)}
                                        trigger={
                                            <Button type="button" disabled={saving}>
                                                {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                                                {opportunitySaveLabel}
                                            </Button>
                                        }
                                    />
                                ) : (
                                    <Button type="button" onClick={() => saveOpportunity()} disabled={saving}>
                                        {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                                        {opportunitySaveLabel}
                                    </Button>
                                )}
                            </div>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Card>
                    <CardHeader className="border-b border-slate-100">
                        <CardTitle>Opportunity list</CardTitle>
                        <CardDescription>
                            Draft, publish, and maintain the opportunities students can browse.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-slate-600">
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                Loading opportunities…
                            </div>
                        ) : opportunities.length === 0 ? (
                            <div className="px-5 py-10 text-center">
                                <Building2 className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
                                <p className="mt-2 text-sm font-medium text-slate-800">No opportunities yet</p>
                                <p className="mt-1 text-sm text-slate-500">Create a draft when your next project idea is ready.</p>
                                <Button type="button" size="sm" className="mt-4" onClick={startCreate}>
                                    <Plus className="h-4 w-4" aria-hidden="true" />
                                    New opportunity
                                </Button>
                            </div>
                        ) : (
                             opportunities.map((opportunity) => {
                                 const activeCount = Number(opportunity.active_team_count || 0);
                                 const isFull = opportunity.is_available === false;
                                 const targetCourseLabels = opportunity.target_courses?.length
                                     ? opportunity.target_courses.map(courseTargetLabel)
                                     : opportunity.target_course_tags || [];
                                return (
                                    <article
                                        key={opportunity.partner_opportunity_id}
                                        className="border-b border-slate-100 p-4 last:border-b-0 sm:p-5"
                                    >
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h2 className="font-semibold leading-snug text-slate-950 [overflow-wrap:anywhere]">
                                                        {opportunity.title}
                                                    </h2>
                                                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${partnerStatusClass(opportunity.status)}`}>
                                                        {formatPartnerStatus(opportunity.status)}
                                                    </span>
                                                    {isFull && (
                                                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                                                            At capacity
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="mt-1 text-sm text-slate-600">{opportunity.organization}</p>
                                                {opportunity.description && (
                                                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 [overflow-wrap:anywhere]">
                                                        {opportunity.description}
                                                    </p>
                                                )}
                                                <p className="mt-2 text-xs text-slate-500">
                                                    {opportunity.max_active_teams
                                                        ? `${activeCount} of ${opportunity.max_active_teams} connected teams`
                                                        : `${activeCount} connected ${activeCount === 1 ? "team" : "teams"}`}
                                                </p>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => startEdit(opportunity)}
                                                className="w-full shrink-0 sm:w-auto"
                                            >
                                                <Pencil className="h-4 w-4" aria-hidden="true" />
                                                Edit opportunity
                                            </Button>
                                         </div>
                                         {(opportunity.disciplines?.length ||
                                             opportunity.skills?.length ||
                                             opportunity.deliverable_types?.length ||
                                             targetCourseLabels.length) ? (
                                             <Disclosure summary="Opportunity taxonomy" className="mt-4 shadow-none">
                                                 <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                                     {opportunity.disciplines?.length ? (
                                                         <div>
                                                             <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Disciplines</p>
                                                             <TaxonomyChipList
                                                                 namespace="discipline"
                                                                 values={opportunity.disciplines}
                                                                 className="mt-2"
                                                             />
                                                         </div>
                                                     ) : null}
                                                     {opportunity.skills?.length ? (
                                                         <div>
                                                             <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Skills</p>
                                                             <TaxonomyChipList
                                                                 namespace="skill"
                                                                 values={opportunity.skills}
                                                                 className="mt-2"
                                                             />
                                                         </div>
                                                     ) : null}
                                                     {opportunity.deliverable_types?.length ? (
                                                         <div>
                                                             <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deliverables</p>
                                                             <TaxonomyChipList
                                                                 namespace="deliverable"
                                                                 values={opportunity.deliverable_types}
                                                                 className="mt-2"
                                                             />
                                                         </div>
                                                     ) : null}
                                                     {targetCourseLabels.length ? (
                                                         <div>
                                                             <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Target courses</p>
                                                                 <TaxonomyChipList
                                                                     namespace="course"
                                                                     values={targetCourseLabels}
                                                                     className="mt-2"
                                                                 />
                                                         </div>
                                                     ) : null}
                                                 </div>
                                             </Disclosure>
                                         ) : null}
                                     </article>
                                );
                            })
                        )}
                        {opportunityTotalPages > 1 && (
                            <nav
                                aria-label="Opportunity pages"
                                className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row"
                            >
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setOpportunityPage((current) => Math.max(1, current - 1))}
                                    disabled={loading || opportunityPage <= 1}
                                    className="w-full sm:w-auto"
                                >
                                    Previous
                                </Button>
                                <span className="text-xs tabular-nums text-slate-500">
                                    Page {opportunityPage} of {opportunityTotalPages}
                                </span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setOpportunityPage((current) => Math.min(opportunityTotalPages, current + 1))}
                                    disabled={loading || opportunityPage >= opportunityTotalPages}
                                    className="w-full sm:w-auto"
                                >
                                    Next
                                </Button>
                            </nav>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="border-b border-slate-100">
                        <CardTitle>Connected projects</CardTitle>
                        <CardDescription>
                            Open a project to see its roster and inspect student profiles.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-slate-600">
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                Loading connected projects…
                            </div>
                        ) : partnerTeams.length === 0 ? (
                            <p className="px-5 py-8 text-sm text-slate-500">
                                No student teams are connected to your opportunities yet.
                            </p>
                        ) : (
                            partnerTeams.map((team) => (
                                <details key={team.team_id} className="group border-b border-slate-100 last:border-b-0">
                                    <summary className="flex cursor-pointer list-none flex-col items-start justify-between gap-3 p-4 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400/70 sm:flex-row sm:gap-4 sm:p-5 [&::-webkit-details-marker]:hidden">
                                        <div className="min-w-0">
                                            <p className="font-medium text-slate-950 [overflow-wrap:anywhere]">
                                                {team.capstone?.title || "Untitled capstone"}
                                            </p>
                                            <p className="mt-1 text-sm text-slate-600 [overflow-wrap:anywhere]">
                                                {team.opportunity?.title || "External opportunity"}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500">
                                                {team.team_members.length} {team.team_members.length === 1 ? "student" : "students"}
                                            </p>
                                        </div>
                                        <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
                                            <StatusBadge
                                                tone={
                                                    team.capstone?.external_partner_support_confirmed
                                                        ? "success"
                                                        : "warning"
                                                }
                                            >
                                                {team.capstone?.external_partner_support_confirmed
                                                    ? "Support confirmed"
                                                    : "Support not confirmed"}
                                            </StatusBadge>
                                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">
                                                {team.status || "forming"}
                                            </span>
                                            <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" />
                                        </div>
                                    </summary>
                                    <div className="border-t border-slate-100 bg-slate-50/60 p-4 sm:p-5">
                                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Team roster</p>
                                        <div className="grid gap-2 md:grid-cols-2">
                                            {team.team_members.map((member) => (
                                                <div
                                                    key={member.user_id}
                                                    className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="break-all text-sm font-medium text-slate-800">{member.email}</p>
                                                        {member.home_department?.name && (
                                                            <p className="text-xs text-slate-500">{member.home_department.name}</p>
                                                        )}
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => openStudentProfile(member)}
                                                        className="shrink-0"
                                                    >
                                                        <Eye className="h-4 w-4" aria-hidden="true" />
                                                        Profile
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </details>
                            ))
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Organization profile</CardTitle>
                        <CardDescription>
                            {profile.organization || "Add the organization students will see on your opportunities."}
                        </CardDescription>
                        <CardAction>
                            <Button type="button" variant="outline" size="sm" onClick={() => setProfileEditorOpen(true)}>
                                <Pencil className="h-4 w-4" aria-hidden="true" />
                                Edit profile
                            </Button>
                        </CardAction>
                    </CardHeader>
                    <CardContent>
                        <dl className="grid gap-4 text-sm sm:grid-cols-3">
                            <div>
                                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Contact</dt>
                                <dd className="mt-1 break-all text-slate-700">{profile.contactEmail || "Not specified"}</dd>
                            </div>
                            <div>
                                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Website</dt>
                                <dd className="mt-1 min-w-0">
                                    {profile.website ? (
                                        <a href={profile.website} target="_blank" rel="noreferrer" className="break-all text-slate-700 underline-offset-4 hover:underline">
                                            {profile.website}
                                        </a>
                                    ) : (
                                        <span className="text-slate-500">Not specified</span>
                                    )}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Areas</dt>
                                <dd className="mt-1">
                                    {splitTags(profile.areas).length > 0 ? (
                                        <TaxonomyChipList
                                            namespace="research-area"
                                            values={splitTags(profile.areas)}
                                        />
                                    ) : (
                                        <span className="text-slate-500">Not specified</span>
                                    )}
                                </dd>
                            </div>
                        </dl>
                    </CardContent>
                </Card>

                <StudentProfileDialog
                    student={profileStudent}
                    open={profileStudent !== null}
                    onOpenChange={(open) => {
                        if (!open) setProfileStudent(null);
                    }}
                />
        </div>
    );
}
