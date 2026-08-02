"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Disclosure, Notice, StatusBadge } from "@/components/ui/workspace";
import { fetchCourses, type Course } from "@/services/courses.service";
import { fetchMarketplaceSettings } from "@/services/marketplace.service";
import { fetchAdminUsers, type AdminUserEntry } from "@/services/users.service";
import {
    courseOptionLabel,
    filterStaffedActiveCourses,
} from "@/lib/course-options";

function courseLabel(course: Course) {
    return courseOptionLabel(course, { includeDepartment: true });
}

function normalizeMarketplacePhase(phase?: string | null) {
    const normalized = String(phase || "exploration").toLowerCase();
    if (normalized === "commitment") return "commitment";
    if (normalized === "finalization" || normalized === "locked") return "finalization";
    return "exploration";
}

function formatPhase(phase?: string | null) {
    const normalized = normalizeMarketplacePhase(phase);
    return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
}

export function AdminFinalizationOverrideSection() {
    const router = useRouter();
    const [students, setStudents] = useState<AdminUserEntry[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [phase, setPhase] = useState("");
    const [studentId, setStudentId] = useState("");
    const [courseId, setCourseId] = useState("");
    const [reason, setReason] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const staffedCourses = useMemo(
        () => filterStaffedActiveCourses(courses),
        [courses]
    );
    const finalizationCourses = useMemo(
        () =>
            staffedCourses.filter(
                (course) =>
                    normalizeMarketplacePhase(course.effective_marketplace_phase) ===
                    "finalization"
            ),
        [staffedCourses]
    );

    useEffect(() => {
        let isMounted = true;
        async function load() {
            setLoading(true);
            setError("");
            try {
                const [settings, userRows, courseRows] = await Promise.all([
                    fetchMarketplaceSettings(),
                    fetchAdminUsers(),
                    fetchCourses(true),
                ]);
                if (!isMounted) return;
                const activeStudents = userRows.filter(
                    (user) => user.role === "student" && user.active !== false
                );
                const activeStaffedCourses = filterStaffedActiveCourses(courseRows);
                const activeStaffedFinalizationCourses = activeStaffedCourses.filter(
                    (course) =>
                        normalizeMarketplacePhase(course.effective_marketplace_phase) ===
                        "finalization"
                );
                setPhase(String(settings.phase || "exploration").toLowerCase());
                setStudents(activeStudents);
                setCourses(courseRows);
                setStudentId((current) => current || String(activeStudents[0]?.user_id || ""));
                setCourseId((current) => current || String(activeStaffedFinalizationCourses[0]?.course_id || ""));
            } catch (err) {
                console.error(err);
                if (isMounted) {
                    setError(err instanceof Error ? err.message : "Could not load override options.");
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        }
        load();
        return () => {
            isMounted = false;
        };
    }, []);

    const canLaunch =
        Boolean(studentId) &&
        Boolean(courseId) &&
        finalizationCourses.some((course) => String(course.course_id) === courseId) &&
        reason.trim().length > 0;

    const launchOverrideForm = () => {
        if (!canLaunch) return;
        window.sessionStorage.setItem(
            "watmatchFinalizationOverride",
            JSON.stringify({
                targetStudentId: studentId,
                targetCourseId: courseId,
                reason: reason.trim(),
            })
        );
        const params = new URLSearchParams({
            finalizationOverride: "true",
            targetStudentId: studentId,
            targetCourseId: courseId,
        });
        router.push(`/project-form?${params.toString()}`);
    };

    return (
        <Disclosure
            summary={
                <span className="flex flex-wrap items-center gap-2">
                    <AlertTriangle className="size-4 text-amber-600" /> Exceptional finalization proposal
                    <StatusBadge tone="warning">Advanced</StatusBadge>
                </span>
            }
        >
            <div className="space-y-4">
                <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                        Finalization exception proposal
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                        Create a proposal for an active student when the selected staffed course is in effective finalization. The course becomes the default routing recommendation; staff still approve the course before the proposal becomes an official team submission.
                    </p>
                </div>

                {error && (
                    <Notice tone="danger">{error}</Notice>
                )}
                {finalizationCourses.length === 0 && !loading && (
                    <Notice tone="warning">
                        No staffed course is currently in effective finalization. Global phase: {formatPhase(phase)}.
                    </Notice>
                )}

                <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                        <label htmlFor="finalization-override-student" className="text-xs font-medium text-slate-700">Active student</label>
                        <Select value={studentId} onValueChange={setStudentId} disabled={loading}>
                            <SelectTrigger id="finalization-override-student"><SelectValue placeholder="Choose active student" /></SelectTrigger>
                            <SelectContent>{students.map((student) => <SelectItem key={student.user_id} value={String(student.user_id)}>{student.email}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="finalization-override-course" className="text-xs font-medium text-slate-700">Finalization course</label>
                        <Select value={courseId} onValueChange={setCourseId} disabled={loading}>
                            <SelectTrigger id="finalization-override-course"><SelectValue placeholder="Choose finalization course" /></SelectTrigger>
                            <SelectContent>{finalizationCourses.map((course) => <SelectItem key={course.course_id} value={String(course.course_id)}>{courseLabel(course)}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label htmlFor="finalization-override-reason" className="text-xs font-medium text-slate-700">Audit reason</label>
                    <Textarea id="finalization-override-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why this exception is required" className="min-h-20" />
                    <p className="text-xs text-slate-500">Required. This explanation is carried into the exceptional proposal flow.</p>
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs leading-5 text-slate-600">Opening the form does not finalize or route the project; staff approval remains required.</p>
                    <Button type="button" onClick={launchOverrideForm} disabled={!canLaunch}>
                        Open proposal form <ArrowRight />
                    </Button>
                </div>
            </div>
        </Disclosure>
    );
}
