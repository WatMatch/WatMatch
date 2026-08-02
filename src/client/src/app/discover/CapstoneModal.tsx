import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Building2,
    CalendarDays,
    CheckCircle2,
    Handshake,
    Pencil,
    UserPlus,
} from "lucide-react";
import { ReactNode } from "react";
import { DetailDisclosure } from "@/components/capstones/BrowsePage";
import {
    CapstoneSaveToggle,
    type CapstoneSaveKind,
} from "@/components/capstones/CapstoneSaveToggle";
import { TaxonomyChipList } from "@/components/ui/taxonomy-chip";

interface Project {
    capstone_id?: string | number;
    id?: string | number;
    title?: string;
    description?: string;
    department?: string | string[];
    departments?: Array<{
        department_id?: number;
        name?: string;
        active?: boolean;
    }>;
    year?: number;
    students?: string[] | null;
    status?: string;
    public_status?: string;
    marketplace_action_state?: string | null;
    read_only_reason?: string | null;
    disciplines?: string[];
    skills?: string[];
    problem_area?: string | null;
    main_objectives?: string | null;
    scope_of_work?: string | null;
    deliverables?: string | null;
    deliverable_types?: string[] | null;
    success_criteria?: string | null;
    validation_plan?: string | null;
    stakeholders?: string | null;
    risks_constraints?: string | null;
    meeting_frequency?: string | null;
    project_start_date?: string | null;
    uw_resources?: string | null;
    org_resources?: string | null;
    other_resources?: string | null;
    external_partner_name?: string | null;
    external_partner_organization?: string | null;
    external_partner_email?: string | null;
    external_partner_website?: string | null;
    support_summary?: {
        accepted_mentor?: {
            mentor_email?: string | null;
        } | null;
        external_partner_support_confirmed?: boolean;
    };
}

interface CapstoneModalProps {
    project: Project | null;
    isOpen: boolean;
    onClose: () => void;
    interestedProjects?: Set<string>;
    onJoinProject?: (projectId: string) => void;
    showActionButton?: boolean;
    actionLabel?: string;
    activeActionLabel?: string;
    actionKind?: "interest" | "mentor";
    additionalMetadata?: ReactNode;
    showSaveAction?: boolean;
    saveKind?: CapstoneSaveKind;
    isSaved?: boolean;
    canSave?: boolean;
    saveBusy?: boolean;
    onSaveClick?: (nextSaved: boolean) => void | Promise<void>;
    onSaveOptimisticChange?: (nextSaved: boolean) => void;
    onSaveError?: (error: unknown, previousSaved: boolean) => void;
}

function formatPublicStatus(project?: Project | null) {
    const publicStatus = (project?.public_status || "").toLowerCase();
    const rawStatus = (project?.status || "").toLowerCase();
    if (publicStatus === "complete" || rawStatus === "complete") {
        return "Complete";
    }
    if (project?.marketplace_action_state === "read_only") {
        return "Read-only";
    }
    if (publicStatus === "recruiting" || rawStatus === "approved_recruiting") {
        return "Recruiting";
    }
    if (publicStatus === "finalized" || rawStatus === "finalized") {
        return "Finalized";
    }
    return null;
}

function compactText(value?: string | null) {
    return value?.trim() || "";
}

