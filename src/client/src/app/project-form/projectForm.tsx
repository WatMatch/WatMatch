"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { ProgressSteps } from "@/components/ui/progress-steps";
import { TaxonomyChipList } from "@/components/ui/taxonomy-chip";
import type { ProjectFormValues } from "@/components/forms/project";
import {
    defaultFormValues,
    studentFormSections,
} from "@/components/forms/project/config";

import { Card, CardContent } from "@/components/ui/card";
import {
    ArrowLeft,
    ArrowRight,
    Check,
    CheckCircle2,
    Circle,
    FileText,
} from "lucide-react";

interface ProjectFormProps {
    initialValues?: Partial<ProjectFormValues>;
    onSubmit?: (
        values: ProjectFormValues
    ) => void | boolean | Promise<void | boolean>;
    className?: string;
    submitLabel?: string;
    finalExtraSection?: React.ReactNode;
    isSubmitting?: boolean;
    submissionError?: string | null;
    draftStorageKey?: string | null;
}

const formSteps = [
    { id: 1, name: "Route" },
    { id: 2, name: "Project" },
    { id: 3, name: "Team" },
    { id: 4, name: "Validation" },
    { id: 5, name: "Resources" },
    { id: 6, name: "Review" },
];

const stepDescriptions: Record<number, string> = {
    1: "Choose the academic route and identify the proposal.",
    2: "Define the problem, intended outcomes, scope, and deliverables.",
    3: "Describe the team, disciplines, and skills the work needs.",
    4: "Explain how the team will test the work and manage constraints.",
    5: "Record support, resources, partner context, and required agreements.",
    6: "Check the complete proposal before sending it for routing and review.",
};

interface StoredProjectDraft {
    version: 1;
    savedAt: string;
    values: Partial<ProjectFormValues>;
}

function formatDraftTime(value: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "recently";
    return parsed.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
    });
}

function buildStepState(activeStep: number) {
    return formSteps.map((step) => ({
        ...step,
        isActive: step.id === activeStep,
        isCompleted: step.id < activeStep,
    }));
}

function SummaryValue({
    label,
    value,
}: {
    label: string;
    value?: React.ReactNode;
}) {
    return (
        <div className="min-w-0">
            <dt className="text-xs font-medium text-slate-500">{label}</dt>
            <dd className="mt-1 text-sm leading-6 text-slate-800 [overflow-wrap:anywhere]">
                {value || <span className="text-slate-400">Not provided</span>}
            </dd>
        </div>
    );
}

