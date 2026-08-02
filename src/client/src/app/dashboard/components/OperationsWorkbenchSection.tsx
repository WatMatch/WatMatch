"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TaxonomyChip, TaxonomyChipList } from "@/components/ui/taxonomy-chip";
import { RefreshCw } from "lucide-react";
import {
    Disclosure,
    EmptyState,
    Notice,
    SectionHeader,
    StatusBadge,
    WorkspaceTabs,
} from "@/components/ui/workspace";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { fetchCourses, type Course } from "@/services/courses.service";
import { fetchDepartments, type Department } from "@/services/departments.service";
import {
    fetchEnrollmentWorkloadSummary,
    type EnrollmentWorkloadSummary,
    type MarketplaceCourseHealthRow,
} from "@/services/marketplace.service";
import type { OperationsQueueFilters } from "@/lib/operations-filters";
import { ProjectCommitmentsSection } from "./ProjectCommitmentsSection";
import { ProjectSubmissionEnrollmentRequestsSection } from "./ProjectSubmissionEnrollmentRequestsSection";
import { AdminCourseRoutingSection } from "./AdminCourseRoutingSection";

type WorkbenchTab =
    | "commitment_routing"
    | "project_submission_enrollment"
    | "project_course_routing"
    | "course_health";

const ALL_COURSES = "all-courses";
const ALL_DEPARTMENTS = "all-departments";

const tabs: Array<{
    id: WorkbenchTab;
    label: string;
    countKey?: keyof EnrollmentWorkloadSummary["counts"];
}> = [
    { id: "commitment_routing", label: "Commitment Routing", countKey: "pending_commitments" },
    {
        id: "project_submission_enrollment",
        label: "Submission Enrollment",
        countKey: "submission_enrollment_requests",
    },
    { id: "project_course_routing", label: "Project Course Routing", countKey: "pending_course_routing" },
    { id: "course_health", label: "Course Health" },
];

