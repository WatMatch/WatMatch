"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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

    const load = useCallback(async () => {
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
            setMentors(mentorRows);
            setDepartments(departmentRows);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Could not load mentor directory.");
        } finally {
            setLoading(false);
        }
    }, [availabilityTerm, departmentId, search]);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <section className="space-y-4">
            <div>
                <h2 className="text-xl font-semibold text-slate-900">Mentor Directory</h2>
                <p className="text-sm text-slate-600">
                    Browse active mentor accounts by department, availability, and expertise.
                </p>
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-4">
                <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_minmax(200px,260px)_minmax(160px,220px)_auto]">
                    <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search name, email, affiliation, or expertise"
                    />
                    <Select value={departmentId} onValueChange={setDepartmentId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Department" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL_DEPARTMENTS}>All departments</SelectItem>
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
                    <Select value={availabilityTerm} onValueChange={setAvailabilityTerm}>
                        <SelectTrigger>
                            <SelectValue placeholder="Availability" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL_TERMS}>All terms</SelectItem>
                            {["Winter", "Spring", "Fall"].map((term) => (
                                <SelectItem key={term} value={term}>
                                    {term}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" onClick={load} disabled={loading}>
                        Refresh
                    </Button>
                </div>

                {error && (
                    <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {loading ? (
                    <p className="mt-4 text-sm text-slate-600">Loading mentors...</p>
                ) : mentors.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-600">No active mentors match these filters.</p>
                ) : (
                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
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
                                <div
                                    key={mentor.user_id}
                                    className="rounded-md border border-slate-200 bg-slate-50 p-3"
                                >
                                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                            <p className="break-words font-medium text-slate-900">
                                                {mentorName(mentor)}
                                            </p>
                                            <p className="break-all text-xs text-slate-500">
                                                {mentor.email}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            <span className="w-fit rounded bg-white px-2 py-0.5 text-xs text-slate-600">
                                                {activeProjectCount} active
                                                {preferredProjectLoad
                                                    ? ` | Preferred ${preferredProjectLoad}`
                                                    : ""}
                                            </span>
                                            {exceedsPreferredLoad && (
                                                <span className="w-fit rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                                                    Above preferred load
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <p className="mt-2 text-sm text-slate-700">
                                        {mentorDepartment(mentor)}
                                        {profile?.affiliation ? ` - ${profile.affiliation}` : ""}
                                    </p>
                                    {profile?.bio && (
                                        <p className="mt-2 text-sm text-slate-600">
                                            {profile.bio}
                                        </p>
                                    )}
                                    <div className="mt-3 flex flex-wrap gap-1">
                                        {availability.map((term) => (
                                            <span
                                                key={`${mentor.user_id}-${term}`}
                                                className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700"
                                            >
                                                {term}
                                            </span>
                                        ))}
                                        {expertise.slice(0, 8).map((tag) => (
                                            <span
                                                key={`${mentor.user_id}-${tag}`}
                                                className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
}
