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
import { Loader2, RotateCcw, UserMinus } from "lucide-react";
import {
    ConfirmActionDialog,
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
} from "@/lib/course-options";
import {
    decideProjectSubmissionEnrollmentRequest,
    fetchProjectSubmissionEnrollmentRequests,
    type ProjectSubmissionEnrollmentItem,
} from "@/services/capstones.service";
import {
    matchesOptionalId,
    matchesSearch,
    type OperationsQueueFilters,
} from "@/lib/operations-filters";

const PAGE_SIZE = 10;

function courseLabel(course?: Course | ProjectSubmissionEnrollmentItem["requested_course"] | null) {
    return courseOptionLabel(course);
}

function formatShortDateTime(value?: string | null) {
    if (!value) return "Not recorded";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not recorded";
    return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

export function ProjectSubmissionEnrollmentRequestsSection({
    filters,
}: { filters?: OperationsQueueFilters } = {}) {
    const [items, setItems] = useState<ProjectSubmissionEnrollmentItem[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [selectedCourses, setSelectedCourses] = useState<Record<number, string>>({});
    const [comments, setComments] = useState<Record<number, string>>({});
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const loadRequestIdRef = useRef(0);

    const staffedCourses = useMemo(
        () => filterStaffedActiveCourses(courses),
        [courses]
    );
    const visibleItems = useMemo(
        () =>
            items.filter((item) =>
                matchesSearch(filters?.search, [
                    item.student?.email,
                    item.requested_by?.email,
                    item.from_course?.code,
                    item.from_course?.name,
                    item.requested_course?.code,
                    item.requested_course?.name,
                ]) &&
                matchesOptionalId(filters?.courseId, [
                    item.request.from_course_fk,
                    item.from_course?.course_id,
                    item.request.to_course_fk,
                    item.requested_course?.course_id,
                    item.student?.course_fk,
                ]) &&
                matchesOptionalId(filters?.departmentId, [item.student?.home_department_id])
            ),
        [filters?.courseId, filters?.departmentId, filters?.search, items]
    );

    const load = useCallback(async (targetPage: number) => {
        const requestId = loadRequestIdRef.current + 1;
        loadRequestIdRef.current = requestId;
        setLoading(true);
        setError(null);
        try {
            const [queue, courseRows] = await Promise.all([
                fetchProjectSubmissionEnrollmentRequests(targetPage, PAGE_SIZE, {
                    search: filters?.search || null,
                    course_id: filters?.courseId || null,
                    department_id: filters?.departmentId || null,
                }),
                fetchCourses(true),
            ]);
            if (loadRequestIdRef.current !== requestId) return;
            setItems(queue.data || []);
            setCourses(courseRows);
            setPage(queue.page || targetPage);
            setTotalPages(queue.total_pages || 1);
            setSelectedCourses((current) => {
                const next = { ...current };
                (queue.data || []).forEach((item) => {
                    const requestId = item.request.request_id;
                    if (!next[requestId] && item.request.to_course_fk) {
                        next[requestId] = String(item.request.to_course_fk);
                    }
                });
                return next;
            });
        } catch (err) {
            if (loadRequestIdRef.current !== requestId) return;
            console.error(err);
            setError(err instanceof Error ? err.message : "Could not load submission enrollment requests.");
        } finally {
            if (loadRequestIdRef.current === requestId) {
                setLoading(false);
            }
        }
    }, [filters?.courseId, filters?.departmentId, filters?.search]);

    useEffect(() => {
        load(1);
    }, [load]);

    const decide = async (
        item: ProjectSubmissionEnrollmentItem,
        decision: "approve" | "reject" | "cancel",
        notesOverride?: string,
        rethrowForDialog = false
    ) => {
        const requestId = item.request.request_id;
        const selectedCourseId = Number(selectedCourses[requestId]);
        const decisionNotes = notesOverride?.trim() || comments[requestId]?.trim() || "";
        if ((decision === "reject" || decision === "cancel") && !decisionNotes) {
            setError("Decision notes are required when rejecting or cancelling a request.");
            return;
        }
        if (
            decision === "approve" &&
            (!Number.isFinite(selectedCourseId) || selectedCourseId <= 0)
        ) {
            setError("Choose a staffed active course before approving.");
            return;
        }
        if (
            decision === "approve" &&
            item.request.to_course_fk &&
            Number(item.request.to_course_fk) !== selectedCourseId &&
            !decisionNotes
        ) {
            setError("Decision notes are required when approving a different enrollment course.");
            return;
        }
        setSavingId(requestId);
        setError(null);
        try {
            await decideProjectSubmissionEnrollmentRequest(requestId, {
                decision,
                target_course_id: decision === "approve" ? selectedCourseId : null,
                comments: decisionNotes || null,
            });
            await load(page);
        } catch (err) {
            console.error(err);
            const message = err instanceof Error ? err.message : "Could not save decision.";
            setError(message);
            if (rethrowForDialog) throw new Error(message);
        } finally {
            setSavingId(null);
        }
    };

    return (
        <section className="space-y-4">
            <SectionHeader
                title="Submission enrollment"
                description="Confirm a staffed course for students who cannot submit a capstone proposal with their current assignment."
            />

            <Notice tone="warning">
                WatMatch records the approved route. The matching Registrar or Quest update still happens outside WatMatch.
            </Notice>

            {error && (
                <Notice tone="danger" title="Decision not saved">{error}</Notice>
            )}

            {loading ? (
                <div className="space-y-3" aria-label="Loading enrollment requests">
                    {[0, 1].map((item) => (
                        <div key={item} className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white" />
                    ))}
                </div>
            ) : items.length === 0 ? (
                <EmptyState
                    title="Submission queue is clear"
                    description="No students currently need staff enrollment confirmation before proposing a project."
                />
            ) : visibleItems.length === 0 ? (
                <EmptyState
                    title="No matching requests"
                    description="Adjust the search, course, or department filters."
                />
            ) : (
                <div className="space-y-3">
                    {visibleItems.map((item) => {
                        const requestId = item.request.request_id;
                        const isFinalizationException =
                            item.request.request_source === "finalization_exception_proposal";
                        const hasFromCourse =
                            Boolean(item.request.from_course_fk || item.from_course);
                        const proposalTitle =
                            typeof item.request.proposal_payload?.title === "string"
                                ? item.request.proposal_payload.title
                                : null;
                        const selectedCourse = staffedCourses.find(
                            (course) => String(course.course_id) === selectedCourses[requestId]
                        );
                        const requestedAt = formatShortDateTime(item.request.created_at);
                        const busy = savingId === requestId;
                        return (
                            <article
                                key={requestId}
                                className="wm-panel overflow-hidden"
                            >
                                <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 md:flex-row md:items-start md:justify-between">
                                    <div className="min-w-0">
                                        <h3 className="font-semibold tracking-[-0.01em] text-slate-950">
                                            {item.student?.email || `Student #${item.request.student_fk}`}
                                        </h3>
                                        <p className="mt-1 text-sm text-slate-600">
                                            {isFinalizationException
                                                ? "Admin-created finalization exception proposal."
                                                : hasFromCourse
                                                  ? "Assigned course needs staff routing before proposal submission."
                                                  : "Needs a course before proposal submission."}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        <StatusBadge tone="warning">Pending</StatusBadge>
                                        {isFinalizationException && (
                                            <StatusBadge tone="accent">Finalization exception</StatusBadge>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4 px-4 py-4">
                                    {proposalTitle && (
                                        <div className="wm-subtle-panel px-3 py-2.5">
                                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Proposal</p>
                                            <p className="mt-1 text-sm font-medium text-slate-900">{proposalTitle}</p>
                                        </div>
                                    )}

                                    <CourseRouteSummary
                                        routes={[
                                            {
                                                label: "Current route",
                                                course: hasFromCourse
                                                    ? courseLabel(item.from_course)
                                                    : "No course assigned",
                                            },
                                            {
                                                label: isFinalizationException
                                                    ? "Default route"
                                                    : "Requested route",
                                                course: item.requested_course
                                                    ? courseLabel(item.requested_course)
                                                    : "No route requested",
                                            },
                                        ]}
                                    />

                                    <div className="grid gap-3 md:grid-cols-2">
                                        <div>
                                            <label htmlFor={`submission-enrollment-course-${requestId}`} className="mb-1.5 block text-xs font-medium text-slate-700">Approved enrollment course</label>
                                            <Select
                                                value={selectedCourses[requestId] || ""}
                                                onValueChange={(value) =>
                                                    setSelectedCourses((current) => ({
                                                        ...current,
                                                        [requestId]: value,
                                                    }))
                                                }
                                            >
                                                <SelectTrigger id={`submission-enrollment-course-${requestId}`}>
                                                    <SelectValue placeholder="Choose target course" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {staffedCourses.map((course) => (
                                                        <SelectItem key={course.course_id} value={String(course.course_id)}>
                                                            {courseLabel(course)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <label htmlFor={`submission-enrollment-notes-${requestId}`} className="mb-1.5 block text-xs font-medium text-slate-700">Decision notes</label>
                                            <Textarea
                                                id={`submission-enrollment-notes-${requestId}`}
                                                value={comments[requestId] || ""}
                                                onChange={(event) =>
                                                    setComments((current) => ({
                                                        ...current,
                                                        [requestId]: event.target.value,
                                                    }))
                                                }
                                                placeholder="Required for route changes, returns, or rejection"
                                                className="min-h-10"
                                            />
                                        </div>
                                    </div>

                                    <Disclosure summary="Request context and secondary actions">
                                        <dl className="grid gap-3 text-xs sm:grid-cols-3">
                                            <div>
                                                <dt className="text-slate-500">Home department</dt>
                                                <dd className="mt-0.5 font-medium text-slate-800">{item.student?.home_department || "Unassigned"}</dd>
                                            </div>
                                            <div>
                                                <dt className="text-slate-500">Requested by</dt>
                                                <dd className="mt-0.5 break-all font-medium text-slate-800">
                                                    {item.requested_by?.email || "Unknown"}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-slate-500">Requested</dt>
                                                <dd className="mt-0.5 font-medium text-slate-800">{requestedAt}</dd>
                                            </div>
                                        </dl>
                                        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                                            <ConfirmActionDialog
                                                title="Return this enrollment request?"
                                                description="The student will need to address the routing issue before their proposal can proceed."
                                                confirmLabel="Return request"
                                                reasonLabel="Return reason"
                                                reasonDescription="This explanation is saved with the routing decision and shown in the request history."
                                                reasonPlaceholder="Explain what the student or coordinator needs to change."
                                                reasonRequired
                                                initialReason={comments[requestId] || ""}
                                                onConfirm={(reason) => decide(item, "cancel", reason, true)}
                                                trigger={
                                                    <Button variant="outline" size="sm" disabled={busy}>
                                                        <RotateCcw /> Return request
                                                    </Button>
                                                }
                                            />
                                            <ConfirmActionDialog
                                                title="Reject this enrollment request?"
                                                description="This ends the pending routing request without assigning the student to the selected course."
                                                confirmLabel="Reject request"
                                                tone="destructive"
                                                reasonLabel="Rejection reason"
                                                reasonDescription="This explanation is saved with the routing decision and shown in the request history."
                                                reasonPlaceholder="Explain why this request cannot be approved."
                                                reasonRequired
                                                initialReason={comments[requestId] || ""}
                                                onConfirm={(reason) => decide(item, "reject", reason, true)}
                                                trigger={
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={busy}
                                                        className="text-red-700 hover:border-red-300 hover:bg-red-50 hover:text-red-800"
                                                    >
                                                        <UserMinus /> Reject request
                                                    </Button>
                                                }
                                            />
                                        </div>
                                    </Disclosure>

                                    <div className="flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                                        <p className="text-xs leading-5 text-slate-600">Approval confirms the selected route and returns the student to proposal submission.</p>
                                        <Button onClick={() => decide(item, "approve")} disabled={busy || !selectedCourse} className="sm:shrink-0">
                                            {busy ? <Loader2 className="animate-spin" /> : null}
                                            {busy ? "Saving..." : "Approve route"}
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
                onPrevious={() => load(Math.max(1, page - 1))}
                onNext={() => load(Math.min(totalPages, page + 1))}
                className="rounded-xl border border-slate-200 bg-white"
            />
        </section>
    );
}
