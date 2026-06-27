"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import ProjectForm from "./projectForm";
import { createCapstone } from "@/hooks/useCapstones";
import { useRouter, useSearchParams } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ProjectFormValues } from "@/components/forms/project";
import { userContext } from "@/contexts/UserContext";
import { fetchUserCapstone } from "@/services/users.service";
import {
    fetchPartnerOpportunity,
    fetchPartnerOpportunities,
    type PartnerOpportunity,
} from "@/services/partners.service";
import { fetchCourses, type Course } from "@/services/courses.service";
import {
    courseOptionLabel,
    filterStaffedActiveCourses,
} from "@/lib/course-options";
import { requestProjectSubmissionEnrollment } from "@/services/capstones.service";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

function readStoredFinalizationOverrideReason(studentId: number, courseId: number) {
    if (typeof window === "undefined") return "";
    try {
        const raw = window.sessionStorage.getItem("watmatchFinalizationOverride");
        if (!raw) return "";
        const parsed = JSON.parse(raw) as {
            targetStudentId?: string | number;
            targetCourseId?: string | number;
            reason?: string;
        };
        if (
            String(parsed.targetStudentId) !== String(studentId) ||
            String(parsed.targetCourseId) !== String(courseId)
        ) {
            return "";
        }
        return parsed.reason || "";
    } catch {
        return "";
    }
}

function ProjectFormPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const opportunityId = searchParams.get("opportunityId");
    const finalizationOverrideRequested =
        searchParams.get("finalizationOverride") === "true";
    const adminTargetStudentId = Number(searchParams.get("targetStudentId"));
    const adminTargetCourseId = Number(searchParams.get("targetCourseId"));
    const [adminOverrideReason] = useState(() =>
        readStoredFinalizationOverrideReason(adminTargetStudentId, adminTargetCourseId)
    );
    const { user } = userContext();
    const userRole = (user?.role || "").toLowerCase();
    const adminOverrideMode =
        finalizationOverrideRequested && userRole === "admin";
    const [checkingAccess, setCheckingAccess] = useState(true);
    const [blockedReason, setBlockedReason] = useState<string | null>(null);
    const [teamWithoutCapstoneId, setTeamWithoutCapstoneId] = useState<
        number | null
    >(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [initialValues, setInitialValues] = useState<Partial<ProjectFormValues>>({});
    const [partnerNotice, setPartnerNotice] = useState("");
    const [partnerOpportunities, setPartnerOpportunities] = useState<PartnerOpportunity[]>([]);
    const [selectedOpportunityId, setSelectedOpportunityId] = useState<string>(
        opportunityId || "none"
    );
    const [needsEnrollmentRequest, setNeedsEnrollmentRequest] = useState(false);
    const [courses, setCourses] = useState<Course[]>([]);
    const [selectedEnrollmentCourseId, setSelectedEnrollmentCourseId] = useState("");
    const [enrollmentComments, setEnrollmentComments] = useState("");
    const [enrollmentSubmitting, setEnrollmentSubmitting] = useState(false);
    const [enrollmentMessage, setEnrollmentMessage] = useState("");
    const [enrollmentError, setEnrollmentError] = useState("");
    const [enrollmentRequestIntro, setEnrollmentRequestIntro] = useState(
        "You need a capstone course before submitting your own proposal. Choose the course you think fits best; staff can approve it or route you to another staffed course."
    );

    const homeDepartmentName = user?.home_department?.name;
    const assignedCourseNotReady =
        !adminOverrideMode &&
        user?.course_fk !== null &&
        user?.course_fk !== undefined &&
        (user?.course_active === false || user?.course?.active === false);

    const defaultHomeDepartmentValues = useCallback(
        (): Partial<ProjectFormValues> =>
            homeDepartmentName ? { projectDisciplines: [homeDepartmentName] } : {},
        [homeDepartmentName]
    );

    const baseInitialValues = useCallback(
        (): Partial<ProjectFormValues> => ({
            ...defaultHomeDepartmentValues(),
            ...(adminOverrideMode
                ? {
                      submissionTrack: "home_course",
                      submissionTrackLocked: true,
                  }
                : {}),
        }),
        [adminOverrideMode, defaultHomeDepartmentValues]
    );

    const valuesFromOpportunity = useCallback(
        (opportunity: PartnerOpportunity): Partial<ProjectFormValues> => ({
            ...baseInitialValues(),
            partnerOpportunityId: String(opportunity.partner_opportunity_id),
            projectTitle: opportunity.title,
            projectStartDate: opportunity.project_start_date || "",
            howHeardAboutCapstone: opportunity.how_heard_about_capstone || "",
            problemArea: opportunity.problem_area || opportunity.description,
            mainObjectives: opportunity.main_objectives || "",
            scopeOfWork: opportunity.scope_of_work || "",
            projectDisciplines: opportunity.disciplines?.length
                ? opportunity.disciplines
                : defaultHomeDepartmentValues().projectDisciplines || [],
            skillsRequired: opportunity.skills || [],
            deliverableTypes: opportunity.deliverable_types || [],
            deliverables: opportunity.deliverables || "",
            meetingFrequency: opportunity.meeting_frequency || "",
            uwResources: opportunity.resources_needed
                ? "Not specified by partner opportunity."
                : "",
            orgResources: opportunity.resources_needed || "",
            otherResources: opportunity.resources_needed
                ? "Not specified by partner opportunity."
                : "",
            organizationName: opportunity.organization || "",
            primaryContact: opportunity.primary_contact || "",
            email: opportunity.contact_email || "",
            phone: opportunity.phone || "",
            website: opportunity.contact_url || "",
            organizationDescription: opportunity.organization_description || "",
            organizationSize: opportunity.organization_size || "",
            externalPartnerOrganization: opportunity.organization || "",
            externalPartnerEmail: opportunity.contact_email || "",
            externalPartnerWebsite: opportunity.contact_url || "",
            externalPartnerNotes:
                "This capstone is based on an external partner opportunity. The team should confirm partner agreement before submitting.",
            externalPartnerConfirmed: false,
        }),
        [baseInitialValues, defaultHomeDepartmentValues]
    );

    useEffect(() => {
        async function checkAccess() {
            if (!user?.user_id) {
                setCheckingAccess(false);
                return;
            }
            if (finalizationOverrideRequested && userRole !== "admin") {
                setBlockedReason("Only admins can create finalization exception proposals.");
                setCheckingAccess(false);
                router.replace("/dashboard");
                return;
            }
            if (userRole !== "student" && !adminOverrideMode) {
                setBlockedReason("Only students can submit capstone projects.");
                setCheckingAccess(false);
                router.replace("/dashboard");
                return;
            }
            if (adminOverrideMode) {
                if (
                    !Number.isFinite(adminTargetStudentId) ||
                    adminTargetStudentId <= 0 ||
                    !Number.isFinite(adminTargetCourseId) ||
                    adminTargetCourseId <= 0 ||
                    !adminOverrideReason.trim()
                ) {
                    setBlockedReason(
                        "Finalization exception proposals require a target student, target course, and audit reason."
                    );
                    setCheckingAccess(false);
                    return;
                }
                setNeedsEnrollmentRequest(false);
                setTeamWithoutCapstoneId(null);
                setCheckingAccess(false);
                return;
            }
            if (user.course_fk === null || user.course_fk === undefined) {
                setNeedsEnrollmentRequest(true);
                setEnrollmentRequestIntro(
                    "You need a capstone course before submitting your own proposal. Choose the course you think fits best; staff can approve it or route you to another staffed course."
                );
                setCheckingAccess(false);
                return;
            }
            if (assignedCourseNotReady) {
                setNeedsEnrollmentRequest(true);
                setEnrollmentRequestIntro(
                    "Your assigned capstone course is not currently ready for project submission. Choose a staffed active course to request, and staff can approve it or route you to a better fit."
                );
                setCheckingAccess(false);
                return;
            }
            setNeedsEnrollmentRequest(false);
            try {
                const data = await fetchUserCapstone();
                const teams = Array.isArray((data as { teams?: unknown[] }).teams)
                    ? ((data as { teams?: unknown[] }).teams as Array<{
                          team_id?: number | string;
                          is_leader?: boolean;
                          project?: { status?: string } | null;
                      }>)
                    : [];
                const hasApprovedProject = teams.some(
                    (team) =>
                        ["approved", "approved_recruiting", "complete"].includes(
                            team?.project?.status?.toLowerCase?.() || ""
                        )
                );
                const leaderTeamWithCapstone = teams.find(
                    (team) => team?.is_leader && team?.project
                );
                const memberTeamWithCapstone = teams.find(
                    (team) => !team?.is_leader && team?.project
                );
                const memberTeamWithoutCapstone = teams.find(
                    (team) => !team?.is_leader && !team?.project
                );
                const leaderTeamWithoutCapstone = teams.find(
                    (team) => team?.is_leader && !team?.project
                );
                if (leaderTeamWithoutCapstone?.team_id !== undefined) {
                    setTeamWithoutCapstoneId(
                        Number(leaderTeamWithoutCapstone.team_id)
                    );
                } else {
                    setTeamWithoutCapstoneId(null);
                }
                if (hasApprovedProject) {
                    setBlockedReason(
                        "You are already part of an approved capstone team. New project submissions are disabled."
                    );
                } else if (leaderTeamWithCapstone) {
                    const status = leaderTeamWithCapstone.project?.status?.toLowerCase?.();
                    setBlockedReason(
                        status === "changes_requested" || status === "rejected"
                            ? "Use your dashboard to revise and resubmit this capstone."
                            : status === "draft"
                            ? "Use your dashboard to edit and submit this capstone."
                            : status === "approved_recruiting"
                            ? "Your team already has an approved capstone accepting student interest."
                            : status === "complete"
                            ? "Your team already has a completed capstone."
                            : status === "pending_review" ||
                              status === "pending_admin_course_routing"
                            ? "Your team already has a capstone awaiting review."
                            : "Your team already has a capstone submission."
                    );
                } else if (memberTeamWithCapstone) {
                    const status = memberTeamWithCapstone.project?.status?.toLowerCase?.();
                    setBlockedReason(
                        status === "changes_requested" || status === "rejected"
                            ? "Your team leader must revise and resubmit this capstone."
                            : status === "draft"
                            ? "Your team leader must edit and submit this draft capstone."
                            : status === "pending_review" ||
                              status === "pending_admin_course_routing"
                            ? "Your team already has a capstone awaiting review."
                            : "Your team already has a capstone submission. Only the team leader can manage it."
                    );
                } else if (memberTeamWithoutCapstone) {
                    setBlockedReason(
                        "Your team leader must submit the capstone idea on behalf of your team."
                    );
                }
            } catch (error) {
                console.error("Failed to verify project-form access:", error);
                setBlockedReason(
                    "Could not verify whether you are eligible to submit a project. Please refresh and try again."
                );
            } finally {
                setCheckingAccess(false);
            }
        }
        checkAccess();
    }, [
        adminOverrideMode,
        adminOverrideReason,
        adminTargetCourseId,
        adminTargetStudentId,
        assignedCourseNotReady,
        finalizationOverrideRequested,
        router,
        user?.course?.active,
        user?.course_active,
        user?.course_fk,
        user?.role,
        user?.user_id,
        userRole,
    ]);

    useEffect(() => {
        let isMounted = true;
        async function loadCoursesForEnrollment() {
            if (!needsEnrollmentRequest) return;
            try {
                const courseRows = await fetchCourses(true);
                if (!isMounted) return;
                const staffedCourses = filterStaffedActiveCourses(courseRows);
                setCourses(staffedCourses);
                setSelectedEnrollmentCourseId((current) =>
                    current || String(staffedCourses[0]?.course_id || "")
                );
            } catch (error) {
                console.error("Failed to load courses for enrollment request:", error);
                if (isMounted) {
                    setEnrollmentError(
                        error instanceof Error
                            ? error.message
                            : "Could not load available courses."
                    );
                }
            }
        }
        loadCoursesForEnrollment();
        return () => {
            isMounted = false;
        };
    }, [needsEnrollmentRequest]);

    useEffect(() => {
        async function loadPartnerOpportunity() {
            if (!opportunityId) {
                setInitialValues(baseInitialValues());
                setPartnerNotice("");
                return;
            }

            try {
                const parsedOpportunityId = Number(opportunityId);
                if (!Number.isFinite(parsedOpportunityId)) {
                    throw new Error("Invalid external opportunity link.");
                }
                const opportunity = await fetchPartnerOpportunity(parsedOpportunityId);
                if (opportunity.is_available === false) {
                    setBlockedReason(
                        "This external opportunity is already full and is not accepting more teams."
                    );
                    return;
                }
                setSelectedOpportunityId(String(opportunity.partner_opportunity_id));
                setInitialValues(valuesFromOpportunity(opportunity));
                setPartnerNotice(
                    "This form is prefilled from an external partner opportunity. Submit only after your team has contacted the partner and they have agreed to support the capstone."
                );
            } catch (error) {
                console.error("Failed to load external partner opportunity:", error);
                setSubmitError(
                    error instanceof Error
                        ? error.message
                        : "Could not load the selected external opportunity."
                );
            }
        }

        loadPartnerOpportunity();
    }, [baseInitialValues, opportunityId, valuesFromOpportunity]);

    useEffect(() => {
        let isMounted = true;
        async function loadOpportunities() {
            try {
                const opportunities = await fetchPartnerOpportunities({
                    status: "published",
                    page: 1,
                    pageSize: 50,
                });
                if (isMounted) {
                    setPartnerOpportunities(
                        opportunities.filter(
                            (opportunity) => opportunity.is_available !== false
                        )
                    );
                }
            } catch (error) {
                console.error("Failed to load external partner opportunities:", error);
            }
        }
        loadOpportunities();
        return () => {
            isMounted = false;
        };
    }, []);

    const handleOpportunitySelect = async (value: string) => {
        setSelectedOpportunityId(value);
        setSubmitError(null);
        if (value === "none") {
            setInitialValues(baseInitialValues());
            setPartnerNotice("");
            return;
        }

        try {
            const opportunity = await fetchPartnerOpportunity(Number(value));
            setInitialValues(valuesFromOpportunity(opportunity));
            setPartnerNotice(
                "This form is prefilled from an external partner opportunity. Submit only after your team has contacted the partner and they have agreed to support the capstone."
            );
        } catch (error) {
            console.error("Failed to load selected external opportunity:", error);
            setSubmitError(
                error instanceof Error
                    ? error.message
                    : "Could not load the selected external opportunity."
            );
        }
    };

    const handleSubmit = async (data: ProjectFormValues) => {
        setSubmitting(true);
        setSubmitError(null);
        try {
            if (!adminOverrideMode && assignedCourseNotReady) {
                throw new Error(
                    "Your assigned capstone course is not currently ready for project submission. Submit a course request first."
                );
            }
            if (!adminOverrideMode && (!user?.user_id || !user.course_fk)) {
                throw new Error(
                    "Missing course information for the current user."
                );
            }
            if (adminOverrideMode) {
                if (
                    !Number.isFinite(adminTargetStudentId) ||
                    adminTargetStudentId <= 0 ||
                    !Number.isFinite(adminTargetCourseId) ||
                    adminTargetCourseId <= 0 ||
                    !adminOverrideReason.trim()
                ) {
                    throw new Error(
                        "Missing target student, target course, or finalization override reason."
                    );
                }
            }
            const submissionTrack = adminOverrideMode
                ? "home_course"
                : data.submissionTrack || "home_course";
            const submitterUserId = adminOverrideMode
                ? adminTargetStudentId
                : Number(user?.user_id ?? NaN);
            const submitterCourseId = adminOverrideMode
                ? adminTargetCourseId
                : Number(user?.course_fk ?? NaN);
            const targetCourseId =
                adminOverrideMode
                    ? adminTargetCourseId
                    : submissionTrack === "interdisciplinary"
                      ? Number(data.interdisciplinaryCourseId)
                      : submitterCourseId;
            if (
                submissionTrack === "interdisciplinary" &&
                (!data.interdisciplinaryCourseId || !Number.isFinite(targetCourseId))
            ) {
                throw new Error("Choose an interdisciplinary transcript course before submitting.");
            }
            const payload = {
                user_id: submitterUserId,
                team_id: adminOverrideMode ? undefined : teamWithoutCapstoneId ?? undefined,
                title: data.projectTitle,
                description:
                    `${data.mainObjectives} ${data.deliverables} ${data.problemArea}`.trim(),
                course_id: targetCourseId,
                submission_track: submissionTrack,
                project_start_date: data.projectStartDate || null,
                how_heard_about_capstone: data.howHeardAboutCapstone || null,
                project_disciplines: data.projectDisciplines || [],
                skills_required: data.skillsRequired || [],
                problem_area: data.problemArea || null,
                main_objectives: data.mainObjectives || null,
                scope_of_work: data.scopeOfWork || null,
                deliverable_types: data.deliverableTypes || [],
                deliverables: data.deliverables || null,
                success_criteria: data.successCriteria || null,
                validation_plan: data.validationPlan || null,
                stakeholders: data.stakeholders || null,
                risks_constraints: data.risksConstraints || null,
                public_evaluation_acknowledged:
                    data.publicEvaluationAcknowledged === true,
                ip_acknowledged: data.ipAcknowledged === true,
                confidentiality_acknowledged:
                    data.confidentialityAcknowledged === true,
                meeting_frequency: data.meetingFrequency || "weekly",
                uw_resources: data.uwResources || null,
                org_resources: data.orgResources || null,
                other_resources: data.otherResources || null,
                proposed_team_members: data.proposedTeamMembers || null,
                organization_name: data.organizationName || null,
                primary_contact: data.primaryContact || null,
                email: data.email || null,
                phone: data.phone || null,
                website: data.website || null,
                organization_description: data.organizationDescription || null,
                organization_size: data.organizationSize || null,
                sector: data.sector || null,
                partner_opportunity_id: data.partnerOpportunityId
                    ? Number(data.partnerOpportunityId)
                    : null,
                external_partner_name: data.externalPartnerName || null,
                external_partner_organization:
                    data.externalPartnerOrganization || null,
                external_partner_email: data.externalPartnerEmail || null,
                external_partner_website: data.externalPartnerWebsite || null,
                external_partner_notes: data.externalPartnerNotes || null,
                external_partner_confirmed: data.externalPartnerConfirmed === true,
                finalization_override: adminOverrideMode,
                finalization_override_reason: adminOverrideMode
                    ? adminOverrideReason.trim()
                    : null,
            };

            await createCapstone(payload);
            if (adminOverrideMode) {
                window.sessionStorage.removeItem("watmatchFinalizationOverride");
            }
            router.push("/project-form/success");
        } catch (error) {
            console.error("Failed to submit form:", error);
            setSubmitError(
                error instanceof Error
                    ? error.message
                    : "Failed to submit project. Please try again."
            );
        } finally {
            setSubmitting(false);
        }
    };

    const handleEnrollmentRequest = async () => {
        const targetCourseId = Number(selectedEnrollmentCourseId);
        if (!Number.isFinite(targetCourseId) || targetCourseId <= 0) {
            setEnrollmentError("Choose a course before submitting your request.");
            return;
        }
        setEnrollmentSubmitting(true);
        setEnrollmentError("");
        setEnrollmentMessage("");
        try {
            await requestProjectSubmissionEnrollment({
                target_course_id: targetCourseId,
                comments: enrollmentComments.trim() || null,
            });
            setEnrollmentMessage(
                "Enrollment request submitted. An advisor or enrollment operator can approve this course or route you to a better fit."
            );
        } catch (error) {
            console.error("Failed to request course enrollment:", error);
            setEnrollmentError(
                error instanceof Error
                    ? error.message
                    : "Could not submit enrollment request."
            );
        } finally {
            setEnrollmentSubmitting(false);
        }
    };

    if (checkingAccess) {
        return (
            <div className="min-h-full bg-slate-50 px-3 py-8 sm:px-8 sm:py-12">
                <div className="mx-auto max-w-4xl text-slate-600">Checking access...</div>
            </div>
        );
    }

    if (blockedReason) {
        return (
            <div className="min-h-full bg-slate-50 px-3 py-8 sm:px-8 sm:py-12">
                <div className="mx-auto max-w-4xl rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
                    <p className="text-slate-900 font-medium mb-2">Submit Project Unavailable</p>
                    <p className="text-slate-600">{blockedReason}</p>
                </div>
            </div>
        );
    }

    if (needsEnrollmentRequest) {
        return (
            <div className="min-h-full bg-slate-50 px-3 py-8 sm:px-8 sm:py-12">
                <div className="mx-auto max-w-4xl rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
                    <p className="text-slate-900 font-medium mb-2">
                        Request Course Enrollment
                    </p>
                    <p className="text-sm text-slate-600">
                        {enrollmentRequestIntro}
                    </p>

                    <div className="mt-5 grid gap-3 md:grid-cols-[minmax(240px,1fr)_minmax(260px,1fr)]">
                        <Select
                            value={selectedEnrollmentCourseId}
                            onValueChange={setSelectedEnrollmentCourseId}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Choose requested course" />
                            </SelectTrigger>
                            <SelectContent>
                                {courses.map((course) => (
                                    <SelectItem
                                        key={course.course_id}
                                        value={String(course.course_id)}
                                    >
                                        {courseOptionLabel(course, { includeDepartment: true })}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Textarea
                            value={enrollmentComments}
                            onChange={(event) => setEnrollmentComments(event.target.value)}
                            placeholder="Optional note for the advisor"
                            className="min-h-10"
                        />
                    </div>

                    {enrollmentError && (
                        <p className="mt-3 text-sm text-red-600">{enrollmentError}</p>
                    )}
                    {enrollmentMessage && (
                        <p className="mt-3 text-sm text-green-700">{enrollmentMessage}</p>
                    )}
                    {courses.length === 0 && !enrollmentError && (
                        <p className="mt-3 text-sm text-slate-600">
                            No staffed active courses are available right now.
                        </p>
                    )}

                    <div className="mt-5 flex justify-end">
                        <Button
                            type="button"
                            onClick={handleEnrollmentRequest}
                            disabled={
                                enrollmentSubmitting ||
                                courses.length === 0 ||
                                !selectedEnrollmentCourseId
                            }
                        >
                            {enrollmentSubmitting ? "Submitting..." : "Submit Request"}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-full bg-slate-50 px-3 py-8 sm:px-8 sm:py-12">
            <div className="mx-auto max-w-4xl">
                {teamWithoutCapstoneId && (
                    <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                        This submission will be linked to your existing team (Team ID:{" "}
                        {teamWithoutCapstoneId}). One capstone idea per team is allowed.
                    </div>
                )}
                {adminOverrideMode && (
                    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        Admin finalization exception mode. This proposal will be created for
                        student #{adminTargetStudentId}. Course #{adminTargetCourseId} will be the
                        default routing recommendation until staff approves the official course.
                    </div>
                )}
                {partnerNotice && (
                    <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                        {partnerNotice}
                    </div>
                )}
                {partnerOpportunities.length > 0 && (
                    <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
                        <p className="mb-2 text-sm font-medium text-slate-900">
                            External Partner Opportunity
                        </p>
                        <Select
                            value={selectedOpportunityId}
                            onValueChange={handleOpportunitySelect}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Optional external opportunity" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">No external opportunity</SelectItem>
                                {partnerOpportunities.map((opportunity) => (
                                    <SelectItem
                                        key={opportunity.partner_opportunity_id}
                                        value={String(opportunity.partner_opportunity_id)}
                                    >
                                        {opportunity.title} - {opportunity.organization}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
                <ProjectForm
                    initialValues={initialValues}
                    onSubmit={handleSubmit}
                    isSubmitting={submitting}
                    submissionError={submitError}
                />
            </div>
        </div>
    );
}

export default function ProjectFormPage() {
    return (
        <ProtectedRoute>
            <Suspense fallback={<div className="min-h-full bg-slate-50 px-3 py-8 sm:px-8 sm:py-12">Loading...</div>}>
                <ProjectFormPageContent />
            </Suspense>
        </ProtectedRoute>
    );
}
