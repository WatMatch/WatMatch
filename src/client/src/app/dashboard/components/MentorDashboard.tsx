"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Eye, Loader2, MoreHorizontal, Pencil, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TaxonomyChipList } from "@/components/ui/taxonomy-chip";
import { CapstoneModal } from "@/app/discover/CapstoneModal";
import { fetchDepartments, type Department } from "@/services/departments.service";
import {
    cancelMentorRequest,
    decideMentorRequest,
    fetchMentorDashboard,
    updateMentorProfile,
    type Capstone,
    type MentorDashboardData,
    type MentorProfile,
    type MentorRequest,
} from "@/services/capstones.service";

function projectTitle(request: MentorRequest) {
    return request.capstone?.title || `Capstone #${request.capstone_fk}`;
}

function projectStatus(request: MentorRequest) {
    return request.capstone?.public_status || request.capstone?.status || "";
}

function projectDepartments(request: MentorRequest): string[] {
    if (request.capstone?.department) return [request.capstone.department];
    return (request.capstone?.departments || [])
        .map((department) => department.name)
        .filter((department): department is string => Boolean(department));
}

function requestSourceLabel(value?: string | null) {
    if (value === "mentor_offer") return "Mentor offer";
    if (value === "staff_request") return "Staff request";
    return "Team request";
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
    const [selectedRequest, setSelectedRequest] = useState<MentorRequest | null>(null);
    const [profileEditorOpen, setProfileEditorOpen] = useState(false);
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
            setProfileEditorOpen(false);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Could not save mentor profile.");
        } finally {
            setProfileSaving(false);
        }
    };

    const selectedProject = selectedRequest?.capstone || null;
    const selectedProjectMetadata = selectedRequest ? (
        <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Mentor Request
            </h3>
            <dl className="space-y-2 text-sm text-slate-700">
                <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Request
                    </dt>
                    <dd className="capitalize">
                        {requestSourceLabel(selectedRequest.request_source)}
                    </dd>
                </div>
                {selectedRequest.requested_by?.email && (
                    <div>
                        <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Requested By
                        </dt>
                        <dd className="[overflow-wrap:anywhere]">
                            {selectedRequest.requested_by.email}
                        </dd>
                    </div>
                )}
                {selectedRequest.created_at && (
                    <div>
                        <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Requested
                        </dt>
                        <dd>{formatDate(selectedRequest.created_at)}</dd>
                    </div>
                )}
                {selectedRequest.decided_at && (
                    <div>
                        <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Decided
                        </dt>
                        <dd>{formatDate(selectedRequest.decided_at)}</dd>
                    </div>
                )}
                <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Status
                    </dt>
                    <dd className="capitalize">{selectedRequest.status}</dd>
                </div>
            </dl>
            {selectedRequest.message && (
                <div className="mt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Request Note
                    </p>
                    <p className="mt-1 break-words text-sm text-slate-700 whitespace-pre-wrap">
                        {selectedRequest.message}
                    </p>
                </div>
            )}
            {selectedRequest.response_note && (
                <div className="mt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Response Note
                    </p>
                    <p className="mt-1 break-words text-sm text-slate-700 whitespace-pre-wrap">
                        {selectedRequest.response_note}
                    </p>
                </div>
            )}
        </div>
    ) : null;

    const openProjectDetails = (request: MentorRequest) => {
        setSelectedRequest(request);
    };

    const renderDetailsButton = (request: MentorRequest) => (
        <Button
            type="button"
            variant="outline"
            onClick={() => openProjectDetails(request)}
            className="gap-2"
        >
            <Eye className="h-4 w-4" />
            View project
        </Button>
    );

    return (
        <div className="mx-auto w-full max-w-6xl space-y-6 px-1 py-2 sm:px-2 sm:py-4">
            <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Mentor workspace
                    </p>
                    <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                        Project support
                    </h1>
                    <p className="mt-1 max-w-2xl text-sm text-slate-600">
                        Respond to teams that need your expertise, then keep track of the projects you support.
                    </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <Button asChild>
                        <Link href="/discover">Browse recruiting projects</Link>
                    </Button>
                    <Button asChild variant="outline">
                        <Link href="/finalized-capstones">Finalized projects</Link>
                    </Button>
                </div>
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

            {loading ? (
                <Card>
                    <CardContent className="flex items-center justify-center gap-2 py-12 text-sm text-slate-600">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Loading mentor workspace…
                    </CardContent>
                </Card>
            ) : (
                <>
                    <Card>
                        <CardHeader className="border-b border-slate-100">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <CardTitle>Requests</CardTitle>
                                    <CardDescription>
                                        Review the project and leave a response for the team.
                                    </CardDescription>
                                </div>
                                <span className="inline-flex min-w-7 justify-center rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold tabular-nums text-amber-800">
                                    {dashboard.pending_requests.length}
                                    <span className="sr-only"> pending requests</span>
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {dashboard.pending_requests.length === 0 ? (
                                <div className="px-5 py-10 text-center">
                                    <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-600" aria-hidden="true" />
                                    <p className="mt-2 text-sm font-medium text-slate-800">You are caught up</p>
                                    <p className="mt-1 text-sm text-slate-500">No mentor requests need a decision.</p>
                                </div>
                            ) : (
                                dashboard.pending_requests.map((request) => {
                                    const isSaving = savingId === request.mentor_request_id;
                                    return (
                                        <article
                                            key={request.mentor_request_id}
                                            className="border-b border-slate-100 p-4 last:border-b-0 sm:p-5"
                                        >
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="min-w-0">
                                                    <h2 className="font-semibold leading-snug text-slate-950 [overflow-wrap:anywhere]">
                                                        {projectTitle(request)}
                                                    </h2>
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        {projectStatus(request) || "Project details available"}
                                                        {request.created_at
                                                            ? ` · Requested ${formatDate(request.created_at)}`
                                                            : ""}
                                                    </p>
                                                    <TaxonomyChipList
                                                        namespace="department"
                                                        values={projectDepartments(request)}
                                                        className="mt-2"
                                                    />
                                                </div>
                                                <span className="w-fit rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                                                    Needs response
                                                </span>
                                            </div>
                                            {request.message && (
                                                <div className="mt-3 rounded-lg bg-slate-50 px-3.5 py-3 text-sm text-slate-700">
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                        Team note
                                                    </p>
                                                    <p className="mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">
                                                        {request.message}
                                                    </p>
                                                </div>
                                            )}
                                            <div className="mt-4 space-y-1.5">
                                                <label
                                                    htmlFor={`mentor-response-${request.mentor_request_id}`}
                                                    className="text-sm font-medium text-slate-700"
                                                >
                                                    Response note <span className="font-normal text-slate-500">(optional)</span>
                                                </label>
                                                <Textarea
                                                    id={`mentor-response-${request.mentor_request_id}`}
                                                    value={notes[request.mentor_request_id] || ""}
                                                    onChange={(event) =>
                                                        setNotes((previous) => ({
                                                            ...previous,
                                                            [request.mentor_request_id]: event.target.value,
                                                        }))
                                                    }
                                                    placeholder="Share any availability or next steps with the team."
                                                    rows={2}
                                                />
                                            </div>
                                            <div className="mt-4 flex flex-wrap items-center gap-2">
                                                <Button
                                                    type="button"
                                                    onClick={() => handleDecision(request, "accept")}
                                                    loading={isSaving}
                                                    loadingLabel="Accept request"
                                                    className="min-w-[9rem]"
                                                >
                                                    {!isSaving && (
                                                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                                    )}
                                                    Accept request
                                                </Button>
                                                {renderDetailsButton(request)}
                                                <details className="relative">
                                                    <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-2 rounded-lg px-3.5 text-sm font-medium text-slate-600 outline-none hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-slate-400/70 [&::-webkit-details-marker]:hidden">
                                                        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                                                        More actions
                                                    </summary>
                                                    <div className="absolute left-0 z-20 mt-1 min-w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-lg sm:left-auto sm:right-0">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDecision(request, "decline")}
                                                            disabled={isSaving}
                                                            className="w-full justify-start text-red-700 hover:bg-red-50 hover:text-red-800"
                                                        >
                                                            <XCircle className="h-4 w-4" aria-hidden="true" />
                                                            Decline request
                                                        </Button>
                                                    </div>
                                                </details>
                                            </div>
                                        </article>
                                    );
                                })
                            )}
                        </CardContent>
                    </Card>

                    <div className="grid gap-4 lg:grid-cols-2">
                        <Card>
                            <CardHeader className="border-b border-slate-100">
                                <CardTitle>Accepted projects</CardTitle>
                                <CardDescription>Projects where you are an active mentor.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                {dashboard.accepted_projects.length === 0 ? (
                                    <p className="px-5 py-8 text-sm text-slate-500">No accepted projects yet.</p>
                                ) : (
                                    dashboard.accepted_projects.map((request) => (
                                        <div
                                            key={request.mentor_request_id}
                                            className="flex flex-col gap-3 border-b border-slate-100 p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                                        >
                                            <div className="min-w-0">
                                                <p className="font-medium text-slate-900 [overflow-wrap:anywhere]">
                                                    {projectTitle(request)}
                                                 </p>
                                                 <p className="mt-1 text-xs text-slate-500">
                                                     {projectStatus(request)}
                                                     {request.decided_at
                                                         ? ` · Accepted ${formatDate(request.decided_at)}`
                                                         : ""}
                                                 </p>
                                                 <TaxonomyChipList
                                                     namespace="department"
                                                     values={projectDepartments(request)}
                                                     className="mt-2"
                                                 />
                                            </div>
                                            <div className="shrink-0">{renderDetailsButton(request)}</div>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="border-b border-slate-100">
                                <CardTitle>My offers</CardTitle>
                                <CardDescription>Support offers you initiated with teams.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                {dashboard.offers.length === 0 ? (
                                    <p className="px-5 py-8 text-sm text-slate-500">No mentor offers yet.</p>
                                ) : (
                                    dashboard.offers.map((request) => (
                                        <div
                                            key={request.mentor_request_id}
                                            className="border-b border-slate-100 p-4 last:border-b-0"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                     <p className="font-medium text-slate-900 [overflow-wrap:anywhere]">
                                                         {projectTitle(request)}
                                                     </p>
                                                     {projectStatus(request) && (
                                                         <p className="mt-1 text-xs text-slate-500">{projectStatus(request)}</p>
                                                     )}
                                                     <TaxonomyChipList
                                                         namespace="department"
                                                         values={projectDepartments(request)}
                                                         className="mt-2"
                                                     />
                                                 </div>
                                                <span className="w-fit shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">
                                                    {request.status}
                                                </span>
                                            </div>
                                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                                {renderDetailsButton(request)}
                                                {request.status === "pending" && (
                                                    <details className="relative">
                                                        <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-2 rounded-lg px-3.5 text-sm font-medium text-slate-600 outline-none hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-slate-400/70 [&::-webkit-details-marker]:hidden">
                                                            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                                                            More actions
                                                        </summary>
                                                        <div className="absolute left-0 z-20 mt-1 min-w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleCancelOffer(request)}
                                                                disabled={savingId === request.mentor_request_id}
                                                                className="w-full justify-start text-red-700 hover:bg-red-50 hover:text-red-800"
                                                            >
                                                                Cancel offer
                                                            </Button>
                                                        </div>
                                                    </details>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Mentor profile</CardTitle>
                            <CardDescription>
                                {dashboard.profile?.display_name || "Your directory listing"}
                                {dashboard.profile?.affiliation ? ` · ${dashboard.profile.affiliation}` : ""}
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
                                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Active projects</dt>
                                    <dd className="mt-1 font-medium text-slate-900">
                                        {activeProjectCount}
                                        {preferredProjectLoad !== null && preferredProjectLoad > 0
                                            ? ` of ${preferredProjectLoad} preferred`
                                            : ""}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Available</dt>
                                    <dd className="mt-1 text-slate-700">
                                        {dashboard.profile?.availability_terms?.join(", ") || "Not specified"}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Expertise</dt>
                                    <dd className="mt-1">
                                        {dashboard.profile?.expertise_tags?.length ? (
                                            <TaxonomyChipList
                                                namespace="skill"
                                                values={dashboard.profile.expertise_tags}
                                                maxVisible={3}
                                            />
                                        ) : (
                                            <span className="text-slate-700">Not specified</span>
                                        )}
                                    </dd>
                                </div>
                            </dl>
                            {exceedsPreferredProjectLoad && (
                                <p className="mt-4 w-fit rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                                    Above your preferred project load
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}

            <Dialog open={profileEditorOpen} onOpenChange={setProfileEditorOpen}>
                <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Edit mentor profile</DialogTitle>
                        <DialogDescription>
                            Keep your expertise and availability current for teams searching the mentor directory.
                        </DialogDescription>
                    </DialogHeader>
                    {error && (
                        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                            {error}
                        </div>
                    )}
                    <div className="space-y-5">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-1.5">
                                <label htmlFor="mentor-display-name" className="text-sm font-medium text-slate-700">Display name</label>
                                <Input
                                    id="mentor-display-name"
                                    value={profileDraft.displayName}
                                    onChange={(event) => setProfileDraft((current) => ({ ...current, displayName: event.target.value }))}
                                    placeholder="Professor name"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label htmlFor="mentor-primary-department" className="text-sm font-medium text-slate-700">Primary department</label>
                                <Select
                                    value={profileDraft.primaryDepartmentId || "none"}
                                    onValueChange={(value) =>
                                        setProfileDraft((current) => ({
                                            ...current,
                                            primaryDepartmentId: value === "none" ? "" : value,
                                            departmentIds:
                                                value === "none"
                                                    ? current.departmentIds
                                                    : Array.from(new Set([...current.departmentIds, Number(value)])),
                                        }))
                                    }
                                >
                                    <SelectTrigger id="mentor-primary-department"><SelectValue placeholder="Select department" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No department</SelectItem>
                                        {departments.map((department) => (
                                            <SelectItem key={department.department_id} value={String(department.department_id)}>
                                                {department.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="mentor-affiliation" className="text-sm font-medium text-slate-700">Affiliation</label>
                            <Input
                                id="mentor-affiliation"
                                value={profileDraft.affiliation}
                                onChange={(event) => setProfileDraft((current) => ({ ...current, affiliation: event.target.value }))}
                                placeholder="Lab, research group, or faculty affiliation"
                            />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <fieldset>
                                <legend className="text-sm font-medium text-slate-700">Department affiliations</legend>
                                <div className="mt-2 grid max-h-48 gap-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
                                    {departments.map((department) => (
                                        <label key={department.department_id} className="flex items-center gap-2 text-sm text-slate-700">
                                            <Checkbox
                                                checked={profileDraft.departmentIds.includes(department.department_id)}
                                                onCheckedChange={(checked) => toggleDepartment(department.department_id, checked === true)}
                                            />
                                            <span>{department.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </fieldset>
                            <div className="space-y-4">
                                <fieldset>
                                    <legend className="text-sm font-medium text-slate-700">Availability terms</legend>
                                    <div className="mt-2 grid grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                        {["Winter", "Spring", "Fall"].map((term) => (
                                            <label key={term} className="flex items-center gap-2 text-sm text-slate-700">
                                                <Checkbox
                                                    checked={profileDraft.availabilityTerms.includes(term)}
                                                    onCheckedChange={(checked) => toggleAvailability(term, checked === true)}
                                                />
                                                <span>{term}</span>
                                            </label>
                                        ))}
                                    </div>
                                </fieldset>
                                <div className="space-y-1.5">
                                    <label htmlFor="mentor-project-load" className="text-sm font-medium text-slate-700">Preferred project load</label>
                                    <Input
                                        id="mentor-project-load"
                                        type="number"
                                        min={0}
                                        max={25}
                                        value={profileDraft.maxActiveProjects}
                                        onChange={(event) => setProfileDraft((current) => ({ ...current, maxActiveProjects: event.target.value }))}
                                        placeholder="No stated preference"
                                    />
                                    <p className="text-xs text-slate-500">Advisory only; it never blocks a request or offer.</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="mentor-expertise" className="text-sm font-medium text-slate-700">Expertise tags</label>
                            <Input
                                id="mentor-expertise"
                                value={profileDraft.expertiseTags}
                                onChange={(event) => setProfileDraft((current) => ({ ...current, expertiseTags: event.target.value }))}
                                placeholder="AI, embedded systems, HCI"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="mentor-bio" className="text-sm font-medium text-slate-700">Short bio</label>
                            <Textarea
                                id="mentor-bio"
                                value={profileDraft.bio}
                                onChange={(event) => setProfileDraft((current) => ({ ...current, bio: event.target.value }))}
                                rows={4}
                                placeholder="Briefly describe the kinds of projects you can support."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setProfileEditorOpen(false)} disabled={profileSaving}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={handleSaveProfile} disabled={profileSaving}>
                            {profileSaving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                            {profileSaving ? "Saving…" : "Save profile"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <CapstoneModal
                project={selectedProject as Capstone | null}
                isOpen={!!selectedRequest}
                onClose={() => setSelectedRequest(null)}
                showActionButton={false}
                additionalMetadata={selectedProjectMetadata}
            />
        </div>
    );
}