function ProjectReview({ values }: { values: ProjectFormValues }) {
    const acknowledgements = [
        ["Public evaluation", values.publicEvaluationAcknowledged],
        ["Intellectual property", values.ipAcknowledged],
        ["Confidentiality", values.confidentialityAcknowledged],
    ] as const;
    const routeLabel =
        values.submissionTrack === "interdisciplinary"
            ? `Interdisciplinary course${values.interdisciplinaryCourseId ? ` #${values.interdisciplinaryCourseId}` : ""}`
            : "Home capstone course";

    return (
        <div className="space-y-5">
            <div className="rounded-lg border border-blue-200 bg-blue-50/70 px-4 py-3">
                <div className="flex items-start gap-2.5">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
                    <div>
                        <h3 className="text-sm font-semibold text-blue-950">Ready for your review</h3>
                        <p className="mt-0.5 text-xs leading-5 text-blue-900">
                            Submission may first go to staff for course routing. It is not finalized until the academic workflow is complete.
                        </p>
                    </div>
                </div>
            </div>

            <section className="rounded-lg border border-slate-200 bg-white p-4" aria-labelledby="review-route">
                <h3 id="review-route" className="text-sm font-semibold text-slate-950">Route and identity</h3>
                <dl className="mt-3 grid gap-4 sm:grid-cols-2">
                    <SummaryValue label="Academic route" value={routeLabel} />
                     <SummaryValue label="Project title" value={values.projectTitle} />
                     <SummaryValue label="Target start" value={values.projectStartDate} />
                     <SummaryValue
                         label="How you found the capstone pathway"
                         value={values.howHeardAboutCapstone}
                     />
                    <SummaryValue
                        label="Disciplines"
                        value={
                            <TaxonomyChipList
                                namespace="discipline"
                                values={values.projectDisciplines}
                            />
                        }
                    />
                </dl>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4" aria-labelledby="review-project">
                <h3 id="review-project" className="text-sm font-semibold text-slate-950">Project plan</h3>
                <dl className="mt-3 grid gap-4 sm:grid-cols-2">
                     <SummaryValue label="Problem" value={values.problemArea} />
                     <SummaryValue label="Objectives" value={values.mainObjectives} />
                     <SummaryValue label="Scope of work" value={values.scopeOfWork} />
                    <SummaryValue
                        label="Deliverable types"
                        value={
                            <TaxonomyChipList
                                namespace="deliverable"
                                values={values.deliverableTypes}
                            />
                        }
                    />
                    <SummaryValue label="Deliverables" value={values.deliverables} />
                     <SummaryValue label="Success criteria" value={values.successCriteria} />
                     <SummaryValue label="Validation plan" value={values.validationPlan} />
                     <SummaryValue label="Stakeholders and users" value={values.stakeholders} />
                     <SummaryValue label="Risks and constraints" value={values.risksConstraints} />
                </dl>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4" aria-labelledby="review-team-support">
                <h3 id="review-team-support" className="text-sm font-semibold text-slate-950">Team and support</h3>
                <dl className="mt-3 grid gap-4 sm:grid-cols-2">
                    <SummaryValue
                        label="Useful skills"
                        value={
                            <TaxonomyChipList
                                namespace="skill"
                                values={values.skillsRequired}
                            />
                        }
                    />
                    <SummaryValue label="Proposed team" value={values.proposedTeamMembers} />
                     <SummaryValue label="Meeting cadence" value={values.meetingFrequency} />
                     <SummaryValue
                         label="External partner"
                         value={values.externalPartnerOrganization || values.organizationName}
                     />
                     <SummaryValue label="UWaterloo resources" value={values.uwResources} />
                     <SummaryValue label="Organization resources" value={values.orgResources} />
                     <SummaryValue label="Other resources" value={values.otherResources} />
                 </dl>
            </section>

            <section className="rounded-lg border border-slate-200 bg-slate-50 p-4" aria-labelledby="review-agreements">
                <h3 id="review-agreements" className="text-sm font-semibold text-slate-950">Required agreements</h3>
                <ul className="mt-3 grid gap-2 sm:grid-cols-3">
                    {acknowledgements.map(([label, checked]) => (
                        <li key={label} className="flex items-center gap-2 text-sm text-slate-700">
                            {checked ? (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                            ) : (
                                <Circle className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                            )}
                            {label}
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}

export default function ProjectForm({
    initialValues = {},
    onSubmit = () => undefined,
    className = "max-w-4xl mx-auto",
    submitLabel = "Submit",
    finalExtraSection,
    isSubmitting = false,
    submissionError = null,
    draftStorageKey = null,
}: ProjectFormProps) {
    const [currentStep, setCurrentStep] = React.useState(1);
    const [steps, setSteps] = React.useState(() => buildStepState(1));
    const [showValidationSummary, setShowValidationSummary] = React.useState(false);
    const [draftMessage, setDraftMessage] = React.useState(
        draftStorageKey
            ? "Draft saves automatically in this browser."
            : "Changes remain on this page until submitted."
    );
    const [hasSavedDraft, setHasSavedDraft] = React.useState(false);
    const autosaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
        null
    );

    const form = useForm<ProjectFormValues>({
        defaultValues: {
            ...defaultFormValues,
            ...initialValues,
        },
    });

    const initialValuesKey = React.useMemo(
        () => JSON.stringify(initialValues ?? {}),
        [initialValues]
    );

    React.useEffect(() => {
        const parsedInitialValues = JSON.parse(
            initialValuesKey
        ) as Partial<ProjectFormValues>;
        let nextValues: ProjectFormValues = {
            ...defaultFormValues,
            ...parsedInitialValues,
        };
        let restoredAt = "";

        if (draftStorageKey) {
            try {
                const rawDraft = window.localStorage.getItem(draftStorageKey);
                if (rawDraft) {
                    const draft = JSON.parse(rawDraft) as StoredProjectDraft;
                    if (
                        draft.version === 1 &&
                        draft.values &&
                        typeof draft.values === "object"
                    ) {
                        nextValues = {
                            ...nextValues,
                            ...draft.values,
                        };
                        restoredAt = draft.savedAt;
                    }
                }
            } catch {
                setDraftMessage(
                    "A saved browser draft could not be restored; original values are shown."
                );
            }
        }

        if (parsedInitialValues.submissionTrackLocked === true) {
            nextValues.submissionTrack =
                parsedInitialValues.submissionTrack ?? "home_course";
            nextValues.interdisciplinaryCourseId =
                parsedInitialValues.interdisciplinaryCourseId ?? "";
            nextValues.submissionTrackLocked = true;
        }

        form.reset(nextValues);
        setCurrentStep(1);
        setSteps(buildStepState(1));
        setShowValidationSummary(false);
        if (restoredAt) {
            setHasSavedDraft(true);
            setDraftMessage(
                `Draft restored from this browser (saved ${formatDraftTime(restoredAt)}).`
            );
        } else if (draftStorageKey) {
            setHasSavedDraft(false);
            setDraftMessage("Draft saves automatically in this browser.");
        } else {
            setHasSavedDraft(false);
            setDraftMessage("Changes remain on this page until submitted.");
        }
    }, [draftStorageKey, form, initialValuesKey]);

    React.useEffect(() => {
        if (!draftStorageKey) return;

        const subscription = form.watch((values) => {
            if (autosaveTimerRef.current) {
                clearTimeout(autosaveTimerRef.current);
            }
            setDraftMessage("Saving draft in this browser…");
            autosaveTimerRef.current = setTimeout(() => {
                const savedAt = new Date().toISOString();
                const draft: StoredProjectDraft = {
                    version: 1,
                    savedAt,
                    values: values as Partial<ProjectFormValues>,
                };
                try {
                    window.localStorage.setItem(
                        draftStorageKey,
                        JSON.stringify(draft)
                    );
                    setHasSavedDraft(true);
                    setDraftMessage(
                        `Draft saved in this browser at ${formatDraftTime(savedAt)}.`
                    );
                } catch {
                    setDraftMessage(
                        "Draft could not be saved in this browser. Keep this page open."
                    );
                }
            }, 500);
        });

        return () => {
            subscription.unsubscribe();
            if (autosaveTimerRef.current) {
                clearTimeout(autosaveTimerRef.current);
                autosaveTimerRef.current = null;
            }
        };
    }, [draftStorageKey, form, initialValuesKey]);

    const updateSteps = (stepNumber: number) => {
        setSteps(buildStepState(stepNumber));
        setCurrentStep(stepNumber);
        setShowValidationSummary(false);
    };

    const handleSubmit = async (values: ProjectFormValues) => {
        const submitted = await onSubmit(values);
        if (submitted !== false && draftStorageKey) {
            if (autosaveTimerRef.current) {
                clearTimeout(autosaveTimerRef.current);
                autosaveTimerRef.current = null;
            }
            try {
                window.localStorage.removeItem(draftStorageKey);
            } catch {
                // Submission already succeeded; storage cleanup must not mask it.
            }
            setHasSavedDraft(false);
            setDraftMessage("Submitted; browser draft cleared.");
        }
    };

    const clearSavedDraft = () => {
        if (!draftStorageKey || !hasSavedDraft) return;
        if (autosaveTimerRef.current) {
            clearTimeout(autosaveTimerRef.current);
            autosaveTimerRef.current = null;
        }
        try {
            window.localStorage.removeItem(draftStorageKey);
            setHasSavedDraft(false);
            setDraftMessage(
                "Saved browser draft cleared. Current changes remain on this page."
            );
        } catch {
            setDraftMessage("The saved browser draft could not be cleared.");
        }
    };

    const renderStepContent = () => {
        if (currentStep === formSteps.length) {
            return <ProjectReview values={form.getValues()} />;
        }
        const StepComponent = studentFormSections[currentStep];
        return StepComponent ? <StepComponent control={form.control} /> : null;
    };

    return (
        <Form {...form}>
            <form onSubmit={(e) => e.preventDefault()} className={className}>
                <ProgressSteps
                    steps={steps}
                    className="mx-auto mb-5 max-w-3xl"
                    theme={{
                        active: "bg-slate-900",
                        completed: "bg-emerald-600",
                        inactive: "bg-slate-200",
                        text: { active: "text-slate-900", inactive: "text-slate-500" },
                    }}
                    transitionDuration={160}
                />

                <div
                    className="mb-3 flex flex-col gap-1.5 text-xs font-medium text-slate-500 sm:flex-row sm:items-center sm:justify-between"
                    aria-live="polite"
                    title="Proposal drafts are stored only in this browser and are cleared after a successful submission."
                >
                    <span>{draftMessage}</span>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clearSavedDraft}
                        disabled={!draftStorageKey || !hasSavedDraft}
                        className="self-start sm:self-auto"
                    >
                        Clear saved draft
                    </Button>
                </div>

                <Card className="gap-0 p-0">
                    <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-4 sm:px-6">
                        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                            <div className="min-w-0">
                                <p className="text-xs font-medium text-slate-500">
                                    Step {currentStep} of {steps.length}
                                </p>
                                <h2 className="mt-0.5 text-lg font-semibold text-slate-950">
                                    {formSteps[currentStep - 1]?.name}
                                </h2>
                            </div>
                            <p className="max-w-md text-xs leading-5 text-slate-500 sm:text-right">
                                {stepDescriptions[currentStep]}
                            </p>
                        </div>
                    </div>
                    <CardContent className="p-4 sm:p-6">
                        {showValidationSummary && (
                            <div
                                className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                                role="alert"
                            >
                                Complete the required fields highlighted below before continuing.
                            </div>
                        )}
                        <div>
                            {renderStepContent()}
                            {currentStep === steps.length && finalExtraSection}
                            {currentStep === steps.length && submissionError && (
                                <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                                    {submissionError}
                                </p>
                            )}
                        </div>

                        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    if (currentStep > 1) {
                                        updateSteps(currentStep - 1);
                                    }
                                }}
                                disabled={currentStep === 1}
                                className="w-full sm:w-auto"
                            >
                                <ArrowLeft aria-hidden="true" />
                                Previous
                            </Button>
                            {currentStep < steps.length ? (
                                <Button
                                    type="button"
                                    className="w-full sm:w-auto"
                                    onClick={async () => {
                                        const isValid = await form.trigger(undefined, {
                                            shouldFocus: true,
                                        });
                                        setShowValidationSummary(!isValid);
                                        if (
                                            isValid &&
                                            currentStep < steps.length
                                        ) {
                                            updateSteps(currentStep + 1);
                                        }
                                    }}
                                >
                                    Continue
                                    <ArrowRight aria-hidden="true" />
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    onClick={form.handleSubmit(handleSubmit, () => {
                                        setShowValidationSummary(true);
                                    })}
                                    disabled={isSubmitting}
                                    className="w-full sm:w-auto"
                                >
                                    {!isSubmitting && <Check aria-hidden="true" />}
                                    {isSubmitting ? "Submitting..." : submitLabel}
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </form>
        </Form>
    );
}
