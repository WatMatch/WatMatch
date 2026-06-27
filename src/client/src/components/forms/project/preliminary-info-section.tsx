import {
    FormField,
    FormItem,
    FormLabel,
    FormControl,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { FormSectionProps, ProjectFormValues } from "./types";
import { disciplines, projectStartTerms } from "./config";
import { MultiSelect } from "@/components/ui/multiselect";
import { fetchDepartments } from "@/services/departments.service";
import { fetchCourses, type Course } from "@/services/courses.service";
import { useEffect, useMemo, useState } from "react";
import { useFormContext } from "react-hook-form";
import { withExistingTerm } from "@/lib/term-options";
import {
    courseOptionLabel,
    hasActiveInstructor,
    isActiveRoutingCourse,
    isInterdisciplinaryCourse,
} from "@/lib/course-options";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export function PreliminaryInfoSection({ control }: FormSectionProps) {
    const form = useFormContext<ProjectFormValues>();
    const [departmentOptions, setDepartmentOptions] = useState<string[]>(disciplines);
    const [interdisciplinaryCourses, setInterdisciplinaryCourses] = useState<Course[]>([]);
    const submissionTrack = form.watch("submissionTrack");
    const submissionTrackLocked = form.watch("submissionTrackLocked");

    useEffect(() => {
        let isMounted = true;
        async function loadDepartments() {
            try {
                const departments = await fetchDepartments(true);
                if (isMounted && departments.length > 0) {
                    setDepartmentOptions(departments.map((department) => department.name));
                }
            } catch (error) {
                console.error("Failed to load departments:", error);
            }
        }
        loadDepartments();
        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        let isMounted = true;
        async function loadInterdisciplinaryCourses() {
            try {
                const courses = await fetchCourses(true);
                if (isMounted) {
                    const selectedCourseId = form.getValues("interdisciplinaryCourseId");
                    const activeInterdisciplinaryCourses = courses.filter(
                        (course) => {
                            const lockedSelectedCourse =
                                form.getValues("submissionTrackLocked") &&
                                String(course.course_id) === selectedCourseId;
                            return (
                                isActiveRoutingCourse(course) &&
                                isInterdisciplinaryCourse(course) &&
                                (hasActiveInstructor(course) || lockedSelectedCourse)
                            );
                        }
                    );
                    setInterdisciplinaryCourses(activeInterdisciplinaryCourses);
                    if (
                        activeInterdisciplinaryCourses.length === 1 &&
                        form.getValues("submissionTrack") === "interdisciplinary" &&
                        !form.getValues("interdisciplinaryCourseId")
                    ) {
                        form.setValue(
                            "interdisciplinaryCourseId",
                            String(activeInterdisciplinaryCourses[0].course_id),
                            { shouldValidate: true }
                        );
                    }
                }
            } catch (error) {
                console.error("Failed to load interdisciplinary courses:", error);
            }
        }
        loadInterdisciplinaryCourses();
        return () => {
            isMounted = false;
        };
    }, [form]);

    const groupedInterdisciplinaryCourses = useMemo(() => {
        const groups = new Map<string, Course[]>();
        interdisciplinaryCourses
            .slice()
            .sort((a, b) => {
                const aGroup =
                    a.effective_ecosystem?.name ||
                    a.current_offering?.ecosystem?.name ||
                    a.ecosystem?.name ||
                    "Other Interdisciplinary";
                const bGroup =
                    b.effective_ecosystem?.name ||
                    b.current_offering?.ecosystem?.name ||
                    b.ecosystem?.name ||
                    "Other Interdisciplinary";
                return (
                    aGroup.localeCompare(bGroup) ||
                    a.code.localeCompare(b.code) ||
                    (a.effective_title || a.name).localeCompare(
                        b.effective_title || b.name
                    )
                );
            })
            .forEach((course) => {
                const groupName =
                    course.effective_ecosystem?.name ||
                    course.current_offering?.ecosystem?.name ||
                    course.ecosystem?.name ||
                    "Other Interdisciplinary";
                groups.set(groupName, [...(groups.get(groupName) || []), course]);
            });
        return Array.from(groups.entries());
    }, [interdisciplinaryCourses]);

    const courseLabel = (course: Course) => {
        return courseOptionLabel(course, {
            includeDepartment: true,
            includeTopic: true,
            includeNoInstructorSuffix: true,
        });
    };

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">Preliminary Information</h2>
            <FormField
                control={control}
                name="submissionTrack"
                rules={{ required: "Registration path is required" }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            Registration Path <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                            <Select
                                value={field.value}
                                disabled={submissionTrackLocked}
                                onValueChange={(value) => {
                                    field.onChange(value);
                                    if (value !== "interdisciplinary") {
                                        form.setValue("interdisciplinaryCourseId", "", {
                                            shouldDirty: true,
                                            shouldValidate: true,
                                        });
                                    } else if (
                                        interdisciplinaryCourses.length === 1 &&
                                        !form.getValues("interdisciplinaryCourseId")
                                    ) {
                                        form.setValue(
                                            "interdisciplinaryCourseId",
                                            String(interdisciplinaryCourses[0].course_id),
                                            {
                                                shouldDirty: true,
                                                shouldValidate: true,
                                            }
                                        );
                                    }
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select registration path" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="home_course">Home capstone course</SelectItem>
                                    <SelectItem
                                        value="interdisciplinary"
                                        disabled={interdisciplinaryCourses.length === 0}
                                    >
                                        Interdisciplinary course
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            {submissionTrack === "interdisciplinary" && (
                <FormField
                    control={control}
                    name="interdisciplinaryCourseId"
                    rules={{
                        validate: (value) =>
                            submissionTrack !== "interdisciplinary" ||
                            Boolean(value) ||
                            "Choose an interdisciplinary transcript course",
                    }}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>
                                Interdisciplinary Transcript Course <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                                <Select
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    disabled={submissionTrackLocked}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select transcript course" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {groupedInterdisciplinaryCourses.map(([ecosystem, courses]) => (
                                            <SelectGroup key={ecosystem}>
                                                <SelectLabel>{ecosystem}</SelectLabel>
                                                {courses.map((course) => (
                                                    <SelectItem
                                                        key={course.course_id}
                                                        value={String(course.course_id)}
                                                    >
                                                        {courseLabel(course)}
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FormControl>
                            <p className="text-sm text-slate-600">
                                Offering topic and held-with grouping come from the current term. The selected course remains the transcript/coordinating route for review.
                            </p>
                            {submissionTrackLocked && (
                                <p className="text-sm text-slate-600">
                                    Registration path changes after submission are handled by course routing.
                                </p>
                            )}
                            <FormMessage />
                        </FormItem>
                    )}
                />
            )}

            <FormField
                control={control}
                name="projectTitle"
                rules={{ required: "Project title is required" }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            Project Title{" "}
                            <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                            <Input {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={control}
                name="projectDisciplines"
                rules={{
                    required: "At least one discipline is required",
                    validate: (value) =>
                        (value && value.length > 0) ||
                        "At least one discipline is required",
                }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            Project Disciplines{" "}
                            <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                            <MultiSelect
                                options={departmentOptions.map((d) => ({
                                    label: d,
                                    value: d,
                                }))}
                                value={field.value || []}
                                onChange={field.onChange}
                                placeholder="Search and select disciplines..."
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={control}
                name="projectStartDate"
                rules={{ required: "Project start date is required" }}
                render={({ field: { value, onChange } }) => {
                    const terms = withExistingTerm(projectStartTerms, value);
                    return (
                    <FormItem>
                        <FormLabel>
                            Starting Term{" "}
                            <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                            <Select
                                value={value}
                                onValueChange={onChange}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select starting term" />
                                </SelectTrigger>
                                <SelectContent>
                                    {terms.map((term) => (
                                        <SelectItem key={term} value={term}>
                                            {term}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                );
                }}
            />

            <FormField
                control={control}
                name="howHeardAboutCapstone"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>How did you hear about capstone?</FormLabel>
                        <FormControl>
                            <Input
                                {...field}
                                placeholder="Campus contact name, website, referral, or other"
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
    );
}
