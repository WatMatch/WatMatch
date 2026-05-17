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
    text: {
        active: string;
        inactive: string;
    };
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
    active: "bg-green-500",
    completed: "bg-green-500",
    inactive: "bg-gray-200",
    text: {
        active: "text-gray-900",
        inactive: "text-gray-500",
    },
};

const circleSizes = {
    sm: { className: "w-6 h-6 text-xs", radius: 12 },
    md: { className: "w-8 h-8 text-sm", radius: 16 },
    lg: { className: "w-10 h-10 text-base", radius: 20 },
};

export function ProgressSteps({
    steps,
    title,
    titleClassName = "text-2xl font-semibold text-center mb-8",
    className = "w-full py-4 mb-8",
    theme = defaultTheme,
    circleSize = "md",
    showStepNumbers = true,
    transitionDuration = 300,
}: ProgressStepsProps) {
    const completedCount = steps.filter((s) => s.isCompleted).length;
    const mergedTheme = { ...defaultTheme, ...theme };
    const circleRadius = circleSizes[circleSize].radius;

    return (
        <div className={className}>
            {title && <h1 className={titleClassName}>{title}</h1>}
            <div className="relative" style={{ paddingBottom: "2.5rem" }}>
                {/* Background line across all steps */}
                <div
                    className="absolute h-1 bg-gray-200 rounded-full z-0"
                    style={{
                        left: "0%",
                        right: "0%",
                        top: `${circleRadius}px`,
                    }}
                />
                {/* Progress line shows completed portion */}
                <div
                    className={`absolute h-1 rounded-full z-0 transition-all ${
                        mergedTheme.completed.startsWith("bg-")
                            ? mergedTheme.completed
                            : ""
                    }`}
                    style={{
                        left: "0%",
                        top: `${circleRadius}px`,
                        width:
                            steps.length > 1
                                ? `${
                                      (completedCount / (steps.length - 1)) *
                                      100
                                  }%`
                                : "0%",
                        backgroundColor: mergedTheme.completed.startsWith("bg-")
                            ? undefined
                            : mergedTheme.completed,
                        transitionDuration: `${transitionDuration}ms`,
                    }}
                />
                {/* Circles and labels */}
                <div className="relative z-10">
                    {steps.map((step, index) => {
                        const position =
                            steps.length > 1
                                ? (index / (steps.length - 1)) * 100
                                : 50;
                        return (
                            <div
                                key={step.id}
                                className="absolute flex flex-col items-center"
                                style={{
                                    left: `${position}%`,
                                    transform: "translateX(-50%)",
                                }}
                            >
                                <div
                                    className={`${
                                        circleSizes[circleSize].className
                                    } rounded-full flex items-center justify-center 
                                      transition-colors duration-200
                                      ${
                                          step.isActive
                                              ? `${mergedTheme.active} text-white`
                                              : step.isCompleted
                                              ? `${mergedTheme.completed} text-white`
                                              : `${mergedTheme.inactive} ${mergedTheme.text.inactive}`
                                      }`}
                                >
                                    {showStepNumbers ? step.id : ""}
                                </div>
                                <span
                                    className={`mt-2 text-sm font-medium transition-colors duration-200 text-center whitespace-nowrap
                                        ${
                                            step.isActive || step.isCompleted
                                                ? mergedTheme.text.active
                                                : mergedTheme.text.inactive
                                        }`}
                                    style={{
                                        transitionDuration: `${transitionDuration}ms`,
                                    }}
                                >
                                    {step.name}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
