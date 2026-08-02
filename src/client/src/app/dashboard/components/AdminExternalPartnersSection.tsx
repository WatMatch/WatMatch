"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, Loader2, Pencil, Plus, Save, Search, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
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
import {
    ConfirmActionDialog,
    Disclosure,
    EmptyState,
    Notice,
    PaginationBar,
    SectionHeader,
    StatusBadge,
} from "@/components/ui/workspace";

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

function partnerStatusTone(
    status: PartnerOpportunityStatus
): "success" | "warning" | "neutral" {
    if (status === "published") return "success";
    if (status === "draft") return "warning";
    return "neutral";
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
    const [profileEditorOpen, setProfileEditorOpen] = useState(false);
    const [opportunityEditorOpen, setOpportunityEditorOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [partnerSearch, setPartnerSearch] = useState("");
    const [departmentOptions, setDepartmentOptions] = useState<string[]>(
        fallbackDepartmentOptions
    );
    const [skillOptions, setSkillOptions] = useState<string[]>(
        fallbackSkillOptions
    );
    const [courses, setCourses] = useState<Course[]>([]);
    const loadRequestIdRef = useRef(0);

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
    const normalizedPartnerSearch = partnerSearch.trim().toLowerCase();
    const filteredPartnerUsers = useMemo(() => {
        if (!normalizedPartnerSearch) return allPartnerUsers;

        return allPartnerUsers.filter((partner) => {
            const profile = profileByPartnerId.get(String(partner.user_id));
            const searchableText = [
                partner.email,
                partner.active ? "active" : "inactive",
                profile?.display_name,
                profile?.organization,
                profile?.contact_email,
                profile?.website,
                profile?.bio,
                ...(profile?.areas || []),
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return searchableText.includes(normalizedPartnerSearch);
        });
    }, [allPartnerUsers, normalizedPartnerSearch, profileByPartnerId]);

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

    const openProfileEditor = (partnerUserId?: string) => {
        if (partnerUserId) {
            selectProfilePartner(partnerUserId);
        } else {
            setProfileForm(emptyProfileForm);
        }
        setError("");
        setNotice("");
        setProfileEditorOpen(true);
    };

    const closeProfileEditor = () => {
        setProfileEditorOpen(false);
        setProfileForm(emptyProfileForm);
    };

    const startCreate = () => {
        setEditingId(null);
        setForm(emptyForm);
        setError("");
        setNotice("");
        setOpportunityEditorOpen(true);
    };

    const closeOpportunityEditor = () => {
        setOpportunityEditorOpen(false);
        setEditingId(null);
        setForm(emptyForm);
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
        setError("");
        setNotice("");
        setOpportunityEditorOpen(true);
    };

    const saveOpportunity = async (
        reasonOverride?: string,
        rethrowForDialog = false
    ) => {
        const reason = reasonOverride?.trim() || form.reason.trim();
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
            setOpportunityEditorOpen(false);
            await loadData();
        } catch (saveError) {
            console.error(saveError);
            const errorMessage = saveError instanceof Error
                ? saveError.message
                : "Failed to save external opportunity.";
            setError(errorMessage);
            if (rethrowForDialog) throw new Error(errorMessage);
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
            setProfileEditorOpen(false);
            setProfileForm(emptyProfileForm);
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
        : editingId
          ? "Save changes"
          : "Create opportunity";

    return (
        <div className="space-y-5">
            <SectionHeader
                title="External partners"
                description="Manage partner profiles and the opportunities published to the student marketplace."
                actions={
                    <>
                        <Button type="button" variant="outline" onClick={() => openProfileEditor()}>
                            <UsersRound className="h-4 w-4" aria-hidden="true" />
                            Edit partner profile
                        </Button>
                        <Button type="button" onClick={startCreate}>
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            New opportunity
                        </Button>
                    </>
                }
            />

            {(error || notice) && (
                <Notice tone={error ? "danger" : "success"}>
                    {error || notice}
                </Notice>
            )}

            <Dialog
                open={profileEditorOpen}
                onOpenChange={(open) => {
                    if (open) setProfileEditorOpen(true);
                    else closeProfileEditor();
                }}
            >
                <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit partner profile</DialogTitle>
                        <DialogDescription>
                            Select an active external-partner account, update its directory information, and record why staff made the change.
                        </DialogDescription>
                    </DialogHeader>
                    {error && <Notice tone="danger">{error}</Notice>}
                    <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="admin-partner-profile-user">External Partner User</Label>
                        <Select
                            value={profileForm.partnerUserId}
                            onValueChange={selectProfilePartner}
                        >
                            <SelectTrigger id="admin-partner-profile-user">
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
                            <Label htmlFor="admin-partner-display-name">Display Name</Label>
                            <Input
                                id="admin-partner-display-name"
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
                            <Label htmlFor="admin-partner-organization">Organization</Label>
                            <Input
                                id="admin-partner-organization"
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
                            <Label htmlFor="admin-partner-contact-email">Contact Email</Label>
                            <Input
                                id="admin-partner-contact-email"
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
                            <Label htmlFor="admin-partner-website">Website</Label>
                            <Input
                                id="admin-partner-website"
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
                            <Label htmlFor="admin-partner-areas">Areas</Label>
                            <Input
                                id="admin-partner-areas"
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
                        <Label htmlFor="admin-partner-bio">Bio</Label>
                        <Textarea
                            id="admin-partner-bio"
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
                        <Label htmlFor="admin-partner-profile-reason">
                            Audit reason <span className="font-normal text-slate-500">(required)</span>
                        </Label>
                        <Textarea
                            id="admin-partner-profile-reason"
                            required
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

                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={closeProfileEditor} disabled={savingProfile}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={saveProfile}
                            disabled={savingProfile || !profileForm.reason.trim()}
                        >
                            {savingProfile ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : (
                                <Save className="h-4 w-4" aria-hidden="true" />
                            )}
                            {savingProfile ? "Saving…" : "Save profile"}
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
                <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>
                            {editingId ? "Edit external opportunity" : "Create external opportunity"}
                        </DialogTitle>
                        <DialogDescription>
                            Keep the marketplace summary concise. Supporting delivery, targeting, and organization context can be expanded as needed.
                        </DialogDescription>
                    </DialogHeader>
                    {error && <Notice tone="danger">{error}</Notice>}
                    <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="admin-opportunity-partner">External Partner User</Label>
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
                            <SelectTrigger id="admin-opportunity-partner">
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
                            <Label htmlFor="admin-opportunity-title">Title</Label>
                            <Input id="admin-opportunity-title" value={form.title} onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="admin-opportunity-organization">Organization</Label>
                            <Input id="admin-opportunity-organization" value={form.organization} onChange={(event) => setForm((previous) => ({ ...previous, organization: event.target.value }))} placeholder={selectedPartner?.email || ""} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="admin-opportunity-description">Description</Label>
                        <Textarea id="admin-opportunity-description" rows={5} value={form.description} onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))} />
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="admin-opportunity-primary-contact">Primary Contact</Label>
                            <Input id="admin-opportunity-primary-contact" value={form.primaryContact} onChange={(event) => setForm((previous) => ({ ...previous, primaryContact: event.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="admin-opportunity-phone">Phone</Label>
                            <Input id="admin-opportunity-phone" value={form.phone} onChange={(event) => setForm((previous) => ({ ...previous, phone: event.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="admin-opportunity-organization-size">Organization Size</Label>
                            <Select value={form.organizationSize} onValueChange={(value) => setForm((previous) => ({ ...previous, organizationSize: value }))}>
                                <SelectTrigger id="admin-opportunity-organization-size">
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
                            <Label htmlFor="admin-opportunity-start-term">Project Start Date</Label>
                            <Select
                                value={form.projectStartDate}
                                onValueChange={(value) => setForm((previous) => ({ ...previous, projectStartDate: value }))}
                            >
                                <SelectTrigger id="admin-opportunity-start-term">
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
                    <Disclosure
                        summary="Organization background"
                        contentClassName="space-y-4"
                    >
                    <div className="space-y-2">
                        <Label htmlFor="admin-opportunity-how-heard">How did you hear about capstone?</Label>
                        <Input id="admin-opportunity-how-heard" value={form.howHeardAboutCapstone} onChange={(event) => setForm((previous) => ({ ...previous, howHeardAboutCapstone: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="admin-opportunity-organization-description">Organization Description</Label>
                        <Textarea id="admin-opportunity-organization-description" rows={4} value={form.organizationDescription} onChange={(event) => setForm((previous) => ({ ...previous, organizationDescription: event.target.value }))} />
                    </div>
                    </Disclosure>
                    <Disclosure
                        summary="Project scope, delivery, and student targeting"
                        contentClassName="space-y-4"
                    >
                    <div className="space-y-2">
                        <Label htmlFor="admin-opportunity-problem-area">Problem Area</Label>
                        <Textarea id="admin-opportunity-problem-area" rows={4} value={form.problemArea} onChange={(event) => setForm((previous) => ({ ...previous, problemArea: event.target.value }))} />
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="admin-opportunity-main-objectives">Main Objectives</Label>
                            <Textarea id="admin-opportunity-main-objectives" rows={4} value={form.mainObjectives} onChange={(event) => setForm((previous) => ({ ...previous, mainObjectives: event.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="admin-opportunity-scope-of-work">Scope of Work</Label>
                            <Textarea id="admin-opportunity-scope-of-work" rows={4} value={form.scopeOfWork} onChange={(event) => setForm((previous) => ({ ...previous, scopeOfWork: event.target.value }))} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="admin-opportunity-deliverable-types">Deliverable Types</Label>
                            <MultiSelect
                                id="admin-opportunity-deliverable-types"
                                options={deliverableOptions}
                                value={form.deliverableTypes}
                                onChange={(value) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        deliverableTypes: value,
                                    }))
                                }
                                placeholder="Select deliverables"
                                chipClassName={() => taxonomyChipClassName("deliverable")}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="admin-opportunity-meeting-frequency">Meeting Frequency</Label>
                            <Select value={form.meetingFrequency} onValueChange={(value) => setForm((previous) => ({ ...previous, meetingFrequency: value }))}>
                                <SelectTrigger id="admin-opportunity-meeting-frequency">
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
                            <Label htmlFor="admin-opportunity-deliverable-details">Deliverable Details</Label>
                            <Textarea id="admin-opportunity-deliverable-details" rows={4} value={form.deliverables} onChange={(event) => setForm((previous) => ({ ...previous, deliverables: event.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="admin-opportunity-resources-needed">Resources Needed</Label>
                            <Textarea id="admin-opportunity-resources-needed" rows={4} value={form.resourcesNeeded} onChange={(event) => setForm((previous) => ({ ...previous, resourcesNeeded: event.target.value }))} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                        <div className="space-y-2">
                            <Label htmlFor="admin-opportunity-disciplines">Disciplines</Label>
                            <MultiSelect
                                id="admin-opportunity-disciplines"
                                options={departmentMultiSelectOptions}
                                value={form.disciplines}
                                onChange={(value) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        disciplines: value,
                                    }))
                                }
                                placeholder="Select departments"
                                chipClassName={() => taxonomyChipClassName("discipline")}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="admin-opportunity-skills">Skills</Label>
                            <MultiSelect
                                id="admin-opportunity-skills"
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
                                chipClassName={() => taxonomyChipClassName("skill")}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="admin-opportunity-target-courses">Target Courses</Label>
                            <MultiSelect
                                id="admin-opportunity-target-courses"
                                options={targetCourseOptions}
                                value={form.targetCourseIds}
                                onChange={(value) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        targetCourseIds: value,
                                    }))
                                }
                                placeholder="Select courses"
                                chipClassName={() => taxonomyChipClassName("course")}
                            />
                        </div>
                    </div>
                    </Disclosure>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="space-y-2">
                            <Label htmlFor="admin-opportunity-team-size">Team Size</Label>
                            <Input id="admin-opportunity-team-size" value={form.preferredTeamSize} onChange={(event) => setForm((previous) => ({ ...previous, preferredTeamSize: event.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="admin-opportunity-max-teams">Max Teams</Label>
                            <Input id="admin-opportunity-max-teams" type="number" min={1} value={form.maxActiveTeams} onChange={(event) => setForm((previous) => ({ ...previous, maxActiveTeams: event.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="admin-opportunity-contact-email">Contact Email</Label>
                            <Input id="admin-opportunity-contact-email" type="email" value={form.contactEmail} onChange={(event) => setForm((previous) => ({ ...previous, contactEmail: event.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="admin-opportunity-status">Status</Label>
                            <Select value={form.status} onValueChange={(value) => setForm((previous) => ({ ...previous, status: value as PartnerOpportunityStatus }))}>
                                <SelectTrigger id="admin-opportunity-status">
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
                        <Label htmlFor="admin-opportunity-contact-link">Contact Link</Label>
                        <Input id="admin-opportunity-contact-link" value={form.contactUrl} onChange={(event) => setForm((previous) => ({ ...previous, contactUrl: event.target.value }))} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="admin-opportunity-reason">
                            Audit reason <span className="font-normal text-slate-500">(required)</span>
                        </Label>
                        <Textarea
                            id="admin-opportunity-reason"
                            required
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

                    <div
                        role="group"
                        aria-labelledby="admin-opportunity-policies-label"
                        className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3"
                    >
                        <p id="admin-opportunity-policies-label" className="text-sm font-medium leading-none">
                            Policies and Agreements
                        </p>
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

                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={closeOpportunityEditor} disabled={saving}>
                            Cancel
                        </Button>
                        {isArchivingOpportunity ? (
                            <ConfirmActionDialog
                                title="Archive this external opportunity?"
                                description="Students will no longer find this opportunity in the published marketplace. Staff can edit and publish it again later."
                                confirmLabel="Archive opportunity"
                                tone="destructive"
                                reasonLabel="Archive reason"
                                reasonDescription="This reason is saved in the staff audit history."
                                reasonPlaceholder="Explain why staff is archiving this opportunity."
                                reasonRequired
                                initialReason={form.reason}
                                onConfirm={(reason) => saveOpportunity(reason, true)}
                                trigger={
                                    <Button
                                        type="button"
                                        disabled={saving || !form.reason.trim()}
                                    >
                                        {saving ? (
                                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                        ) : (
                                            <Save className="h-4 w-4" aria-hidden="true" />
                                        )}
                                        {opportunitySaveLabel}
                                    </Button>
                                }
                            />
                        ) : (
                            <Button
                                type="button"
                                onClick={() => saveOpportunity()}
                                disabled={saving || !form.reason.trim()}
                            >
                                {saving ? (
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                ) : editingId ? (
                                    <Save className="h-4 w-4" aria-hidden="true" />
                                ) : (
                                    <Plus className="h-4 w-4" aria-hidden="true" />
                                )}
                                {opportunitySaveLabel}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Card>
                <CardHeader className="border-b border-slate-100">
                    <CardTitle>External opportunities</CardTitle>
                    <CardDescription>
                        Published and draft partner records. Open an editor only when a record needs staff intervention.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-slate-600">
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            Loading opportunities…
                        </div>
                    ) : opportunities.length === 0 ? (
                        <EmptyState
                            icon={Building2}
                            title="No external opportunities"
                            description="Create the first opportunity after an active external-partner account is available."
                            action={
                                <Button type="button" size="sm" onClick={startCreate}>
                                    <Plus className="h-4 w-4" aria-hidden="true" />
                                    New opportunity
                                </Button>
                            }
                        />
                    ) : (
                        <div>
                            {opportunities.map((opportunity) => {
                                const activeCount = Number(opportunity.active_team_count || 0);
                                const isFull = opportunity.is_available === false;
                                 const owner = partnerById.get(String(opportunity.partner_user_fk));
                                 const ownerActive = owner?.active === true;
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
                                                    <h3 className="font-semibold leading-snug text-slate-950 [overflow-wrap:anywhere]">
                                                        {opportunity.title}
                                                    </h3>
                                                    <StatusBadge tone={partnerStatusTone(opportunity.status)}>
                                                        {formatPartnerStatus(opportunity.status)}
                                                    </StatusBadge>
                                                    {isFull && <StatusBadge tone="warning">At capacity</StatusBadge>}
                                                </div>
                                                <p className="mt-1 text-sm text-slate-600 [overflow-wrap:anywhere]">
                                                    {opportunity.organization}
                                                    {owner?.email ? ` · ${owner.email}` : ""}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    {opportunity.max_active_teams
                                                        ? `${activeCount} of ${opportunity.max_active_teams} active teams`
                                                        : `${activeCount} active ${activeCount === 1 ? "team" : "teams"}`}
                                                </p>
                                                {!ownerActive && (
                                                    <p className="mt-2 text-sm font-medium text-amber-800">
                                                        Reactivate this external-partner account before editing.
                                                    </p>
                                                )}
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => startEdit(opportunity)}
                                                disabled={!ownerActive}
                                                className="w-full shrink-0 sm:w-auto"
                                            >
                                                <Pencil className="h-4 w-4" aria-hidden="true" />
                                                Edit opportunity
                                            </Button>
                                        </div>
                                        <Disclosure summary="Record context" className="mt-4 shadow-none">
                                            <div className="space-y-4">
                                                {opportunity.description && (
                                                    <p className="whitespace-pre-wrap leading-6 text-slate-700 [overflow-wrap:anywhere]">
                                                        {opportunity.description}
                                                    </p>
                                                )}
                                                <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                                    <div>
                                                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Owner</dt>
                                                        <dd className="mt-1 break-all">{owner?.email || `User #${opportunity.partner_user_fk}`}</dd>
                                                    </div>
                                                    <div>
                                                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</dt>
                                                        <dd className="mt-1 break-all">{opportunity.contact_email || "Not specified"}</dd>
                                                    </div>
                                                    <div>
                                                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Start term</dt>
                                                        <dd className="mt-1">{opportunity.project_start_date || "Not specified"}</dd>
                                                    </div>
                                                     <div>
                                                         <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Target courses</dt>
                                                         <dd className="mt-1">
                                                             {targetCourseLabels.length > 0 ? (
                                                                 <TaxonomyChipList
                                                                     namespace="course"
                                                                     values={targetCourseLabels}
                                                                 />
                                                             ) : (
                                                                 "Not specified"
                                                             )}
                                                         </dd>
                                                         </div>
                                                 </dl>
                                                 {(opportunity.disciplines?.length ||
                                                     opportunity.skills?.length ||
                                                     opportunity.deliverable_types?.length) ? (
                                                     <div className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
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
                                                     </div>
                                                 ) : null}
                                             </div>
                                         </Disclosure>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                    <PaginationBar
                        page={opportunityPage}
                        totalPages={opportunityTotalPages}
                        loading={loading}
                        onPrevious={() => setOpportunityPage((current) => Math.max(1, current - 1))}
                        onNext={() => setOpportunityPage((current) => Math.min(opportunityTotalPages, current + 1))}
                    />
                </CardContent>
            </Card>

            <Disclosure
                summary={
                    <span className="flex items-center gap-2">
                        <UsersRound className="h-4 w-4 text-slate-500" aria-hidden="true" />
                        Partner directory
                        <span className="wm-count tabular-nums">{allPartnerUsers.length}</span>
                    </span>
                }
            >
                {allPartnerUsers.length === 0 ? (
                    <EmptyState
                        icon={UsersRound}
                        title="No external-partner accounts"
                        description="Create an external-partner user from the Users section before managing profiles or opportunities."
                    />
                ) : (
                    <div className="space-y-4">
                        <div className="grid gap-2 border-b border-slate-100 pb-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                            <div className="relative">
                                <Search
                                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                                    aria-hidden="true"
                                />
                                <Label htmlFor="partner-directory-search" className="sr-only">
                                    Search partner directory
                                </Label>
                                <Input
                                    id="partner-directory-search"
                                    value={partnerSearch}
                                    onChange={(event) => setPartnerSearch(event.target.value)}
                                    placeholder="Search email, organization, or area"
                                    className="pl-9"
                                />
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setPartnerSearch("")}
                                disabled={!normalizedPartnerSearch}
                                className="w-full sm:w-auto"
                            >
                                Clear
                            </Button>
                        </div>
                        <p className="text-xs tabular-nums text-slate-500" aria-live="polite">
                            {filteredPartnerUsers.length === allPartnerUsers.length
                                ? `${allPartnerUsers.length} partner${allPartnerUsers.length === 1 ? "" : "s"}`
                                : `${filteredPartnerUsers.length} of ${allPartnerUsers.length} partners`}
                        </p>
                        {filteredPartnerUsers.length === 0 ? (
                            <EmptyState
                                icon={UsersRound}
                                title="No matching partners"
                                description="Try a broader search or clear the current filter."
                                action={
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setPartnerSearch("")}
                                    >
                                        Clear filter
                                    </Button>
                                }
                            />
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {filteredPartnerUsers.map((partner) => {
                                    const profile = profileByPartnerId.get(String(partner.user_id));
                                    return (
                                        <div
                                            key={partner.user_id}
                                            className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                                        >
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="break-all font-medium text-slate-900">{partner.email}</p>
                                                    <StatusBadge tone={partner.active ? "success" : "neutral"}>
                                                        {partner.active ? "Active" : "Inactive"}
                                                    </StatusBadge>
                                                </div>
                                                <p className="mt-1 text-sm text-slate-500 [overflow-wrap:anywhere]">
                                                    {profile?.organization || profile?.display_name || "Profile not completed"}
                                                    {profile?.contact_email ? ` · ${profile.contact_email}` : ""}
                                                </p>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => openProfileEditor(String(partner.user_id))}
                                                disabled={!partner.active}
                                                className="w-full shrink-0 sm:w-auto"
                                            >
                                                <Pencil className="h-4 w-4" aria-hidden="true" />
                                                Edit profile
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </Disclosure>
        </div>
    );
}
