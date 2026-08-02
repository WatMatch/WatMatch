"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    decideCapstoneCloseout,
    fetchCapstonesNeedingCloseout,
    fetchMarketplaceReadiness,
    fetchMarketplaceSettings,
    resolveMarketplaceActivityForFinalization,
    updateMarketplaceSettings,
    type CapstoneCloseoutDecision,
    type CapstoneCloseoutSummary,
    type MarketplaceReadiness,
    type MarketplacePhase,
    type MarketplaceSettings,
} from "@/services/marketplace.service";
import { fetchCourses, type Course } from "@/services/courses.service";
import { buildTermOptions, withExistingTerm } from "@/lib/term-options";
import { Textarea } from "@/components/ui/textarea";
import { userContext } from "@/contexts/UserContext";
import {
    ConfirmActionDialog,
    Disclosure,
    EmptyState,
    Notice,
    SectionHeader,
    StatusBadge,
} from "@/components/ui/workspace";

const marketplaceTermOptions = buildTermOptions();
const currentCalendarTerm = (() => {
    const now = new Date();
    const month = now.getMonth();
    const season = month < 4 ? "Winter" : month < 8 ? "Spring" : "Fall";
    return `${season} ${now.getFullYear()}`;
})();
const defaultMarketplaceTerm = marketplaceTermOptions.includes(currentCalendarTerm)
    ? currentCalendarTerm
    : marketplaceTermOptions[0] || currentCalendarTerm;
const isMarketplaceTerm = (value: string) => marketplaceTermOptions.includes(value);
const seasonFromTerm = (value: string) => value.split(" ")[0] || "";
const normalizePhase = (value?: string | null): MarketplacePhase =>
    ((value || "exploration") as MarketplacePhase);

const phases: Array<{ value: MarketplacePhase; label: string; description: string }> = [
    {
        value: "exploration",
        label: "Exploration",
        description: "Students can save projects, express interest, receive invites, and explore many options.",
    },
    {
        value: "commitment",
        label: "Commitment",
        description: "Students and teams narrow to one project and create routing requests.",
    },
    {
        value: "finalization",
        label: "Finalization",
        description: "New marketplace activity is closed while instructors and admins finalize official teams.",
    },
];

const marketplacePhaseLabel = (value?: string | null) =>
    phases.find((phase) => phase.value === value)?.label || "Global phase";

const workflowLabel = (value?: string | null, fallback = "Unknown") => {
    const normalized = String(value || "").trim().replace(/_/g, " ");
    return normalized
        ? `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`
        : fallback;
};

const closeoutOptions: Array<{ value: CapstoneCloseoutDecision; label: string; description: string }> = [
    {
        value: "continue_to_course",
        label: "Continue to course",
        description: "Carry this project into the next term and route the whole team to instructor review.",
    },
    {
        value: "publish_completed",
        label: "Publish completed",
        description: "Move it into WatMatch completed capstones and archive the live project.",
    },
    {
        value: "carry_over_read_only",
        label: "Carry over read-only",
        description: "Keep it visible for browsing or mentor support, but close student marketplace activity.",
    },
    {
        value: "archive",
        label: "Archive",
        description: "Close the live project without publishing a past-capstone record.",
    },
    {
        value: "clear_decision",
        label: "Clear decision",
        description: "Remove the saved closeout decision and return this project to closeout review.",
    },
];

const blockerLabels: Record<keyof MarketplaceReadiness["counts"], string> = {
    pending_capstone_reviews: "Pending capstone reviews",
    pending_commitments: "Pending commitment routing",
    pending_enrollment_requests: "Pending enrollment/course requests",
    support_gaps: "Mentor or external partner support gaps",
    closeout_required: "Live capstones needing closeout",
    invalid_pending_continuations: "Invalid pending continuations",
    unresolved_marketplace_activity: "Unresolved marketplace activity",
    invalid_member_enrollments: "Invalid member enrollment courses",
    phase_overrides: "Course/ecosystem phase overrides",
};

type CloseoutDraft = {
    decision: CapstoneCloseoutDecision;
    targetCourseId: string;
    targetTerm: string;
    memberEnrollmentRoutes: Record<string, string>;
    notes: string;
};

