"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { TaxonomyChipList } from "@/components/ui/taxonomy-chip";
import {
    CourseRouteSummary,
    Disclosure,
    EmptyState,
    Notice,
    PaginationBar,
    SectionHeader,
    StatusBadge,
} from "@/components/ui/workspace";
import { fetchCourses, type Course } from "@/services/courses.service";
import {
    courseOptionLabel,
    filterStaffedActiveCourses,
    hasActiveInstructor,
    isActiveRoutingCourse,
} from "@/lib/course-options";
import {
    fetchCourseRoutingCapstones,
    routeCapstoneCourse,
    type CourseRoutingItem,
} from "@/services/capstones.service";
import {
    matchesOptionalId,
    matchesSearch,
    type OperationsQueueFilters,
} from "@/lib/operations-filters";

const PAGE_SIZE = 20;

function courseLabel(course?: Course | CourseRoutingItem["target_course"] | null) {
    return courseOptionLabel(course, { includeDepartment: true });
}

function trackLabel(track?: string | null) {
    return track === "interdisciplinary"
        ? "Interdisciplinary course"
        : "Standard capstone course";
}

export function AdminCourseRoutingSection({ filters }: { filters?: OperationsQueueFilters } = {}) {
    const [items, setItems] = useState<CourseRoutingItem[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [selectedCourses, setSelectedCourses] = useState<Record<string, string>>({});
    const [notes, setNotes] = useState<Record<string, string>>({});
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [submittingId, setSubmittingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const loadRequestIdRef = useRef(0);

    const activeCourses = useMemo(
        () => courses.filter(isActiveRoutingCourse),
        [courses]
    );
    const staffedCourses = useMemo(
        () => filterStaffedActiveCourses(courses),
        [courses]
    );
    const visibleItems = useMemo(
        () =>
            items.filter((item) =>
                matchesSearch(filters?.search, [
                    item.capstone.title,
                    item.capstone.description,
                    item.capstone.problem_area,
                    ...item.members.map((member) => member.email),
                ]) &&
                matchesOptionalId(filters?.courseId, [
                    item.capstone.course_fk,
                    item.capstone.requested_course_fk,
                    item.team?.course_fk,
                    item.target_course?.course_id,
                    ...item.members.map((member) => member.course_id),
                ]) &&
                matchesOptionalId(filters?.departmentId, [
                    item.target_course?.department_fk,
                    item.target_course?.department?.department_id,
                    ...item.members.map((member) => member.home_department_id),
                ])
            ),
        [filters?.courseId, filters?.departmentId, filters?.search, items]
    );

    const loadQueue = useCallback(async (targetPage: number) => {
        const requestId = loadRequestIdRef.current + 1;
        loadRequestIdRef.current = requestId;
        setLoading(true);
        setError(null);
        try {
            const [initialQueue, courseRows] = await Promise.all([
                fetchCourseRoutingCapstones(targetPage, PAGE_SIZE, {
                    search: filters?.search || null,
                    course_id: filters?.courseId || null,
                    department_id: filters?.departmentId || null,
                }),
                fetchCourses(true),
            ]);
            let queue = initialQueue;
            let resolvedTotalPages = Math.max(1, Number(queue.total_pages || 1));
            let resolvedPage = Math.min(Math.max(1, targetPage), resolvedTotalPages);
            if (resolvedPage !== targetPage) {
                queue = await fetchCourseRoutingCapstones(resolvedPage, PAGE_SIZE, {
                    search: filters?.search || null,
                    course_id: filters?.courseId || null,
                    department_id: filters?.departmentId || null,
                });
                resolvedTotalPages = Math.max(1, Number(queue.total_pages || 1));
                resolvedPage = Math.min(Math.max(1, resolvedPage), resolvedTotalPages);
            }
            if (loadRequestIdRef.current !== requestId) return;
            setItems(queue.data || []);
            setCourses(courseRows);
            setPage(resolvedPage);
            setTotalPages(resolvedTotalPages);
            setSelectedCourses(() => {
                const next: Record<string, string> = {};
                for (const item of queue.data || []) {
                    const id = String(item.capstone.capstone_id);
                    const target =
                        item.capstone.requested_course_fk ??
                        item.target_course?.course_id ??
                        item.team?.course_fk ??
                        item.capstone.course_fk;
                    if (target) next[id] = String(target);
                }
                return next;
            });
        } catch (e) {
            if (loadRequestIdRef.current !== requestId) return;
            console.error(e);
            setError(e instanceof Error ? e.message : "Could not load course routing queue.");
        } finally {
            if (loadRequestIdRef.current === requestId) {
                setLoading(false);
            }
        }
    }, [filters?.courseId, filters?.departmentId, filters?.search]);

    useEffect(() => {
        loadQueue(1);
    }, [loadQueue]);

    const handleRoute = async (item: CourseRoutingItem) => {
        const capstoneId = String(item.capstone.capstone_id);
        const selectedCourse = selectedCourses[capstoneId];
        if (!selectedCourse) {
            setError("Choose a target course before routing.");
            return;
        }
        const course = staffedCourses.find(
            (activeCourse) => String(activeCourse.course_id) === selectedCourse
        );
        if (!course) {
            setError("Choose a target course with an active instructor assigned.");
            return;
        }
        const previousCourseId =
            item.capstone.requested_course_fk ??
            item.target_course?.course_id ??
            item.team?.course_fk ??
            item.capstone.course_fk;
        if (
            previousCourseId &&
            Number(selectedCourse) !== Number(previousCourseId) &&
            !notes[capstoneId]?.trim()
        ) {
            setError("Decision notes are required when routing changes the intended course.");
            return;
        }
        setSubmittingId(capstoneId);
        setError(null);
        setNotice(null);
        try {
            await routeCapstoneCourse(capstoneId, {
                target_course_id: Number(selectedCourse),
                comments: notes[capstoneId]?.trim() || null,
            });
            setNotice("Capstone routed to instructor review.");
            await loadQueue(page);
        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : "Failed to route capstone.");
        } finally {
            setSubmittingId(null);
        }
    };

    return (
        <section className="space-y-4">
                    <SectionHeader
                        title="Course routing"
                        description="Assign a staffed coordinating course before a project enters instructor review."
                    />
                    {error && <Notice tone="danger" title="Route not saved">{error}</Notice>}
                    {notice && <Notice tone="success">{notice}</Notice>}
                    <Notice tone="warning">
                        WatMatch records the intended coordinating course. Matching Registrar or Quest updates still happen outside WatMatch.
                    </Notice>
                    {loading ? (
                        <div className="space-y-3" aria-label="Loading course routing queue">
                            {[0, 1].map((item) => (
                                <div key={item} className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />
                            ))}
                        </div>
                    ) : items.length === 0 ? (
                        <EmptyState
                            title="Course-routing queue is clear"
                            description="No capstones are waiting for a coordinating course."
                        />
                    ) : visibleItems.length === 0 ? (
                        <EmptyState
                            title="No matching projects"
                            description="Adjust the search, course, or department filters."
                        />
                    ) : (
                        <div className="space-y-4">
                            {visibleItems.map((item) => {
                                const capstoneId = String(item.capstone.capstone_id);
                                const requestedCourse = activeCourses.find(
                                    (course) =>
                                        course.course_id === item.capstone.requested_course_fk
                                );
                                const currentCourseIds = Array.from(
                                    new Set(
                                        item.members
                                            .map((member) => member.course_id)
                                            .filter(
                                                (courseId): courseId is number =>
                                                    courseId !== undefined &&
                                                    courseId !== null
                                            )
                                    )
                                );
                                const suggestedCourses = [
                                    ...currentCourseIds
                                        .map((courseId) =>
                                            activeCourses.find(
                                                (course) => course.course_id === courseId
                                            )
                                        )
                                        .filter((course): course is Course => Boolean(course)),
                                    requestedCourse,
                                ].filter((course): course is Course => Boolean(course));
                                const uniqueSuggestedCourses = Array.from(
                                    new Map(
                                        suggestedCourses.map((course) => [
                                            course.course_id,
                                            course,
                                        ])
                                    ).values()
                                );
                                return (
                                    <article key={capstoneId} className="wm-panel overflow-hidden">
                                        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="min-w-0">
                                                <h3 className="font-semibold tracking-[-0.01em] text-slate-950">
                                                    {item.capstone.title || "Untitled capstone"}
                                                </h3>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                <StatusBadge tone="warning">Awaiting route</StatusBadge>
                                                <StatusBadge tone="neutral">{item.members.length} member{item.members.length === 1 ? "" : "s"}</StatusBadge>
                                            </div>
                                        </div>

                                        <div className="space-y-4 px-4 py-4">
                                            <CourseRouteSummary
                                                routes={[
                                                    {
                                                        label: "Current target",
                                                        course: item.target_course
                                                            ? courseLabel(item.target_course)
                                                            : "No coordinating course",
                                                    },
                                                    {
                                                        label: "Requested course",
                                                        course: requestedCourse
                                                            ? courseLabel(requestedCourse)
                                                            : "None specified",
                                                    },
                                                ]}
                                            />

                                            <Disclosure summary="Project and roster context">
                                                <dl className="grid gap-3 text-xs sm:grid-cols-2">
                                                    <div>
                                                        <dt className="text-slate-500">Registration path</dt>
                                                        <dd className="mt-0.5 font-medium text-slate-800">{trackLabel(item.capstone.submission_track)}</dd>
                                                    </div>
                                                    <div>
                                                        <dt className="text-slate-500">Proposed team</dt>
                                                        <dd className="mt-0.5 font-medium text-slate-800">{item.capstone.proposed_team_members || "Not specified"}</dd>
                                                    </div>
                                                </dl>
                                                <div className="mt-4 grid gap-3 md:grid-cols-2">
                                                    {[
                                                        ["Problem area", item.capstone.problem_area || item.capstone.description || "Not specified"],
                                                        ["Objectives", item.capstone.main_objectives || "Not specified"],
                                                        ["Scope", item.capstone.scope_of_work || "Not specified"],
                                                    ].map(([label, value]) => (
                                                        <div key={label} className="wm-subtle-panel p-3">
                                                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
                                                            <p className="mt-1 max-h-28 overflow-y-auto whitespace-pre-wrap text-sm leading-5 text-slate-800">{value}</p>
                                                        </div>
                                                    ))}
                                                    <div className="wm-subtle-panel p-3">
                                                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                                            Project taxonomy and deliverables
                                                        </p>
                                                        <div className="mt-2 space-y-3">
                                                            <div>
                                                                <p className="mb-1 text-xs font-medium text-slate-600">Disciplines</p>
                                                                {item.capstone.disciplines?.length ? (
                                                                    <TaxonomyChipList
                                                                        namespace="discipline"
                                                                        values={item.capstone.disciplines}
                                                                    />
                                                                ) : (
                                                                    <p className="text-sm text-slate-800">Not specified</p>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="mb-1 text-xs font-medium text-slate-600">Skills</p>
                                                                {item.capstone.skills?.length ? (
                                                                    <TaxonomyChipList
                                                                        namespace="skill"
                                                                        values={item.capstone.skills}
                                                                    />
                                                                ) : (
                                                                    <p className="text-sm text-slate-800">Not specified</p>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-medium text-slate-600">Deliverables</p>
                                                                {item.capstone.deliverable_types?.length ? (
                                                                    <TaxonomyChipList
                                                                        namespace="deliverable"
                                                                        values={item.capstone.deliverable_types}
                                                                        className="mt-1.5"
                                                                    />
                                                                ) : (
                                                                    <p className="mt-1 text-sm text-slate-800">Not specified</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
                                                    <table className="min-w-full text-left text-sm">
                                                        <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                                                            <tr>
                                                                <th className="px-3 py-2 font-medium">Student</th>
                                                                <th className="px-3 py-2 font-medium">Current course</th>
                                                                <th className="px-3 py-2 font-medium">Home department</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {item.members.map((member) => (
                                                                <tr key={member.user_id}>
                                                                    <td className="px-3 py-2.5">
                                                                        <span className="break-all text-slate-900">{member.email}</span>
                                                                        {member.is_leader && <StatusBadge tone="neutral" className="ml-2">Lead</StatusBadge>}
                                                                    </td>
                                                                    <td className="px-3 py-2.5 text-slate-700">{member.course_code ? `${member.course_code} - ${member.course_name || ""}`.trim() : "Unassigned"}</td>
                                                                    <td className="px-3 py-2.5 text-slate-700">{member.home_department || "Unassigned"}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </Disclosure>

                                            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                                            <div className="space-y-2">
                                                <label htmlFor={`routing-course-${capstoneId}`} className="block text-xs font-medium text-slate-700">Coordinating course</label>
                                                {uniqueSuggestedCourses.length > 0 && (
                                                    <div className="flex flex-wrap gap-2">
                                                        {uniqueSuggestedCourses.map((course) => {
                                                            const isRequested =
                                                                course.course_id ===
                                                                item.capstone.requested_course_fk;
                                                            const isInterdisciplinary =
                                                                course.routing_kind === "interdisciplinary";
                                                            return (
                                                                <Button
                                                                    key={course.course_id}
                                                                    type="button"
                                                                    disabled={
                                                                        !hasActiveInstructor(course)
                                                                    }
                                                                    variant={
                                                                        selectedCourses[capstoneId] ===
                                                                        String(course.course_id)
                                                                            ? "default"
                                                                            : "outline"
                                                                    }
                                                                    size="sm"
                                                                    onClick={() =>
                                                                        setSelectedCourses(
                                                                            (previous) => ({
                                                                                ...previous,
                                                                                [capstoneId]:
                                                                                    String(
                                                                                        course.course_id
                                                                                    ),
                                                                            })
                                                                        )
                                                                    }
                                                                >
                                                                    {isRequested
                                                                        ? isInterdisciplinary
                                                                            ? "Interdisciplinary"
                                                                            : "Requested"
                                                                        : "Current course"}
                                                                    {!hasActiveInstructor(course) && " (no instructor)"}
                                                                </Button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                                <Select
                                                    value={selectedCourses[capstoneId] || ""}
                                                    onValueChange={(value) =>
                                                        setSelectedCourses((previous) => ({
                                                            ...previous,
                                                            [capstoneId]: value,
                                                        }))
                                                    }
                                                >
                                                    <SelectTrigger id={`routing-course-${capstoneId}`}>
                                                        <SelectValue placeholder="Choose course" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {activeCourses.map((course) => (
                                                            <SelectItem
                                                                key={course.course_id}
                                                                value={String(course.course_id)}
                                                                disabled={!hasActiveInstructor(course)}
                                                            >
                                                                {courseLabel(course)}
                                                                {!hasActiveInstructor(course) && " - no active instructor"}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <label htmlFor={`routing-notes-${capstoneId}`} className="block text-xs font-medium text-slate-700">Routing notes</label>
                                                <Textarea
                                                    id={`routing-notes-${capstoneId}`}
                                                    value={notes[capstoneId] || ""}
                                                    onChange={(event) =>
                                                        setNotes((previous) => ({
                                                            ...previous,
                                                            [capstoneId]: event.target.value,
                                                        }))
                                                    }
                                                    placeholder="Optional routing note"
                                                    className="min-h-9"
                                                />
                                            </div>
                                        </div>
                                            <div className="flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                                                <p className="text-xs leading-5 text-slate-600">Routing sends the project to the selected course&apos;s instructor review queue.</p>
                                                <Button onClick={() => handleRoute(item)} disabled={submittingId === capstoneId || !selectedCourses[capstoneId]} className="sm:shrink-0">
                                                    {submittingId === capstoneId ? <Loader2 className="animate-spin" /> : null}
                                                    {submittingId === capstoneId ? "Routing..." : "Route to course"}
                                                </Button>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                    <PaginationBar
                        page={page}
                        totalPages={totalPages}
                        loading={loading}
                        onPrevious={() => loadQueue(page - 1)}
                        onNext={() => loadQueue(page + 1)}
                        className="rounded-xl border border-slate-200 bg-white"
                    />
        </section>
    );
}
