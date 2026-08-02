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
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    BrowseLoading,
    BrowseNotice,
    BrowsePageHeader,
    BrowsePageShell,
    DetailDisclosure,
} from "@/components/capstones/BrowsePage";

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
                            ? "Use Home to revise and resubmit this capstone."
                            : status === "draft"
                            ? "Use Home to edit and submit this capstone."
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
            return true;
        } catch (error) {
            console.error("Failed to submit form:", error);
            setSubmitError(
                error instanceof Error
                    ? error.message
                    : "Failed to submit project. Please try again."
            );
            return false;
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
            <BrowsePageShell>
                <div className="mx-auto w-full max-w-4xl">
                    <BrowseLoading label="Checking proposal access…" />
                </div>
            </BrowsePageShell>
        );
    }

    if (blockedReason) {
        return (
            <BrowsePageShell>
                <div className="mx-auto w-full max-w-4xl space-y-5">
                    <BrowsePageHeader
                        eyebrow="Capstone proposal"
                        title="Submission unavailable"
                        description="WatMatch checked your current team and proposal state."
                    />
                    <Card className="gap-4 p-5 sm:p-6">
                        <BrowseNotice tone="warning">{blockedReason}</BrowseNotice>
                        <div>
                            <Button type="button" variant="outline" onClick={() => router.push("/dashboard")}>
                                Return to Home
                            </Button>
                        </div>
                    </Card>
                </div>
            </BrowsePageShell>
        );
    }

    if (needsEnrollmentRequest) {
        return (
            <BrowsePageShell>
                <div className="mx-auto w-full max-w-4xl space-y-5">
                    <BrowsePageHeader
                        eyebrow="Course access"
                        title="Request a capstone course"
                        description="A staffed enrollment route is required before you can submit your own proposal."
                    />
                    <Card className="gap-0 p-0">
                        <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-4">
                            <h2 className="text-sm font-semibold text-slate-950">Your requested route</h2>
                            <p className="mt-1 text-sm leading-6 text-slate-600">{enrollmentRequestIntro}</p>
                        </div>
                        <div className="space-y-5 p-5">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="requested-enrollment-course">Requested course</Label>
                                    <Select value={selectedEnrollmentCourseId} onValueChange={setSelectedEnrollmentCourseId}>
                                        <SelectTrigger id="requested-enrollment-course">
                                            <SelectValue placeholder="Choose a staffed course" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {courses.map((course) => (
                                                <SelectItem key={course.course_id} value={String(course.course_id)}>
                                                    {courseOptionLabel(course, { includeDepartment: true })}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="enrollment-request-note">Note for staff <span className="font-normal text-slate-500">(optional)</span></Label>
                                    <Textarea
                                        id="enrollment-request-note"
                                        value={enrollmentComments}
                                        onChange={(event) => setEnrollmentComments(event.target.value)}
                                        placeholder="Share context that may help staff route you"
                                        rows={4}
                                    />
                                </div>
                            </div>

                            {enrollmentError && <BrowseNotice tone="error">{enrollmentError}</BrowseNotice>}
                            {enrollmentMessage && <BrowseNotice tone="success">{enrollmentMessage}</BrowseNotice>}
                            {courses.length === 0 && !enrollmentError && (
                                <BrowseNotice tone="warning">No staffed active courses are available right now.</BrowseNotice>
                            )}

                            <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                                <p className="max-w-xl text-xs leading-5 text-slate-500">
                                    Staff may approve this course or select a better staffed route. Registrar/Quest updates remain a separate manual step.
                                </p>
                                <Button
                                    type="button"
                                    onClick={handleEnrollmentRequest}
                                    disabled={enrollmentSubmitting || courses.length === 0 || !selectedEnrollmentCourseId}
                                    className="w-full sm:w-auto"
                                >
                                    {enrollmentSubmitting ? "Submitting…" : "Submit request"}
                                </Button>
                            </div>
                        </div>
                    </Card>
                    <div>
                        <Button type="button" variant="ghost" onClick={() => router.push("/dashboard")}>
                            Return to Home
                        </Button>
                    </div>
                </div>
            </BrowsePageShell>
        );
    }

    return (
        <BrowsePageShell>
            <div className="mx-auto w-full max-w-4xl space-y-5">
                <BrowsePageHeader
                    eyebrow={adminOverrideMode ? "Admin exception proposal" : "Student proposal"}
                    title="Submit a capstone proposal"
                    description="Build the proposal in focused sections, then review the complete submission before sending it into course routing and instructor review."
                />
                {teamWithoutCapstoneId && (
                    <BrowseNotice tone="info">
                        This proposal will be linked to your existing team. Each team can have one active capstone idea.
                    </BrowseNotice>
                )}
                {adminOverrideMode && (
                    <BrowseNotice tone="warning">
                        Admin finalization exception mode. This proposal will be created for
                        student #{adminTargetStudentId}. Course #{adminTargetCourseId} will be the
                        default routing recommendation until staff approves the official course.
                    </BrowseNotice>
                )}
                {partnerNotice && (
                    <BrowseNotice tone="info">{partnerNotice}</BrowseNotice>
                )}
                {partnerOpportunities.length > 0 && (
                    <DetailDisclosure
                        label={selectedOpportunityId === "none" ? "Attach an external opportunity (optional)" : "External opportunity attached"}
                        defaultOpen={selectedOpportunityId !== "none"}
                    >
                        <div className="space-y-2">
                            <Label htmlFor="partner-opportunity">Partner opportunity</Label>
                            <Select value={selectedOpportunityId} onValueChange={handleOpportunitySelect}>
                                <SelectTrigger id="partner-opportunity">
                                    <SelectValue placeholder="Optional external opportunity" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No external opportunity</SelectItem>
                                    {partnerOpportunities.map((opportunity) => (
                                        <SelectItem key={opportunity.partner_opportunity_id} value={String(opportunity.partner_opportunity_id)}>
                                            {opportunity.title} — {opportunity.organization}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs leading-5 text-slate-500">
                                Choosing an opportunity prefills relevant fields. Confirm partner support before submission.
                            </p>
                        </div>
                    </DetailDisclosure>
                )}
                <ProjectForm
                    initialValues={initialValues}
                    onSubmit={handleSubmit}
                    draftStorageKey={
                        adminOverrideMode
                            ? `watmatch:project-exception:${adminTargetStudentId}:${adminTargetCourseId}`
                            : user?.user_id
                              ? `watmatch:project-proposal:${user.user_id}:${selectedOpportunityId}`
                              : null
                    }
                    isSubmitting={submitting}
                    submissionError={submitError}
                    submitLabel="Submit proposal"
                    className="w-full"
                />
            </div>
        </BrowsePageShell>
    );
}

export default function ProjectFormPage() {
    return (
        <ProtectedRoute>
            <Suspense
                fallback={
                    <BrowsePageShell>
                        <div className="mx-auto w-full max-w-4xl">
                            <BrowseLoading label="Loading proposal form…" />
                        </div>
                    </BrowsePageShell>
                }
            >
                <ProjectFormPageContent />
            </Suspense>
        </ProtectedRoute>
    );
}
