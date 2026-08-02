"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import ProjectForm from "../../projectForm";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { userContext } from "@/contexts/UserContext";
import type { ProjectFormValues } from "@/components/forms/project";
import {
    fetchCapstoneById,
    fetchCapstoneApprovalHistory,
    resubmitCapstone,
    type ApprovalHistoryRecord,
    type FullCapstoneDetails,
} from "@/services/capstones.service";
import { fetchUserCapstone } from "@/services/users.service";
import { Card } from "@/components/ui/card";
import {
    BrowseLoading,
    BrowseNotice,
    BrowsePageHeader,
    BrowsePageShell,
} from "@/components/capstones/BrowsePage";

function toStringArray(input: unknown): string[] {
    if (Array.isArray(input)) {
        return input
            .map((v) => String(v).trim())
            .filter(Boolean);
    }
    if (typeof input === "string") {
        const trimmed = input.trim();
        if (!trimmed) return [];
        if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
            return trimmed
                .slice(1, -1)
                .split(",")
                .map((v) => v.trim().replace(/^"|"$/g, ""))
                .filter(Boolean);
        }
        return trimmed
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean);
    }
    return [];
}

function normalizeProjectStartDate(value?: string): string {
    return value || "";
}

function mapCapstoneToFormValues(capstone: FullCapstoneDetails): Partial<ProjectFormValues> {
    const requestedCourse = capstone.requested_course;
    const requestedInterdisciplinary =
        requestedCourse?.routing_kind === "interdisciplinary" ||
        (capstone.submission_track === "interdisciplinary" &&
            Boolean(capstone.requested_course_fk || capstone.course_fk));
    return {
        submissionTrack: requestedInterdisciplinary
            ? "interdisciplinary"
            : capstone.submission_track === "interdisciplinary"
            ? "interdisciplinary"
            : "home_course",
        interdisciplinaryCourseId: requestedInterdisciplinary
            ? String(capstone.requested_course_fk || capstone.course_fk || "")
            : "",
        submissionTrackLocked: true,
        projectStartDate: normalizeProjectStartDate(capstone.project_start_date),
        howHeardAboutCapstone: capstone.how_heard_about_capstone || "",
        projectTitle: capstone.title || "",
        organizationName: capstone.organization_name || "",
        primaryContact: capstone.primary_contact || "",
        email: capstone.email || "",
        phone: capstone.phone || "",
        website: capstone.website || "",
        organizationDescription: capstone.organization_description || "",
        organizationSize: capstone.organization_size || "",
        sector: capstone.sector || "",
        problemArea: capstone.problem_area || "",
        mainObjectives: capstone.main_objectives || "",
        scopeOfWork: capstone.scope_of_work || "",
        deliverableTypes: toStringArray(capstone.deliverable_types),
        deliverables: capstone.deliverables || "",
        successCriteria: capstone.success_criteria || "",
        validationPlan: capstone.validation_plan || "",
        stakeholders: capstone.stakeholders || "",
        risksConstraints: capstone.risks_constraints || "",
        publicEvaluationAcknowledged:
            capstone.public_evaluation_acknowledged === true,
        ipAcknowledged: capstone.ip_acknowledged === true,
        confidentialityAcknowledged:
            capstone.confidentiality_acknowledged === true,
        meetingFrequency: capstone.meeting_frequency || "",
        skillsRequired: toStringArray(capstone.skills),
        proposedTeamMembers: capstone.proposed_team_members || "",
        uwResources: capstone.uw_resources || "",
        orgResources: capstone.org_resources || "",
        otherResources: capstone.other_resources || "",
        projectDisciplines: toStringArray(capstone.disciplines),
        partnerOpportunityId: capstone.partner_opportunity_fk
            ? String(capstone.partner_opportunity_fk)
            : "",
        externalPartnerName: capstone.external_partner_name || "",
        externalPartnerOrganization: capstone.external_partner_organization || "",
        externalPartnerEmail: capstone.external_partner_email || "",
        externalPartnerWebsite: capstone.external_partner_website || "",
        externalPartnerNotes: capstone.external_partner_notes || "",
        externalPartnerConfirmed: false,
    };
}

const RESUBMITTABLE_STATUSES = new Set(["draft", "rejected", "changes_requested"]);

const textValue = (value: string | null | undefined) => value ?? "";

