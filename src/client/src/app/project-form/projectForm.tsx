"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { ProgressSteps } from "@/components/ui/progress-steps";
import type { ProjectFormValues } from "@/components/forms/project";
import {
    defaultFormValues,
    organizationFormSections,
    studentFormSections,
    studentFormSteps,
    organizationFormSteps,
} from "@/components/forms/project/config";

import { Card, CardContent } from "@/components/ui/card";

interface ProjectFormProps {
    role?: string;
    initialValues?: Partial<ProjectFormValues>;
    onSubmit?: (values: ProjectFormValues) => void;
    className?: string;
}

export default function ProjectForm({
    role,
    initialValues = {},
    onSubmit = (values) => console.log(values),
    className = "max-w-4xl mx-auto",
}: ProjectFormProps) {
    const normalizedRole = role?.toLowerCase();
    const formType =
        normalizedRole === "organization" ? "organization" : "student";

    // Select mapping based on formType
    const formSections =
        formType === "student" ? studentFormSections : organizationFormSections;

    const initialSteps =
        formType === "student" ? studentFormSteps : organizationFormSteps;

    const [currentStep, setCurrentStep] = React.useState(1);
    const [steps, setSteps] = React.useState(initialSteps);

    const form = useForm<ProjectFormValues>({
        defaultValues: {
            ...defaultFormValues,
            ...initialValues,
        },
    });

    const updateSteps = (stepNumber: number) => {
        setSteps(
            steps.map((step) => ({
                ...step,
                isActive: step.id === stepNumber,
                isCompleted: step.id < stepNumber,
            }))
        );
        setCurrentStep(stepNumber);
    };

    const handleSubmit = async (values: ProjectFormValues) => {
        await onSubmit(values);
    };

    const renderStepContent = () => {
        const StepComponent = formSections[currentStep];
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
                                >
                                    Submit
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </form>
        </Form>
    );
}