function formatDate(value?: string | null) {
    if (!value) return "No pending items";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function courseLabel(course: Course | MarketplaceCourseHealthRow) {
    const department = course.department?.name;
    return `${course.code} - ${course.name}${department ? ` (${department})` : ""}`;
}

function statusTone(status?: string): "success" | "danger" | "warning" | "neutral" {
    switch (status) {
        case "ready":
            return "success";
        case "missing_instructor":
        case "pipeline_issue":
            return "danger";
        case "workload":
            return "warning";
        default:
            return "neutral";
    }
}

function statusLabel(status?: string) {
    return (status || "unknown").replace(/_/g, " ");
}

export function OperationsWorkbenchSection() {
    const [activeTab, setActiveTab] = useState<WorkbenchTab>("commitment_routing");
    const [summary, setSummary] = useState<EnrollmentWorkloadSummary | null>(null);
    const [courses, setCourses] = useState<Course[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [search, setSearch] = useState("");
    const [courseId, setCourseId] = useState(ALL_COURSES);
    const [departmentId, setDepartmentId] = useState(ALL_DEPARTMENTS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const loadRequestIdRef = useRef(0);

    const filters = useMemo<OperationsQueueFilters>(
        () => ({
            search,
            courseId: courseId === ALL_COURSES ? null : Number(courseId),
            departmentId: departmentId === ALL_DEPARTMENTS ? null : Number(departmentId),
        }),
        [courseId, departmentId, search]
    );

    const load = useCallback(async () => {
        const requestId = loadRequestIdRef.current + 1;
        loadRequestIdRef.current = requestId;
        setLoading(true);
        setError("");
        try {
            const [nextSummary, courseRows, departmentRows] = await Promise.all([
                fetchEnrollmentWorkloadSummary({
                    search: filters.search || null,
                    course_id: filters.courseId || null,
                    department_id: filters.departmentId || null,
                    queue_type: null,
                }),
                fetchCourses(false),
                fetchDepartments(true),
            ]);
            if (loadRequestIdRef.current !== requestId) return;
            setSummary(nextSummary);
            setCourses(courseRows);
            setDepartments(departmentRows);
        } catch (err) {
            if (loadRequestIdRef.current !== requestId) return;
            console.error(err);
            setError(err instanceof Error ? err.message : "Could not load operations workbench.");
        } finally {
            if (loadRequestIdRef.current === requestId) {
                setLoading(false);
            }
        }
    }, [filters.courseId, filters.departmentId, filters.search]);

    useEffect(() => {
        load();
    }, [load]);

    const counts = summary?.counts;
    const hasFilters = Boolean(filters.search?.trim() || filters.courseId || filters.departmentId);
    const displayCounts = hasFilters && summary?.filtered_counts ? summary.filtered_counts : counts;
    const marketplace = summary?.marketplace;
    const courseHealthRows = summary?.course_health || [];
    const courseDetailsById = useMemo(
        () => new Map(courses.map((course) => [course.course_id, course])),
        [courses]
    );
    const unhealthyCourseCount = courseHealthRows.filter(
        (row) => !["ready", "inactive", "force_inactive"].includes(row.health_status)
    ).length;
    const reassignmentSignalCount =
        (hasFilters && summary?.filtered_counts
            ? summary.filtered_counts.course_reassignment_requests
            : counts?.course_reassignment_requests) || 0;
    const cleanedCommitments = summary?.cleanup?.cancelled_stale_commitments ?? 0;
    const workbenchTabs = tabs.map((tab) => ({
        id: tab.id,
        label: tab.label,
        count: !summary
            ? undefined
            : tab.id === "course_health"
              ? unhealthyCourseCount
              : tab.countKey
                ? displayCounts?.[tab.countKey] ?? 0
                : 0,
    }));

    return (
        <section className="space-y-4">
            <SectionHeader
                title="Routing queues"
                description="Resolve the decisions currently blocking students, rosters, and project review."
                actions={
                    marketplace ? (
                        <StatusBadge tone="neutral" className="capitalize">
                            {marketplace.current_term || "Term unset"} · {marketplace.phase || "exploration"}
                        </StatusBadge>
                    ) : null
                }
            />

            {error && (
                <Notice tone="danger" title="Workbench unavailable">{error}</Notice>
            )}
            {cleanedCommitments > 0 && (
                <Notice tone="warning">
                    Removed {cleanedCommitments} stale commitment request{cleanedCommitments === 1 ? "" : "s"} while refreshing this queue.
                </Notice>
            )}

            <div className="wm-panel overflow-hidden">
                <div className="grid gap-2 border-b border-slate-100 p-3 lg:grid-cols-[minmax(240px,1fr)_minmax(190px,250px)_minmax(190px,250px)_auto]">
                    <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search projects or students"
                        aria-label="Search routing queues"
                    />
                    <Select value={courseId} onValueChange={setCourseId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Course" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL_COURSES}>All courses</SelectItem>
                            {courses.map((course) => (
                                <SelectItem key={course.course_id} value={String(course.course_id)}>
                                    {course.code} - {course.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
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
                    <Button type="button" variant="outline" onClick={load} disabled={loading}>
                        <RefreshCw className={loading ? "animate-spin" : ""} />
                        <span className="lg:sr-only xl:not-sr-only">Refresh</span>
                    </Button>
                </div>
                <div className="px-3 pt-3">
                    <WorkspaceTabs
                        tabs={workbenchTabs}
                        activeTab={activeTab}
                        onChange={setActiveTab}
                        label="Routing queues"
                    />
                </div>
            </div>

            <Disclosure
                summary={
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>Workload details</span>
                        <span className="text-xs font-normal text-slate-500">
                            {!summary && loading
                                ? "Loading workload…"
                                : `${summary?.filtered_attention_count ?? 0} matching · oldest ${formatDate(summary?.oldest_pending_at)}`}
                        </span>
                    </span>
                }
            >
                {!summary && loading ? (
                    <div
                        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
                        role="status"
                        aria-label="Loading workload details"
                    >
                        {Array.from({ length: 4 }).map((_, index) => (
                            <div
                                key={index}
                                className="h-[4.25rem] animate-pulse rounded-xl border border-slate-200 bg-slate-100"
                            />
                        ))}
                    </div>
                ) : (
                    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="wm-subtle-panel px-3 py-2.5">
                        <dt className="text-xs text-slate-500">Roster signals</dt>
                        <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{reassignmentSignalCount}</dd>
                    </div>
                    <div className="wm-subtle-panel px-3 py-2.5">
                        <dt className="text-xs text-slate-500">Courses needing attention</dt>
                        <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{unhealthyCourseCount}</dd>
                    </div>
                    <div className="wm-subtle-panel px-3 py-2.5">
                        <dt className="text-xs text-slate-500">View scope</dt>
                        <dd className="mt-1 text-sm font-medium text-slate-900">{hasFilters ? "Filtered" : "All courses"}</dd>
                    </div>
                    <div className="wm-subtle-panel px-3 py-2.5">
                        <dt className="text-xs text-slate-500">Oldest pending</dt>
                        <dd className="mt-1 text-sm font-medium text-slate-900">{formatDate(summary?.oldest_pending_at)}</dd>
                    </div>
                    </dl>
                )}
            </Disclosure>

            {activeTab === "commitment_routing" ? (
                <ProjectCommitmentsSection filters={filters} />
            ) : activeTab === "project_submission_enrollment" ? (
                <ProjectSubmissionEnrollmentRequestsSection filters={filters} />
            ) : activeTab === "project_course_routing" ? (
                <AdminCourseRoutingSection filters={filters} />
            ) : (
                <div className="wm-panel p-4">
                    <SectionHeader
                        title="Course health"
                        description="Staffing and pipeline conditions that can block review or routing."
                    />
                    {loading ? (
                        <div className="mt-4 space-y-2" aria-label="Loading course health">
                            {[0, 1, 2].map((item) => <div key={item} className="h-14 animate-pulse rounded-lg bg-slate-100" />)}
                        </div>
                    ) : courseHealthRows.length === 0 ? (
                        <EmptyState className="mt-4" title="No matching courses" description="Adjust the course, department, or search filters." />
                    ) : (
                        <div className="mt-4 space-y-2">
                            {courseHealthRows.map((course) => (
                                (() => {
                                    const courseDetails = courseDetailsById.get(course.course_id);
                                    const currentOffering = courseDetails?.current_offering;
                                    const heldWithCourses = currentOffering?.held_with_courses || [];
                                    const effectiveEcosystem =
                                        courseDetails?.effective_ecosystem?.name ||
                                        currentOffering?.ecosystem?.name ||
                                        course.ecosystem?.name;
                                    const requiresSupport =
                                        currentOffering?.requires_project_support ??
                                        courseDetails?.effective_requires_project_support ??
                                        course.requires_project_support ??
                                        false;
                                    const effectiveRoutingKind =
                                        currentOffering?.routing_kind_override ||
                                        courseDetails?.effective_routing_kind ||
                                        course.routing_kind ||
                                        "standard";

                                    return (
                                        <Disclosure
                                            key={course.course_id}
                                            summary={
                                                <div className="flex w-full flex-col gap-2 pr-2 sm:flex-row sm:items-center sm:justify-between">
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-slate-900">
                                                            {courseLabel(course)}
                                                        </p>
                                                        <p className="text-xs text-slate-500">
                                                            {currentOffering
                                                                ? `${currentOffering.term} offering`
                                                                : course.active_terms?.join(", ") || "No current-term offering"}
                                                            {" · "}
                                                            {effectiveRoutingKind.replace(/_/g, " ")}
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        <StatusBadge tone={statusTone(course.health_status)} className="capitalize">
                                                            {statusLabel(course.health_status)}
                                                        </StatusBadge>
                                                        <StatusBadge tone="neutral">
                                                            {course.active_instructor_count || 0} instructor{course.active_instructor_count === 1 ? "" : "s"}
                                                        </StatusBadge>
                                                    </div>
                                                </div>
                                            }
                                            contentClassName="space-y-4 bg-slate-50/60"
                                        >
                                            <dl className="grid gap-x-5 gap-y-3 text-xs sm:grid-cols-2 lg:grid-cols-5">
                                                <div>
                                                    <dt className="text-slate-500">Term offering</dt>
                                                    <dd className="mt-1 font-medium text-slate-900">
                                                        {currentOffering
                                                            ? `${currentOffering.term} · ${statusLabel(currentOffering.status)}`
                                                            : "No current-term offering"}
                                                    </dd>
                                                </div>
                                                <div>
                                                    <dt className="text-slate-500">Held with</dt>
                                                    <dd className="mt-1 font-medium text-slate-900">
                                                        {heldWithCourses.length > 0 ? (
                                                            <TaxonomyChipList
                                                                namespace="course"
                                                                values={heldWithCourses.map((item) => item.code)}
                                                            />
                                                        ) : (
                                                            "None"
                                                        )}
                                                    </dd>
                                                </div>
                                                <div>
                                                    <dt className="text-slate-500">Ecosystem</dt>
                                                    <dd className="mt-1 font-medium text-slate-900">
                                                        {effectiveEcosystem ? (
                                                            <TaxonomyChip namespace="ecosystem" value={effectiveEcosystem} />
                                                        ) : (
                                                            "None"
                                                        )}
                                                    </dd>
                                                </div>
                                                <div>
                                                    <dt className="text-slate-500">Project support</dt>
                                                    <dd className="mt-1 font-medium text-slate-900">
                                                        {requiresSupport ? "Required" : "Not required"}
                                                    </dd>
                                                </div>
                                                <div>
                                                    <dt className="text-slate-500">Offering source</dt>
                                                    <dd className="mt-1 font-medium text-slate-900">
                                                        {currentOffering?.source_url ? (
                                                            <a
                                                                href={currentOffering.source_url}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="text-blue-700 underline underline-offset-2"
                                                            >
                                                                Open source
                                                            </a>
                                                        ) : (
                                                            "Not recorded"
                                                        )}
                                                    </dd>
                                                </div>
                                            </dl>
                                            <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-5">
                                                <span className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-slate-700">
                                                    Reviews: {course.pending_review_count}
                                                </span>
                                                <span className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-slate-700">
                                                    Routing: {course.pending_routing_count}
                                                </span>
                                                <span className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-slate-700">
                                                    Commitments: {course.pending_commitment_count}
                                                </span>
                                                <span className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-slate-700">
                                                    Roster signals: {course.course_reassignment_count}
                                                </span>
                                                <span className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-slate-700">
                                                    Pipeline issues: {course.pipeline_issue_count}
                                                </span>
                                            </div>
                                        </Disclosure>
                                    );
                                })()
                            ))}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
