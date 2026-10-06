"use client";

import { useEffect, useState } from "react";
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
    const [phase, setPhase] = useState<MarketplacePhase | null>(null);

    useEffect(() => {
        let mounted = true;
        fetchCourses()
            .then((courses) => {
                const course = courses.find((item) => item.course_id === courseId);
                if (
                    mounted &&
                    course?.instructor_phase_control &&
                    course.can_set_course_phase_override
                ) {
                    setPhase(course.effective_marketplace_phase ?? null);
                }
            })
            .catch((error) => console.error(error));
        return () => {
            mounted = false;
        };
    }, [courseId]);

    if (!phase) return null;
    const next = NEXT_PHASE[phase];

    return (
        <section className="space-y-3">
            <SectionHeader
                title="Course phase"
                description="Your course moves forward one phase at a time. Only an admin can move it back."
                actions={<StatusBadge tone="info">{PHASE_LABEL[phase]}</StatusBadge>}
            />
            {next ? (
                <ConfirmActionDialog
                    trigger={<Button>Advance to {PHASE_LABEL[next]}</Button>}
                    title={`Advance to ${PHASE_LABEL[next]}?`}
                    description="Students in this course will see the new phase immediately. Instructors cannot undo this."
                    confirmLabel={`Advance to ${PHASE_LABEL[next]}`}
                    onConfirm={async () => {
                        const context = await advanceCoursePhase(courseId, phase);
                        setPhase(context.effective_phase);
                    }}
                />
            ) : null}
        </section>
    );
}
