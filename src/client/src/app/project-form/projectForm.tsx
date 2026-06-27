"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { ProgressSteps } from "@/components/ui/progress-steps";
import type { ProjectFormValues } from "@/components/forms/project";
import {
    defaultFormValues,
    studentFormSections,
    studentFormSteps,
} from "@/components/forms/project/config";

import { Card, CardContent } from "@/components/ui/card";

interface ProjectFormProps {
    initialValues?: Partial<ProjectFormValues>;
    onSubmit?: (values: ProjectFormValues) => void | Promise<void>;
    className?: string;
    submitLabel?: string;
    finalExtraSection?: React.ReactNode;
    isSubmitting?: boolean;
    submissionError?: string | null;
}

function buildStepState(activeStep: number) {
    return studentFormSteps.map((step) => ({
        ...step,
        isActive: step.id === activeStep,
        isCompleted: step.id < activeStep,
    }));
}

export default function ProjectForm({
    initialValues = {},
    onSubmit = () => undefined,
    className = "max-w-4xl mx-auto",
    submitLabel = "Submit",
    finalExtraSection,
    isSubmitting = false,
    submissionError = null,
}: ProjectFormProps) {
    const [currentStep, setCurrentStep] = React.useState(1);
    const [steps, setSteps] = React.useState(() => buildStepState(1));

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
        form.reset({
            ...defaultFormValues,
            ...parsedInitialValues,
        });
        setCurrentStep(1);
        setSteps(buildStepState(1));
    }, [form, initialValuesKey]);

    const updateSteps = (stepNumber: number) => {
        setSteps(buildStepState(stepNumber));
        setCurrentStep(stepNumber);
    };

    const handleSubmit = async (values: ProjectFormValues) => {
        await onSubmit(values);
    };

    const renderStepContent = () => {
        const StepComponent = studentFormSections[currentStep];
        return StepComponent ? <StepComponent control={form.control} /> : null;
    };

    return (
        <Form {...form}>
            <form onSubmit={(e) => e.preventDefault()} className={className}>
                <ProgressSteps
                    steps={steps}
                    className="mb-16 max-w-3xl mx-auto"
                />

                <Card className="border-slate-200 shadow-sm bg-white flex flex-col">
                    <CardContent className="p-2 flex-1 flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-y-auto p-2">
                            {renderStepContent()}
                            {currentStep === steps.length && finalExtraSection}
                            {currentStep === steps.length && submissionError && (
                                <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                    {submissionError}
                                </p>
                            )}
                        </div>

                        <div className="flex justify-between pt-8 mt-4 border-t border-slate-100 flex-shrink-0">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    if (currentStep > 1) {
                                        updateSteps(currentStep - 1);
                                    }
                                }}
                                disabled={currentStep === 1}
                            >
                                Previous
                            </Button>
                            {currentStep < steps.length ? (
                                <Button
                                    type="button"
                                    onClick={async () => {
                                        const isValid = await form.trigger();
                                        if (
                                            isValid &&
                                            currentStep < steps.length
                                        ) {
                                            updateSteps(currentStep + 1);
                                        }
                                    }}
                                >
                                    Next
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    onClick={form.handleSubmit(handleSubmit)}
                                    disabled={isSubmitting}
                                >
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
