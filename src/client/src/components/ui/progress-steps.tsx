import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
    id: number;
    name: string;
    isActive: boolean;
    isCompleted: boolean;
}

interface ThemeColors {
    active: string;
    completed: string;
    inactive: string;
    text: { active: string; inactive: string };
}

interface ProgressStepsProps {
    steps: Step[];
    title?: string;
    titleClassName?: string;
    className?: string;
    theme?: Partial<ThemeColors>;
    circleSize?: "sm" | "md" | "lg";
    showStepNumbers?: boolean;
    transitionDuration?: number;
}

const defaultTheme: ThemeColors = {
    active: "bg-slate-950",
    completed: "bg-emerald-600",
    inactive: "bg-slate-200",
    text: { active: "text-slate-900", inactive: "text-slate-500" },
};

const circleSizes = {
    sm: "size-6 text-[11px]",
    md: "size-7 text-xs",
    lg: "size-9 text-sm",
};

const stepGridColumns: Record<number, string> = {
    1: "sm:grid-cols-1",
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3",
    4: "sm:grid-cols-4",
    5: "sm:grid-cols-5",
    6: "sm:grid-cols-6",
};

export function ProgressSteps({
    steps,
    title,
    titleClassName = "text-lg font-semibold text-slate-950",
    className,
    theme = {},
    circleSize = "md",
    showStepNumbers = true,
}: ProgressStepsProps) {
    const mergedTheme = { ...defaultTheme, ...theme, text: { ...defaultTheme.text, ...theme.text } };

    return (
        <div className={cn("w-full", className)}>
            {title ? <h2 className={titleClassName}>{title}</h2> : null}
            <ol className={cn("mt-4 grid gap-2 sm:gap-0", stepGridColumns[Math.min(Math.max(steps.length, 1), 6)])} aria-label="Form progress">
                {steps.map((step, index) => (
                    <li key={step.id} className="relative flex items-center gap-3 sm:flex-col sm:gap-2">
                        {index > 0 ? (
                            <span className={cn("absolute hidden h-px w-1/2 -translate-x-full bg-slate-200 sm:left-1/2 sm:top-3.5 sm:block", step.isCompleted || step.isActive ? "bg-emerald-500" : "")} aria-hidden="true" />
                        ) : null}
                        {index < steps.length - 1 ? (
                            <span className={cn("absolute hidden h-px w-1/2 bg-slate-200 sm:left-1/2 sm:top-3.5 sm:block", step.isCompleted ? "bg-emerald-500" : "")} aria-hidden="true" />
                        ) : null}
                        <span
                            className={cn(
                                "relative z-10 flex shrink-0 items-center justify-center rounded-full font-semibold transition-colors",
                                circleSizes[circleSize],
                                step.isCompleted ? `${mergedTheme.completed} text-white` : step.isActive ? `${mergedTheme.active} text-white` : `${mergedTheme.inactive} text-slate-500`
                            )}
                            aria-current={step.isActive ? "step" : undefined}
                        >
                            {step.isCompleted ? <Check className="size-3.5" /> : showStepNumbers ? step.id : null}
                        </span>
                        <span className={cn("text-sm font-medium sm:max-w-28 sm:text-center sm:text-xs", step.isActive || step.isCompleted ? mergedTheme.text.active : mergedTheme.text.inactive)}>{step.name}</span>
                    </li>
                ))}
            </ol>
        </div>
    );
}
