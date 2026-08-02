"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Filter, RefreshCw, Search } from "lucide-react";
import {
    fetchAuditLog,
    type AuditLogResponse,
    type AuditLogRow,
} from "@/services/approvals.service";
import { fetchCourses, type Course } from "@/services/courses.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { userContext } from "@/contexts/UserContext";

const ALL = "all";
const LIMIT_OPTIONS = [50, 150, 300, 500];

type AuditContextCourse = {
    course_id: number;
    code: string;
    name: string;
    active?: boolean;
};

function formatAuditLabel(value?: string | null): string {
    const cleaned = String(value || "")
        .trim()
        .replace(/_/g, " ");
    if (!cleaned) return "Unknown";
    return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
}

function courseLabel(course: Course | AuditContextCourse) {
    return `${course.code} - ${course.name}`;
}

function toPositiveInteger(value: string): number | undefined {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function actionTone(action: string): "neutral" | "info" | "warning" | "success" {
    const normalized = action.toLowerCase();
    if (normalized.includes("created") || normalized.includes("approved")) {
        return "success";
    }
    if (normalized.includes("updated") || normalized.includes("reassigned")) {
        return "info";
    }
    if (
        normalized.includes("archived") ||
        normalized.includes("deleted") ||
        normalized.includes("removed") ||
        normalized.includes("disbanded") ||
        normalized.includes("rejected")
    ) {
        return "warning";
    }
    return "neutral";
}

function AuditRowDisclosure({ row }: { row: AuditLogRow }) {
    const courses = row.context?.courses || [];
    const teamId = row.context?.team_id;
    const teamLabel = row.context?.team_label;
    const capstoneId = row.context?.capstone_id;
    const capstoneTitle = row.context?.capstone_title;
    const actorLabel =
        row.actor_email || (row.actor_fk ? `User #${row.actor_fk}` : "Unknown actor");
    const targetLabel = capstoneTitle || teamLabel || `${formatAuditLabel(row.entity_type)} #${row.entity_id}`;

    return (
        <Disclosure
            className="rounded-none border-x-0 border-b-0 border-t border-slate-100 first:border-t-0"
            summaryClassName="items-start py-3.5 [&::after]:hidden"
            contentClassName="bg-slate-50/60"
            summary={
                <span className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                    <span className="min-w-0">
                        <span className="flex min-w-0 flex-wrap items-center gap-2">
                            <StatusBadge tone={actionTone(row.action)}>{formatAuditLabel(row.action)}</StatusBadge>
                            <span className="break-words text-sm font-semibold text-slate-950">{targetLabel}</span>
                        </span>
                        {row.reason && (
                            <span className="mt-2 block whitespace-pre-wrap text-xs font-normal leading-5 text-slate-700">
                                Reason: {row.reason}
                            </span>
                        )}
                        <span className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs font-normal text-slate-500">
                            <span>{new Date(row.created_at).toLocaleString()}</span>
                            <span className="break-all">{actorLabel}</span>
                            <span>{formatAuditLabel(row.actor_role || "n/a")}</span>
                        </span>
                    </span>
                    <span className="flex flex-wrap gap-1.5 sm:justify-end">
                        {courses.map((course) => (
                            <StatusBadge key={`audit-${row.audit_id}-course-${course.course_id}`} tone={course.active === false ? "warning" : "info"}>
                                {course.code}
                            </StatusBadge>
                        ))}
                    </span>
                </span>
            }
        >
            <div className="grid gap-4 lg:grid-cols-[minmax(220px,.7fr)_minmax(0,1.3fr)]">
                <dl className="grid content-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-xs">
                    <div>
                        <dt className="text-slate-500">Entity</dt>
                        <dd className="mt-0.5 font-medium text-slate-900">
                            {formatAuditLabel(row.entity_type)} #{row.entity_id}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-slate-500">Actor</dt>
                        <dd className="mt-0.5 break-all font-medium text-slate-900">{actorLabel}</dd>
                    </div>
                    {teamId && (
                        <div>
                            <dt className="text-slate-500">Team</dt>
                            <dd className="mt-0.5 font-medium text-slate-900">{teamLabel || `Team ${teamId}`}</dd>
                        </div>
                    )}
                    {capstoneId && (
                        <div>
                            <dt className="text-slate-500">Capstone</dt>
                            <dd className="mt-0.5 break-words font-medium text-slate-900">{capstoneTitle || `Capstone ${capstoneId}`}</dd>
                        </div>
                    )}
                    {courses.length > 0 && (
                        <div>
                            <dt className="text-slate-500">Course context</dt>
                            <dd className="mt-0.5 space-y-1 font-medium text-slate-900">
                                {courses.map((course) => <span key={course.course_id} className="block">{courseLabel(course)}</span>)}
                            </dd>
                        </div>
                    )}
                </dl>
                <div className="min-w-0">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Metadata</p>
                    <pre className="max-w-full overflow-x-auto rounded-lg border border-slate-200 bg-slate-950 p-3 text-[11px] leading-5 text-slate-100">
                        {JSON.stringify(row.metadata || {}, null, 2)}
                    </pre>
                </div>
            </div>
        </Disclosure>
    );
}

export function AuditLogSection() {
    const { user } = userContext();
    const currentRole = (user?.role || "").toLowerCase();
    const isInstructor = currentRole === "instructor";
    const [initialized, setInitialized] = useState(false);
    const [rows, setRows] = useState<AuditLogRow[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [filterMetadata, setFilterMetadata] = useState<AuditLogResponse["filters"]>({
        actions: [],
        entity_types: [],
    });
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [courseFilter, setCourseFilter] = useState(ALL);
    const [teamFilter, setTeamFilter] = useState("");
    const [contextSearch, setContextSearch] = useState("");
    const [entityTypeFilter, setEntityTypeFilter] = useState(ALL);
    const [actionFilter, setActionFilter] = useState(ALL);
    const [watiamFilter, setWatiamFilter] = useState("");
    const [limit, setLimit] = useState("150");
    const loadRequestIdRef = useRef(0);

    useEffect(() => {
        if (!user) return;
        setCourseFilter(isInstructor && user.course_fk ? String(user.course_fk) : ALL);
        setInitialized(true);
    }, [isInstructor, user, user?.course_fk, user?.user_id]);

    useEffect(() => {
        async function loadCourses() {
            try {
                setCourses(await fetchCourses(false));
            } catch (courseError) {
                console.error("Failed to load courses for audit filters:", courseError);
                setCourses([]);
            }
        }
        loadCourses();
    }, []);

    const selectedCourseLabel = useMemo(() => {
        if (courseFilter === ALL) return isInstructor ? "No course assigned" : "All courses";
        const course = courses.find((row) => String(row.course_id) === courseFilter);
        return course ? courseLabel(course) : `Course #${courseFilter}`;
    }, [courseFilter, courses, isInstructor]);

    const load = useCallback(async () => {
        if (!initialized) return;
        const requestId = loadRequestIdRef.current + 1;
        loadRequestIdRef.current = requestId;
        setLoading(true);
        setError(null);
        try {
            const response = await fetchAuditLog({
                course_id: courseFilter === ALL ? undefined : toPositiveInteger(courseFilter),
                team_id: toPositiveInteger(teamFilter.trim()),
                context_search: contextSearch.trim() || undefined,
                entity_type: entityTypeFilter === ALL ? undefined : entityTypeFilter,
                action: actionFilter === ALL ? undefined : actionFilter,
                actor_search: watiamFilter.trim() || undefined,
                limit: Number(limit),
            });
            if (loadRequestIdRef.current !== requestId) return;
            setRows(response.rows);
            setTotal(response.total);
            setFilterMetadata(response.filters);
        } catch (err) {
            if (loadRequestIdRef.current !== requestId) return;
            console.error("Failed to load audit log:", err);
            setRows([]);
            setTotal(0);
            setError(err instanceof Error ? err.message : "Could not load audit log.");
        } finally {
            if (loadRequestIdRef.current === requestId) {
                setLoading(false);
            }
        }
    }, [
        actionFilter,
        contextSearch,
        courseFilter,
        entityTypeFilter,
        initialized,
        limit,
        teamFilter,
        watiamFilter,
    ]);

    useEffect(() => {
        load();
    }, [load]);

    const clearFilters = () => {
        setTeamFilter("");
        setContextSearch("");
        setEntityTypeFilter(ALL);
        setActionFilter(ALL);
        setWatiamFilter("");
        setLimit("150");
        setCourseFilter(isInstructor && user?.course_fk ? String(user.course_fk) : ALL);
    };

    return (
        <section className="space-y-5">
            <SectionHeader
                title={isInstructor ? "Course activity" : "Audit log"}
                description={
                    isInstructor
                        ? "Inspect privileged workflow changes recorded for your course."
                        : "Inspect privileged workflow changes across courses, teams, and users."
                }
                actions={
                    <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
                        <RefreshCw className="size-4" aria-hidden="true" />
                        Refresh
                    </Button>
                }
            />

            <div className="wm-panel space-y-3 p-3">
                <div className={`grid gap-3 ${isInstructor ? "md:grid-cols-[minmax(180px,.7fr)_minmax(220px,1fr)_minmax(180px,.7fr)_auto]" : "md:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_minmax(180px,.7fr)_auto]"}`}>
                    <div className="min-w-0">
                        <Label htmlFor="audit-course-filter" className="mb-1.5 block text-xs text-slate-500">Course scope</Label>
                        {isInstructor ? (
                            <div id="audit-course-filter" className="flex h-9 min-w-0 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-800">
                                <span className="truncate">{selectedCourseLabel}</span>
                            </div>
                        ) : (
                            <Select value={courseFilter} onValueChange={setCourseFilter}>
                                <SelectTrigger id="audit-course-filter"><SelectValue>{selectedCourseLabel}</SelectValue></SelectTrigger>
                                <SelectContent className="max-w-[min(560px,calc(100vw-2rem))]">
                                    <SelectItem value={ALL}>All courses</SelectItem>
                                    {courses.map((course) => (
                                        <SelectItem key={`audit-course-${course.course_id}`} value={String(course.course_id)}>
                                            {courseLabel(course)}{course.active === false ? " - Inactive" : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                    <div className="min-w-0">
                        <Label htmlFor="audit-context-filter" className="mb-1.5 block text-xs text-slate-500">Capstone or team</Label>
                        <Input id="audit-context-filter" value={contextSearch} onChange={(event) => setContextSearch(event.target.value)} placeholder="Search title or team" />
                    </div>
                    <div className="min-w-0">
                        <Label htmlFor="audit-action-filter" className="mb-1.5 block text-xs text-slate-500">Action</Label>
                        <Select value={actionFilter} onValueChange={setActionFilter}>
                            <SelectTrigger id="audit-action-filter"><SelectValue /></SelectTrigger>
                            <SelectContent className="max-w-[min(520px,calc(100vw-2rem))]">
                                <SelectItem value={ALL}>All actions</SelectItem>
                                {filterMetadata.actions.map((action) => (
                                    <SelectItem key={action} value={action}>{formatAuditLabel(action)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-end">
                        <Button type="button" className="w-full md:w-auto" onClick={load} disabled={loading}>
                            <Search className="size-4" aria-hidden="true" />
                            Search
                        </Button>
                    </div>
                </div>

                <Disclosure
                    summary={<span className="inline-flex items-center gap-2"><Filter className="size-4" aria-hidden="true" />More filters</span>}
                    summaryClassName="[&::after]:hidden"
                    contentClassName="space-y-3"
                >
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[110px_minmax(160px,1fr)_minmax(150px,1fr)_120px]">
                        <div>
                            <Label htmlFor="audit-team-filter" className="mb-1.5 block text-xs text-slate-500">Team ID</Label>
                            <Input id="audit-team-filter" inputMode="numeric" value={teamFilter} onChange={(event) => setTeamFilter(event.target.value.replace(/[^\d]/g, ""))} placeholder="Any" />
                        </div>
                        <div>
                            <Label htmlFor="audit-entity-filter" className="mb-1.5 block text-xs text-slate-500">Entity</Label>
                            <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
                                <SelectTrigger id="audit-entity-filter"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>All entities</SelectItem>
                                    {filterMetadata.entity_types.map((entityType) => (
                                        <SelectItem key={entityType} value={entityType}>{formatAuditLabel(entityType)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="audit-actor-filter" className="mb-1.5 block text-xs text-slate-500">Actor / WatIAM</Label>
                            <Input id="audit-actor-filter" value={watiamFilter} onChange={(event) => setWatiamFilter(event.target.value.trim().toLowerCase())} placeholder="snviswan" />
                        </div>
                        <div>
                            <Label htmlFor="audit-limit-filter" className="mb-1.5 block text-xs text-slate-500">Limit</Label>
                            <Select value={limit} onValueChange={setLimit}>
                                <SelectTrigger id="audit-limit-filter"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {LIMIT_OPTIONS.map((option) => <SelectItem key={option} value={String(option)}>{option}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <Button type="button" variant="ghost" size="sm" onClick={clearFilters} disabled={loading}>Clear filters</Button>
                    </div>
                </Disclosure>
            </div>

            {error && <Notice tone="danger" title="Audit records could not be loaded">{error}</Notice>}

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                <p>Showing <span className="font-medium tabular-nums text-slate-800">{rows.length}</span> of <span className="font-medium tabular-nums text-slate-800">{total}</span> matching records</p>
                <StatusBadge tone="info">{selectedCourseLabel}</StatusBadge>
            </div>

            {loading ? (
                <div className="wm-panel px-4 py-5 text-sm text-slate-600" role="status">Loading audit records…</div>
            ) : rows.length === 0 ? (
                <EmptyState title="No audit records match these filters" description="Broaden the course, action, or context filters to inspect more activity." />
            ) : (
                <div className="wm-panel overflow-hidden">
                    {rows.map((row) => <AuditRowDisclosure key={row.audit_id} row={row} />)}
                </div>
            )}
        </section>
    );
}
