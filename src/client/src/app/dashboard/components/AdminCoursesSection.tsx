"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TaxonomyChip, TaxonomyChipList } from "@/components/ui/taxonomy-chip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    ConfirmActionDialog,
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
import {
    fetchCourses,
    fetchCourseOfferings,
    fetchProjectEcosystems,
    createCourse,
    updateCourse,
    setInstructorPhaseControl,
    cloneCourseOfferings,
    upsertCourseOffering,
    updateProjectEcosystem,
    upsertCoursePipelineEdge,
    type Course,
    type CourseOffering,
    type CourseOfferingStatus,
    type CloneCourseOfferingsResult,
    type CoursePipelineEdge,
    type MarketplacePhase,
    type ProjectEcosystem,
} from "@/services/courses.service";
import { fetchDepartments, type Department } from "@/services/departments.service";

const COURSE_SEASONS = ["Winter", "Spring", "Fall"] as const;
type CourseSeason = (typeof COURSE_SEASONS)[number];
type CourseAdminView = "courses" | "offerings" | "ecosystems";
type ActivationMode = "auto" | "force_active" | "force_inactive";
type RoutingKind = "standard" | "interdisciplinary";
type PhaseOverrideValue = MarketplacePhase | "none";
type PipelineDraft = {
    toCourseId: string;
    isDefault: boolean;
    active: boolean;
    notes: string;
};
type OfferingRoutingOverride = RoutingKind | "inherit";
type OfferingSupportRule = "inherit" | "required" | "not_required";
type CloneOfferingStatus = Exclude<CourseOfferingStatus, "archived">;
type OfferingDraft = {
    offeringId: number | null;
    courseId: string;
    term: string;
    titleOverride: string;
    description: string;
    topic: string;
    sectionLabel: string;
    status: CourseOfferingStatus;
    routingKindOverride: OfferingRoutingOverride;
    ecosystemId: string;
    requiresSupport: OfferingSupportRule;
    studentRegistrationNotes: string;
    adminRoutingNotes: string;
    sourceUrl: string;
    heldWithCourseIds: string[];
};

const activationModes: Array<{
    value: ActivationMode;
    label: string;
    description: string;
}> = [
    {
        value: "auto",
        label: "Auto",
        description: "Follow active seasons and the current marketplace term.",
    },
    {
        value: "force_active",
        label: "Force Active",
        description: "Keep staffed course active regardless of season.",
    },
    {
        value: "force_inactive",
        label: "Force Inactive",
        description: "Keep course inactive regardless of season.",
    },
];

const routingKinds: Array<{ value: RoutingKind; label: string; description: string }> = [
    {
        value: "standard",
        label: "Standard",
        description: "Routes through the course's normal department-owned capstone workflow.",
    },
    {
        value: "interdisciplinary",
        label: "Interdisciplinary",
        description: "Routes through a real interdisciplinary transcript course grouped by ecosystem.",
    },
];

const marketplacePhaseOptions: Array<{ value: PhaseOverrideValue; label: string }> = [
    { value: "none", label: "Use global phase" },
    { value: "exploration", label: "Exploration" },
    { value: "commitment", label: "Commitment" },
    { value: "finalization", label: "Finalization" },
];

const offeringStatuses: Array<{ value: CourseOfferingStatus; label: string }> = [
    { value: "draft", label: "Draft" },
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
    { value: "archived", label: "Archived" },
];

function offeringStatusLabel(value?: CourseOfferingStatus | null) {
    return offeringStatuses.find((status) => status.value === value)?.label || "Unknown";
}

const cloneOfferingStatuses: Array<{ value: CloneOfferingStatus; label: string }> = [
    { value: "draft", label: "Draft" },
    { value: "inactive", label: "Inactive" },
    { value: "active", label: "Active" },
];

function toggleSeason(current: string[], season: CourseSeason, checked: boolean) {
    const next = new Set(current);
    if (checked) {
        next.add(season);
    } else {
        next.delete(season);
    }
    return COURSE_SEASONS.filter((value) => next.has(value));
}

function activationModeLabel(value?: string | null) {
    return activationModes.find((mode) => mode.value === value)?.label || "Auto";
}

function routingKindLabel(value?: string | null) {
    return routingKinds.find((kind) => kind.value === value)?.label || "Standard";
}

function marketplacePhaseLabel(value?: string | null) {
    return marketplacePhaseOptions.find((phase) => phase.value === value)?.label || "Global phase";
}

function departmentValue(course: Course) {
    return course.department_id || course.department_fk
        ? String(course.department_id || course.department_fk)
        : "none";
}

function departmentLabel(department: Department) {
    return department.faculty?.name
        ? `${department.name} (${department.faculty.name})`
        : department.name;
}

function ecosystemValue(course: Course) {
    return course.ecosystem_id || course.ecosystem_fk
        ? String(course.ecosystem_id || course.ecosystem_fk)
        : "none";
}

function isDepartmentalEcosystem(ecosystem: ProjectEcosystem) {
    return ecosystem.name.trim().toLowerCase() === "departmental";
}

function ecosystemOptionsForRouting(
    kind: RoutingKind,
    ecosystems: ProjectEcosystem[]
) {
    if (kind === "standard") {
        return ecosystems.filter(isDepartmentalEcosystem);
    }
    return ecosystems.filter(
        (ecosystem) =>
            ecosystem.active !== false && !isDepartmentalEcosystem(ecosystem)
    );
}

function defaultEcosystemForRouting(
    kind: RoutingKind,
    ecosystems: ProjectEcosystem[],
    currentValue: string
) {
    const options = ecosystemOptionsForRouting(kind, ecosystems);
    if (options.some((ecosystem) => String(ecosystem.ecosystem_id) === currentValue)) {
        return currentValue;
    }
    return options[0] ? String(options[0].ecosystem_id) : "none";
}

function courseLabel(course?: Course | null) {
    if (!course) return "Unknown course";
    const effectiveName = course.effective_title || course.effective_name || course.name;
    return `${course.code} - ${effectiveName}`;
}

function targetCourseForEdge(edge: CoursePipelineEdge, courses: Course[]) {
    return (
        edge.to_course ||
        edge.course ||
        courses.find((course) => course.course_id === Number(edge.to_course_fk)) ||
        null
    );
}

function nextTerm(term: string) {
    const match = term.trim().match(/^(Winter|Spring|Fall)\s+(\d{4})$/);
    if (!match) return term;
    const season = match[1];
    const year = Number(match[2]);
    if (season === "Winter") return `Spring ${year}`;
    if (season === "Spring") return `Fall ${year}`;
    return `Winter ${year + 1}`;
}

function isTermLabel(value: string) {
    return /^(Winter|Spring|Fall)\s+\d{4}$/.test(value.trim());
}

function currentTermFromCourses(courses: Course[]) {
    return (
        courses.find((course) => course.current_marketplace_term)?.current_marketplace_term ||
        "Fall 2026"
    );
}

function defaultOfferingDraft(courses: Course[]): OfferingDraft {
    const firstCourse = courses.find((course) => course.retired_for_routing !== true);
    const currentTerm = currentTermFromCourses(courses);
    return {
        offeringId: null,
        courseId: firstCourse ? String(firstCourse.course_id) : "",
        term: currentTerm,
        titleOverride: "",
        description: "",
        topic: "",
        sectionLabel: "",
        status: "draft",
        routingKindOverride: "inherit",
        ecosystemId: "inherit",
        requiresSupport: "inherit",
        studentRegistrationNotes: "",
        adminRoutingNotes: "",
        sourceUrl: "",
        heldWithCourseIds: [],
    };
}

function offeringLabel(offering: CourseOffering) {
    const course = offering.course;
    const code = course?.code || `Course ${offering.course_fk}`;
    const title = offering.title_override || course?.name || "Untitled offering";
    return `${code} - ${title}`;
}

function appendAuditReason(
    currentValue: string | null | undefined,
    actionLabel: string,
    reason: string,
    maxLength: number
) {
    const current = currentValue?.trim() || "";
    const auditEntry = `${actionLabel}: ${reason.trim()}`;
    const nextValue = current ? `${current}\n${auditEntry}` : auditEntry;
    if (nextValue.length > maxLength) {
        throw new Error(
            `The existing notes and audit reason exceed ${maxLength} characters. Shorten the notes or reason before continuing.`
        );
    }
    return nextValue;
}

