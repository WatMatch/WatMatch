"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog, SectionHeader, StatusBadge } from "@/components/ui/workspace";
import {
    advanceCoursePhase,
    fetchCourses,
    type MarketplacePhase,
} from "@/services/courses.service";

const PHASE_LABEL: Record<MarketplacePhase, string> = {
    exploration: "Exploration",
    commitment: "Commitment",
    finalization: "Finalization",
};

const NEXT_PHASE: Partial<Record<MarketplacePhase, MarketplacePhase>> = {
    exploration: "commitment",
    commitment: "finalization",
};

export function InstructorCoursePhaseCard({ courseId }: { courseId: number }) {
    return <CoursePhaseControl key={courseId} courseId={courseId} />;
}

function CoursePhaseControl({ courseId }: { courseId: number }) {
    const [phase, setPhase] = useState<MarketplacePhase | null>(null);
    const [error, setError] = useState("");
    const [reload, setReload] = useState(0);
    const latestRead = useRef(0);

    useEffect(() => {
        let mounted = true;
        const refresh = async () => {
            const request = ++latestRead.current;
            try {
                const courses = await fetchCourses();
                if (!mounted || request !== latestRead.current) return;
                const course = courses.find((item) => item.course_id === courseId);
                setPhase(course?.active && course.instructor_phase_control && course.can_set_course_phase_override
                    ? course.effective_marketplace_phase ?? null : null);
            } catch {
                if (!mounted || request !== latestRead.current) return;
                setPhase(null);
                setError("Could not load the current course phase.");
            }
        };
        void refresh();
        window.addEventListener("focus", refresh);
        return () => {
            mounted = false;
            window.removeEventListener("focus", refresh);
        };
    }, [courseId, reload]);

    const retry = () => { setError(""); setReload((value) => value + 1); };
    const notice = error && <p role="alert" className="text-sm">{error} <Button variant="outline" size="sm" onClick={retry}>Refresh phase</Button></p>;
    if (!phase) return notice || null;
    const next = NEXT_PHASE[phase];

    return (
        <section className="space-y-3">
            <SectionHeader
                title="Course phase"
                description="Your course moves forward one phase at a time. Only an admin can move it back."
                actions={<StatusBadge tone="info">{PHASE_LABEL[phase]}</StatusBadge>}
            />
            {notice}
            {next ? (
                <ConfirmActionDialog
                    trigger={<Button>Advance to {PHASE_LABEL[next]}</Button>}
                    title={`Advance to ${PHASE_LABEL[next]}?`}
                    description="Students in this course will see the new phase immediately. Instructors cannot undo this."
                    confirmLabel={`Advance to ${PHASE_LABEL[next]}`}
                    onConfirm={async () => {
                        try {
                            const context = await advanceCoursePhase(courseId, phase);
                            ++latestRead.current;
                            setPhase(context.effective_phase);
                            setError("");
                        } catch (cause) {
                            setPhase(null);
                            setError(cause instanceof Error ? cause.message : "Could not advance the course phase.");
                            setReload((value) => value + 1);
                        }
                    }}
                />
            ) : null}
        </section>
    );
}
