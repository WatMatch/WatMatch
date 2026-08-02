"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TaxonomyChipList } from "@/components/ui/taxonomy-chip";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Disclosure,
    EmptyState,
    Notice,
    SectionHeader,
    StatusBadge,
} from "@/components/ui/workspace";
import { fetchActiveMentors, type MentorUserSummary } from "@/services/capstones.service";
import { fetchDepartments, type Department } from "@/services/departments.service";

const ALL_DEPARTMENTS = "all-departments";
const ALL_TERMS = "all-terms";

function mentorName(mentor: MentorUserSummary) {
    return mentor.profile?.display_name || mentor.email;
}

function mentorDepartment(mentor: MentorUserSummary) {
    return (
        mentor.profile?.primary_department?.name ||
        mentor.profile?.departments?.[0]?.name ||
        "No department listed"
    );
}

export function MentorDirectorySection() {
    const [mentors, setMentors] = useState<MentorUserSummary[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [search, setSearch] = useState("");
    const [departmentId, setDepartmentId] = useState(ALL_DEPARTMENTS);
    const [availabilityTerm, setAvailabilityTerm] = useState(ALL_TERMS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const loadRequestIdRef = useRef(0);

    const load = useCallback(async () => {
        const requestId = loadRequestIdRef.current + 1;
        loadRequestIdRef.current = requestId;
        setLoading(true);
        setError("");
        try {
            const selectedDepartmentId = Number(departmentId);
            const [mentorRows, departmentRows] = await Promise.all([
                fetchActiveMentors({
                    search,
                    department_id:
                        departmentId === ALL_DEPARTMENTS || !Number.isFinite(selectedDepartmentId)
                            ? null
                            : selectedDepartmentId,
                    availability_term:
                        availabilityTerm === ALL_TERMS ? null : availabilityTerm,
                }),
                fetchDepartments(true),
            ]);
            if (loadRequestIdRef.current !== requestId) return;
            setMentors(mentorRows);
            setDepartments(departmentRows);
        } catch (err) {
            if (loadRequestIdRef.current !== requestId) return;
            console.error(err);
            setError(err instanceof Error ? err.message : "Could not load mentor directory.");
        } finally {
            if (loadRequestIdRef.current === requestId) {
                setLoading(false);
            }
        }
    }, [availabilityTerm, departmentId, search]);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <section className="space-y-5">
            <SectionHeader
                title="Mentor directory"
                description="Find active mentors by department, availability, expertise, and current project load."
                actions={
                    <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
                        <RefreshCw className="size-4" aria-hidden="true" />
                        Refresh
                    </Button>
                }
            />

            <div className="wm-panel p-3">
                <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_minmax(190px,250px)_minmax(150px,210px)]">
                    <div className="relative min-w-0">
                        <Label htmlFor="mentor-search" className="sr-only">Search mentors</Label>
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                        <Input
                            id="mentor-search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search mentors or expertise"
                            className="pl-9"
                        />
                    </div>
                    <div>
                        <Label htmlFor="mentor-department" className="sr-only">Department</Label>
                        <Select value={departmentId} onValueChange={setDepartmentId}>
                            <SelectTrigger id="mentor-department">
                                <SelectValue placeholder="Department" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL_DEPARTMENTS}>All departments</SelectItem>
                                {departments.map((department) => (
                                    <SelectItem key={department.department_id} value={String(department.department_id)}>
                                        {department.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="mentor-availability" className="sr-only">Availability</Label>
                        <Select value={availabilityTerm} onValueChange={setAvailabilityTerm}>
                            <SelectTrigger id="mentor-availability">
                                <SelectValue placeholder="Availability" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL_TERMS}>All terms</SelectItem>
                                {[
                                    "Winter",
                                    "Spring",
                                    "Fall",
                                ].map((term) => (
                                    <SelectItem key={term} value={term}>{term}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {error && (
                <Notice tone="danger" title="Mentor directory could not be refreshed">
                    {error}
                </Notice>
            )}

            {loading ? (
                <div className="wm-panel px-4 py-5 text-sm text-slate-600" role="status">
                    Loading mentors…
                </div>
            ) : mentors.length === 0 ? (
                <EmptyState
                    title="No active mentors match these filters"
                    description="Try a broader department, term, or search phrase."
                />
            ) : (
                <div className="space-y-2">
                    <p className="text-xs font-medium tabular-nums text-slate-500">
                        {mentors.length} {mentors.length === 1 ? "mentor" : "mentors"}
                    </p>
                    <div className="wm-panel overflow-hidden">
                        {mentors.map((mentor) => {
                            const profile = mentor.profile;
                            const availability = profile?.availability_terms || [];
                            const expertise = profile?.expertise_tags || [];
                            const activeProjectCount = profile?.active_project_count || 0;
                            const preferredProjectLoad = profile?.max_active_projects ?? null;
                            const exceedsPreferredLoad =
                                preferredProjectLoad !== null &&
                                preferredProjectLoad > 0 &&
                                activeProjectCount > preferredProjectLoad;
                            return (
                                <Disclosure
                                    key={mentor.user_id}
                                    className="rounded-none border-x-0 border-b-0 border-t border-slate-100 first:border-t-0"
                                    summaryClassName="min-h-16 [&::after]:hidden"
                                    contentClassName="bg-slate-50/60"
                                    summary={
                                        <span className="grid min-w-0 gap-x-5 gap-y-2 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,.8fr)_auto] md:items-center">
                                            <span className="min-w-0">
                                                <span className="block break-words font-medium text-slate-950">{mentorName(mentor)}</span>
                                                <span className="mt-0.5 block break-all text-xs font-normal text-slate-500">{mentor.email}</span>
                                            </span>
                                            <span className="break-words text-xs font-normal text-slate-600 md:text-sm">
                                                {mentorDepartment(mentor)}
                                                {profile?.affiliation ? ` · ${profile.affiliation}` : ""}
                                            </span>
                                            <span className="text-xs font-normal text-slate-600">
                                                {availability.length > 0 ? availability.join(", ") : "Availability not listed"}
                                            </span>
                                            <StatusBadge tone={exceedsPreferredLoad ? "warning" : "neutral"}>
                                                {activeProjectCount} active
                                            </StatusBadge>
                                        </span>
                                    }
                                >
                                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(240px,.8fr)]">
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Profile</p>
                                            <p className="mt-2 whitespace-pre-wrap leading-6 text-slate-700">
                                                {profile?.bio || "No mentor biography is available."}
                                            </p>
                                            <div className="mt-4">
                                                {expertise.length > 0 ? (
                                                    <TaxonomyChipList
                                                        namespace="skill"
                                                        values={expertise}
                                                    />
                                                ) : (
                                                    <span className="text-xs text-slate-500">No expertise tags listed.</span>
                                                )}
                                            </div>
                                        </div>
                                        <dl className="grid content-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-xs">
                                            <div className="flex items-center justify-between gap-3">
                                                <dt className="text-slate-500">Active projects</dt>
                                                <dd className="font-medium tabular-nums text-slate-900">{activeProjectCount}</dd>
                                            </div>
                                            <div className="flex items-center justify-between gap-3">
                                                <dt className="text-slate-500">Preferred load</dt>
                                                <dd className="font-medium tabular-nums text-slate-900">{preferredProjectLoad ?? "Not set"}</dd>
                                            </div>
                                            <div className="flex items-start justify-between gap-3">
                                                <dt className="text-slate-500">Available</dt>
                                                <dd className="text-right font-medium text-slate-900">{availability.join(", ") || "Not listed"}</dd>
                                            </div>
                                            {exceedsPreferredLoad && (
                                                <Notice tone="warning" className="mt-1">Above the mentor&apos;s preferred project load.</Notice>
                                            )}
                                        </dl>
                                    </div>
                                </Disclosure>
                            );
                        })}
                    </div>
                </div>
            )}
        </section>
    );
}