function formatDateOnly(value?: string | null) {
    const text = compactText(value);
    if (!text) return "";
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return text;
    return parsed.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

export function CapstoneModal({
    project,
    isOpen,
    onClose,
    interestedProjects = new Set(),
    onJoinProject,
    showActionButton = true,
    actionLabel = "Join Project",
    activeActionLabel = "Edit Note",
    actionKind = "interest",
    additionalMetadata,
    showSaveAction = false,
    saveKind = "project",
    isSaved = false,
    canSave = false,
    saveBusy = false,
    onSaveClick,
    onSaveOptimisticChange,
    onSaveError,
}: CapstoneModalProps) {
    if (!project) return null;

    const projectId = String(project.capstone_id ?? project.id ?? "");
    const departmentValues = Array.isArray(project.department)
        ? project.department
        : project.department
          ? [project.department]
          : project.departments
                ?.map((department) => department.name)
                .filter((name): name is string => Boolean(name)) || [];
    const statusLabel = formatPublicStatus(project);
    const ActionIcon = actionKind === "mentor" ? Handshake : UserPlus;
    const acceptedMentor = project.support_summary?.accepted_mentor || null;
    const mentorLabel = acceptedMentor?.mentor_email || "Accepted mentor";
    const detailSections = [
        ["Problem Area", project.problem_area],
        ["Main Objectives", project.main_objectives],
        ["Scope of Work", project.scope_of_work],
        ["Deliverables", project.deliverables],
        ["Success Criteria", project.success_criteria],
        ["Validation Plan", project.validation_plan],
        ["Stakeholders", project.stakeholders],
        ["Risks and Constraints", project.risks_constraints],
    ].filter(([, value]) => compactText(value as string | null));
    const resourceSections = [
        ["UW Resources", project.uw_resources],
        ["Organization Resources", project.org_resources],
        ["Other Resources", project.other_resources],
    ].filter(([, value]) => compactText(value as string | null));

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
            >
                <DialogDescription className="sr-only">
                    Full project details for {project.title || "this capstone"}.
                </DialogDescription>
                <header className="border-b border-slate-200 bg-slate-50/70 px-5 py-5 pr-12 sm:px-6">
                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                            <DialogTitle className="text-xl font-semibold leading-tight tracking-[-0.02em] text-slate-950 sm:text-2xl">
                                {project.title || "Untitled project"}
                            </DialogTitle>
                            {(departmentValues.length > 0 || project.year) && (
                                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
                                    {departmentValues.length > 0 && (
                                        <div className="inline-flex min-w-0 items-center gap-1.5 [overflow-wrap:anywhere]">
                                            <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                            <TaxonomyChipList
                                                namespace="department"
                                                values={departmentValues}
                                            />
                                        </div>
                                    )}
                                    {project.year && (
                                        <span className="inline-flex items-center gap-1.5">
                                            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                                            {project.year}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        {statusLabel && (
                            <span className="w-fit shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                                {statusLabel}
                            </span>
                        )}
                    </div>
                    {project.read_only_reason && (
                        <p className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-5 text-slate-600">
                            {project.read_only_reason}
                        </p>
                    )}
                </header>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
                    <section aria-labelledby={`project-overview-${projectId}`}>
                        <h3 id={`project-overview-${projectId}`} className="text-sm font-semibold text-slate-950">
                            About this project
                        </h3>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-650 [overflow-wrap:anywhere]">
                            {compactText(project.description) ||
                                "No project description has been provided yet."}
                        </p>
                    </section>

                    {additionalMetadata && <div>{additionalMetadata}</div>}

                    <div className="space-y-2">
                        {detailSections.length > 0 && (
                            <DetailDisclosure label="Project plan">
                                <div className="space-y-5">
                                    {detailSections.map(([label, value]) => (
                                        <section key={label}>
                                            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                {label}
                                            </h4>
                                            <p className="mt-1.5 whitespace-pre-wrap leading-6 text-slate-700 [overflow-wrap:anywhere]">
                                                {compactText(value as string | null)}
                                            </p>
                                        </section>
                                    ))}
                                </div>
                            </DetailDisclosure>
                        )}

                        {((project.skills?.length ?? 0) > 0 ||
                            (project.disciplines?.length ?? 0) > 0) && (
                            <DetailDisclosure label="Skills and disciplines">
                                <div className="space-y-4">
                                    {project.skills?.length ? (
                                        <div>
                                            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Skills</h4>
                                            <TaxonomyChipList
                                                namespace="skill"
                                                values={project.skills}
                                                className="mt-2"
                                            />
                                        </div>
                                    ) : null}
                                    {project.disciplines?.length ? (
                                        <div>
                                            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Disciplines</h4>
                                            <TaxonomyChipList
                                                namespace="discipline"
                                                values={project.disciplines}
                                                className="mt-2"
                                            />
                                        </div>
                                    ) : null}
                                </div>
                            </DetailDisclosure>
                        )}

                        {(Boolean(project.project_start_date || project.meeting_frequency) ||
                            (project.deliverable_types?.length ?? 0) > 0) && (
                            <DetailDisclosure label="Logistics">
                                <dl className="grid gap-4 sm:grid-cols-2">
                                    {project.project_start_date && (
                                        <div>
                                            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Start date</dt>
                                            <dd className="mt-1">{formatDateOnly(project.project_start_date)}</dd>
                                        </div>
                                    )}
                                    {project.meeting_frequency && (
                                        <div>
                                            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Meeting cadence</dt>
                                            <dd className="mt-1 [overflow-wrap:anywhere]">{project.meeting_frequency}</dd>
                                        </div>
                                    )}
                                    {project.deliverable_types?.length ? (
                                        <div className="sm:col-span-2">
                                            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deliverable types</dt>
                                            <dd className="mt-1.5">
                                                <TaxonomyChipList
                                                    namespace="deliverable"
                                                    values={project.deliverable_types}
                                                />
                                            </dd>
                                        </div>
                                    ) : null}
                                </dl>
                            </DetailDisclosure>
                        )}

                        {(project.external_partner_name || project.external_partner_organization || project.external_partner_email || project.external_partner_website || acceptedMentor) && (
                            <DetailDisclosure label="Partner and support">
                                <div className="space-y-4">
                                    {acceptedMentor && (
                                        <p className="inline-flex items-center gap-2 text-emerald-800">
                                            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                            Mentor confirmed: <span className="[overflow-wrap:anywhere]">{mentorLabel}</span>
                                        </p>
                                    )}
                                    {(project.external_partner_name || project.external_partner_organization || project.external_partner_email || project.external_partner_website) && (
                                        <div className="space-y-1 [overflow-wrap:anywhere]">
                                            <p className="font-medium text-slate-900">
                                                {project.external_partner_organization || project.external_partner_name}
                                            </p>
                                            {project.external_partner_name && project.external_partner_organization && <p>{project.external_partner_name}</p>}
                                            {project.external_partner_email && (
                                                <a href={`mailto:${project.external_partner_email}`} className="block font-medium text-slate-900 underline underline-offset-4">
                                                    {project.external_partner_email}
                                                </a>
                                            )}
                                            {project.external_partner_website && (
                                                <a href={project.external_partner_website} target="_blank" rel="noreferrer" className="block font-medium text-slate-900 underline underline-offset-4">
                                                    Partner website
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </DetailDisclosure>
                        )}

                        {resourceSections.length > 0 && (
                            <DetailDisclosure label="Resources">
                                <div className="space-y-4">
                                    {resourceSections.map(([label, value]) => (
                                        <div key={label}>
                                            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</h4>
                                            <p className="mt-1.5 whitespace-pre-wrap leading-6 [overflow-wrap:anywhere]">
                                                {compactText(value as string | null)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </DetailDisclosure>
                        )}
                    </div>
                </div>

                <DialogFooter className="items-stretch border-t border-slate-200 bg-white px-5 py-4 sm:items-center sm:px-6">
                    <Button type="button" variant="outline" size="sm" onClick={onClose}>
                        Close
                    </Button>
                    {showSaveAction && onSaveClick && (
                        <CapstoneSaveToggle
                            kind={saveKind}
                            saved={isSaved}
                            canSave={canSave}
                            busy={saveBusy}
                            onToggle={onSaveClick}
                            onOptimisticChange={onSaveOptimisticChange}
                            onError={onSaveError}
                        />
                    )}
                    {showActionButton && onJoinProject && (
                        <Button
                            type="button"
                            size="sm"
                            variant={interestedProjects.has(projectId) ? "secondary" : "default"}
                            onClick={() => onJoinProject(projectId)}
                            className={interestedProjects.has(projectId) ? "text-emerald-700" : undefined}
                        >
                            {interestedProjects.has(projectId) ? (
                                <Pencil aria-hidden="true" />
                            ) : (
                                <ActionIcon aria-hidden="true" />
                            )}
                            {interestedProjects.has(projectId) ? activeActionLabel : actionLabel}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
