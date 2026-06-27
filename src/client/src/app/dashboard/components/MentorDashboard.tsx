"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fetchDepartments, type Department } from "@/services/departments.service";
import {
    cancelMentorRequest,
    decideMentorRequest,
    fetchMentorDashboard,
    updateMentorProfile,
    type MentorDashboardData,
    type MentorProfile,
    type MentorRequest,
} from "@/services/capstones.service";

function projectTitle(request: MentorRequest) {
    return request.capstone?.title || `Capstone #${request.capstone_fk}`;
}

function projectMeta(request: MentorRequest) {
    const status = request.capstone?.public_status || request.capstone?.status;
    const course = request.capstone?.departments?.[0]?.name;
    return [status, course].filter(Boolean).join(" | ");
}

function formatDate(value?: string | null) {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

export function MentorDashboard() {
    const [dashboard, setDashboard] = useState<MentorDashboardData>({
        profile: null,
        pending_requests: [],
        accepted_projects: [],
        offers: [],
    });
    const [departments, setDepartments] = useState<Department[]>([]);
    const [profileDraft, setProfileDraft] = useState({
        displayName: "",
        primaryDepartmentId: "",
        departmentIds: [] as number[],
        affiliation: "",
        bio: "",
        availabilityTerms: [] as string[],
        expertiseTags: "",
        maxActiveProjects: "",
    });
    const [notes, setNotes] = useState<Record<number, string>>({});
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<number | null>(null);
    const [profileSaving, setProfileSaving] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const preferredProjectLoad =
        dashboard.profile?.max_active_projects === null ||
        dashboard.profile?.max_active_projects === undefined
            ? null
            : dashboard.profile.max_active_projects;
    const activeProjectCount = dashboard.profile?.active_project_count || 0;
    const exceedsPreferredProjectLoad =
        preferredProjectLoad !== null &&
        preferredProjectLoad > 0 &&
        activeProjectCount > preferredProjectLoad;

    const hydrateProfileDraft = useCallback((profile: MentorProfile | null) => {
        setProfileDraft({
            displayName: profile?.display_name || "",
            primaryDepartmentId: profile?.primary_department_fk
                ? String(profile.primary_department_fk)
                : "",
            departmentIds: (profile?.departments || []).map((department) => department.department_id),
            affiliation: profile?.affiliation || "",
            bio: profile?.bio || "",
            availabilityTerms: profile?.availability_terms || [],
            expertiseTags: (profile?.expertise_tags || []).join(", "),
            maxActiveProjects:
                profile?.max_active_projects === null || profile?.max_active_projects === undefined
                    ? ""
                    : String(profile.max_active_projects),
        });
    }, []);

    const loadDashboard = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [nextDashboard, departmentRows] = await Promise.all([
                fetchMentorDashboard(),
                fetchDepartments(true),
            ]);
            setDashboard(nextDashboard);
            setDepartments(departmentRows);
            hydrateProfileDraft(nextDashboard.profile || null);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Could not load mentor dashboard.");
        } finally {
            setLoading(false);
        }
    }, [hydrateProfileDraft]);

    useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    const handleDecision = async (
        request: MentorRequest,
        decision: "accept" | "decline"
    ) => {
        setSavingId(request.mentor_request_id);
        setError("");
        setNotice("");
        try {
            await decideMentorRequest(request.mentor_request_id, {
                decision,
                response_note: notes[request.mentor_request_id]?.trim() || null,
            });
            setNotice(decision === "accept" ? "Mentor request accepted." : "Mentor request declined.");
            setNotes((previous) => ({
                ...previous,
                [request.mentor_request_id]: "",
            }));
            await loadDashboard();
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Could not save mentor decision.");
        } finally {
            setSavingId(null);
        }
    };

    const handleCancelOffer = async (request: MentorRequest) => {
        setSavingId(request.mentor_request_id);
        setError("");
        setNotice("");
        try {
            await cancelMentorRequest(request.mentor_request_id, {
                reason: "Mentor cancelled their offer.",
            });
            setNotice("Mentor offer cancelled.");
            await loadDashboard();
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Could not cancel mentor offer.");
        } finally {
            setSavingId(null);
        }
    };

    const toggleDepartment = (departmentId: number, checked: boolean) => {
        setProfileDraft((current) => ({
            ...current,
            departmentIds: checked
                ? Array.from(new Set([...current.departmentIds, departmentId]))
                : current.departmentIds.filter((id) => id !== departmentId),
        }));
    };

    const toggleAvailability = (term: string, checked: boolean) => {
        setProfileDraft((current) => ({
            ...current,
            availabilityTerms: checked
                ? Array.from(new Set([...current.availabilityTerms, term]))
                : current.availabilityTerms.filter((value) => value !== term),
        }));
    };

    const handleSaveProfile = async () => {
        setProfileSaving(true);
        setError("");
        setNotice("");
        try {
            const primaryDepartmentId = Number(profileDraft.primaryDepartmentId);
            const nextProfile = await updateMentorProfile({
                display_name: profileDraft.displayName.trim() || null,
                primary_department_id: Number.isFinite(primaryDepartmentId)
                    ? primaryDepartmentId
                    : null,
                department_ids: profileDraft.departmentIds,
                affiliation: profileDraft.affiliation.trim() || null,
                bio: profileDraft.bio.trim() || null,
                availability_terms: profileDraft.availabilityTerms,
                expertise_tags: profileDraft.expertiseTags
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                max_active_projects: profileDraft.maxActiveProjects
                    ? Number(profileDraft.maxActiveProjects)
                    : null,
            });
            setDashboard((current) => ({
                ...current,
                profile: nextProfile,
            }));
            hydrateProfileDraft(nextProfile);
            setNotice("Mentor directory profile saved.");
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Could not save mentor profile.");
        } finally {
            setProfileSaving(false);
        }
    };

    return (
        <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-6xl space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-slate-900">Mentor Dashboard</h1>
                        <p className="mt-1 text-sm text-slate-600">
                            Review mentor requests and track projects you support.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline">
                            <Link href="/discover">Browse Recruiting Projects</Link>
                        </Button>
                        <Button asChild variant="outline">
                            <Link href="/finalized-capstones">View Finalized Projects</Link>
                        </Button>
                    </div>
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

                {loading ? (
                    <Card>
                        <CardContent className="flex items-center gap-2 py-8 text-sm text-slate-600">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading mentor dashboard...
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <details className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
                            <summary className="cursor-pointer text-sm font-medium text-slate-700">
                                Profile settings
                            </summary>
                            <Card className="mt-4">
                                <CardHeader>
                                    <CardTitle>Mentor Directory Profile</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-slate-700">
                                            Display name
                                        </label>
                                        <Input
                                            value={profileDraft.displayName}
                                            onChange={(event) =>
                                                setProfileDraft((current) => ({
                                                    ...current,
                                                    displayName: event.target.value,
                                                }))
                                            }
                                            placeholder="Professor name"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-slate-700">
                                            Primary department
                                        </label>
                                        <Select
                                            value={profileDraft.primaryDepartmentId || "none"}
                                            onValueChange={(value) =>
                                                setProfileDraft((current) => ({
                                                    ...current,
                                                    primaryDepartmentId:
                                                        value === "none" ? "" : value,
                                                    departmentIds:
                                                        value === "none"
                                                            ? current.departmentIds
                                                            : Array.from(
                                                                  new Set([
                                                                      ...current.departmentIds,
                                                                      Number(value),
                                                                  ])
                                                              ),
                                                }))
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select department" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">No department</SelectItem>
                                                {departments.map((department) => (
                                                    <SelectItem
                                                        key={department.department_id}
                                                        value={String(department.department_id)}
                                                    >
                                                        {department.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-slate-700">
                                        Affiliation
                                    </label>
                                    <Input
                                        value={profileDraft.affiliation}
                                        onChange={(event) =>
                                            setProfileDraft((current) => ({
                                                ...current,
                                                affiliation: event.target.value,
                                            }))
                                        }
                                        placeholder="Lab, research group, or faculty affiliation"
                                    />
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                        <p className="text-sm font-medium text-slate-700">
                                            Department affiliations
                                        </p>
                                        <div className="mt-2 grid max-h-44 gap-2 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-3">
                                            {departments.map((department) => (
                                                <label
                                                    key={department.department_id}
                                                    className="flex items-center gap-2 text-sm text-slate-700"
                                                >
                                                    <Checkbox
                                                        checked={profileDraft.departmentIds.includes(
                                                            department.department_id
                                                        )}
                                                        onCheckedChange={(checked) =>
                                                            toggleDepartment(
                                                                department.department_id,
                                                                checked === true
                                                            )
                                                        }
                                                    />
                                                    <span>{department.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-700">
                                            Availability terms
                                        </p>
                                        <div className="mt-2 grid gap-2 rounded border border-slate-200 bg-slate-50 p-3">
                                            {["Winter", "Spring", "Fall"].map((term) => (
                                                <label
                                                    key={term}
                                                    className="flex items-center gap-2 text-sm text-slate-700"
                                                >
                                                    <Checkbox
                                                        checked={profileDraft.availabilityTerms.includes(term)}
                                                        onCheckedChange={(checked) =>
                                                            toggleAvailability(term, checked === true)
                                                        }
                                                    />
                                                    <span>{term}</span>
                                                </label>
                                            ))}
                                        </div>
                                        <div className="mt-3 space-y-1.5">
                                            <label className="text-sm font-medium text-slate-700">
                                            Preferred project load
                                        </label>
                                        <Input
                                            type="number"
                                            min={0}
                                                max={25}
                                                value={profileDraft.maxActiveProjects}
                                                onChange={(event) =>
                                                    setProfileDraft((current) => ({
                                                        ...current,
                                                        maxActiveProjects: event.target.value,
                                                    }))
                                            }
                                            placeholder="No stated preference"
                                        />
                                        <p className="text-xs text-slate-500">
                                            Optional and advisory only. Mentor requests and offers are never blocked by this value.
                                        </p>
                                        {exceedsPreferredProjectLoad && (
                                            <span className="inline-flex w-fit rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                                                Above preferred load
                                            </span>
                                        )}
                                    </div>
                                </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-slate-700">
                                        Expertise tags
                                    </label>
                                    <Input
                                        value={profileDraft.expertiseTags}
                                        onChange={(event) =>
                                            setProfileDraft((current) => ({
                                                ...current,
                                                expertiseTags: event.target.value,
                                            }))
                                        }
                                        placeholder="AI, embedded systems, HCI"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-slate-700">
                                        Short bio
                                    </label>
                                    <Textarea
                                        value={profileDraft.bio}
                                        onChange={(event) =>
                                            setProfileDraft((current) => ({
                                                ...current,
                                                bio: event.target.value,
                                            }))
                                        }
                                        rows={3}
                                        placeholder="Briefly describe the kinds of projects you can support."
                                    />
                                </div>

                                <div className="flex justify-end">
                                    <Button onClick={handleSaveProfile} disabled={profileSaving}>
                                        {profileSaving ? "Saving..." : "Save Profile"}
                                    </Button>
                                </div>
                                </CardContent>
                            </Card>
                        </details>

                        <Card>
                            <CardHeader>
                                <CardTitle>Pending Requests</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {dashboard.pending_requests.length === 0 ? (
                                    <p className="text-sm text-slate-600">No pending mentor requests.</p>
                                ) : (
                                    dashboard.pending_requests.map((request) => (
                                        <div
                                            key={request.mentor_request_id}
                                            className="rounded-md border border-slate-200 bg-white p-3"
                                        >
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="min-w-0">
                                                    <p className="font-medium text-slate-900">
                                                        {projectTitle(request)}
                                                    </p>
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        {projectMeta(request) || "Project details available in Discover"}
                                                        {request.created_at
                                                            ? ` | Requested ${formatDate(request.created_at)}`
                                                            : ""}
                                                    </p>
                                                    {request.message && (
                                                        <p className="mt-2 text-sm text-slate-700">
                                                            {request.message}
                                                        </p>
                                                    )}
                                                </div>
                                                <span className="w-fit rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                                                    Pending
                                                </span>
                                            </div>
                                            <Textarea
                                                className="mt-3"
                                                value={notes[request.mentor_request_id] || ""}
                                                onChange={(event) =>
                                                    setNotes((previous) => ({
                                                        ...previous,
                                                        [request.mentor_request_id]: event.target.value,
                                                    }))
                                                }
                                                placeholder="Optional response note"
                                                rows={2}
                                            />
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <Button
                                                    onClick={() => handleDecision(request, "accept")}
                                                    disabled={savingId === request.mentor_request_id}
                                                >
                                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                                    Accept
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    onClick={() => handleDecision(request, "decline")}
                                                    disabled={savingId === request.mentor_request_id}
                                                >
                                                    <XCircle className="mr-2 h-4 w-4" />
                                                    Decline
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Accepted Projects</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {dashboard.accepted_projects.length === 0 ? (
                                        <p className="text-sm text-slate-600">No accepted mentor projects yet.</p>
                                    ) : (
                                        dashboard.accepted_projects.map((request) => (
                                            <div
                                                key={request.mentor_request_id}
                                                className="rounded-md border border-slate-200 bg-white p-3"
                                            >
                                                <p className="font-medium text-slate-900">
                                                    {projectTitle(request)}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    {projectMeta(request)}
                                                    {request.decided_at
                                                        ? ` | Accepted ${formatDate(request.decided_at)}`
                                                        : ""}
                                                </p>
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>My Offers</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {dashboard.offers.length === 0 ? (
                                        <p className="text-sm text-slate-600">No mentor offers yet.</p>
                                    ) : (
                                        dashboard.offers.map((request) => (
                                            <div
                                                key={request.mentor_request_id}
                                                className="rounded-md border border-slate-200 bg-white p-3"
                                            >
                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-slate-900">
                                                            {projectTitle(request)}
                                                        </p>
                                                        <p className="mt-1 text-xs text-slate-500">
                                                            {projectMeta(request)}
                                                        </p>
                                                    </div>
                                                    <span className="w-fit rounded bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-700">
                                                        {request.status}
                                                    </span>
                                                </div>
                                                {request.status === "pending" && (
                                                    <Button
                                                        className="mt-3"
                                                        variant="outline"
                                                        onClick={() => handleCancelOffer(request)}
                                                        disabled={savingId === request.mentor_request_id}
                                                    >
                                                        Cancel Offer
                                                    </Button>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}
