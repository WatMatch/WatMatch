export interface CourseOptionLike {
    course_id?: number | null;
    code?: string | null;
    name?: string | null;
    effective_title?: string | null;
    effective_name?: string | null;
    effective_topic?: string | null;
    department?: {
        name?: string | null;
    } | null;
    active?: boolean | null;
    active_for_current_term?: boolean | null;
    retired_for_routing?: boolean | null;
    active_instructor_count?: number | null;
    routing_kind?: string | null;
    effective_routing_kind?: string | null;
}

export function courseOptionLabel(
    course?: CourseOptionLike | null,
    options: {
        fallback?: string;
        includeDepartment?: boolean;
        includeTopic?: boolean;
        includeNoInstructorSuffix?: boolean;
    } = {}
) {
    if (!course) return options.fallback || "Unassigned";

    const title = course.effective_title || course.effective_name || course.name || "Unnamed course";
    const topic =
        options.includeTopic && course.effective_topic
            ? ` - ${course.effective_topic}`
            : "";
    const department =
        options.includeDepartment && course.department?.name
            ? ` (${course.department.name})`
            : "";
    const noInstructor =
        options.includeNoInstructorSuffix && !hasActiveInstructor(course)
            ? " - no active instructor"
            : "";

    return `${course.code || "Course"} - ${title}${topic}${department}${noInstructor}`;
}

export function hasActiveInstructor(course?: CourseOptionLike | null) {
    return Number(course?.active_instructor_count || 0) > 0;
}

export function isActiveRoutingCourse(course?: CourseOptionLike | null) {
    if (!course) return false;
    return (
        course.active !== false &&
        course.active_for_current_term !== false &&
        course.retired_for_routing !== true
    );
}

export function isStaffedActiveCourse(course?: CourseOptionLike | null) {
    return isActiveRoutingCourse(course) && hasActiveInstructor(course);
}

export function filterStaffedActiveCourses<T extends CourseOptionLike>(courses: T[]) {
    return courses.filter(isStaffedActiveCourse);
}

export function isInterdisciplinaryCourse(course?: CourseOptionLike | null) {
    return (course?.effective_routing_kind || course?.routing_kind) === "interdisciplinary";
}