export function AdminCoursesSection() {
    const [courses, setCourses] = useState<Course[]>([]);
    const [offerings, setOfferings] = useState<CourseOffering[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [ecosystems, setEcosystems] = useState<ProjectEcosystem[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeView, setActiveView] = useState<CourseAdminView>("courses");
    const [createCourseOpen, setCreateCourseOpen] = useState(false);
    const [offeringEditorOpen, setOfferingEditorOpen] = useState(false);
    const [code, setCode] = useState("");
    const [name, setName] = useState("");
    const [activeTerms, setActiveTerms] = useState<string[]>([]);
    const [activationMode, setActivationMode] = useState<ActivationMode>("auto");
    const [departmentId, setDepartmentId] = useState("none");
    const [ecosystemId, setEcosystemId] = useState("none");
    const [routingKind, setRoutingKind] = useState<RoutingKind>("standard");
    const [requiresSupport, setRequiresSupport] = useState(true);
    const [phaseOverride, setPhaseOverride] = useState<PhaseOverrideValue>("none");
    const [phaseOverrideReason, setPhaseOverrideReason] = useState("");
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editCode, setEditCode] = useState("");
    const [editName, setEditName] = useState("");
    const [editActiveTerms, setEditActiveTerms] = useState<string[]>([]);
    const [editActivationMode, setEditActivationMode] =
        useState<ActivationMode>("auto");
    const [editDepartmentId, setEditDepartmentId] = useState("none");
    const [editEcosystemId, setEditEcosystemId] = useState("none");
    const [editRoutingKind, setEditRoutingKind] = useState<RoutingKind>("standard");
    const [editRequiresSupport, setEditRequiresSupport] = useState(true);
    const [editInstructorPhaseControl, setEditInstructorPhaseControl] = useState(false);
    const [editPhaseOverride, setEditPhaseOverride] = useState<PhaseOverrideValue>("none");
    const [editPhaseOverrideReason, setEditPhaseOverrideReason] = useState("");
    const [offeringDraft, setOfferingDraft] = useState<OfferingDraft>(() =>
        defaultOfferingDraft([])
    );
    const [offeringSaving, setOfferingSaving] = useState(false);
    const [cloneSourceTerm, setCloneSourceTerm] = useState("");
    const [cloneTargetTerm, setCloneTargetTerm] = useState("");
    const [cloneTargetStatus, setCloneTargetStatus] =
        useState<CloneOfferingStatus>("draft");
    const [cloneOverwriteExisting, setCloneOverwriteExisting] = useState(false);
    const [cloneReason, setCloneReason] = useState("");
    const [cloneSaving, setCloneSaving] = useState(false);
    const [cloneResult, setCloneResult] =
        useState<CloneCourseOfferingsResult | null>(null);
    const [pipelineDrafts, setPipelineDrafts] = useState<Record<number, PipelineDraft>>({});
    const [pipelineSavingId, setPipelineSavingId] = useState<string | null>(null);
    const [ecosystemDrafts, setEcosystemDrafts] = useState<
        Record<number, {
            description: string;
            active: boolean;
            phaseOverride: PhaseOverrideValue;
            phaseOverrideReason: string;
        }>
    >({});
    const [ecosystemSavingId, setEcosystemSavingId] = useState<number | null>(null);
    const createEcosystemOptions = ecosystemOptionsForRouting(routingKind, ecosystems);
    const editEcosystemOptions = ecosystemOptionsForRouting(editRoutingKind, ecosystems);
    const activeSharedEcosystems = ecosystems.filter(
        (ecosystem) => ecosystem.active !== false && !isDepartmentalEcosystem(ecosystem)
    );

    const loadCourses = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [data, departmentRows, ecosystemRows, offeringRows] = await Promise.all([
                fetchCourses(false),
                fetchDepartments(false),
                fetchProjectEcosystems(false),
                fetchCourseOfferings(),
            ]);
            setCourses(data);
            setDepartments(departmentRows);
            setEcosystems(ecosystemRows);
            setOfferings(offeringRows);
            setOfferingDraft((current) => {
                if (current.courseId || data.length === 0) return current;
                return defaultOfferingDraft(data);
            });
            setCloneSourceTerm((current) => current || currentTermFromCourses(data));
            setCloneTargetTerm(
                (current) => current || nextTerm(currentTermFromCourses(data))
            );
            setEcosystemDrafts(
                ecosystemRows.reduce<typeof ecosystemDrafts>((drafts, ecosystem) => {
                    drafts[ecosystem.ecosystem_id] = {
                        description: ecosystem.description || "",
                        active: ecosystem.active !== false,
                        phaseOverride: ecosystem.marketplace_phase_override || "none",
                        phaseOverrideReason: ecosystem.marketplace_phase_override_reason || "",
                    };
                    return drafts;
                }, {})
            );
        } catch (e) {
            console.error(e);
            setError("Could not load courses.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCourses();
    }, [loadCourses]);

    useEffect(() => {
        setEcosystemId((current) =>
            defaultEcosystemForRouting(routingKind, ecosystems, current)
        );
    }, [routingKind, ecosystems]);

    useEffect(() => {
        if (editingId === null) return;
        setEditEcosystemId((current) =>
            defaultEcosystemForRouting(editRoutingKind, ecosystems, current)
        );
    }, [editRoutingKind, ecosystems, editingId]);

    const handleRoutingKindChange = (value: RoutingKind) => {
        setRoutingKind(value);
        setEcosystemId((current) =>
            defaultEcosystemForRouting(value, ecosystems, current)
        );
        if (value !== "standard") {
            setPhaseOverride("none");
            setPhaseOverrideReason("");
        }
    };

    const handleEditRoutingKindChange = (value: RoutingKind) => {
        setEditRoutingKind(value);
        setEditEcosystemId((current) =>
            defaultEcosystemForRouting(value, ecosystems, current)
        );
        if (value !== "standard") {
            setEditPhaseOverride("none");
            setEditPhaseOverrideReason("");
        }
    };

    const handleCreateCourse = async () => {
        if (!code.trim() || !name.trim()) {
            setError("Course code and name are required.");
            return;
        }
        if (
            routingKind === "standard" &&
            phaseOverride !== "none" &&
            !phaseOverrideReason.trim()
        ) {
            setError("A course phase override requires an audit reason.");
            return;
        }
        const normalizedEcosystemId = defaultEcosystemForRouting(
            routingKind,
            ecosystems,
            ecosystemId
        );
        if (routingKind === "interdisciplinary" && normalizedEcosystemId === "none") {
            setError("Choose an active non-Departmental ecosystem for interdisciplinary courses.");
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            await createCourse({
                code: code.trim(),
                name: name.trim(),
                active_terms: activeTerms,
                activation_mode: activationMode,
                department_id:
                    departmentId === "none" ? null : Number(departmentId),
                ecosystem_id:
                    normalizedEcosystemId === "none" ? null : Number(normalizedEcosystemId),
                routing_kind: routingKind,
                marketplace_phase_override:
                    routingKind === "standard" && phaseOverride !== "none"
                        ? phaseOverride
                        : null,
                marketplace_phase_override_reason:
                    routingKind === "standard" && phaseOverride !== "none"
                        ? phaseOverrideReason.trim()
                        : null,
                requires_project_support: requiresSupport,
            });
            setCode("");
            setName("");
            setActiveTerms([]);
            setActivationMode("auto");
            setDepartmentId("none");
            setRoutingKind("standard");
            setEcosystemId(defaultEcosystemForRouting("standard", ecosystems, "none"));
            setRequiresSupport(true);
            setPhaseOverride("none");
            setPhaseOverrideReason("");
            await loadCourses();
            setCreateCourseOpen(false);
        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : "Failed to create course.");
        } finally {
            setSubmitting(false);
        }
    };

    const startEdit = (course: Course) => {
        setEditingId(course.course_id);
        setEditCode(course.code);
        setEditName(course.name);
        setEditActiveTerms(course.active_terms || []);
        setEditActivationMode(course.activation_mode || "auto");
        setEditDepartmentId(departmentValue(course));
        setEditEcosystemId(ecosystemValue(course));
        setEditRoutingKind(course.routing_kind || "standard");
        setEditRequiresSupport(course.requires_project_support !== false);
        setEditInstructorPhaseControl(course.instructor_phase_control === true);
        setEditPhaseOverride(course.marketplace_phase_override || "none");
        setEditPhaseOverrideReason(course.marketplace_phase_override_reason || "");
        setError(null);
    };

    const saveEdit = async (course: Course, forceInactiveReason?: string) => {
        const confirmingForceInactive = forceInactiveReason !== undefined;
        if (!editCode.trim() || !editName.trim()) {
            const message = "Course code and name are required.";
            setError(message);
            if (confirmingForceInactive) throw new Error(message);
            return;
        }
        if (
            editRoutingKind === "standard" &&
            editPhaseOverride !== "none" &&
            !editPhaseOverrideReason.trim()
        ) {
            const message = "A course phase override requires an audit reason.";
            setError(message);
            if (confirmingForceInactive) throw new Error(message);
            return;
        }
        const normalizedEcosystemId = defaultEcosystemForRouting(
            editRoutingKind,
            ecosystems,
            editEcosystemId
        );
        if (editRoutingKind === "interdisciplinary" && normalizedEcosystemId === "none") {
            const message =
                "Choose an active non-Departmental ecosystem for interdisciplinary courses.";
            setError(message);
            if (confirmingForceInactive) throw new Error(message);
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            await updateCourse(course.course_id, {
                code: editCode.trim(),
                name: editName.trim(),
                active_terms: editActiveTerms,
                activation_mode: editActivationMode,
                department_id:
                    editDepartmentId === "none" ? null : Number(editDepartmentId),
                ecosystem_id:
                    normalizedEcosystemId === "none" ? null : Number(normalizedEcosystemId),
                routing_kind: editRoutingKind,
                marketplace_phase_override:
                    editRoutingKind === "standard" && editPhaseOverride !== "none"
                        ? editPhaseOverride
                        : null,
                marketplace_phase_override_reason:
                    editRoutingKind === "standard" && editPhaseOverride !== "none"
                        ? editPhaseOverrideReason.trim()
                        : null,
                requires_project_support: editRequiresSupport,
                reason: forceInactiveReason?.trim() || null,
            });
            if (
                editRoutingKind === "standard" &&
                editInstructorPhaseControl !== (course.instructor_phase_control === true)
            ) {
                await setInstructorPhaseControl(course.course_id, editInstructorPhaseControl);
            }
            setEditingId(null);
            await loadCourses();
        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : "Failed to update course details.");
            if (confirmingForceInactive) throw e;
        } finally {
            setSubmitting(false);
        }
    };

    const updateEcosystemDraft = (
        ecosystemId: number,
        patch: Partial<{
            description: string;
            active: boolean;
            phaseOverride: PhaseOverrideValue;
            phaseOverrideReason: string;
        }>
    ) => {
        setEcosystemDrafts((current) => ({
            ...current,
            [ecosystemId]: {
                ...(current[ecosystemId] || {
                    description: "",
                    active: true,
                    phaseOverride: "none",
                    phaseOverrideReason: "",
                }),
                ...patch,
            },
        }));
    };

    const saveEcosystemDraft = async (
        ecosystem: ProjectEcosystem,
        deactivationReason?: string
    ) => {
        const confirmingDeactivation = deactivationReason !== undefined;
        const draft =
            ecosystemDrafts[ecosystem.ecosystem_id] || {
                description: ecosystem.description || "",
                active: ecosystem.active !== false,
                phaseOverride: ecosystem.marketplace_phase_override || "none",
                phaseOverrideReason: ecosystem.marketplace_phase_override_reason || "",
            };
        if (draft.phaseOverride !== "none" && !draft.phaseOverrideReason.trim()) {
            const message = "An ecosystem phase override requires an audit reason.";
            setError(message);
            if (confirmingDeactivation) throw new Error(message);
            return;
        }
        setEcosystemSavingId(ecosystem.ecosystem_id);
        setError(null);
        try {
            await updateProjectEcosystem(ecosystem.ecosystem_id, {
                description: draft.description.trim() || null,
                active: draft.active,
                marketplace_phase_override:
                    draft.active && draft.phaseOverride !== "none"
                        ? draft.phaseOverride
                        : null,
                marketplace_phase_override_reason:
                    draft.active && draft.phaseOverride !== "none"
                        ? draft.phaseOverrideReason.trim()
                        : null,
                reason: deactivationReason?.trim() || null,
            });
            await loadCourses();
        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : "Failed to update project ecosystem.");
            if (confirmingDeactivation) throw e;
        } finally {
            setEcosystemSavingId(null);
        }
    };

    const resetOfferingDraft = () => {
        setOfferingDraft(defaultOfferingDraft(courses));
        setOfferingEditorOpen(false);
    };

    const updateOfferingDraft = (patch: Partial<OfferingDraft>) => {
        setOfferingDraft((current) => ({
            ...current,
            ...patch,
        }));
    };

    const toggleHeldWithCourse = (courseId: number, checked: boolean) => {
        const value = String(courseId);
        setOfferingDraft((current) => {
            const next = new Set(current.heldWithCourseIds);
            if (checked) {
                next.add(value);
            } else {
                next.delete(value);
            }
            return {
                ...current,
                heldWithCourseIds: Array.from(next),
            };
        });
    };

    const editOffering = (offering: CourseOffering) => {
        setOfferingDraft({
            offeringId: offering.course_offering_id,
            courseId: String(offering.course_fk),
            term: offering.term,
            titleOverride: offering.title_override || "",
            description: offering.description || "",
            topic: offering.topic || "",
            sectionLabel: offering.section_label || "",
            status: offering.status,
            routingKindOverride: offering.routing_kind_override || "inherit",
            ecosystemId: offering.ecosystem_fk ? String(offering.ecosystem_fk) : "inherit",
            requiresSupport:
                offering.requires_project_support === true
                    ? "required"
                    : offering.requires_project_support === false
                    ? "not_required"
                    : "inherit",
            studentRegistrationNotes: offering.student_registration_notes || "",
            adminRoutingNotes: offering.admin_routing_notes || "",
            sourceUrl: offering.source_url || "",
            heldWithCourseIds: (offering.held_with_course_ids || []).map(String),
        });
        setError(null);
        setOfferingEditorOpen(true);
    };

    const copyOffering = (offering: CourseOffering) => {
        setOfferingDraft({
            offeringId: null,
            courseId: String(offering.course_fk),
            term: nextTerm(offering.term),
            titleOverride: offering.title_override || "",
            description: offering.description || "",
            topic: offering.topic || "",
            sectionLabel: offering.section_label || "",
            status: "draft",
            routingKindOverride: offering.routing_kind_override || "inherit",
            ecosystemId: offering.ecosystem_fk ? String(offering.ecosystem_fk) : "inherit",
            requiresSupport:
                offering.requires_project_support === true
                    ? "required"
                    : offering.requires_project_support === false
                    ? "not_required"
                    : "inherit",
            studentRegistrationNotes: offering.student_registration_notes || "",
            adminRoutingNotes: offering.admin_routing_notes || "",
            sourceUrl: offering.source_url || "",
            heldWithCourseIds: (offering.held_with_course_ids || []).map(String),
        });
        setError(null);
        setOfferingEditorOpen(true);
    };

    const saveOfferingDraft = async (statusChangeReason?: string) => {
        const confirmingStatusChange = statusChangeReason !== undefined;
        if (!offeringDraft.courseId) {
            const message = "Choose a course for the offering.";
            setError(message);
            if (confirmingStatusChange) throw new Error(message);
            return;
        }
        if (!offeringDraft.term.trim()) {
            const message = "Offering term is required.";
            setError(message);
            if (confirmingStatusChange) throw new Error(message);
            return;
        }
        setOfferingSaving(true);
        setError(null);
        try {
            await upsertCourseOffering({
                course_offering_id: offeringDraft.offeringId,
                course_id: Number(offeringDraft.courseId),
                term: offeringDraft.term.trim(),
                title_override: offeringDraft.titleOverride.trim() || null,
                description: offeringDraft.description.trim() || null,
                topic: offeringDraft.topic.trim() || null,
                section_label: offeringDraft.sectionLabel.trim() || null,
                status: offeringDraft.status,
                routing_kind_override:
                    offeringDraft.routingKindOverride === "inherit"
                        ? null
                        : offeringDraft.routingKindOverride,
                ecosystem_id:
                    offeringDraft.ecosystemId === "inherit"
                        ? null
                        : Number(offeringDraft.ecosystemId),
                requires_project_support:
                    offeringDraft.requiresSupport === "inherit"
                        ? null
                        : offeringDraft.requiresSupport === "required",
                student_registration_notes:
                    offeringDraft.studentRegistrationNotes.trim() || null,
                admin_routing_notes: statusChangeReason
                    ? appendAuditReason(
                          offeringDraft.adminRoutingNotes,
                          `Status changed to ${offeringStatusLabel(offeringDraft.status)}`,
                          statusChangeReason,
                          5000
                      )
                    : offeringDraft.adminRoutingNotes.trim() || null,
                source_url: offeringDraft.sourceUrl.trim() || null,
                held_with_course_ids: offeringDraft.heldWithCourseIds.map(Number),
            });
            resetOfferingDraft();
            await loadCourses();
        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : "Failed to save course offering.");
            if (confirmingStatusChange) throw e;
        } finally {
            setOfferingSaving(false);
        }
    };

    const cloneOfferingsForTerm = async () => {
        const sourceTerm = cloneSourceTerm.trim();
        const targetTerm = cloneTargetTerm.trim();
        if (!sourceTerm || !targetTerm) {
            setError("Source and target terms are required for cloning.");
            return;
        }
        if (sourceTerm === targetTerm) {
            setError("Source and target terms must be different.");
            return;
        }
        if (!isTermLabel(sourceTerm) || !isTermLabel(targetTerm)) {
            setError("Terms must look like Winter 2026, Spring 2026, or Fall 2026.");
            return;
        }
        setCloneSaving(true);
        setCloneResult(null);
        setError(null);
        try {
            const result = await cloneCourseOfferings({
                source_term: sourceTerm,
                target_term: targetTerm,
                target_status: cloneTargetStatus,
                overwrite_existing: cloneOverwriteExisting,
                reason: cloneReason.trim() || "admin_course_offering_clone",
            });
            setCloneResult(result);
            setOfferingDraft((current) => ({
                ...current,
                term: targetTerm,
            }));
            await loadCourses();
        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : "Failed to clone course offerings.");
        } finally {
            setCloneSaving(false);
        }
    };

    const pipelineDraftFor = (course: Course): PipelineDraft =>
        pipelineDrafts[course.course_id] || {
            toCourseId: "",
            isDefault: false,
            active: true,
            notes: "",
        };

    const updatePipelineDraft = (courseId: number, patch: Partial<PipelineDraft>) => {
        setPipelineDrafts((current) => ({
            ...current,
            [courseId]: {
                ...(current[courseId] || {
                    toCourseId: "",
                    isDefault: false,
                    active: true,
                    notes: "",
                }),
                ...patch,
            },
        }));
    };

    const savePipelineDraft = async (course: Course) => {
        const draft = pipelineDraftFor(course);
        if (!draft.toCourseId) {
            setError("Choose a continuation target before saving a pipeline edge.");
            return;
        }
        setPipelineSavingId(`draft-${course.course_id}`);
        setError(null);
        try {
            await upsertCoursePipelineEdge({
                from_course_id: course.course_id,
                to_course_id: Number(draft.toCourseId),
                active: draft.active,
                is_default: draft.isDefault,
                notes: draft.notes.trim() || null,
            });
            setPipelineDrafts((current) => ({
                ...current,
                [course.course_id]: {
                    toCourseId: "",
                    isDefault: false,
                    active: true,
                    notes: "",
                },
            }));
            await loadCourses();
        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : "Failed to save pipeline edge.");
        } finally {
            setPipelineSavingId(null);
        }
    };

    const saveExistingPipelineEdge = async (
        course: Course,
        edge: CoursePipelineEdge,
        patch: Partial<Pick<CoursePipelineEdge, "active" | "is_default" | "notes">>,
        archiveReason?: string
    ) => {
        const confirmingArchive = archiveReason !== undefined;
        setPipelineSavingId(`edge-${edge.course_pipeline_edge_id}`);
        setError(null);
        try {
            await upsertCoursePipelineEdge({
                course_pipeline_edge_id: edge.course_pipeline_edge_id,
                from_course_id: course.course_id,
                to_course_id: Number(edge.to_course_fk),
                active: patch.active ?? edge.active !== false,
                is_default: patch.is_default ?? edge.is_default === true,
                notes: archiveReason
                    ? appendAuditReason(
                          patch.notes ?? edge.notes,
                          "Pipeline edge archived",
                          archiveReason,
                          1000
                      )
                    : patch.notes ?? edge.notes ?? null,
            });
            await loadCourses();
        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : "Failed to update pipeline edge.");
            if (confirmingArchive) throw e;
        } finally {
            setPipelineSavingId(null);
        }
    };

    const editedOffering = offeringDraft.offeringId
        ? offerings.find(
              (offering) => offering.course_offering_id === offeringDraft.offeringId
          ) || null
        : null;
    const offeringStatusNeedsConfirmation =
        (offeringDraft.status === "inactive" || offeringDraft.status === "archived") &&
        editedOffering?.status !== offeringDraft.status;

    return (
        <div className="flex flex-col gap-4">
            <SectionHeader
                className="order-0"
                title="Course catalog"
                description={
                    activeView === "courses"
                        ? "Stable course identities and their current-term readiness. Term offerings are managed separately."
                        : activeView === "offerings"
                          ? "Term-specific topics, staffing-sensitive routing, held-with groups, and support rules."
                          : "Shared project-market labels and audited phase overrides for interdisciplinary routing."
                }
                actions={
                    activeView === "courses" ? (
                        <Button
                            size="sm"
                            onClick={() => setCreateCourseOpen(true)}
                        >
                            Create stable course
                        </Button>
                    ) : activeView === "offerings" ? (
                        <Button
                            size="sm"
                            onClick={() => {
                                setOfferingDraft(defaultOfferingDraft(courses));
                                setOfferingEditorOpen(true);
                            }}
                        >
                            New term offering
                        </Button>
                    ) : null
                }
            />
            <WorkspaceTabs
                className="order-1"
                activeTab={activeView}
                onChange={setActiveView}
                label="Course administration views"
                tabs={[
                    { id: "courses", label: "Stable courses", count: courses.length },
                    { id: "offerings", label: "Term offerings", count: offerings.length },
                    { id: "ecosystems", label: "Ecosystems", count: ecosystems.length },
                ]}
            />
            {error && (
                <Notice className="order-2" tone="danger" title="Course change needs attention">
                    {error}
                </Notice>
            )}
            <Disclosure
                className={`order-10 ${activeView === "courses" ? "" : "hidden"}`}
                open={createCourseOpen}
                onToggle={(event) =>
                    setCreateCourseOpen(event.currentTarget.open)
                }
                summary="Create a stable course identity"
                contentClassName="p-0"
            >
                <Card className="rounded-none border-0 shadow-none">
                    <CardHeader>
                        <CardTitle>Create stable course</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input
                            placeholder="Code (e.g. SE390)"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                        />
                        <Input
                            placeholder="Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-slate-700">Terms active</p>
                        <div className="flex flex-wrap gap-3">
                            {COURSE_SEASONS.map((season) => (
                                <label
                                    key={season}
                                    className="flex items-center gap-2 text-sm text-slate-700"
                                >
                                    <Checkbox
                                        checked={activeTerms.includes(season)}
                                        onCheckedChange={(checked) =>
                                            setActiveTerms((current) =>
                                                toggleSeason(current, season, checked === true)
                                            )
                                        }
                                    />
                                    {season}
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="max-w-sm space-y-1.5">
                        <p className="text-sm font-medium text-slate-700">Activation mode</p>
                        <Select
                            value={activationMode}
                            onValueChange={(value) => setActivationMode(value as ActivationMode)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Activation mode" />
                            </SelectTrigger>
                            <SelectContent>
                                {activationModes.map((mode) => (
                                    <SelectItem key={mode.value} value={mode.value}>
                                        {mode.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-500">
                            {activationModes.find((mode) => mode.value === activationMode)?.description}
                        </p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div className="space-y-1.5">
                            <p className="text-sm font-medium text-slate-700">Department</p>
                            <Select value={departmentId} onValueChange={setDepartmentId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="No department" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No department</SelectItem>
                                    {departments.map((department) => (
                                        <SelectItem
                                            key={department.department_id}
                                            value={String(department.department_id)}
                                        >
                                            {departmentLabel(department)}
                                            {department.active === false ? " (inactive)" : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <p className="text-sm font-medium text-slate-700">Project ecosystem</p>
                            <Select value={ecosystemId} onValueChange={setEcosystemId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Project ecosystem" />
                                </SelectTrigger>
                                <SelectContent>
                                    {createEcosystemOptions.length === 0 && (
                                        <SelectItem value="none" disabled>
                                            No valid ecosystems
                                        </SelectItem>
                                    )}
                                    {createEcosystemOptions.map((ecosystem) => (
                                        <SelectItem
                                            key={ecosystem.ecosystem_id}
                                            value={String(ecosystem.ecosystem_id)}
                                        >
                                            {ecosystem.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-slate-500">
                                {routingKind === "standard"
                                    ? "Standard courses use the Departmental ecosystem."
                                    : "Interdisciplinary courses use an active shared ecosystem."}
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            <p className="text-sm font-medium text-slate-700">Routing kind</p>
                            <Select
                                value={routingKind}
                                onValueChange={(value) => handleRoutingKindChange(value as RoutingKind)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Routing kind" />
                                </SelectTrigger>
                                <SelectContent>
                                    {routingKinds.map((kind) => (
                                        <SelectItem key={kind.value} value={kind.value}>
                                            {kind.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-slate-500">
                                {routingKinds.find((kind) => kind.value === routingKind)?.description}
                            </p>
                        </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                        <Checkbox
                            checked={requiresSupport}
                            onCheckedChange={(checked) => setRequiresSupport(checked === true)}
                        />
                        Require mentor or confirmed external partner before finalization
                    </label>
                    <Disclosure
                        summary="Advanced: marketplace phase override"
                        contentClassName="bg-slate-50/70"
                    >
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1.5">
                                <p className="text-sm font-medium text-slate-700">
                                    Course override
                                </p>
                                <Select
                                    value={phaseOverride}
                                    onValueChange={(value) =>
                                        setPhaseOverride(value as PhaseOverrideValue)
                                    }
                                    disabled={routingKind !== "standard"}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Use global phase" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {marketplacePhaseOptions.map((phase) => (
                                            <SelectItem key={phase.value} value={phase.value}>
                                                {phase.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-slate-500">
                                    Standard courses only. Interdisciplinary courses use their ecosystem phase.
                                </p>
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-sm font-medium text-slate-700">
                                    Audit reason
                                </p>
                                <Textarea
                                    value={phaseOverrideReason}
                                    onChange={(event) =>
                                        setPhaseOverrideReason(event.target.value)
                                    }
                                    disabled={routingKind !== "standard" || phaseOverride === "none"}
                                    placeholder="Why should this course differ from the global phase?"
                                    rows={3}
                                />
                            </div>
                        </div>
                    </Disclosure>
                    <Button onClick={handleCreateCourse} disabled={submitting}>
                        {submitting ? "Creating..." : "Create stable course"}
                    </Button>
                    </CardContent>
                </Card>
            </Disclosure>
            <section
                className={`order-10 space-y-4 ${activeView === "ecosystems" ? "" : "hidden"}`}
                aria-labelledby="ecosystem-admin-heading"
            >
                <SectionHeader
                    title={<span id="ecosystem-admin-heading">Project ecosystems</span>}
                    description="Reusable project-market labels. Phase overrides are exceptional and continue to require an audit reason."
                />
                <div className="space-y-3">
                    {ecosystems.length === 0 ? (
                        <p className="text-sm text-slate-600">No project ecosystems found.</p>
                    ) : (
                        ecosystems.map((ecosystem) => {
                            const draft =
                                ecosystemDrafts[ecosystem.ecosystem_id] || {
                                    description: ecosystem.description || "",
                                    active: ecosystem.active !== false,
                                    phaseOverride: ecosystem.marketplace_phase_override || "none",
                                    phaseOverrideReason:
                                        ecosystem.marketplace_phase_override_reason || "",
                                };
                            const canOverride =
                                ecosystem.can_set_ecosystem_phase_override !== false &&
                                ecosystem.name.toLowerCase() !== "departmental" &&
                                draft.active;
                            const isSaving = ecosystemSavingId === ecosystem.ecosystem_id;
                            const isDeactivating =
                                ecosystem.active !== false && draft.active === false;
                            const hasOverride =
                                ecosystem.marketplace_phase_context?.override_source === "ecosystem";
                            return (
                                <div
                                    key={ecosystem.ecosystem_id}
                                    className="rounded-lg border border-slate-200 bg-white p-3 sm:p-4"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                            <p className="font-medium text-slate-900">
                                                {ecosystem.name}
                                            </p>
                                            {ecosystem.description && (
                                                <p className="text-sm text-slate-600">
                                                    {ecosystem.description}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <StatusBadge
                                                tone={draft.active ? "success" : "neutral"}
                                            >
                                                {draft.active ? "Active" : "Inactive"}
                                            </StatusBadge>
                                            {hasOverride && (
                                                <StatusBadge tone="accent">
                                                    Phase override:{" "}
                                                    {marketplacePhaseLabel(
                                                        ecosystem.marketplace_phase_context?.effective_phase
                                                    )}
                                                </StatusBadge>
                                            )}
                                        </div>
                                    </div>
                                    <Disclosure
                                        className="mt-3"
                                        summary="Edit ecosystem and phase override"
                                        contentClassName="bg-slate-50/70"
                                    >
                                        <div className="grid gap-3 md:grid-cols-2">
                                            <div className="space-y-1.5">
                                                <p className="text-sm font-medium text-slate-700">
                                                    Description
                                                </p>
                                                <Textarea
                                                    value={draft.description}
                                                    onChange={(event) =>
                                                        updateEcosystemDraft(ecosystem.ecosystem_id, {
                                                            description: event.target.value,
                                                        })
                                                    }
                                                    rows={3}
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="flex items-center gap-2 text-sm text-slate-700">
                                                    <Checkbox
                                                        checked={draft.active}
                                                        onCheckedChange={(checked) =>
                                                            updateEcosystemDraft(
                                                                ecosystem.ecosystem_id,
                                                                { active: checked === true }
                                                            )
                                                        }
                                                    />
                                                    Active ecosystem
                                                </label>
                                                <div className="space-y-1.5">
                                                    <p className="text-sm font-medium text-slate-700">
                                                        Ecosystem override
                                                    </p>
                                                    <Select
                                                        value={draft.phaseOverride}
                                                        onValueChange={(value) =>
                                                            updateEcosystemDraft(
                                                                ecosystem.ecosystem_id,
                                                                {
                                                                    phaseOverride:
                                                                        value as PhaseOverrideValue,
                                                                }
                                                            )
                                                        }
                                                        disabled={!canOverride}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Use global phase" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {marketplacePhaseOptions.map((phase) => (
                                                                <SelectItem
                                                                    key={phase.value}
                                                                    value={phase.value}
                                                                >
                                                                    {phase.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <p className="text-xs text-slate-500">
                                                        Use ecosystem overrides for shared interdisciplinary project markets.
                                                    </p>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <p className="text-sm font-medium text-slate-700">
                                                        Audit reason
                                                    </p>
                                                    <Textarea
                                                        value={draft.phaseOverrideReason}
                                                        onChange={(event) =>
                                                            updateEcosystemDraft(
                                                                ecosystem.ecosystem_id,
                                                                {
                                                                    phaseOverrideReason:
                                                                        event.target.value,
                                                                }
                                                            )
                                                        }
                                                        disabled={
                                                            !canOverride ||
                                                            draft.phaseOverride === "none"
                                                        }
                                                        placeholder="Why should this ecosystem differ from the global phase?"
                                                        rows={3}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-3 flex justify-end">
                                            {isDeactivating ? (
                                                <ConfirmActionDialog
                                                    trigger={
                                                        <Button
                                                            variant="outline"
                                                            disabled={isSaving}
                                                        >
                                                            Save Ecosystem
                                                        </Button>
                                                    }
                                                    title={`Deactivate ${ecosystem.name}?`}
                                                    description="This removes the ecosystem from new interdisciplinary routing choices and clears its phase override while inactive. Existing course and project records keep their recorded ecosystem reference."
                                                    confirmLabel="Deactivate ecosystem"
                                                    tone="destructive"
                                                    reasonLabel="Audit reason"
                                                    reasonDescription="Explain why this ecosystem should no longer be available for new routing decisions."
                                                    reasonPlaceholder="Enter the operational reason for deactivation"
                                                    reasonRequired
                                                    onConfirm={(reason) =>
                                                        saveEcosystemDraft(ecosystem, reason)
                                                    }
                                                />
                                            ) : (
                                                <Button
                                                    variant="outline"
                                                    onClick={() => saveEcosystemDraft(ecosystem)}
                                                    disabled={isSaving}
                                                >
                                                    {isSaving ? "Saving..." : "Save Ecosystem"}
                                                </Button>
                                            )}
                                        </div>
                                    </Disclosure>
                                </div>
                            );
                        })
                    )}
                </div>
            </section>
            <section
                className={`order-10 space-y-4 ${activeView === "offerings" ? "" : "hidden"}`}
                aria-labelledby="offering-admin-heading"
            >
                <SectionHeader
                    title={<span id="offering-admin-heading">Term offerings</span>}
                    description="Term-specific configuration layered on top of a stable course identity."
                />
                <Notice tone="warning" title="Registrar updates remain manual">
                    WatMatch records intended coordinating courses and enrollment routes.
                    Enrollment coordinators still update Registrar/Quest separately.
                </Notice>
                <div className="space-y-4">
                    <Disclosure
                        summary="Advanced: clone one term into another"
                        contentClassName="space-y-3 bg-slate-50/70"
                    >
                        <div className="grid gap-3 md:grid-cols-3">
                            <div className="space-y-1.5">
                                <p className="text-sm font-medium text-slate-700">Clone from term</p>
                                <Input
                                    value={cloneSourceTerm}
                                    onChange={(event) => setCloneSourceTerm(event.target.value)}
                                    placeholder="Fall 2026"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-sm font-medium text-slate-700">Clone to term</p>
                                <Input
                                    value={cloneTargetTerm}
                                    onChange={(event) => setCloneTargetTerm(event.target.value)}
                                    placeholder="Winter 2027"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-sm font-medium text-slate-700">Target status</p>
                                <Select
                                    value={cloneTargetStatus}
                                    onValueChange={(value) =>
                                        setCloneTargetStatus(value as CloneOfferingStatus)
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Target status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {cloneOfferingStatuses.map((status) => (
                                            <SelectItem key={status.value} value={status.value}>
                                                {status.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                            <Input
                                value={cloneReason}
                                onChange={(event) => setCloneReason(event.target.value)}
                                placeholder="Audit reason"
                            />
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                                <Checkbox
                                    checked={cloneOverwriteExisting}
                                    onCheckedChange={(checked) =>
                                        setCloneOverwriteExisting(checked === true)
                                    }
                                />
                                Overwrite matching target offerings
                            </label>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={cloneOfferingsForTerm}
                                disabled={cloneSaving}
                            >
                                {cloneSaving ? "Cloning..." : "Clone Term Offerings"}
                            </Button>
                            {cloneResult && (
                                <div className="min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                                    <span className="font-medium text-slate-800">
                                        {cloneResult.target_term}:
                                    </span>{" "}
                                    {cloneResult.created_count} created,{" "}
                                    {cloneResult.updated_count} updated,{" "}
                                    {cloneResult.skipped_count} skipped
                                    {cloneResult.unresolved_held_with_count > 0
                                        ? `, ${cloneResult.unresolved_held_with_count} held-with link${
                                              cloneResult.unresolved_held_with_count === 1
                                                  ? ""
                                                  : "s"
                                          } need target offerings`
                                        : ""}
                                    .
                                </div>
                            )}
                        </div>
                    </Disclosure>
                    <Disclosure
                        open={offeringEditorOpen}
                        onToggle={(event) =>
                            setOfferingEditorOpen(event.currentTarget.open)
                        }
                        summary={
                            offeringDraft.offeringId
                                ? "Edit term offering"
                                : "Create a term offering"
                        }
                        contentClassName="space-y-3"
                    >
                    <div className="grid gap-3 md:grid-cols-3">
                        <div className="space-y-1.5">
                            <p className="text-sm font-medium text-slate-700">Course code</p>
                            <Select
                                value={offeringDraft.courseId || "none"}
                                onValueChange={(value) =>
                                    updateOfferingDraft({
                                        courseId: value === "none" ? "" : value,
                                        heldWithCourseIds: offeringDraft.heldWithCourseIds.filter(
                                            (courseId) => courseId !== value
                                        ),
                                    })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Choose course" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Choose course</SelectItem>
                                    {courses
                                        .filter((course) => course.retired_for_routing !== true)
                                        .map((course) => (
                                            <SelectItem
                                                key={course.course_id}
                                                value={String(course.course_id)}
                                            >
                                                {course.code} - {course.name}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <p className="text-sm font-medium text-slate-700">Term</p>
                            <Input
                                value={offeringDraft.term}
                                onChange={(event) =>
                                    updateOfferingDraft({ term: event.target.value })
                                }
                                placeholder="Fall 2026"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <p className="text-sm font-medium text-slate-700">Status</p>
                            <Select
                                value={offeringDraft.status}
                                onValueChange={(value) =>
                                    updateOfferingDraft({
                                        status: value as CourseOfferingStatus,
                                    })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    {offeringStatuses.map((status) => (
                                        <SelectItem key={status.value} value={status.value}>
                                            {status.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                        <Input
                            value={offeringDraft.titleOverride}
                            onChange={(event) =>
                                updateOfferingDraft({ titleOverride: event.target.value })
                            }
                            placeholder="Title override"
                        />
                        <Input
                            value={offeringDraft.topic}
                            onChange={(event) =>
                                updateOfferingDraft({ topic: event.target.value })
                            }
                            placeholder="Topic"
                        />
                        <Input
                            value={offeringDraft.sectionLabel}
                            onChange={(event) =>
                                updateOfferingDraft({ sectionLabel: event.target.value })
                            }
                            placeholder="Section label"
                        />
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                        <div className="space-y-1.5">
                            <p className="text-sm font-medium text-slate-700">Routing override</p>
                            <Select
                                value={offeringDraft.routingKindOverride}
                                onValueChange={(value) =>
                                    updateOfferingDraft({
                                        routingKindOverride:
                                            value as OfferingRoutingOverride,
                                    })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Use course default" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="inherit">Use course default</SelectItem>
                                    {routingKinds.map((kind) => (
                                        <SelectItem key={kind.value} value={kind.value}>
                                            {kind.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <p className="text-sm font-medium text-slate-700">Offering ecosystem</p>
                            <Select
                                value={offeringDraft.ecosystemId}
                                onValueChange={(value) =>
                                    updateOfferingDraft({ ecosystemId: value })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Use course ecosystem" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="inherit">Use course ecosystem</SelectItem>
                                    {activeSharedEcosystems.map((ecosystem) => (
                                        <SelectItem
                                            key={ecosystem.ecosystem_id}
                                            value={String(ecosystem.ecosystem_id)}
                                        >
                                            {ecosystem.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <p className="text-sm font-medium text-slate-700">Support rule</p>
                            <Select
                                value={offeringDraft.requiresSupport}
                                onValueChange={(value) =>
                                    updateOfferingDraft({
                                        requiresSupport: value as OfferingSupportRule,
                                    })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Use course default" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="inherit">Use course default</SelectItem>
                                    <SelectItem value="required">Requires support</SelectItem>
                                    <SelectItem value="not_required">Does not require support</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <Textarea
                        value={offeringDraft.description}
                        onChange={(event) =>
                            updateOfferingDraft({ description: event.target.value })
                        }
                        placeholder="Term-specific description"
                        rows={3}
                    />
                    <div className="grid gap-3 md:grid-cols-2">
                        <Textarea
                            value={offeringDraft.studentRegistrationNotes}
                            onChange={(event) =>
                                updateOfferingDraft({
                                    studentRegistrationNotes: event.target.value,
                                })
                            }
                            placeholder="Student registration notes"
                            rows={3}
                        />
                        <Textarea
                            value={offeringDraft.adminRoutingNotes}
                            onChange={(event) =>
                                updateOfferingDraft({
                                    adminRoutingNotes: event.target.value,
                                })
                            }
                            placeholder="Admin routing notes"
                            rows={3}
                        />
                    </div>
                    <Input
                        value={offeringDraft.sourceUrl}
                        onChange={(event) =>
                            updateOfferingDraft({ sourceUrl: event.target.value })
                        }
                        placeholder="Source URL"
                    />
                    <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                        <p className="text-sm font-medium text-slate-700">Held with courses</p>
                        <div className="grid max-h-48 gap-2 overflow-y-auto md:grid-cols-2">
                            {courses
                                .filter(
                                    (course) =>
                                        course.retired_for_routing !== true &&
                                        String(course.course_id) !== offeringDraft.courseId
                                )
                                .map((course) => (
                                    <label
                                        key={course.course_id}
                                        className="flex items-center gap-2 text-sm text-slate-700"
                                    >
                                        <Checkbox
                                            checked={offeringDraft.heldWithCourseIds.includes(
                                                String(course.course_id)
                                            )}
                                            onCheckedChange={(checked) =>
                                                toggleHeldWithCourse(
                                                    course.course_id,
                                                    checked === true
                                                )
                                            }
                                        />
                                        {course.code} - {course.name}
                                    </label>
                                ))}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {offeringStatusNeedsConfirmation ? (
                            <ConfirmActionDialog
                                trigger={
                                    <Button type="button" disabled={offeringSaving}>
                                        {offeringDraft.offeringId
                                            ? "Save Offering"
                                            : "Create Offering"}
                                    </Button>
                                }
                                title={
                                    offeringDraft.status === "archived"
                                        ? "Archive this term offering?"
                                        : "Make this term offering inactive?"
                                }
                                description={
                                    offeringDraft.status === "archived"
                                        ? "This removes the offering from live routing and marks it as historical. Existing project, team, and enrollment records remain unchanged."
                                        : "This removes the offering from active term routing until an administrator reactivates it. Existing project, team, and enrollment records remain unchanged."
                                }
                                confirmLabel={
                                    offeringDraft.status === "archived"
                                        ? "Archive offering"
                                        : "Make offering inactive"
                                }
                                tone="destructive"
                                reasonLabel="Audit reason"
                                reasonDescription="This reason will be added to the offering's admin routing notes."
                                reasonPlaceholder="Enter the operational reason for this status change"
                                reasonRequired
                                onConfirm={saveOfferingDraft}
                            />
                        ) : (
                            <Button
                                type="button"
                                onClick={() => saveOfferingDraft()}
                                disabled={offeringSaving}
                            >
                                {offeringSaving
                                    ? "Saving..."
                                    : offeringDraft.offeringId
                                      ? "Save Offering"
                                      : "Create Offering"}
                            </Button>
                        )}
                        <Button type="button" variant="outline" onClick={resetOfferingDraft}>
                            Close editor
                        </Button>
                    </div>
                    </Disclosure>
                    <div className="space-y-3">
                        {offerings.length === 0 ? (
                            <p className="text-sm text-slate-500">No course offerings found.</p>
                        ) : (
                            offerings.map((offering) => (
                                <div
                                    key={offering.course_offering_id}
                                    className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 sm:p-4"
                                >
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                                                Term offering
                                            </p>
                                            <p className="mt-1 break-words font-semibold text-slate-950">
                                                {offeringLabel(offering)}
                                            </p>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                <StatusBadge tone="neutral">
                                                    {offering.term}
                                                </StatusBadge>
                                                <StatusBadge
                                                    tone={
                                                        offering.status === "active"
                                                            ? "success"
                                                            : offering.status === "draft"
                                                              ? "warning"
                                                              : "neutral"
                                                    }
                                                >
                                                    {offeringStatuses.find(
                                                        (status) => status.value === offering.status
                                                    )?.label || offering.status}
                                                </StatusBadge>
                                            </div>
                                        </div>
                                        <div className="flex shrink-0 flex-wrap gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => editOffering(offering)}
                                            >
                                                Edit
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => copyOffering(offering)}
                                            >
                                                Copy next term
                                            </Button>
                                        </div>
                                    </div>
                                    <Disclosure
                                        summary="Offering details"
                                        contentClassName="space-y-3"
                                    >
                                        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                            <div>
                                                <dt className="text-xs font-medium text-slate-500">
                                                    Topic
                                                </dt>
                                                <dd className="mt-1 text-slate-800">
                                                    {offering.topic || "No topic"}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-xs font-medium text-slate-500">
                                                    Ecosystem
                                                </dt>
                                                <dd className="mt-1 text-slate-800">
                                                    {offering.ecosystem?.name ? (
                                                        <TaxonomyChip
                                                            namespace="ecosystem"
                                                            value={offering.ecosystem.name}
                                                        />
                                                    ) : (
                                                        "Use stable course ecosystem"
                                                    )}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-xs font-medium text-slate-500">
                                                    Held with
                                                </dt>
                                                 <dd className="mt-1 text-slate-800">
                                                     {offering.held_with_courses &&
                                                     offering.held_with_courses.length > 0
                                                         ? (
                                                               <TaxonomyChipList
                                                                   namespace="course"
                                                                   values={offering.held_with_courses.map((course) => course.code)}
                                                               />
                                                           )
                                                         : "None"}
                                                 </dd>
                                            </div>
                                        </dl>
                                        {offering.admin_routing_notes && (
                                            <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                                                <p className="text-xs font-medium text-slate-500">
                                                    Admin routing notes
                                                </p>
                                                <p className="mt-1 whitespace-pre-wrap">
                                                    {offering.admin_routing_notes}
                                                </p>
                                            </div>
                                        )}
                                        {offering.source_url && (
                                            <a
                                                className="inline-flex text-sm font-medium text-blue-700 underline underline-offset-2"
                                                href={offering.source_url}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                Open source
                                            </a>
                                        )}
                                    </Disclosure>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </section>
            <Card
                className={`order-20 ${activeView === "courses" ? "" : "hidden"}`}
            >
                <CardHeader>
                    <SectionHeader
                        title="Stable course identities"
                        description="Catalog identity persists across terms. Readiness combines live course state, a current offering, and active instructor coverage."
                    />
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <p className="text-sm text-slate-600" role="status">
                            Loading stable courses...
                        </p>
                    ) : courses.length === 0 ? (
                        <EmptyState
                            title="No stable courses found"
                            description="Create a stable course identity before adding a term offering."
                        />
                    ) : (
                        <div className="space-y-3">
                            {courses.map((course) => {
                                const isEditing = editingId === course.course_id;
                                const pipelineEdges = course.pipeline_next_courses || [];
                                const pipelineDraft = pipelineDraftFor(course);
                                const currentOffering = course.current_offering || null;
                                const isForcingInactive =
                                    isEditing &&
                                    editActivationMode === "force_inactive" &&
                                    course.activation_mode !== "force_inactive";
                                const activeInstructorCount = Number(
                                    course.active_instructor_count || 0
                                );
                                const readinessLabel = course.retired_for_routing
                                    ? "Retired"
                                    : course.active === false
                                      ? "Inactive"
                                      : (currentOffering !== null &&
                                            currentOffering.status !== "active") ||
                                          activeInstructorCount === 0
                                        ? "Needs setup"
                                        : "Ready";
                                const readinessTone =
                                    readinessLabel === "Ready"
                                        ? "success"
                                        : readinessLabel === "Needs setup"
                                          ? "warning"
                                          : "neutral";
                                return (
                                    <div
                                        key={course.course_id}
                                        className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 sm:p-4"
                                    >
                                        {isEditing ? (
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <Input
                                                        value={editCode}
                                                        onChange={(event) =>
                                                            setEditCode(event.target.value)
                                                        }
                                                    />
                                                    <Input
                                                        value={editName}
                                                        onChange={(event) =>
                                                            setEditName(event.target.value)
                                                        }
                                                    />
                                                </div>
                                                 <div className="space-y-2">
                                                     <p className="text-sm font-medium text-slate-700">
                                                         Terms active
                                                     </p>
                                                     <div className="flex flex-wrap gap-3">
                                                         {COURSE_SEASONS.map((season) => (
                                                             <label
                                                                 key={season}
                                                                 className="flex items-center gap-2 text-sm text-slate-700"
                                                             >
                                                                 <Checkbox
                                                                     checked={editActiveTerms.includes(season)}
                                                                     onCheckedChange={(checked) =>
                                                                         setEditActiveTerms((current) =>
                                                                             toggleSeason(
                                                                                 current,
                                                                                 season,
                                                                                 checked === true
                                                                             )
                                                                         )
                                                                     }
                                                                 />
                                                                 {season}
                                                             </label>
                                                         ))}
                                                     </div>
                                                 </div>
                                                 <div className="max-w-sm space-y-1.5">
                                                     <p className="text-sm font-medium text-slate-700">
                                                         Activation mode
                                                     </p>
                                                     <Select
                                                         value={editActivationMode}
                                                         onValueChange={(value) =>
                                                             setEditActivationMode(value as ActivationMode)
                                                         }
                                                     >
                                                         <SelectTrigger>
                                                             <SelectValue placeholder="Activation mode" />
                                                         </SelectTrigger>
                                                         <SelectContent>
                                                             {activationModes.map((mode) => (
                                                                 <SelectItem
                                                                     key={mode.value}
                                                                     value={mode.value}
                                                                 >
                                                                     {mode.label}
                                                                 </SelectItem>
                                                             ))}
                                                         </SelectContent>
                                                     </Select>
                                                     <p className="text-xs text-slate-500">
                                                         {
                                                             activationModes.find(
                                                                 (mode) => mode.value === editActivationMode
                                                             )?.description
                                                         }
                                                     </p>
                                                 </div>
                                                   <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                                       <div className="space-y-1.5">
                                                          <p className="text-sm font-medium text-slate-700">
                                                              Department
                                                          </p>
                                                          <Select
                                                              value={editDepartmentId}
                                                              onValueChange={setEditDepartmentId}
                                                          >
                                                              <SelectTrigger>
                                                                  <SelectValue placeholder="No department" />
                                                              </SelectTrigger>
                                                              <SelectContent>
                                                                  <SelectItem value="none">No department</SelectItem>
                                                                  {departments.map((department) => (
                                                                      <SelectItem
                                                                          key={department.department_id}
                                                                          value={String(department.department_id)}
                                                                      >
                                                                          {departmentLabel(department)}
                                                                          {department.active === false ? " (inactive)" : ""}
                                                                      </SelectItem>
                                                                  ))}
                                                              </SelectContent>
                                                           </Select>
                                                       </div>
                                                       <div className="space-y-1.5">
                                                           <p className="text-sm font-medium text-slate-700">
                                                               Project ecosystem
                                                           </p>
                                                            <Select
                                                                value={editEcosystemId}
                                                                onValueChange={setEditEcosystemId}
                                                            >
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Project ecosystem" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {editEcosystemOptions.length === 0 && (
                                                                        <SelectItem value="none" disabled>
                                                                            No valid ecosystems
                                                                        </SelectItem>
                                                                    )}
                                                                    {editEcosystemOptions.map((ecosystem) => (
                                                                        <SelectItem
                                                                            key={ecosystem.ecosystem_id}
                                                                            value={String(ecosystem.ecosystem_id)}
                                                                        >
                                                                            {ecosystem.name}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <p className="text-xs text-slate-500">
                                                                {editRoutingKind === "standard"
                                                                    ? "Standard courses use the Departmental ecosystem."
                                                                    : "Interdisciplinary courses use an active shared ecosystem."}
                                                            </p>
                                                        </div>
                                                       <div className="space-y-1.5">
                                                          <p className="text-sm font-medium text-slate-700">
                                                              Routing kind
                                                          </p>
                                                           <Select
                                                               value={editRoutingKind}
                                                               onValueChange={(value) =>
                                                                   handleEditRoutingKindChange(value as RoutingKind)
                                                               }
                                                           >
                                                              <SelectTrigger>
                                                                  <SelectValue placeholder="Routing kind" />
                                                              </SelectTrigger>
                                                              <SelectContent>
                                                                  {routingKinds.map((kind) => (
                                                                      <SelectItem key={kind.value} value={kind.value}>
                                                                          {kind.label}
                                                                      </SelectItem>
                                                                  ))}
                                                              </SelectContent>
                                                          </Select>
                                                          <p className="text-xs text-slate-500">
                                                              {
                                                                  routingKinds.find(
                                                                      (kind) => kind.value === editRoutingKind
                                                                  )?.description
                                                              }
                                                          </p>
                                                      </div>
                                                  </div>
                                                  <label className="flex items-center gap-2 text-sm text-slate-700">
                                                      <Checkbox
                                                          checked={editRequiresSupport}
                                                         onCheckedChange={(checked) =>
                                                             setEditRequiresSupport(checked === true)
                                                         }
                                                     />
                                                     Require mentor or confirmed external partner before finalization
                                                 </label>
                                                 <label className="flex items-center gap-2 text-sm text-slate-700">
                                                     <Checkbox
                                                         checked={editInstructorPhaseControl}
                                                         disabled={editRoutingKind !== "standard"}
                                                         onCheckedChange={(checked) =>
                                                             setEditInstructorPhaseControl(checked === true)
                                                         }
                                                     />
                                                     Let the assigned instructor advance this standalone course through the marketplace phases
                                                 </label>
                                                 <Disclosure
                                                     summary="Advanced: marketplace phase override"
                                                     contentClassName="bg-slate-50/70"
                                                 >
                                                     <div className="grid gap-3 md:grid-cols-2">
                                                         <div className="space-y-1.5">
                                                             <p className="text-sm font-medium text-slate-700">
                                                                 Course override
                                                             </p>
                                                             <Select
                                                                 value={editPhaseOverride}
                                                                 onValueChange={(value) =>
                                                                     setEditPhaseOverride(value as PhaseOverrideValue)
                                                                 }
                                                                 disabled={editRoutingKind !== "standard"}
                                                             >
                                                                 <SelectTrigger>
                                                                     <SelectValue placeholder="Use global phase" />
                                                                 </SelectTrigger>
                                                                 <SelectContent>
                                                                     {marketplacePhaseOptions.map((phase) => (
                                                                         <SelectItem
                                                                             key={phase.value}
                                                                             value={phase.value}
                                                                         >
                                                                             {phase.label}
                                                                         </SelectItem>
                                                                     ))}
                                                                 </SelectContent>
                                                             </Select>
                                                             <p className="text-xs text-slate-500">
                                                                 Standard courses only. Interdisciplinary courses use their ecosystem phase.
                                                             </p>
                                                         </div>
                                                         <div className="space-y-1.5">
                                                             <p className="text-sm font-medium text-slate-700">
                                                                 Audit reason
                                                             </p>
                                                             <Textarea
                                                                 value={editPhaseOverrideReason}
                                                                 onChange={(event) =>
                                                                     setEditPhaseOverrideReason(event.target.value)
                                                                 }
                                                                 disabled={
                                                                     editRoutingKind !== "standard" ||
                                                                     editPhaseOverride === "none"
                                                                 }
                                                                 placeholder="Why should this course differ from the global phase?"
                                                                 rows={3}
                                                             />
                                                         </div>
                                                     </div>
                                                 </Disclosure>
                                             </div>
                                         ) : (
                                            <div className="space-y-3">
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                    <div className="min-w-0">
                                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                                            Stable course identity
                                                        </p>
                                                        <h3 className="mt-1 break-words font-semibold text-slate-950">
                                                            {course.code} - {course.name}
                                                        </h3>
                                                        <p className="mt-1 text-xs text-slate-500">
                                                            {course.department?.name || "No department"}
                                                            {course.department?.faculty?.name
                                                                ? ` · ${course.department.faculty.name}`
                                                                : ""}
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <StatusBadge tone={readinessTone}>
                                                            {readinessLabel}
                                                        </StatusBadge>
                                                        <StatusBadge
                                                            tone={
                                                                currentOffering?.status === "active"
                                                                    ? "success"
                                                                    : currentOffering
                                                                      ? "warning"
                                                                      : "neutral"
                                                            }
                                                        >
                                                            {currentOffering
                                                                ? `Offering ${offeringStatusLabel(currentOffering.status)}`
                                                                : "No current offering"}
                                                        </StatusBadge>
                                                    </div>
                                                </div>
                                                <div className="grid gap-2 text-sm sm:grid-cols-3">
                                                    <div className="rounded-md border border-blue-100 bg-blue-50/60 px-3 py-2">
                                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                                                            Current offering
                                                        </p>
                                                        <p className="mt-0.5 break-words font-medium text-slate-800">
                                                            {currentOffering
                                                                ? currentOffering.title_override ||
                                                                  currentOffering.topic ||
                                                                  course.name
                                                                : "Not configured"}
                                                        </p>
                                                    </div>
                                                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                                            Staffing
                                                        </p>
                                                        <p className="mt-0.5 font-medium text-slate-800">
                                                            {activeInstructorCount > 0
                                                                ? `${activeInstructorCount} active instructor${activeInstructorCount === 1 ? "" : "s"}`
                                                                : "No active instructor"}
                                                        </p>
                                                    </div>
                                                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                                            Routing
                                                        </p>
                                                        <p className="mt-0.5 font-medium text-slate-800">
                                                            {routingKindLabel(
                                                                course.routing_kind || "standard"
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                                <Disclosure
                                                    summary="Stable identity and routing details"
                                                    contentClassName="space-y-3"
                                                >
                                                    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                                        <div>
                                                            <dt className="text-xs font-medium text-slate-500">
                                                                Active seasons
                                                            </dt>
                                                            <dd className="mt-1 text-slate-800">
                                                                {(course.active_terms || []).length > 0
                                                                    ? (course.active_terms || []).join(", ")
                                                                    : "None"}
                                                            </dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-xs font-medium text-slate-500">
                                                                Activation
                                                            </dt>
                                                            <dd className="mt-1 text-slate-800">
                                                                {activationModeLabel(
                                                                    course.activation_mode
                                                                )}
                                                            </dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-xs font-medium text-slate-500">
                                                                Ecosystem
                                                            </dt>
                                                            <dd className="mt-1 text-slate-800">
                                                                {course.ecosystem?.name ? (
                                                                    <TaxonomyChip
                                                                        namespace="ecosystem"
                                                                        value={course.ecosystem.name}
                                                                    />
                                                                ) : (
                                                                    "None"
                                                                )}
                                                            </dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-xs font-medium text-slate-500">
                                                                Project support
                                                            </dt>
                                                            <dd className="mt-1 text-slate-800">
                                                                {course.requires_project_support !== false
                                                                    ? "Required"
                                                                    : "Optional"}
                                                            </dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-xs font-medium text-slate-500">
                                                                Effective topic
                                                            </dt>
                                                            <dd className="mt-1 text-slate-800">
                                                                {course.effective_topic || "No topic"}
                                                            </dd>
                                                        </div>
                                                        <div>
                                                            <dt className="text-xs font-medium text-slate-500">
                                                                Marketplace phase
                                                            </dt>
                                                            <dd className="mt-1 text-slate-800">
                                                                {course.marketplace_phase_context
                                                                    ?.override_source &&
                                                                course.marketplace_phase_context
                                                                    .override_source !== "global"
                                                                    ? `Override: ${marketplacePhaseLabel(
                                                                          course
                                                                              .marketplace_phase_context
                                                                              .effective_phase
                                                                      )}`
                                                                    : "Global phase"}
                                                            </dd>
                                                        </div>
                                                    </dl>
                                                    {currentOffering && (
                                                        <div className="rounded-md border border-blue-100 bg-blue-50/60 p-3">
                                                            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                                                                Term-specific layer
                                                            </p>
                                                            <p className="mt-1 text-sm text-slate-700">
                                                                {currentOffering.term} · {offeringStatusLabel(currentOffering.status)}
                                                                {course.effective_topic
                                                                    ? ` · ${course.effective_topic}`
                                                                    : ""}
                                                            </p>
                                                        </div>
                                                    )}
                                                </Disclosure>
                                            </div>
                                        )}
                                        <div className="flex flex-wrap gap-2">
                                            {isEditing ? (
                                                <>
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => setEditingId(null)}
                                                    >
                                                        Cancel
                                                    </Button>
                                                    {isForcingInactive ? (
                                                        <ConfirmActionDialog
                                                            trigger={
                                                                <Button disabled={submitting}>
                                                                    Save Details
                                                                </Button>
                                                            }
                                                            title={`Force ${course.code} inactive?`}
                                                            description="This makes the course unavailable for every new live routing decision, regardless of term or instructor coverage. Existing project, team, and enrollment records remain unchanged until the course is reactivated."
                                                            confirmLabel="Force course inactive"
                                                            tone="destructive"
                                                            reasonLabel="Audit reason"
                                                            reasonDescription="Explain why this stable course must be removed from all new routing choices."
                                                            reasonPlaceholder="Enter the operational reason for forcing this course inactive"
                                                            reasonRequired
                                                            onConfirm={(reason) =>
                                                                saveEdit(course, reason)
                                                            }
                                                        />
                                                    ) : (
                                                        <Button
                                                            onClick={() => saveEdit(course)}
                                                            disabled={submitting}
                                                        >
                                                            Save Details
                                                        </Button>
                                                    )}
                                                </>
                                            ) : course.retired_for_routing ? (
                                                <span className="rounded bg-stone-100 px-3 py-2 text-sm text-stone-700">
                                                    Retired routing row
                                                </span>
                                            ) : (
                                                <Button
                                                    variant="outline"
                                                    onClick={() => startEdit(course)}
                                                >
                                                    Edit Details
                                                </Button>
                                            )}
                                        </div>
                                        {!isEditing && (
                                            <Disclosure
                                                summary={`Advanced: pipeline continuations (${pipelineEdges.length})`}
                                                contentClassName="space-y-3 bg-slate-50/70"
                                            >
                                                <div className="space-y-3">
                                                    {pipelineEdges.length > 0 ? (
                                                        <div className="space-y-2">
                                                            {pipelineEdges.map((edge) => {
                                                                const targetCourse = targetCourseForEdge(edge, courses);
                                                                const saving = pipelineSavingId === `edge-${edge.course_pipeline_edge_id}`;
                                                                return (
                                                                    <div
                                                                        key={edge.course_pipeline_edge_id}
                                                                        className="rounded border border-slate-200 bg-white p-3"
                                                                    >
                                                                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                                                            <div>
                                                                                <p className="text-sm font-medium text-slate-900">
                                                                                    {courseLabel(targetCourse)}
                                                                                </p>
                                                                                <div className="mt-1 flex flex-wrap gap-2">
                                                                                    <span
                                                                                        className={`rounded px-2 py-0.5 text-xs ${
                                                                                            edge.active === false
                                                                                                ? "bg-slate-100 text-slate-600"
                                                                                                : "bg-emerald-50 text-emerald-700"
                                                                                        }`}
                                                                                    >
                                                                                        {edge.active === false ? "Inactive" : "Active"}
                                                                                    </span>
                                                                                    {edge.is_default && edge.active !== false && (
                                                                                        <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                                                                                            Default
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                {edge.notes && (
                                                                                    <p className="mt-1 text-xs text-slate-500">
                                                                                        {edge.notes}
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex flex-wrap gap-2">
                                                                                {edge.active !== false && !edge.is_default && (
                                                                                    <Button
                                                                                        type="button"
                                                                                        variant="outline"
                                                                                        onClick={() =>
                                                                                            saveExistingPipelineEdge(course, edge, {
                                                                                                is_default: true,
                                                                                                active: true,
                                                                                            })
                                                                                        }
                                                                                        disabled={saving}
                                                                                    >
                                                                                        Set default
                                                                                    </Button>
                                                                                )}
                                                                                {edge.active === false ? (
                                                                                    <Button
                                                                                        type="button"
                                                                                        variant="outline"
                                                                                        onClick={() =>
                                                                                            saveExistingPipelineEdge(
                                                                                                course,
                                                                                                edge,
                                                                                                {
                                                                                                    active: true,
                                                                                                    is_default:
                                                                                                        edge.is_default ===
                                                                                                        true,
                                                                                                }
                                                                                            )
                                                                                        }
                                                                                        disabled={saving}
                                                                                    >
                                                                                        {saving
                                                                                            ? "Saving..."
                                                                                            : "Reactivate"}
                                                                                    </Button>
                                                                                ) : (
                                                                                    <ConfirmActionDialog
                                                                                        trigger={
                                                                                            <Button
                                                                                                type="button"
                                                                                                variant="outline"
                                                                                                disabled={saving}
                                                                                            >
                                                                                                Archive edge
                                                                                            </Button>
                                                                                        }
                                                                                        title={`Archive continuation to ${courseLabel(targetCourse)}?`}
                                                                                        description="This removes the continuation from active pipeline routing and clears it as the default route. Existing course and project records remain unchanged."
                                                                                        confirmLabel="Archive edge"
                                                                                        tone="destructive"
                                                                                        reasonLabel="Audit reason"
                                                                                        reasonDescription="This reason will be added to the pipeline edge notes."
                                                                                        reasonPlaceholder="Enter the routing reason for archiving this edge"
                                                                                        reasonRequired
                                                                                        onConfirm={(reason) =>
                                                                                            saveExistingPipelineEdge(
                                                                                                course,
                                                                                                edge,
                                                                                                {
                                                                                                    active: false,
                                                                                                    is_default: false,
                                                                                                },
                                                                                                reason
                                                                                            )
                                                                                        }
                                                                                    />
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-slate-500">
                                                            No continuation pipeline is configured for this course.
                                                        </p>
                                                    )}
                                                    <div className="grid gap-3 rounded border border-slate-200 bg-white p-3 md:grid-cols-[minmax(220px,1fr)_minmax(180px,260px)_auto] md:items-end">
                                                        <div className="space-y-1.5">
                                                            <p className="text-sm font-medium text-slate-700">
                                                                Add or update continuation
                                                            </p>
                                                            <Select
                                                                value={pipelineDraft.toCourseId || "none"}
                                                                onValueChange={(value) =>
                                                                    updatePipelineDraft(course.course_id, {
                                                                        toCourseId: value === "none" ? "" : value,
                                                                    })
                                                                }
                                                            >
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Target course" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="none">Choose target course</SelectItem>
                                                                    {courses.map((targetCourse) => (
                                                                        <SelectItem
                                                                            key={targetCourse.course_id}
                                                                            value={String(targetCourse.course_id)}
                                                                        >
                                                                            {courseLabel(targetCourse)}
                                                                            {targetCourse.department?.name
                                                                                ? ` (${targetCourse.department.name})`
                                                                                : ""}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <div className="flex flex-wrap gap-4 pt-1">
                                                                <label className="flex items-center gap-2 text-sm text-slate-700">
                                                                    <Checkbox
                                                                        checked={pipelineDraft.isDefault}
                                                                        onCheckedChange={(checked) =>
                                                                            updatePipelineDraft(course.course_id, {
                                                                                isDefault: checked === true,
                                                                            })
                                                                        }
                                                                    />
                                                                    Default
                                                                </label>
                                                                <label className="flex items-center gap-2 text-sm text-slate-700">
                                                                    <Checkbox
                                                                        checked={pipelineDraft.active}
                                                                        onCheckedChange={(checked) =>
                                                                            updatePipelineDraft(course.course_id, {
                                                                                active: checked === true,
                                                                            })
                                                                        }
                                                                    />
                                                                    Active
                                                                </label>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <p className="text-sm font-medium text-slate-700">
                                                                Notes
                                                            </p>
                                                            <Input
                                                                value={pipelineDraft.notes}
                                                                onChange={(event) =>
                                                                    updatePipelineDraft(course.course_id, {
                                                                        notes: event.target.value,
                                                                    })
                                                                }
                                                                placeholder="Optional notes"
                                                            />
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            onClick={() => savePipelineDraft(course)}
                                                            disabled={
                                                                pipelineSavingId === `draft-${course.course_id}` ||
                                                                !pipelineDraft.toCourseId
                                                            }
                                                        >
                                                            {pipelineSavingId === `draft-${course.course_id}`
                                                                ? "Saving..."
                                                                : "Save pipeline"}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </Disclosure>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

