import type { Course } from "@/services/courses.service";

export interface MultiSelectOption {
    value: string;
    label: string;
}

function normalize(value: string): string {
    return value.trim().toLowerCase();
}

export function uniqueStrings(
    values?: Array<string | null | undefined>
): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    (values || []).forEach((value) => {
        const trimmed = value?.trim();
        if (!trimmed) return;
        const key = normalize(trimmed);
        if (seen.has(key)) return;
        seen.add(key);
        result.push(trimmed);
    });
    return result;
}

export function toMultiSelectOptions(values: string[]): MultiSelectOption[] {
    return uniqueStrings(values).map((value) => ({
        value,
        label: value,
    }));
}

export function courseTargetLabel(course: Course): string {
    const code = course.code?.trim() || `Course ${course.course_id}`;
    const name = course.name?.trim();
    return [code, name ? `- ${name}` : ""]
        .filter(Boolean)
        .join(" ");
}

export function courseOptionLabel(course: Course): string {
    const label = courseTargetLabel(course);
    return course.active === false ? `${label} (inactive)` : label;
}

export function courseMultiSelectOptions(
    courses: Course[]
): MultiSelectOption[] {
    return courses.map((course) => ({
        value: String(course.course_id),
        label: courseOptionLabel(course),
    }));
}

export function numericCourseIds(values: string[]): number[] {
    return values
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0);
}

export function courseTargetTagsFromIds(
    courseIds: string[],
    courses: Course[]
): string[] {
    const courseById = new Map(
        courses.map((course) => [String(course.course_id), course])
    );
    return uniqueStrings(
        courseIds.map((courseId) => {
            const course = courseById.get(courseId);
            return course ? courseTargetLabel(course) : "";
        })
    );
}

export function targetCourseIdsFromOpportunity(
    opportunity: {
        target_course_ids?: number[] | null;
        target_course_tags?: string[] | null;
    },
    courses: Course[]
): string[] {
    if (opportunity.target_course_ids?.length) {
        return opportunity.target_course_ids.map((courseId) => String(courseId));
    }

    const tagKeys = new Set(
        (opportunity.target_course_tags || []).map((tag) => normalize(tag))
    );
    if (!tagKeys.size) return [];

    return courses
        .filter((course) => {
            const labels = [
                courseTargetLabel(course),
                courseOptionLabel(course),
                course.code,
                `${course.code} - ${course.name}`,
            ];
            return labels.some((label) => tagKeys.has(normalize(label || "")));
        })
        .map((course) => String(course.course_id));
}

export function legacyTargetCourseTags(
    tags: string[] | null | undefined,
    selectedCourseIds: string[],
    courses: Course[]
): string[] {
    const courseById = new Map(
        courses.map((course) => [String(course.course_id), course])
    );
    const selectedKeys = new Set<string>();
    selectedCourseIds.forEach((courseId) => {
        const course = courseById.get(courseId);
        if (!course) return;
        [
            courseTargetLabel(course),
            courseOptionLabel(course),
            course.code,
            `${course.code} - ${course.name}`,
        ].forEach((label) => selectedKeys.add(normalize(label || "")));
    });

    return uniqueStrings(tags || []).filter(
        (tag) => !selectedKeys.has(normalize(tag))
    );
}