function ResubmitCapstonePageContent() {
    const params = useParams<{ capstoneId: string }>();
    const capstoneId = String(params?.capstoneId || "");
    const { user } = userContext();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [feedbackText, setFeedbackText] = useState("");
    const [changeSummary, setChangeSummary] = useState("");
    const [initialValues, setInitialValues] = useState<Partial<ProjectFormValues>>({});
    const [currentStatus, setCurrentStatus] = useState("");
    const [canResubmit, setCanResubmit] = useState(false);
    const isStudent = (user?.role || "").toLowerCase() === "student";
    const isDraft = currentStatus === "draft";

    useEffect(() => {
        if (user && !isStudent) {
            setError("Only students can resubmit capstones.");
            setLoading(false);
            router.replace("/dashboard");
            return;
        }
        async function loadData() {
            if (!capstoneId) return;
            setLoading(true);
            setError("");
            setCanResubmit(false);
            setCurrentStatus("");
            try {
                const capstone = await fetchCapstoneById(capstoneId);
                if (!capstone) {
                    setError("Capstone not found.");
                    return;
                }
                const teamState = await fetchUserCapstone();
                const currentTeams = Array.isArray(
                    (teamState as { teams?: unknown[] }).teams
                )
                    ? ((teamState as { teams?: unknown[] }).teams as Array<{
                          is_leader?: boolean;
                          project?: { capstone_id?: string | number } | null;
                      }>)
                    : [];
                const leaderForThisCapstone = currentTeams.some(
                    (team) =>
                        team?.is_leader &&
                        String(team.project?.capstone_id ?? "") === capstoneId
                );
                if (!leaderForThisCapstone) {
                    setError("Only the current team leader can revise this capstone.");
                    return;
                }
                const currentStatus = (capstone.status || "").toLowerCase();
                setCurrentStatus(currentStatus);
                if (!RESUBMITTABLE_STATUSES.has(currentStatus)) {
                    setError("This capstone is not currently open for revision.");
                    return;
                }
                setInitialValues(mapCapstoneToFormValues(capstone));
                setCanResubmit(true);
                let history: ApprovalHistoryRecord[] = [];
                try {
                    history = await fetchCapstoneApprovalHistory(capstoneId);
                } catch (historyError) {
                    console.error(
                        "Failed to load capstone feedback for resubmission:",
                        historyError
                    );
                    setFeedbackText("Feedback unavailable.");
                    return;
                }
                const latestChangesRequested = history.find(
                    (record) =>
                        record.action === "changes_requested" && record.comments
                );
                const latestRejected = history.find(
                    (record) => record.action === "rejected" && record.comments
                );
                setFeedbackText(
                    latestChangesRequested?.comments ||
                        latestRejected?.comments ||
                        ""
                );
            } catch (loadError) {
                console.error("Failed to load capstone for resubmission:", loadError);
                setError("Failed to load capstone details.");
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [capstoneId, isStudent, router, user]);

    const finalExtraSection = useMemo(
        () => {
            const summaryLabel = isDraft
                ? "What changed before submitting for review? *"
                : "What did you change based on instructor feedback? *";
            const summaryPlaceholder = isDraft
                ? "Describe the draft updates you want instructors to see."
                : "Describe your updates and how they address the feedback.";
            const feedbackFallback = isDraft
                ? "This draft has no instructor feedback yet."
                : "No instructor comments found.";

            return (
                <div className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="space-y-2">
                    <Label className="text-sm font-semibold text-slate-900">
                        Instructor feedback
                    </Label>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                        {feedbackText || feedbackFallback}
                    </p>
                </div>
                <div className="space-y-2">
                    <Label
                        htmlFor="change-summary"
                        className="text-sm font-semibold text-slate-900"
                    >
                        {summaryLabel}
                    </Label>
                    <Textarea
                        id="change-summary"
                        value={changeSummary}
                        onChange={(event) => setChangeSummary(event.target.value)}
                        placeholder={summaryPlaceholder}
                        rows={5}
                    />
                </div>
            </div>
            );
        },
        [feedbackText, changeSummary, isDraft]
    );

    const handleSubmit = async (values: ProjectFormValues) => {
        if (!isStudent) {
            setError("Only students can resubmit capstones.");
            return false;
        }
        if (!changeSummary.trim()) {
            setError(
                isDraft
                    ? "Please describe what changed before submitting for review."
                    : "Please answer: What did you change based on instructor feedback?"
            );
            return false;
        }

        setSubmitting(true);
        setError("");
        try {
            await resubmitCapstone(capstoneId, {
                title: textValue(values.projectTitle),
                description:
                    `${values.mainObjectives || ""} ${values.deliverables || ""} ${values.problemArea || ""}`.trim(),
                project_start_date: textValue(values.projectStartDate),
                how_heard_about_capstone: textValue(values.howHeardAboutCapstone),
                project_disciplines: values.projectDisciplines || [],
                skills_required: values.skillsRequired || [],
                problem_area: textValue(values.problemArea),
                main_objectives: textValue(values.mainObjectives),
                scope_of_work: textValue(values.scopeOfWork),
                deliverable_types: values.deliverableTypes || [],
                deliverables: textValue(values.deliverables),
                success_criteria: textValue(values.successCriteria),
                validation_plan: textValue(values.validationPlan),
                stakeholders: textValue(values.stakeholders),
                risks_constraints: textValue(values.risksConstraints),
                public_evaluation_acknowledged:
                    values.publicEvaluationAcknowledged === true,
                ip_acknowledged: values.ipAcknowledged === true,
                confidentiality_acknowledged:
                    values.confidentialityAcknowledged === true,
                meeting_frequency: textValue(values.meetingFrequency),
                uw_resources: textValue(values.uwResources),
                org_resources: textValue(values.orgResources),
                other_resources: textValue(values.otherResources),
                proposed_team_members: textValue(values.proposedTeamMembers),
                organization_name: textValue(values.organizationName),
                primary_contact: textValue(values.primaryContact),
                email: textValue(values.email),
                phone: textValue(values.phone),
                website: textValue(values.website),
                organization_description: textValue(values.organizationDescription),
                organization_size: textValue(values.organizationSize),
                sector: textValue(values.sector),
                partner_opportunity_id: values.partnerOpportunityId
                    ? Number(values.partnerOpportunityId)
                    : null,
                external_partner_name: textValue(values.externalPartnerName),
                external_partner_organization: textValue(values.externalPartnerOrganization),
                external_partner_email: textValue(values.externalPartnerEmail),
                external_partner_website: textValue(values.externalPartnerWebsite),
                external_partner_notes: textValue(values.externalPartnerNotes),
                external_partner_confirmed: values.externalPartnerConfirmed === true,
                change_summary: changeSummary.trim(),
            });
            router.push("/dashboard");
            return true;
        } catch (submitError) {
            console.error("Failed to resubmit capstone:", submitError);
            setError(
                submitError instanceof Error
                    ? submitError.message
                    : "Failed to resubmit capstone."
            );
            return false;
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <BrowsePageShell>
                <div className="mx-auto w-full max-w-4xl">
                    <BrowseLoading label="Loading your proposal…" />
                </div>
            </BrowsePageShell>
        );
    }

    return (
        <BrowsePageShell>
            <div className="mx-auto w-full max-w-4xl space-y-5">
                <BrowsePageHeader
                    eyebrow={isDraft ? "Draft proposal" : "Instructor feedback"}
                    title={isDraft ? "Submit your proposal" : "Revise your proposal"}
                    description={
                        isDraft
                            ? "Review the draft, complete each section, and check the full proposal before sending it to the instructor."
                            : "Update the proposal in response to feedback, summarize the changes, and review everything before resubmitting."
                    }
                    actions={
                        <Button variant="outline" onClick={() => router.push("/dashboard")}>
                            Back to Home
                        </Button>
                    }
                />
                {error && !canResubmit && <BrowseNotice tone="error">{error}</BrowseNotice>}
                {canResubmit ? (
                    <ProjectForm
                        initialValues={initialValues}
                        onSubmit={handleSubmit}
                        draftStorageKey={
                            user?.user_id
                                ? `watmatch:project-resubmit:${user.user_id}:${capstoneId}`
                                : null
                        }
                        submitLabel={isDraft ? "Submit to instructor" : "Resubmit to instructor"}
                        isSubmitting={submitting}
                        submissionError={error}
                        finalExtraSection={finalExtraSection}
                        className="w-full"
                    />
                ) : (
                    <Card className="p-6">
                        <p className="text-sm text-slate-600">
                            Only draft, rejected, or change-requested capstones can be revised here.
                        </p>
                    </Card>
                )}
            </div>
        </BrowsePageShell>
    );
}

export default function ResubmitCapstonePage() {
    return (
        <ProtectedRoute>
            <ResubmitCapstonePageContent />
        </ProtectedRoute>
    );
}
