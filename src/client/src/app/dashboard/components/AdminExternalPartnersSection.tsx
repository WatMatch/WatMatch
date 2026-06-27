"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { fetchAdminUsers, type AdminUserEntry } from "@/services/users.service";
import {
    createAdminPartnerOpportunity,
    fetchAdminPartnerOpportunityPage,
    fetchAdminPartnerProfiles,
    saveAdminPartnerProfile,
    updateAdminPartnerOpportunity,
    type PartnerOpportunity,
    type PartnerOpportunityStatus,
    type PartnerProfile,
} from "@/services/partners.service";
import { buildTermOptions, withExistingTerm } from "@/lib/term-options";

const projectStartTermOptions = buildTermOptions();

function splitTags(value: string): string[] {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function joinTags(value?: string[] | null): string {
    return (value || []).join(", ");
}

interface OpportunityFormState {
    partnerUserId: string;
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
    reason: string;
}

const emptyForm: OpportunityFormState = {
    partnerUserId: "",
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
    status: "published" as PartnerOpportunityStatus,
    reason: "",
};

const emptyProfileForm = {
    partnerUserId: "",
    displayName: "",
    organization: "",
    contactEmail: "",
    website: "",
    areas: "",
    bio: "",
    reason: "",
};

function formatPartnerStatus(status: PartnerOpportunityStatus): string {
    if (status === "draft") return "Draft";
    if (status === "published") return "Published";
    if (status === "archived") return "Archived";
    return "Unknown";
}

export function AdminExternalPartnersSection() {
    const [users, setUsers] = useState<AdminUserEntry[]>([]);
    const [profiles, setProfiles] = useState<PartnerProfile[]>([]);
    const [opportunities, setOpportunities] = useState<PartnerOpportunity[]>([]);
    const [opportunityPage, setOpportunityPage] = useState(1);
    const [opportunityTotalPages, setOpportunityTotalPages] = useState(1);
    const [profileForm, setProfileForm] = useState(emptyProfileForm);
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [departmentOptions, setDepartmentOptions] = useState<string[]>(
        fallbackDepartmentOptions
    );
    const [skillOptions, setSkillOptions] = useState<string[]>(
        fallbackSkillOptions
    );
    const [courses, setCourses] = useState<Course[]>([]);
    const loadRequestIdRef = useRef(0);
    const toolsDetailsRef = useRef<HTMLDetailsElement | null>(null);
    const opportunityFormRef = useRef<HTMLDivElement | null>(null);

    const partnerUsers = useMemo(
        () => users.filter((user) => user.role === "external_partner" && user.active),
        [users]
    );
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
    const allPartnerUsers = useMemo(
        () => users.filter((user) => user.role === "external_partner"),
        [users]
    );
    const partnerById = useMemo(
        () =>
            new Map(
                allPartnerUsers.map((partner) => [
                    String(partner.user_id),
                    partner,
                ])
            ),
        [allPartnerUsers]
    );

    const loadData = useCallback(async () => {
        const requestId = loadRequestIdRef.current + 1;
        loadRequestIdRef.current = requestId;
        setLoading(true);
        setError("");
        try {
            const [userRows, profileRows, opportunityRows] = await Promise.all([
                fetchAdminUsers(),
                fetchAdminPartnerProfiles(),
                fetchAdminPartnerOpportunityPage({
                    page: opportunityPage,
                    pageSize: 10,
                }),
            ]);
            if (loadRequestIdRef.current !== requestId) return;
            setUsers(userRows);
            setProfiles(profileRows);
            setOpportunities(opportunityRows.data || []);
            setOpportunityTotalPages(
                Math.max(1, opportunityRows.total_pages || 1)
            );
        } catch (loadError) {
            if (loadRequestIdRef.current !== requestId) return;
            console.error(loadError);
            setError(
                loadError instanceof Error
                    ? loadError.message
                    : "Could not load external partner data."
            );
        } finally {
            if (loadRequestIdRef.current === requestId) {
                setLoading(false);
            }
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

    const selectedPartner = partnerUsers.find(
        (partner) => String(partner.user_id) === form.partnerUserId
    );
    const selectedProfilePartner = partnerUsers.find(
        (partner) => String(partner.user_id) === profileForm.partnerUserId
    );
    const profileByPartnerId = useMemo(
        () =>
            new Map(
                profiles.map((profile) => [
                    String(profile.partner_user_fk),
                    profile,
                ])
            ),
        [profiles]
    );

    const selectProfilePartner = (partnerUserId: string) => {
        const partner = partnerUsers.find(
            (user) => String(user.user_id) === partnerUserId
        );
        const profile = profileByPartnerId.get(partnerUserId);
        setProfileForm({
            partnerUserId,
            displayName: profile?.display_name || "",
            organization: profile?.organization || "",
            contactEmail: profile?.contact_email || partner?.email || "",
            website: profile?.website || "",
            areas: joinTags(profile?.areas),
            bio: profile?.bio || "",
            reason: "",
        });
    };

    const focusOpportunityTools = () => {
        if (toolsDetailsRef.current) {
            toolsDetailsRef.current.open = true;
        }
        window.requestAnimationFrame(() => {
            opportunityFormRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        });
    };

    const startEdit = (opportunity: PartnerOpportunity) => {
        const owner = partnerById.get(String(opportunity.partner_user_fk));
        if (!owner?.active) {
            setNotice("");
            setError(
                "Reactivate this external partner user before editing their opportunities."
            );
            return;
        }
        const relatedCourses = courses.length
            ? courses
            : opportunity.target_courses || [];
        const targetCourseIds = targetCourseIdsFromOpportunity(
            opportunity,
            relatedCourses
        );
        setEditingId(opportunity.partner_opportunity_id);
        setForm({
            partnerUserId: String(opportunity.partner_user_fk),
            title: opportunity.title,
            organization: opportunity.organization,
            description: opportunity.description,
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
            contactEmail: opportunity.contact_email,
            contactUrl: opportunity.contact_url || "",
            ipAcknowledged: opportunity.ip_acknowledged === true,
            ndaAcknowledged: opportunity.nda_acknowledged === true,
            matchingAcknowledged: opportunity.matching_acknowledged === true,
            status: opportunity.status,
            reason: "",
        });
        focusOpportunityTools();
    };

    const saveOpportunity = async () => {
        const reason = form.reason.trim();
        if (!form.partnerUserId) {
            setError("Select an external partner user first.");
            return;
        }
        if (!reason) {
            setError("Add an audit reason before saving this external opportunity.");
            return;
        }
        const owner = partnerById.get(form.partnerUserId);
        if (!owner?.active) {
            setNotice("");
            setError(
                "Reactivate this external partner user before editing their opportunities."
            );
            return;
        }
        setSaving(true);
        setError("");
        setNotice("");
        try {
            const targetCourseTags = uniqueStrings([
                ...courseTargetTagsFromIds(form.targetCourseIds, courses),
                ...form.legacyTargetCourseTags,
            ]);
            const payload = {
                partner_user_id: Number(form.partnerUserId),
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
                reason,
            };
            if (editingId) {
                await updateAdminPartnerOpportunity(editingId, payload);
                setNotice("External opportunity updated.");
            } else {
                await createAdminPartnerOpportunity(payload);
                setNotice("External opportunity created.");
                setOpportunityPage(1);
            }
            setEditingId(null);
            setForm(emptyForm);
            await loadData();
        } catch (saveError) {
            console.error(saveError);
            setError(
                saveError instanceof Error
                    ? saveError.message
                    : "Failed to save external opportunity."
            );
        } finally {
            setSaving(false);
        }
    };

    const saveProfile = async () => {
        const reason = profileForm.reason.trim();
        if (!profileForm.partnerUserId) {
            setError("Select an external partner user first.");
            return;
        }
        if (!reason) {
            setError("Add an audit reason before saving this external partner profile.");
            return;
        }
        setSavingProfile(true);
        setError("");
        setNotice("");
        try {
            await saveAdminPartnerProfile(Number(profileForm.partnerUserId), {
                display_name: profileForm.displayName,
                organization: profileForm.organization,
                contact_email: profileForm.contactEmail,
                website: profileForm.website || null,
                bio: profileForm.bio || null,
                areas: splitTags(profileForm.areas),
                reason,
            });
            setNotice("External partner profile saved.");
            await loadData();
        } catch (saveError) {
            console.error(saveError);
            setError(
                saveError instanceof Error
                    ? saveError.message
                    : "Failed to save external partner profile."
            );
        } finally {
            setSavingProfile(false);
        }
    };

    return (
        <div className="space-y-5">
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

            <details
                ref={toolsDetailsRef}
                className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"
            >
                <summary className="cursor-pointer text-sm font-medium text-slate-800">
                    Partner tools
                </summary>
                <div className="mt-4 space-y-4">
            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle>External Partner Profiles</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>External Partner User</Label>
                        <Select
                            value={profileForm.partnerUserId}
                            onValueChange={selectProfilePartner}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select external partner" />
                            </SelectTrigger>
                            <SelectContent>
                                {partnerUsers.map((partner) => (
                                    <SelectItem
                                        key={partner.user_id}
                                        value={String(partner.user_id)}
                                    >
                                        {partner.email}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {partnerUsers.length === 0 && (
                            <p className="text-xs text-slate-500">
                                Create an active external partner user in the Users tab first.
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                        <div className="space-y-2">
                            <Label>Display Name</Label>
                            <Input
                                value={profileForm.displayName}
                                onChange={(event) =>
                                    setProfileForm((previous) => ({
                                        ...previous,
                                        displayName: event.target.value,
                                    }))
                                }
                                placeholder={selectedProfilePartner?.email || ""}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Organization</Label>
                            <Input
                                value={profileForm.organization}
                                onChange={(event) =>
                                    setProfileForm((previous) => ({
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
                                value={profileForm.contactEmail}
                                onChange={(event) =>
                                    setProfileForm((previous) => ({
                                        ...previous,
                                        contactEmail: event.target.value,
                                    }))
                                }
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Website</Label>
                            <Input
                                value={profileForm.website}
                                onChange={(event) =>
                                    setProfileForm((previous) => ({
                                        ...previous,
                                        website: event.target.value,
                                    }))
                                }
                                placeholder="https://..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Areas</Label>
                            <Input
                                value={profileForm.areas}
                                onChange={(event) =>
                                    setProfileForm((previous) => ({
                                        ...previous,
                                        areas: event.target.value,
                                    }))
                                }
                                placeholder="Biomedical Engineering, Research"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Bio</Label>
                        <Textarea
                            rows={4}
                            value={profileForm.bio}
                            onChange={(event) =>
                                setProfileForm((previous) => ({
                                    ...previous,
                                    bio: event.target.value,
                                }))
                            }
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Audit Reason</Label>
                        <Textarea
                            rows={3}
                            value={profileForm.reason}
                            onChange={(event) =>
                                setProfileForm((previous) => ({
                                    ...previous,
                                    reason: event.target.value,
                                }))
                            }
                            placeholder="Why is staff changing this partner profile?"
                        />
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <Button
                            onClick={saveProfile}
                            disabled={savingProfile || !profileForm.reason.trim()}
                            className="w-full sm:w-auto"
                        >
                        <Save className="w-4 h-4 mr-2" />
                        {savingProfile ? "Saving..." : "Save Profile"}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div ref={opportunityFormRef}>
            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle>
                        {editingId ? "Edit External Opportunity" : "Create External Opportunity"}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>External Partner User</Label>
                        <Select
                            value={form.partnerUserId}
                            onValueChange={(value) => {
                                const partner = partnerUsers.find(
                                    (user) => String(user.user_id) === value
                                );
                                setForm((previous) => ({
                                    ...previous,
                                    partnerUserId: value,
                                    contactEmail: previous.contactEmail || partner?.email || "",
                                }));
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select external partner" />
                            </SelectTrigger>
                            <SelectContent>
                                {partnerUsers.map((partner) => (
                                    <SelectItem key={partner.user_id} value={String(partner.user_id)}>
                                        {partner.email}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {partnerUsers.length === 0 && (
                            <p className="text-xs text-slate-500">
                                Create an active external partner user in the Users tab first.
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Title</Label>
                            <Input value={form.title} onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Organization</Label>
                            <Input value={form.organization} onChange={(event) => setForm((previous) => ({ ...previous, organization: event.target.value }))} placeholder={selectedPartner?.email || ""} />
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
                            <Label>Max Teams</Label>
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

                    <div className="space-y-2">
                        <Label>Audit Reason</Label>
                        <Textarea
                            rows={3}
                            value={form.reason}
                            onChange={(event) =>
                                setForm((previous) => ({
                                    ...previous,
                                    reason: event.target.value,
                                }))
                            }
                            placeholder="Why is staff creating or changing this opportunity?"
                        />
                    </div>

                    <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                        <Label>Policies and Agreements</Label>
                        <label className="flex items-start gap-3 text-sm text-slate-700">
                            <Checkbox checked={form.ipAcknowledged} onCheckedChange={(checked) => setForm((previous) => ({ ...previous, ipAcknowledged: checked === true }))} />
                            <span>IP policy acknowledgement received.</span>
                        </label>
                        <label className="flex items-start gap-3 text-sm text-slate-700">
                            <Checkbox checked={form.ndaAcknowledged} onCheckedChange={(checked) => setForm((previous) => ({ ...previous, ndaAcknowledged: checked === true }))} />
                            <span>NDA and agreement acknowledgement received.</span>
                        </label>
                        <label className="flex items-start gap-3 text-sm text-slate-700">
                            <Checkbox checked={form.matchingAcknowledged} onCheckedChange={(checked) => setForm((previous) => ({ ...previous, matchingAcknowledged: checked === true }))} />
                            <span>Project matching acknowledgement received.</span>
                        </label>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <Button
                            onClick={saveOpportunity}
                            disabled={saving || !form.reason.trim()}
                            className="w-full sm:w-auto"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            {saving ? "Saving..." : editingId ? "Update" : "Create"}
                        </Button>
                        {editingId && (
                            <Button
                                variant="outline"
                                onClick={() => { setEditingId(null); setForm(emptyForm); }}
                                className="w-full sm:w-auto"
                            >
                                Cancel
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
            </div>
                </div>
            </details>

            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle>External Opportunities</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <p className="text-sm text-slate-600">Loading opportunities...</p>
                    ) : opportunities.length === 0 ? (
                        <p className="text-sm text-slate-600">No external opportunities found.</p>
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
                                            {!partnerById.get(String(opportunity.partner_user_fk))?.active && (
                                                <p className="mt-1 text-xs text-amber-700">
                                                    Reactivate this external partner user before editing.
                                                </p>
                                            )}
                                        </div>
                                        <Button
                                            variant="outline"
                                            onClick={() => startEdit(opportunity)}
                                            disabled={!partnerById.get(String(opportunity.partner_user_fk))?.active}
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
        </div>
    );
}