export function MarketplaceSettingsSection({ canEdit = false }: { canEdit?: boolean }) {
    const { user } = userContext();
    const [settings, setSettings] = useState<MarketplaceSettings | null>(null);
    const [currentTerm, setCurrentTerm] = useState(defaultMarketplaceTerm);
    const [phase, setPhase] = useState<MarketplacePhase>("exploration");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [readinessLoading, setReadinessLoading] = useState(false);
    const [closeoutSavingId, setCloseoutSavingId] = useState<number | null>(null);
    const [message, setMessage] = useState("");
    const [courses, setCourses] = useState<Course[]>([]);
    const [readiness, setReadiness] = useState<MarketplaceReadiness | null>(null);
    const [carriedOverCapstones, setCarriedOverCapstones] = useState<CapstoneCloseoutSummary[]>([]);
    const [closeoutDrafts, setCloseoutDrafts] = useState<Record<number, CloseoutDraft>>({});
    const [acknowledgedTransition, setAcknowledgedTransition] = useState(false);
    const [overrideReason, setOverrideReason] = useState("");
    const [resolvingActivityKey, setResolvingActivityKey] = useState<string | null>(null);
    const [activityResolutionReason, setActivityResolutionReason] = useState("");
    const [cycleEditorOpen, setCycleEditorOpen] = useState(false);
    const settingsLoadRequestIdRef = useRef(0);
    const readinessLoadRequestIdRef = useRef(0);

    const load = useCallback(async () => {
        const requestId = settingsLoadRequestIdRef.current + 1;
        settingsLoadRequestIdRef.current = requestId;
        setLoading(true);
        setMessage("");
        try {
            const [next, courseRows] = await Promise.all([
                fetchMarketplaceSettings(),
                fetchCourses(false),
            ]);
            if (settingsLoadRequestIdRef.current !== requestId) return;
            const loadedTerm = next.current_term || defaultMarketplaceTerm;
            setSettings(next);
            setCourses(courseRows);
            setCurrentTerm(isMarketplaceTerm(loadedTerm) ? loadedTerm : defaultMarketplaceTerm);
            setPhase(normalizePhase(next.phase));
            setAcknowledgedTransition(false);
            setOverrideReason("");
        } catch (error) {
            if (settingsLoadRequestIdRef.current !== requestId) return;
            console.error(error);
            setMessage(error instanceof Error ? error.message : "Could not load marketplace settings.");
        } finally {
            if (settingsLoadRequestIdRef.current === requestId) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const loadReadiness = useCallback(
        async (term: string, nextPhase: MarketplacePhase) => {
            if (!canEdit) {
                return;
            }
            const requestId = readinessLoadRequestIdRef.current + 1;
            readinessLoadRequestIdRef.current = requestId;
            setReadinessLoading(true);
            setReadiness(null);
            try {
                const [next, closeoutRowsForManagement] = await Promise.all([
                    fetchMarketplaceReadiness({
                        current_term: term,
                        phase: nextPhase,
                    }),
                    fetchCapstonesNeedingCloseout({ include_carried_over: true }),
                ]);
                if (readinessLoadRequestIdRef.current !== requestId) return;
                setReadiness(next);
                const managedRows = closeoutRowsForManagement.filter(
                    (capstone) => Boolean(capstone.closeout_decision) && Boolean(capstone.carry_over_read_only)
                );
                setCarriedOverCapstones(managedRows);
                const closeoutRows = next.blockers?.closeout_required || [];
                const invalidContinuationRows = next.blockers?.invalid_pending_continuations || [];
                const rowsToDraft = [...closeoutRows, ...invalidContinuationRows, ...managedRows];
                if (rowsToDraft.length) {
                    setCloseoutDrafts((previous) => {
                        const updated = { ...previous };
                        rowsToDraft.forEach((capstone) => {
                            if (!updated[capstone.capstone_id]) {
                                updated[capstone.capstone_id] = {
                                    decision:
                                        capstone.closeout_decision ||
                                        ((capstone.status || "").toLowerCase() === "complete"
                                            ? "publish_completed"
                                            : "carry_over_read_only"),
                                    targetCourseId: capstone.continued_to_course_fk
                                        ? String(capstone.continued_to_course_fk)
                                        : "",
                                    targetTerm: capstone.continued_to_term || term,
                                    memberEnrollmentRoutes: Object.fromEntries(
                                        Object.entries(capstone.continued_member_enrollment_routes || {}).map(
                                            ([studentId, courseId]) => [studentId, String(courseId)]
                                        )
                                    ),
                                    notes: capstone.closeout_notes || "",
                                };
                            }
                        });
                        return updated;
                    });
                }
            } catch (error) {
                if (readinessLoadRequestIdRef.current !== requestId) return;
                console.error(error);
                setReadiness(null);
                setCarriedOverCapstones([]);
            } finally {
                if (readinessLoadRequestIdRef.current === requestId) {
                    setReadinessLoading(false);
                }
            }
        },
        [canEdit]
    );

    useEffect(() => {
        if (!loading && canEdit) {
            loadReadiness(currentTerm, phase);
        }
    }, [canEdit, currentTerm, phase, loadReadiness, loading]);

    const save = async () => {
        const savedPhase = normalizePhase(settings?.phase);
        const hasTransition =
            Boolean(settings) &&
            (currentTerm !== settings?.current_term || phase !== savedPhase);
        if (hasTransition && !acknowledgedTransition) {
            setMessage("Review and acknowledge the marketplace transition before saving.");
            return;
        }
        if (hasTransition && transitionReadinessPending) {
            setMessage("Wait for the transition readiness check to finish before saving.");
            return;
        }
        if (hasTransition && transitionRequiresOverride && !overrideReason.trim()) {
            setMessage("Provide an override reason for this non-standard marketplace transition.");
            return;
        }
        setSaving(true);
        setMessage("");
        try {
            const next = await updateMarketplaceSettings({
                ...(settings || {}),
                current_term: currentTerm || defaultMarketplaceTerm,
                phase,
                override_reason:
                    hasTransition && transitionRequiresOverride ? overrideReason.trim() : null,
            });
            const loadedTerm = next.current_term || defaultMarketplaceTerm;
            setSettings(next);
            setCurrentTerm(isMarketplaceTerm(loadedTerm) ? loadedTerm : defaultMarketplaceTerm);
            setPhase(normalizePhase(next.phase));
            setAcknowledgedTransition(false);
            setOverrideReason("");
            await load();
            setMessage("Marketplace settings saved.");
            setCycleEditorOpen(false);
        } catch (error) {
            console.error(error);
            setMessage(error instanceof Error ? error.message : "Could not save marketplace settings.");
        } finally {
            setSaving(false);
        }
    };

    const selectedPhase = phases.find((item) => item.value === phase);
    const savedPhase = normalizePhase(settings?.phase);
    const hasTransition =
        Boolean(settings) &&
        (currentTerm !== settings?.current_term || phase !== savedPhase);
    const isNormalTransition =
        !settings ||
        !hasTransition ||
        (currentTerm !== settings.current_term
            ? savedPhase === "finalization" && phase === "exploration"
            : (savedPhase === "exploration" && phase === "commitment") ||
              (savedPhase === "commitment" && phase === "finalization"));
    const transitionRequiresOverride = hasTransition && !isNormalTransition;
    const readinessMatchesSelection =
        readiness?.target_term === currentTerm &&
        normalizePhase(readiness?.target_phase) === phase;
    const transitionReadinessPending =
        Boolean(hasTransition) && (readinessLoading || !readinessMatchesSelection);
    const transitionHasBlockers = Boolean(
        hasTransition && readinessMatchesSelection && readiness?.has_blockers
    );
    const transitionHasAttention = Boolean(
        hasTransition &&
            readinessMatchesSelection &&
            (readiness?.has_attention_items ?? readiness?.has_blockers)
    );
    const courseById = new Map(courses.map((course) => [course.course_id, course]));
    const courseCanContinueInTerm = (course: Course, term: string) => {
        const targetSeason = seasonFromTerm(term);
        return (
            course.activation_mode !== "force_inactive" &&
            (course.active_instructor_count || 0) > 0 &&
            (course.activation_mode === "force_active" ||
                (course.active_terms || []).includes(targetSeason))
        );
    };
    const nextEligibleTermForCourse = (course: Course, preferredTerm: string) => {
        const indexedTerms = withExistingTerm(marketplaceTermOptions, preferredTerm);
        const startIndex = Math.max(0, indexedTerms.indexOf(preferredTerm));
        return (
            indexedTerms
                .slice(startIndex)
                .find((term) => courseCanContinueInTerm(course, term)) ||
            indexedTerms.find((term) => courseCanContinueInTerm(course, term)) ||
            preferredTerm
        );
    };
    const continuationCoursesForTerm = (term: string) =>
        courses.filter((course) => courseCanContinueInTerm(course, term));
    const pipelineEdgesForCapstone = (capstone: CapstoneCloseoutSummary) =>
        capstone.course_fk
            ? (courseById.get(Number(capstone.course_fk))?.pipeline_next_courses || []).filter(
                  (edge) => edge.active !== false
              )
            : [];
    const defaultContinuationTerm = (capstone: CapstoneCloseoutSummary) => {
        if (capstone.continued_to_term) {
            return capstone.continued_to_term;
        }
        const pipelineEdges = pipelineEdgesForCapstone(capstone);
        const defaultEdge = pipelineEdges.find((edge) => edge.is_default === true);
        const defaultCourse = defaultEdge
            ? courseById.get(Number(defaultEdge.to_course_fk))
            : null;
        if (defaultCourse) {
            return nextEligibleTermForCourse(defaultCourse, currentTerm);
        }
        const fallbackCourse = pipelineEdges
            .map((edge) => courseById.get(Number(edge.to_course_fk)))
            .find((course): course is Course => Boolean(course));
        return fallbackCourse ? nextEligibleTermForCourse(fallbackCourse, currentTerm) : currentTerm;
    };
    const defaultContinuationCourseId = (
        capstone: CapstoneCloseoutSummary,
        targetTerm = defaultContinuationTerm(capstone)
    ) => {
        if (capstone.continued_to_course_fk) {
            return String(capstone.continued_to_course_fk);
        }
        const pipelineEdges = pipelineEdgesForCapstone(capstone);
        const defaultEdge = pipelineEdges.find((edge) => edge.is_default === true);
        const eligibleDefault = defaultEdge
            ? courseById.get(Number(defaultEdge.to_course_fk))
            : null;
        if (eligibleDefault && courseCanContinueInTerm(eligibleDefault, targetTerm)) {
            return String(eligibleDefault.course_id);
        }
        const fallbackEdge = pipelineEdges.find((edge) => {
            const course = courseById.get(Number(edge.to_course_fk));
            return course ? courseCanContinueInTerm(course, targetTerm) : false;
        });
        return fallbackEdge ? String(fallbackEdge.to_course_fk) : "";
    };
    const continuationCourseOptions = (capstone: CapstoneCloseoutSummary, targetTerm: string) => {
        const pipelineEdges = pipelineEdgesForCapstone(capstone);
        const pipelineCourseIds = pipelineEdges
            .map((edge) => Number(edge.to_course_fk))
            .filter((courseId) => Number.isFinite(courseId));
        const continuationCourses = continuationCoursesForTerm(targetTerm);
        const orderedIds = [
            ...pipelineCourseIds,
            ...continuationCourses.map((course) => course.course_id),
        ];
        return Array.from(new Set(orderedIds))
            .map((courseId) => continuationCourses.find((course) => course.course_id === courseId))
            .filter((course): course is Course => Boolean(course));
    };
    const memberSourceCourseId = (
        member: NonNullable<CapstoneCloseoutSummary["members"]>[number]
    ) => member.enrollment_course_fk || member.course_fk || null;
    const memberPipelineCourseIds = (
        member: NonNullable<CapstoneCloseoutSummary["members"]>[number],
        targetTerm: string,
        fallbackTargetCourseId?: string
    ) => {
        const sourceCourse = memberSourceCourseId(member)
            ? courseById.get(Number(memberSourceCourseId(member)))
            : null;
        const pipelineIds = (sourceCourse?.pipeline_next_courses || [])
            .filter((edge) => edge.active !== false)
            .map((edge) => Number(edge.to_course_fk))
            .filter((courseId) => {
                const course = courseById.get(courseId);
                return course ? courseCanContinueInTerm(course, targetTerm) : false;
            });
        const currentCourseId = sourceCourse && courseCanContinueInTerm(sourceCourse, targetTerm)
            ? sourceCourse.course_id
            : null;
        const targetCourseId = fallbackTargetCourseId ? Number(fallbackTargetCourseId) : null;
        const targetCourse = targetCourseId ? courseById.get(targetCourseId) : null;
        return Array.from(new Set([
            ...pipelineIds,
            ...(currentCourseId ? [currentCourseId] : []),
            ...(targetCourse && courseCanContinueInTerm(targetCourse, targetTerm)
                ? [targetCourse.course_id]
                : []),
        ]));
    };
    const memberEnrollmentCourseOptions = (
        member: NonNullable<CapstoneCloseoutSummary["members"]>[number],
        targetTerm: string,
        fallbackTargetCourseId?: string
    ) => {
        const continuationCourses = continuationCoursesForTerm(targetTerm);
        const preferredIds = memberPipelineCourseIds(member, targetTerm, fallbackTargetCourseId);
        const orderedIds = [
            ...preferredIds,
            ...continuationCourses.map((course) => course.course_id),
        ];
        return Array.from(new Set(orderedIds))
            .map((courseId) => continuationCourses.find((course) => course.course_id === courseId))
            .filter((course): course is Course => Boolean(course));
    };
    const defaultMemberEnrollmentCourseId = (
        member: NonNullable<CapstoneCloseoutSummary["members"]>[number],
        targetTerm: string,
        fallbackTargetCourseId?: string
    ) => {
        const sourceCourse = memberSourceCourseId(member)
            ? courseById.get(Number(memberSourceCourseId(member)))
            : null;
        const defaultPipelineEdge = (sourceCourse?.pipeline_next_courses || [])
            .filter((edge) => edge.active !== false)
            .sort((a, b) => Number(b.is_default === true) - Number(a.is_default === true))
            .find((edge) => {
                const course = courseById.get(Number(edge.to_course_fk));
                return course ? courseCanContinueInTerm(course, targetTerm) : false;
            });
        if (defaultPipelineEdge) {
            return String(defaultPipelineEdge.to_course_fk);
        }
        return memberEnrollmentCourseOptions(member, targetTerm, fallbackTargetCourseId)[0]?.course_id
            ? String(memberEnrollmentCourseOptions(member, targetTerm, fallbackTargetCourseId)[0].course_id)
            : "";
    };
    const memberRouteValue = (
        member: NonNullable<CapstoneCloseoutSummary["members"]>[number],
        draft: CloseoutDraft,
        targetTerm: string,
        targetCourseId?: string
    ) => {
        const studentId = member.user_id ? String(member.user_id) : "";
        const selected = studentId ? draft.memberEnrollmentRoutes[studentId] : "";
        const options = memberEnrollmentCourseOptions(member, targetTerm, targetCourseId);
        if (selected && options.some((course) => String(course.course_id) === selected)) {
            return selected;
        }
        return defaultMemberEnrollmentCourseId(member, targetTerm, targetCourseId);
    };
    const pipelineLabelForCourse = (capstone: CapstoneCloseoutSummary, courseId: number) => {
        const edge = pipelineEdgesForCapstone(capstone).find(
            (pipelineEdge) => Number(pipelineEdge.to_course_fk) === Number(courseId)
        );
        if (!edge) return "";
        return edge.is_default ? " (recommended)" : " (pipeline option)";
    };
    const formatStatusCounts = (counts?: Record<string, number> | null) => {
        const entries = Object.entries(counts || {}).filter(([, count]) => Number(count) > 0);
        return entries.length
            ? entries
                  .map(([status, count]) => `${workflowLabel(status)}: ${count}`)
                  .join(", ")
            : "No active relationships";
    };
    const activationPreview = readiness?.course_activation_preview;
    const activationCounts = activationPreview?.counts;
    const transitionSteps = [
        {
            label: "Target cycle",
            value: `${settings?.current_term || "Unset"} / ${marketplacePhaseLabel(savedPhase)} → ${currentTerm} / ${marketplacePhaseLabel(phase)}`,
            state: hasTransition ? "active" : "idle",
        },
        {
            label: "Readiness",
            value: readinessLoading
                ? "Checking"
                : hasTransition && !readinessMatchesSelection
                ? "Needs preflight"
                : transitionHasBlockers
                ? "Blocked"
                : transitionHasAttention
                ? "Attention"
                : hasTransition
                ? "Ready"
                : "No transition",
            state: transitionHasBlockers
                ? "blocked"
                : hasTransition && readinessMatchesSelection
                ? "ready"
                : "idle",
        },
        {
            label: "Resolve work",
            value:
                (readiness?.counts?.closeout_required || 0) +
                    (readiness?.counts?.invalid_pending_continuations || 0) >
                0
                    ? "Needs decisions"
                    : "Clear",
            state:
                (readiness?.counts?.closeout_required || 0) +
                    (readiness?.counts?.invalid_pending_continuations || 0) >
                0
                    ? "blocked"
                    : "ready",
        },
        {
            label: "Course activation",
            value: activationCounts
                ? `${activationCounts.will_activate} activate, ${activationCounts.will_deactivate} deactivate`
                : "Preview unavailable",
            state: (activationCounts?.blocked_missing_instructor || 0) > 0 ? "blocked" : "ready",
        },
    ];
    const closeoutRequiredRows = readiness?.blockers?.closeout_required || [];
    const invalidContinuationRows = readiness?.blockers?.invalid_pending_continuations || [];
    const unresolvedActivityRows = readiness?.blockers?.unresolved_marketplace_activity || [];
    const phaseOverrideRows = readiness?.blockers?.phase_overrides || [];
    const closeoutDecisionCount = closeoutRequiredRows.length + invalidContinuationRows.length;
    const readinessAttentionTotal = Object.entries(readiness?.counts || {}).reduce(
        (total, [key, value]) =>
            key === "phase_overrides" ? total : total + Math.max(0, Number(value) || 0),
        0
    );
    const activationBlockCount = activationCounts?.blocked_missing_instructor || 0;
    let nextTaskTone: "neutral" | "info" | "warning" | "success" = "neutral";
    let nextTaskTitle = "Marketplace state is available";
    let nextTaskDetail = "Review the current cycle and phase before coordinating the next staff transition.";
    if (!canEdit) {
        nextTaskTitle = "Marketplace settings are view-only";
        nextTaskDetail = "An enrollment operator or admin can change the active term and phase.";
    } else if (readinessLoading) {
        nextTaskTone = "info";
        nextTaskTitle = "Checking operational readiness";
        nextTaskDetail = "WatMatch is loading routing, support, closeout, and course-activation context.";
    } else if (!readiness) {
        nextTaskTone = "warning";
        nextTaskTitle = "Readiness could not be confirmed";
        nextTaskDetail = "Refresh this workspace before attempting a marketplace transition.";
    } else if (closeoutDecisionCount > 0) {
        nextTaskTone = "warning";
        nextTaskTitle = `${closeoutDecisionCount} closeout ${closeoutDecisionCount === 1 ? "decision needs" : "decisions need"} attention`;
        nextTaskDetail = "Resolve the project closeout queue before entering finalization or moving to a new term.";
    } else if (unresolvedActivityRows.length > 0) {
        nextTaskTone = "warning";
        nextTaskTitle = "Marketplace relationships need resolution";
        nextTaskDetail = "Resolve broad exploration activity with an audit reason before finalization begins.";
    } else if (readinessAttentionTotal > 0 || activationBlockCount > 0) {
        nextTaskTone = "info";
        nextTaskTitle = "Review readiness work before the next transition";
        nextTaskDetail = [
            readinessAttentionTotal > 0
                ? `${readinessAttentionTotal} operational ${readinessAttentionTotal === 1 ? "item is" : "items are"} visible.`
                : null,
            activationBlockCount > 0
                ? `${activationBlockCount} course activation ${activationBlockCount === 1 ? "gap also needs" : "gaps also need"} attention.`
                : null,
        ]
            .filter(Boolean)
            .join(" ");
    } else {
        nextTaskTone = "success";
        nextTaskTitle = "No readiness work is currently visible";
        nextTaskDetail = `Keep ${marketplacePhaseLabel(savedPhase).toLowerCase()} active until staff are ready to advance the cycle.`;
    }

    const restoreSavedCycle = () => {
        const loadedTerm = settings?.current_term || defaultMarketplaceTerm;
        setCurrentTerm(isMarketplaceTerm(loadedTerm) ? loadedTerm : defaultMarketplaceTerm);
        setPhase(normalizePhase(settings?.phase));
        setAcknowledgedTransition(false);
        setOverrideReason("");
    };

    const openCycleEditor = () => {
        restoreSavedCycle();
        setMessage("");
        setCycleEditorOpen(true);
    };

    const closeCycleEditor = () => {
        restoreSavedCycle();
        setMessage("");
        setCycleEditorOpen(false);
    };

    const updateCloseoutDraft = (capstoneId: number, patch: Partial<CloseoutDraft>) => {
        setCloseoutDrafts((previous) => ({
            ...previous,
            [capstoneId]: {
                ...(previous[capstoneId] || {
                    decision: "carry_over_read_only",
                    targetCourseId: "",
                    targetTerm: currentTerm,
                    memberEnrollmentRoutes: {},
                    notes: "",
                }),
                ...patch,
            },
        }));
    };

    const isCompleteCapstone = (capstone: CapstoneCloseoutSummary) =>
        (capstone.status || "").toLowerCase() === "complete";
    const isAdminUser = (user?.role || "").toLowerCase() === "admin";

    const canClearCloseoutDecision = (capstone: CapstoneCloseoutSummary) =>
        Boolean(
            capstone.closeout_decision ||
                capstone.carry_over_read_only ||
                capstone.continued_to_course_fk ||
                capstone.continued_to_term
        ) &&
        !capstone.published_past_capstone_fk &&
        !capstone.published_watmatch_past_capstone_fk &&
        capstone.closeout_decision !== "publish_completed" &&
        capstone.closeout_decision !== "archive";

    const availableCloseoutOptions = (capstone: CapstoneCloseoutSummary) =>
        closeoutOptions.filter((option) => {
            if (option.value === "clear_decision") {
                return canClearCloseoutDecision(capstone);
            }
            if (!isAdminUser && (option.value === "publish_completed" || option.value === "archive")) {
                return false;
            }
            return isCompleteCapstone(capstone)
                ? option.value === "publish_completed" || option.value === "archive"
                : option.value !== "publish_completed";
        });

    const defaultCloseoutDecision = (capstone: CapstoneCloseoutSummary): CapstoneCloseoutDecision =>
        availableCloseoutOptions(capstone)[0]?.value || "carry_over_read_only";

    const applyCloseout = async (
        capstone: CapstoneCloseoutSummary,
        rethrowForDialog = false
    ) => {
        const defaultTargetTerm = defaultContinuationTerm(capstone);
        const draft = closeoutDrafts[capstone.capstone_id] || {
            decision: defaultCloseoutDecision(capstone),
            targetCourseId: defaultContinuationCourseId(capstone, defaultTargetTerm),
            targetTerm: defaultTargetTerm,
            memberEnrollmentRoutes: Object.fromEntries(
                Object.entries(capstone.continued_member_enrollment_routes || {}).map(
                    ([studentId, courseId]) => [studentId, String(courseId)]
                )
            ),
            notes: "",
        };
        const targetTerm = draft.targetTerm || defaultTargetTerm;
        const targetCourseId =
            draft.targetCourseId || defaultContinuationCourseId(capstone, targetTerm);
        if (draft.decision === "publish_completed" && !isCompleteCapstone(capstone)) {
            setMessage("Mark this capstone complete before publishing it to WatMatch completed capstones.");
            return;
        }
        if (
            isCompleteCapstone(capstone) &&
            (draft.decision === "continue_to_course" || draft.decision === "carry_over_read_only")
        ) {
            setMessage("Completed capstones can only be published or archived.");
            return;
        }
        if (draft.decision === "continue_to_course" && !targetCourseId) {
            setMessage("Choose the continuation course before saving this closeout decision.");
            return;
        }
        if (draft.decision === "continue_to_course" && !targetTerm) {
            setMessage("Choose the continuation term before saving this closeout decision.");
            return;
        }
        if (
            draft.decision === "continue_to_course" &&
            !continuationCourseOptions(capstone, targetTerm).some(
                (course) => String(course.course_id) === String(targetCourseId)
            )
        ) {
            setMessage("Choose a staffed continuation course that is available in the selected term.");
            return;
        }
        const memberRoutes: Record<string, number> = {};
        let enrollmentChanged = false;
        if (draft.decision === "continue_to_course") {
            const members = capstone.members || [];
            if (members.length === 0) {
                setMessage("Continuation requires at least one official team member.");
                return;
            }
            for (const member of members) {
                if (!member.user_id) {
                    setMessage("Every continuing team member must have a student ID.");
                    return;
                }
                const value = memberRouteValue(member, draft, targetTerm, targetCourseId);
                const routeCourseId = Number(value);
                const options = memberEnrollmentCourseOptions(member, targetTerm, targetCourseId);
                if (
                    !Number.isFinite(routeCourseId) ||
                    routeCourseId <= 0 ||
                    !options.some((course) => course.course_id === routeCourseId)
                ) {
                    setMessage(
                        `Choose a staffed continuation enrollment course for ${member.email || `student #${member.user_id}`}.`
                    );
                    return;
                }
                memberRoutes[String(member.user_id)] = routeCourseId;
                const currentCourseId = member.enrollment_course_fk || member.course_fk;
                if (currentCourseId && Number(currentCourseId) !== routeCourseId) {
                    enrollmentChanged = true;
                }
            }
        }
        if (
            draft.decision === "continue_to_course" &&
            enrollmentChanged &&
            !draft.notes.trim()
        ) {
            setMessage("Decision notes are required when continuation changes a student's enrollment course.");
            return;
        }
        if (!draft.notes.trim()) {
            setMessage("Decision notes are required before saving a closeout decision.");
            return;
        }
        setCloseoutSavingId(capstone.capstone_id);
        setMessage("");
        try {
            await decideCapstoneCloseout(capstone.capstone_id, {
                decision: draft.decision,
                target_course_id:
                    draft.decision === "continue_to_course"
                        ? Number(targetCourseId)
                        : null,
                notes: draft.notes.trim(),
                target_term:
                    draft.decision === "continue_to_course"
                        ? targetTerm
                        : null,
                member_enrollment_routes:
                    draft.decision === "continue_to_course" ? memberRoutes : null,
            });
            setMessage(
                draft.decision === "clear_decision"
                    ? "Closeout decision cleared."
                    : "Closeout decision saved."
            );
            await loadReadiness(currentTerm, phase);
        } catch (error) {
            console.error(error);
            const errorMessage = error instanceof Error ? error.message : "Could not save closeout decision.";
            setMessage(errorMessage);
            if (rethrowForDialog) throw new Error(errorMessage);
        } finally {
            setCloseoutSavingId(null);
        }
    };

    const resolveMarketplaceActivity = async (
        capstoneId?: number,
        reasonOverride?: string,
        rethrowForDialog = false
    ) => {
        const key = capstoneId ? `capstone-${capstoneId}` : "all";
        const trimmedReason = reasonOverride?.trim() || activityResolutionReason.trim();
        if (!trimmedReason) {
            setMessage("Marketplace activity resolution requires an audit reason.");
            return;
        }
        setResolvingActivityKey(key);
        setMessage("");
        try {
            const result = await resolveMarketplaceActivityForFinalization({
                capstone_id: capstoneId ?? null,
                reason: trimmedReason,
            });
            setMessage(
                `Resolved ${result.resolved_count ?? 0} marketplace relationship${
                    (result.resolved_count ?? 0) === 1 ? "" : "s"
                }.`
            );
            setActivityResolutionReason("");
            await loadReadiness(currentTerm, phase);
        } catch (error) {
            console.error(error);
            const errorMessage = error instanceof Error ? error.message : "Could not resolve marketplace activity.";
            setMessage(errorMessage);
            if (rethrowForDialog) throw new Error(errorMessage);
        } finally {
            setResolvingActivityKey(null);
        }
    };

    const renderCloseoutCard = (capstone: CapstoneCloseoutSummary, contextLabel?: string) => {
        const options = availableCloseoutOptions(capstone);
        const defaultTargetTerm = defaultContinuationTerm(capstone);
        const rawDraft = closeoutDrafts[capstone.capstone_id] || {
            decision: (capstone.closeout_decision || defaultCloseoutDecision(capstone)) as CapstoneCloseoutDecision,
            targetCourseId: defaultContinuationCourseId(capstone, defaultTargetTerm),
            targetTerm: defaultTargetTerm,
            memberEnrollmentRoutes: Object.fromEntries(
                Object.entries(capstone.continued_member_enrollment_routes || {}).map(
                    ([studentId, courseId]) => [studentId, String(courseId)]
                )
            ),
            notes: capstone.closeout_notes || "",
        };
        let draft = options.some((option) => option.value === rawDraft.decision)
            ? rawDraft
            : {
                  ...rawDraft,
                  decision: defaultCloseoutDecision(capstone),
                  targetTerm: rawDraft.targetTerm || defaultTargetTerm,
                  targetCourseId:
                      rawDraft.targetCourseId ||
                      defaultContinuationCourseId(capstone, rawDraft.targetTerm || defaultTargetTerm),
                  memberEnrollmentRoutes: rawDraft.memberEnrollmentRoutes || {},
              };
        const draftTargetTerm = draft.targetTerm || defaultTargetTerm;
        if (draft.decision === "continue_to_course" && !draft.targetCourseId) {
            draft = {
                ...draft,
                targetTerm: draftTargetTerm,
                targetCourseId: defaultContinuationCourseId(capstone, draftTargetTerm),
            };
        }
        const selectedDecision = options.find((option) => option.value === draft.decision);
        const courseOptions = continuationCourseOptions(capstone, draftTargetTerm);
        const termOptions = withExistingTerm(marketplaceTermOptions, draftTargetTerm || currentTerm);
        const selectedTargetCourse = courseOptions.find(
            (course) => String(course.course_id) === String(draft.targetCourseId)
        );

        return (
            <Disclosure
                key={capstone.capstone_id}
                className="bg-white"
                summaryClassName="[&::after]:hidden"
                contentClassName="space-y-3 bg-slate-50/50"
                summary={
                    <span className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="min-w-0">
                            <span className="block break-words font-medium text-slate-950">
                                {capstone.title || "Untitled capstone"}
                            </span>
                            <span className="mt-0.5 block text-xs font-normal text-slate-500">
                                {workflowLabel(capstone.status, "Unknown status")}
                                {capstone.team_status ? ` · Team ${workflowLabel(capstone.team_status)}` : " · No team"}
                                {capstone.continued_to_term ? ` · Target ${capstone.continued_to_term}` : ""}
                                {capstone.completed_term ? ` · Completed ${capstone.completed_term}` : ""}
                            </span>
                        </span>
                        <span className="flex shrink-0 flex-wrap gap-1.5">
                            {contextLabel && (
                                <StatusBadge tone={capstone.invalid_reason ? "danger" : "warning"}>
                                    {contextLabel}
                                </StatusBadge>
                            )}
                            <StatusBadge tone="neutral">{capstone.members?.length || 0} members</StatusBadge>
                        </span>
                    </span>
                }
            >
                {capstone.invalid_reason && (
                    <Notice tone="danger" title="Saved continuation is no longer valid">
                        {capstone.invalid_reason}
                    </Notice>
                )}
                {capstone.members?.length ? (
                    <Disclosure
                        summary={`Team context (${capstone.members.length})`}
                        summaryClassName="[&::after]:hidden"
                        contentClassName="flex flex-wrap gap-1.5"
                    >
                        {capstone.members.map((member) => (
                            <StatusBadge key={`${capstone.capstone_id}-${member.user_id || member.email}`} tone="neutral">
                                {member.email || `Student #${member.user_id || "unknown"}`}
                                {member.is_leader ? " · leader" : ""}
                            </StatusBadge>
                        ))}
                    </Disclosure>
                ) : null}
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-1.5">
                        <Label htmlFor={`closeout-decision-${capstone.capstone_id}`}>Decision</Label>
                        <Select
                            value={draft.decision}
                            onValueChange={(value) =>
                                updateCloseoutDraft(capstone.capstone_id, {
                                    decision: value as CapstoneCloseoutDecision,
                                    ...(value === "continue_to_course" && !draft.targetCourseId
                                        ? {
                                              targetTerm: draftTargetTerm,
                                              targetCourseId: defaultContinuationCourseId(
                                                  capstone,
                                                  draftTargetTerm
                                              ),
                                          }
                                        : {}),
                                })
                            }
                            disabled={options.length === 0 || closeoutSavingId === capstone.capstone_id}
                        >
                            <SelectTrigger id={`closeout-decision-${capstone.capstone_id}`}>
                                <SelectValue placeholder="Choose decision" />
                            </SelectTrigger>
                            <SelectContent>
                                {options.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {selectedDecision && (
                            <p className="text-xs text-slate-500">{selectedDecision.description}</p>
                        )}
                        {!isCompleteCapstone(capstone) && (
                            <p className="text-xs text-slate-500">
                                Publishing is available after an instructor or admin marks the capstone complete.
                            </p>
                        )}
                        {isCompleteCapstone(capstone) && options.length === 0 && (
                            <p className="text-xs text-slate-500">
                                Admin access is required to publish or archive completed capstones.
                            </p>
                        )}
                    </div>
                    {draft.decision === "continue_to_course" && (
                        <>
                    <div className="space-y-1.5">
                        <Label htmlFor={`closeout-term-${capstone.capstone_id}`}>Continuation term</Label>
                        <Select
                            value={draftTargetTerm}
                            onValueChange={(value) => {
                                const selectedCourse = draft.targetCourseId
                                    ? courseById.get(Number(draft.targetCourseId))
                                    : null;
                                updateCloseoutDraft(capstone.capstone_id, {
                                    targetTerm: value,
                                    targetCourseId:
                                        selectedCourse && courseCanContinueInTerm(selectedCourse, value)
                                            ? draft.targetCourseId
                                            : defaultContinuationCourseId(capstone, value),
                                });
                            }}
                            disabled={
                                draft.decision !== "continue_to_course" ||
                                closeoutSavingId === capstone.capstone_id
                            }
                        >
                            <SelectTrigger id={`closeout-term-${capstone.capstone_id}`}>
                                <SelectValue placeholder="Choose term" />
                            </SelectTrigger>
                            <SelectContent>
                                {termOptions.map((term) => (
                                    <SelectItem key={term} value={term}>
                                        {term}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-500">
                            Use this when a project skips the immediate next marketplace cycle.
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor={`closeout-course-${capstone.capstone_id}`}>Continuation course</Label>
                        <Select
                            value={selectedTargetCourse ? draft.targetCourseId : "none"}
                            onValueChange={(value) => {
                                const selectedCourse = courseById.get(Number(value));
                                const nextTargetTerm =
                                    selectedCourse && value !== "none"
                                        ? nextEligibleTermForCourse(selectedCourse, draftTargetTerm)
                                        : draftTargetTerm;
                                updateCloseoutDraft(capstone.capstone_id, {
                                    targetCourseId: value === "none" ? "" : value,
                                    targetTerm: nextTargetTerm,
                                });
                            }}
                            disabled={
                                draft.decision !== "continue_to_course" ||
                                closeoutSavingId === capstone.capstone_id ||
                                courseOptions.length === 0
                            }
                        >
                            <SelectTrigger id={`closeout-course-${capstone.capstone_id}`}>
                                <SelectValue placeholder="Choose course" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Choose course</SelectItem>
                                {courseOptions.map((course) => (
                                    <SelectItem key={course.course_id} value={String(course.course_id)}>
                                        {course.code} - {course.name}
                                        {course.department?.name ? ` (${course.department.name})` : ""}
                                        {pipelineLabelForCourse(capstone, course.course_id)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-500">
                            Pipeline recommendations appear first when configured; the chosen course becomes the coordinating review course after term transition.
                        </p>
                    </div>
                        </>
                    )}
                    <div className="space-y-1.5">
                        <Label htmlFor={`closeout-notes-${capstone.capstone_id}`}>Decision notes</Label>
                        <Textarea
                            id={`closeout-notes-${capstone.capstone_id}`}
                            rows={3}
                            value={draft.notes}
                            onChange={(event) =>
                                updateCloseoutDraft(capstone.capstone_id, {
                                    notes: event.target.value,
                                })
                            }
                            disabled={closeoutSavingId === capstone.capstone_id}
                            placeholder="Required: explain this closeout decision"
                        />
                    </div>
                </div>
                {draft.decision === "continue_to_course" && (capstone.members || []).length > 0 && (
                    <div className="space-y-3">
                    <Notice tone="warning" title="Registrar / Quest update required">
                        WatMatch records continuation intent. Enrollment coordinators must update registrar-side enrollments outside WatMatch.
                    </Notice>
                    <Disclosure
                        summary={`Member enrollment routes (${capstone.members?.length || 0})`}
                        summaryClassName="[&::after]:hidden"
                        contentClassName="space-y-3"
                    >
                        <p className="text-xs text-slate-600">
                            The coordinating course owns review. Each student receives the selected enrollment course for transcript/course routing.
                        </p>
                        <div className="space-y-2">
                            {(capstone.members || []).map((member) => {
                                const studentId = member.user_id ? String(member.user_id) : "";
                                const routeOptions = memberEnrollmentCourseOptions(
                                    member,
                                    draftTargetTerm,
                                    draft.targetCourseId
                                );
                                const selectedRoute =
                                    memberRouteValue(member, draft, draftTargetTerm, draft.targetCourseId) ||
                                    "none";
                                const currentEnrollment = member.enrollment_course_fk
                                    ? courseById.get(Number(member.enrollment_course_fk))
                                    : null;
                                return (
                                    <div
                                        key={`${capstone.capstone_id}-${studentId || member.email}`}
                                        className="grid gap-2 rounded border border-slate-100 bg-white px-3 py-2 text-sm md:grid-cols-[minmax(180px,1fr)_minmax(180px,260px)] md:items-center"
                                    >
                                        <div className="min-w-0">
                                            <p className="break-all font-medium text-slate-800">
                                                {member.email || `Student #${studentId || "unknown"}`}
                                                {member.is_leader ? " - leader" : ""}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {member.home_department || "No home department"}
                                                {currentEnrollment
                                                    ? ` - current enrollment: ${currentEnrollment.code}`
                                                    : ""}
                                            </p>
                                        </div>
                                        <Select
                                            value={
                                                routeOptions.some(
                                                    (course) => String(course.course_id) === selectedRoute
                                                )
                                                    ? selectedRoute
                                                    : "none"
                                            }
                                            onValueChange={(value) => {
                                                if (!studentId) return;
                                                updateCloseoutDraft(capstone.capstone_id, {
                                                    memberEnrollmentRoutes: {
                                                        ...draft.memberEnrollmentRoutes,
                                                        [studentId]: value === "none" ? "" : value,
                                                    },
                                                });
                                            }}
                                            disabled={
                                                closeoutSavingId === capstone.capstone_id ||
                                                routeOptions.length === 0
                                            }
                                        >
                                            <SelectTrigger aria-label={`Enrollment course for ${member.email || `student ${studentId}`}`}>
                                                <SelectValue placeholder="Choose enrollment course" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Choose enrollment course</SelectItem>
                                                {routeOptions.map((course) => (
                                                    <SelectItem
                                                        key={course.course_id}
                                                        value={String(course.course_id)}
                                                    >
                                                        {course.code} - {course.name}
                                                        {course.department?.name ? ` (${course.department.name})` : ""}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                );
                            })}
                        </div>
                    </Disclosure>
                    </div>
                )}
                {draft.decision === "archive" && (
                    <Notice tone="danger" title="This will archive the live project">
                        The project will close without publishing a past-capstone record. The required decision notes become part of the audit trail.
                    </Notice>
                )}
                <div className="mt-3 flex justify-end">
                    {draft.decision === "archive" ? (
                        <ConfirmActionDialog
                            title="Archive this live project?"
                            description="The live project will close without publishing a past-capstone record. Students will no longer be able to use its active marketplace relationships."
                            confirmLabel="Archive project"
                            tone="destructive"
                            onConfirm={() => applyCloseout(capstone, true)}
                            trigger={
                                <Button
                                    type="button"
                                    disabled={
                                        options.length === 0 ||
                                        closeoutSavingId === capstone.capstone_id ||
                                        !draft.notes.trim()
                                    }
                                >
                                    {closeoutSavingId === capstone.capstone_id ? "Saving..." : "Save closeout"}
                                </Button>
                            }
                        />
                    ) : (
                        <Button
                            type="button"
                            onClick={() => applyCloseout(capstone)}
                            disabled={
                                options.length === 0 ||
                                closeoutSavingId === capstone.capstone_id ||
                                !draft.notes.trim()
                            }
                        >
                            {closeoutSavingId === capstone.capstone_id ? "Saving..." : "Save closeout"}
                        </Button>
                    )}
                </div>
            </Disclosure>
        );
    };

    return (
        <section className="space-y-5">
            <SectionHeader
                title="Marketplace cycle"
                description="Coordinate the active term and phase, resolve transition work, and close projects deliberately."
                actions={
                    canEdit ? (
                        <Button type="button" size="sm" onClick={openCycleEditor} disabled={loading}>
                            Edit cycle
                        </Button>
                    ) : undefined
                }
            />

            {message && (
                <Notice tone="neutral" title="Marketplace update">
                    {message}
                </Notice>
            )}

            {loading ? (
                <div className="wm-panel px-4 py-5 text-sm text-slate-600" role="status">
                    Loading marketplace cycle…
                </div>
            ) : (
                <div className="wm-panel overflow-hidden">
                    <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current cycle</p>
                            <h3 className="mt-1 break-words text-xl font-semibold text-slate-950">
                                {settings?.current_term || "Term not set"}
                            </h3>
                            <p className="mt-1 max-w-2xl text-sm leading-5 text-slate-600">
                                {phases.find((item) => item.value === savedPhase)?.description}
                            </p>
                        </div>
                        <StatusBadge tone={savedPhase === "finalization" ? "warning" : "info"} className="capitalize">
                            {marketplacePhaseLabel(savedPhase)}
                        </StatusBadge>
                    </div>
                    <dl className="grid divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                        <div className="px-4 py-3">
                            <dt className="text-xs text-slate-500">Active term</dt>
                            <dd className="mt-0.5 text-sm font-medium text-slate-900">{settings?.current_term || "Not set"}</dd>
                        </div>
                        <div className="px-4 py-3">
                            <dt className="text-xs text-slate-500">Marketplace phase</dt>
                            <dd className="mt-0.5 text-sm font-medium text-slate-900">{marketplacePhaseLabel(savedPhase)}</dd>
                        </div>
                        <div className="px-4 py-3">
                            <dt className="text-xs text-slate-500">Course activation season</dt>
                            <dd className="mt-0.5 text-sm font-medium text-slate-900">{settings?.current_season || "Not available"}</dd>
                        </div>
                    </dl>
                    <div className="border-t border-slate-100 p-4">
                        <Notice tone={nextTaskTone} title={nextTaskTitle}>
                            {nextTaskDetail}
                        </Notice>
                    </div>
                </div>
            )}

            {canEdit && !loading && closeoutDecisionCount > 0 && (
                <Disclosure
                    summary={`Project closeout (${closeoutDecisionCount})`}
                    summaryClassName="[&::after]:hidden"
                    contentClassName="space-y-3 bg-slate-50/60"
                >
                    <p className="text-sm text-slate-600">
                        Choose one audited outcome for each live or invalidly continued project before the next term transition.
                    </p>
                    {closeoutRequiredRows.map((capstone) => renderCloseoutCard(capstone, "Needs decision"))}
                    {invalidContinuationRows.map((capstone) => renderCloseoutCard(capstone, "Invalid continuation"))}
                </Disclosure>
            )}

            {canEdit && !loading && unresolvedActivityRows.length > 0 && (
                <Disclosure
                    summary={`Marketplace relationship cleanup (${unresolvedActivityRows.length})`}
                    summaryClassName="[&::after]:hidden"
                    contentClassName="space-y-4 bg-slate-50/60"
                >
                    <Notice tone="warning" title="Resolve exploration activity before finalization">
                        Saved, interested, and invited relationships will expire; exploring candidates will be marked not selected. An audit reason is required.
                    </Notice>
                    <div className="space-y-1.5">
                        <Label htmlFor="marketplace-activity-resolution-reason">Resolution reason</Label>
                        <Textarea
                            id="marketplace-activity-resolution-reason"
                            value={activityResolutionReason}
                            onChange={(event) => setActivityResolutionReason(event.target.value)}
                            placeholder="Explain why these marketplace relationships are being resolved"
                            rows={3}
                            disabled={resolvingActivityKey !== null}
                        />
                    </div>
                    <div className="flex justify-end">
                        <ConfirmActionDialog
                            title="Resolve every marketplace relationship?"
                            description="Saved, interested, and invited relationships will expire. Exploring students will be marked not selected across every project listed here."
                            confirmLabel="Resolve all relationships"
                            tone="destructive"
                            reasonLabel="Resolution reason"
                            reasonDescription="This reason is saved in the marketplace audit history."
                            reasonPlaceholder="Explain why these relationships are being closed."
                            reasonRequired
                            initialReason={activityResolutionReason}
                            onConfirm={(reason) => resolveMarketplaceActivity(undefined, reason, true)}
                            trigger={
                                <Button
                                    type="button"
                                    disabled={resolvingActivityKey !== null || !activityResolutionReason.trim()}
                                >
                                    {resolvingActivityKey === "all" ? "Resolving…" : "Resolve all relationships"}
                                </Button>
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        {unresolvedActivityRows.map((item) => (
                            <Disclosure
                                key={item.capstone_id}
                                summaryClassName="[&::after]:hidden"
                                summary={
                                    <span className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                        <span className="min-w-0">
                                            <span className="block break-words font-medium text-slate-900">{item.title || "Untitled capstone"}</span>
                                            <span className="block text-xs font-normal text-slate-500">{formatStatusCounts(item.status_counts)}</span>
                                        </span>
                                        <StatusBadge tone="warning">{item.explorations?.length || 0} relationships</StatusBadge>
                                    </span>
                                }
                            >
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0 text-xs text-slate-600">
                                        <p>Status: {workflowLabel(item.status)} · Team: {workflowLabel(item.team_status)}</p>
                                        {item.explorations?.length ? (
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {item.explorations.map((exploration) => (
                                                    <StatusBadge key={`${item.capstone_id}-${exploration.exploration_id}`} tone="neutral">
                                                        {exploration.student_email || `Student #${exploration.student_fk}`} · {workflowLabel(exploration.status)}
                                                    </StatusBadge>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                    <ConfirmActionDialog
                                        title={`Resolve relationships for ${item.title || "this project"}?`}
                                        description="Saved, interested, and invited relationships will expire for this project. Exploring students will be marked not selected."
                                        confirmLabel="Resolve project"
                                        tone="destructive"
                                        reasonLabel="Resolution reason"
                                        reasonDescription="This reason is saved in the marketplace audit history."
                                        reasonPlaceholder="Explain why these relationships are being closed."
                                        reasonRequired
                                        initialReason={activityResolutionReason}
                                        onConfirm={(reason) => resolveMarketplaceActivity(item.capstone_id, reason, true)}
                                        trigger={
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                disabled={resolvingActivityKey !== null || !activityResolutionReason.trim()}
                                            >
                                                {resolvingActivityKey === `capstone-${item.capstone_id}` ? "Resolving…" : "Resolve this project"}
                                            </Button>
                                        }
                                    />
                                </div>
                            </Disclosure>
                        ))}
                    </div>
                </Disclosure>
            )}

            {canEdit && !loading && carriedOverCapstones.length > 0 && (
                <Disclosure
                    summary={`Carried-over project controls (${carriedOverCapstones.length})`}
                    summaryClassName="[&::after]:hidden"
                    contentClassName="space-y-3 bg-slate-50/60"
                >
                    <p className="text-sm text-slate-600">
                        These projects remain visible but read-only. Keep them parked, continue them into {settings?.current_term || currentTerm}, publish completed work, or archive them.
                    </p>
                    {carriedOverCapstones.map((capstone) =>
                        renderCloseoutCard(
                            capstone,
                            capstone.closeout_decision === "continue_to_course"
                                ? "Pending continuation"
                                : "Read-only carry-over"
                        )
                    )}
                </Disclosure>
            )}

            {canEdit && !loading && (
                <Disclosure
                    summary="Readiness, activation, and phase policy"
                    summaryClassName="[&::after]:hidden"
                    contentClassName="space-y-4 bg-slate-50/60"
                >
                    {readinessLoading ? (
                        <p className="text-sm text-slate-600" role="status">Checking readiness…</p>
                    ) : readiness ? (
                        <>
                            <div>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h3 className="text-sm font-semibold text-slate-900">Operational readiness</h3>
                                    <StatusBadge tone={readiness.has_blockers ? "danger" : transitionHasAttention ? "warning" : "success"}>
                                        {readiness.has_blockers ? "Blocked" : transitionHasAttention ? "Attention" : "Ready"}
                                    </StatusBadge>
                                </div>
                                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                                    {(Object.keys(blockerLabels) as Array<keyof MarketplaceReadiness["counts"]>).map((key) => (
                                        <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
                                            <dt className="text-slate-600">{blockerLabels[key]}</dt>
                                            <dd className="font-semibold tabular-nums text-slate-900">{readiness.counts?.[key] ?? 0}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </div>
                            {activationPreview && (
                                <div className="rounded-lg border border-slate-200 bg-white p-3">
                                    <h3 className="text-sm font-semibold text-slate-900">Course activation preview</h3>
                                    <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-5">
                                        {[
                                            ["Will activate", activationCounts?.will_activate || 0],
                                            ["Will deactivate", activationCounts?.will_deactivate || 0],
                                            ["Force-active", activationCounts?.force_active || 0],
                                            ["Force-inactive", activationCounts?.force_inactive || 0],
                                            ["Missing instructor", activationCounts?.blocked_missing_instructor || 0],
                                        ].map(([label, value]) => (
                                            <div key={String(label)} className="rounded-md bg-slate-50 px-3 py-2">
                                                <dt className="text-slate-500">{label}</dt>
                                                <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">{value}</dd>
                                            </div>
                                        ))}
                                    </dl>
                                    {(activationPreview.blocked_missing_instructor || []).length > 0 && (
                                        <Notice tone="danger" title="Courses blocked from activation" className="mt-3">
                                            {(activationPreview.blocked_missing_instructor || []).map((course) => `${course.code} - ${course.name}`).join(", ")}
                                        </Notice>
                                    )}
                                </div>
                            )}
                            {phaseOverrideRows.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-900">Phase overrides</h3>
                                    <div className="mt-2 space-y-2">
                                        {phaseOverrideRows.map((item, index) => (
                                            <div key={`${String(item.kind || "override")}-${String(item.course_id || item.ecosystem_id || index)}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-medium text-slate-900">{String(item.code || item.name || "Phase override")}</span>
                                                    <StatusBadge tone="accent">{marketplacePhaseLabel(String(item.phase || ""))}</StatusBadge>
                                                </div>
                                                {item.reason ? <p className="mt-1 text-xs text-slate-600">{String(item.reason)}</p> : null}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <p className="text-xs leading-5 text-slate-600">
                                Term changes and finalization are blocked while required reviews, routing, enrollment, support, closeout, or marketplace-relationship work remains unresolved. Course and ecosystem phase overrides are preserved.
                            </p>
                        </>
                    ) : (
                        <EmptyState title="Readiness details are unavailable" description="Refresh the marketplace workspace before attempting a transition." />
                    )}
                </Disclosure>
            )}

            <Dialog
                open={cycleEditorOpen}
                onOpenChange={(open) => {
                    if (open) {
                        setCycleEditorOpen(true);
                    } else {
                        closeCycleEditor();
                    }
                }}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Edit marketplace cycle</DialogTitle>
                        <DialogDescription>
                            Select the target term and phase, review the preflight, then acknowledge the operational effect before saving.
                        </DialogDescription>
                    </DialogHeader>
                {loading ? (
                    <p className="text-sm text-slate-600">Loading marketplace settings...</p>
                ) : (
                    <div className="grid gap-4 md:grid-cols-[minmax(180px,240px)_minmax(220px,280px)_1fr] md:items-end">
                        <div className="space-y-1.5">
                            <Label htmlFor="marketplace-term">Active cycle</Label>
                            <Select
                                value={currentTerm}
                                onValueChange={(value) => {
                                    setCurrentTerm(value);
                                    setAcknowledgedTransition(false);
                                }}
                                disabled={!canEdit || saving}
                            >
                                <SelectTrigger id="marketplace-term">
                                    <SelectValue placeholder="Choose term" />
                                </SelectTrigger>
                                <SelectContent>
                                    {marketplaceTermOptions.map((term) => (
                                        <SelectItem key={term} value={term}>
                                            {term}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="marketplace-phase">Phase</Label>
                            <Select
                                value={phase}
                                onValueChange={(value) => {
                                    setPhase(value as MarketplacePhase);
                                    setAcknowledgedTransition(false);
                                }}
                                disabled={!canEdit || saving}
                            >
                                <SelectTrigger id="marketplace-phase">
                                    <SelectValue placeholder="Choose phase" />
                                </SelectTrigger>
                                <SelectContent>
                                    {phases.map((item) => (
                                        <SelectItem key={item.value} value={item.value}>
                                            {item.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm text-slate-600">
                                {selectedPhase?.description}
                            </p>
                            {settings?.current_season && (
                                <p className="text-xs text-slate-500">
                                    Course auto-activation uses the {settings.current_season} season.
                                </p>
                            )}
                        </div>
                    </div>
                )}
                {canEdit && hasTransition && (
                    <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <p className="font-medium">Term-transition wizard</p>
                                <p className="mt-1 text-xs text-amber-900">
                                    Normal cycle: exploration to commitment to finalization, then next term exploration.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                <StatusBadge tone={transitionReadinessPending ? "info" : transitionHasBlockers ? "danger" : transitionHasAttention ? "warning" : "success"}>
                                    {transitionReadinessPending ? "Checking" : transitionHasBlockers ? "Blocked" : transitionHasAttention ? "Attention" : "Ready"}
                                </StatusBadge>
                                {transitionRequiresOverride && (
                                    <StatusBadge tone="danger">Override required</StatusBadge>
                                )}
                            </div>
                        </div>
                        <Disclosure
                            summary="Transition preflight details"
                            className="mt-3"
                            summaryClassName="[&::after]:hidden"
                            contentClassName="space-y-3 bg-white/60"
                        >
                        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                            {transitionSteps.map((step, index) => (
                                <div
                                    key={step.label}
                                    className={`rounded border px-3 py-2 ${
                                        step.state === "blocked"
                                            ? "border-red-200 bg-red-50"
                                            : step.state === "ready"
                                            ? "border-emerald-200 bg-emerald-50"
                                            : "border-amber-200 bg-white/70"
                                    }`}
                                >
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Step {index + 1}
                                    </p>
                                    <p className="mt-1 font-medium text-slate-900">{step.label}</p>
                                    <p className="mt-1 text-xs text-slate-600">{step.value}</p>
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 rounded border border-amber-200 bg-white/70 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                                Course activation preview
                            </p>
                            {activationPreview ? (
                                <>
                                    <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                                        <div className="rounded border border-slate-200 bg-white px-2 py-1.5 text-xs">
                                            <span className="font-semibold">{activationCounts?.will_activate || 0}</span>{" "}
                                            will activate
                                        </div>
                                        <div className="rounded border border-slate-200 bg-white px-2 py-1.5 text-xs">
                                            <span className="font-semibold">{activationCounts?.will_deactivate || 0}</span>{" "}
                                            will deactivate
                                        </div>
                                        <div className="rounded border border-slate-200 bg-white px-2 py-1.5 text-xs">
                                            <span className="font-semibold">{activationCounts?.force_active || 0}</span>{" "}
                                            force-active
                                        </div>
                                        <div className="rounded border border-slate-200 bg-white px-2 py-1.5 text-xs">
                                            <span className="font-semibold">{activationCounts?.force_inactive || 0}</span>{" "}
                                            force-inactive
                                        </div>
                                        <div className="rounded border border-slate-200 bg-white px-2 py-1.5 text-xs">
                                            <span className="font-semibold">{activationCounts?.blocked_missing_instructor || 0}</span>{" "}
                                            missing instructor
                                        </div>
                                    </div>
                                    {(activationPreview.blocked_missing_instructor || []).length > 0 && (
                                        <details className="mt-3 rounded border border-red-200 bg-red-50 p-2">
                                            <summary className="cursor-pointer text-xs font-medium text-red-800">
                                                Courses blocked from activation ({activationPreview.blocked_missing_instructor.length})
                                            </summary>
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                {activationPreview.blocked_missing_instructor.map((course) => (
                                                    <span
                                                        key={course.course_id}
                                                        className="rounded bg-white px-2 py-1 text-xs text-red-700"
                                                    >
                                                        {course.code} - {course.name}
                                                    </span>
                                                ))}
                                            </div>
                                        </details>
                                    )}
                                </>
                            ) : (
                                <p className="mt-2 text-xs text-amber-900">
                                    Load readiness to preview which courses will activate or deactivate.
                                </p>
                            )}
                            <p className="mt-2 text-xs text-amber-900">
                                The backend blocks term changes and finalization when reviews, routing queues, commitment requests, enrollment requests, invalid member enrollment courses, unresolved marketplace activity, or required mentor/partner support are unresolved. Earlier phase changes show those items as attention work.
                            </p>
                        </div>
                        {readinessLoading ? (
                            <p className="mt-3 text-xs text-amber-900">Checking transition readiness...</p>
                        ) : readiness && (
                            <div className="mt-3 rounded border border-amber-200 bg-white/70 p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                                        Readiness
                                    </span>
                                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${readiness.has_blockers ? "bg-red-100 text-red-700" : transitionHasAttention ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"}`}>
                                        {readiness.has_blockers ? "Blocked" : transitionHasAttention ? "Attention" : "Ready"}
                                    </span>
                                </div>
                                <div className="mt-2 grid gap-2 md:grid-cols-2">
                                    {(Object.keys(blockerLabels) as Array<keyof MarketplaceReadiness["counts"]>).map((key) => (
                                        <div key={key} className="flex items-center justify-between rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700">
                                            <span>{blockerLabels[key]}</span>
                                            <span className="font-semibold">{readiness.counts?.[key] ?? 0}</span>
                                        </div>
                                    ))}
                                </div>
                                {readiness.has_blockers ? (
                                    <p className="mt-2 text-xs text-amber-900">
                                        Resolve these items before saving this transition. Closeout decisions can be handled below when live capstones need a term-end decision.
                                    </p>
                                ) : transitionHasAttention ? (
                                    <p className="mt-2 text-xs text-amber-900">
                                        These items do not block this selected transition, but staff should review them before finalization or a term change.
                                    </p>
                                ) : null}
                            </div>
                        )}
                        {readiness?.blockers?.phase_overrides?.length ? (
                            <details className="mt-3 rounded border border-fuchsia-200 bg-white/80 p-3">
                                <summary className="cursor-pointer text-sm font-medium text-fuchsia-800">
                                    Review phase overrides ({readiness.blockers.phase_overrides.length})
                                </summary>
                                <p className="mt-2 text-xs text-fuchsia-700">
                                    These course or ecosystem phases intentionally differ from the global cycle and will be preserved through this transition.
                                </p>
                                <div className="mt-3 space-y-2">
                                    {readiness.blockers.phase_overrides.map((item, index) => (
                                        <div
                                            key={`${String(item.kind || "override")}-${String(item.course_id || item.ecosystem_id || index)}`}
                                            className="rounded-md border border-slate-200 bg-white p-3 text-sm"
                                        >
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-medium text-slate-900">
                                                    {String(item.code || item.name || "Phase override")}
                                                </span>
                                                <span className="rounded bg-fuchsia-50 px-2 py-0.5 text-xs text-fuchsia-700">
                                                    {marketplacePhaseLabel(String(item.phase || ""))}
                                                </span>
                                                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                                    {String(item.kind || "override")}
                                                </span>
                                            </div>
                                            {item.reason ? (
                                                <p className="mt-1 text-xs text-slate-600">
                                                    {String(item.reason)}
                                                </p>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            </details>
                        ) : null}
                        </Disclosure>
                        {transitionHasBlockers && (
                            <Notice tone="danger" title="This transition is blocked" className="mt-3">
                                Resolve the visible routing, enrollment, support, closeout, or marketplace work in this workspace before saving the cycle change.
                            </Notice>
                        )}
                        {transitionRequiresOverride && (
                            <div className="mt-3 space-y-2">
                                <Notice tone="danger" title="A staff override reason is required">
                                    This transition skips the normal phase order. Use it only for a deliberate staff correction.
                                </Notice>
                                <Label htmlFor="marketplace-override-reason">Override reason</Label>
                                <Textarea
                                    id="marketplace-override-reason"
                                    rows={3}
                                    value={overrideReason}
                                    onChange={(event) => setOverrideReason(event.target.value)}
                                    placeholder="Explain why this non-standard transition is necessary"
                                />
                            </div>
                        )}
                        <label className="mt-3 flex items-start gap-2">
                            <input
                                type="checkbox"
                                checked={acknowledgedTransition}
                                onChange={(event) => setAcknowledgedTransition(event.target.checked)}
                                className="mt-1 h-4 w-4 rounded border-amber-300"
                            />
                            <span>
                                I understand this may activate/deactivate courses and requires unresolved reviews, routing, support, closeout, and marketplace activity to be completed before changing term or entering finalization.
                            </span>
                        </label>
                    </div>
                )}
                {message && (
                    <Notice tone="neutral" title="Marketplace update">
                        {message}
                    </Notice>
                )}
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={closeCycleEditor} disabled={saving}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={save}
                            disabled={
                                saving ||
                                (hasTransition &&
                                    (!acknowledgedTransition ||
                                        transitionReadinessPending ||
                                        transitionHasBlockers ||
                                        (transitionRequiresOverride && !overrideReason.trim())))
                            }
                        >
                            {saving ? "Saving…" : "Save cycle"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}
