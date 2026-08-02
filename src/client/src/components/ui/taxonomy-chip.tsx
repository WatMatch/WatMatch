import { cn } from "@/lib/utils";

export type TaxonomyNamespace =
    | "discipline"
    | "program"
    | "department"
    | "skill"
    | "deliverable"
    | "theme"
    | "research-area"
    | "ecosystem"
    | "course"
    | "role"
    | "interest";

const namespaceClasses: Record<TaxonomyNamespace, string> = {
    discipline: "border-blue-200 bg-blue-50 text-blue-800",
    program: "border-blue-200 bg-blue-50 text-blue-800",
    department: "border-blue-200 bg-blue-50 text-blue-800",
    skill: "border-purple-200 bg-purple-50 text-purple-800",
    deliverable: "border-emerald-200 bg-emerald-50 text-emerald-800",
    theme: "border-orange-200 bg-orange-50 text-orange-800",
    "research-area": "border-orange-200 bg-orange-50 text-orange-800",
    ecosystem: "border-cyan-200 bg-cyan-50 text-cyan-800",
    course: "border-indigo-200 bg-indigo-50 text-indigo-800",
    role: "border-rose-200 bg-rose-50 text-rose-800",
    interest: "border-orange-200 bg-orange-50 text-orange-800",
};

function normalizeTaxonomyValue(value: string): string {
    return value
        .normalize("NFKC")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

export function taxonomyChipClassName(namespace: TaxonomyNamespace): string {
    return namespaceClasses[namespace];
}

export function TaxonomyChip({
    namespace,
    value,
    className,
}: {
    namespace: TaxonomyNamespace;
    value: string;
    className?: string;
}) {
    return (
        <span
            className={cn(
                "inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-xs font-medium leading-5",
                taxonomyChipClassName(namespace),
                className
            )}
        >
            <span className="break-words">{value}</span>
        </span>
    );
}

export function TaxonomyChipList({
    namespace,
    values,
    maxVisible,
    className,
    chipClassName,
}: {
    namespace: TaxonomyNamespace;
    values?: Array<string | null | undefined> | null;
    maxVisible?: number;
    className?: string;
    chipClassName?: string;
}) {
    const seen = new Set<string>();
    const uniqueValues = (values || []).filter((value): value is string => {
        if (!value?.trim()) return false;
        const key = normalizeTaxonomyValue(value);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    const visibleValues =
        maxVisible === undefined ? uniqueValues : uniqueValues.slice(0, maxVisible);
    const hiddenCount = uniqueValues.length - visibleValues.length;

    if (uniqueValues.length === 0) return null;

    return (
        <div className={cn("flex flex-wrap gap-1.5", className)}>
            {visibleValues.map((value) => (
                <TaxonomyChip
                    key={`${namespace}-${normalizeTaxonomyValue(value)}`}
                    namespace={namespace}
                    value={value}
                    className={chipClassName}
                />
            ))}
            {hiddenCount > 0 && (
                <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium leading-5 text-slate-600">
                    +{hiddenCount} more
                </span>
            )}
        </div>
    );
}
