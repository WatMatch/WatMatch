import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Handshake, Pencil, UserPlus } from "lucide-react";
import { ReactNode } from "react";

interface Project {
    capstone_id?: string;
    id?: string;
    title?: string;
    description?: string;
    department?: string | string[];
    year?: number;
    students?: string[] | null;
    status?: string;
    public_status?: string;
    marketplace_action_state?: string | null;
    read_only_reason?: string | null;
    disciplines?: string[];
    skills?: string[];
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
}: CapstoneModalProps) {
    if (!project) return null;

    const projectId = project.capstone_id ?? project.id ?? "";
    const departmentDisplay = Array.isArray(project.department)
        ? project.department.join(", ")
        : project.department;
    const students = project.students ?? [];
    const statusLabel = formatPublicStatus(project);
    const ActionIcon = actionKind === "mentor" ? Handshake : UserPlus;
    const acceptedMentor = project.support_summary?.accepted_mentor || null;
    const mentorLabel = acceptedMentor?.mentor_email || "Accepted mentor";

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                className="
                    fixed z-50
                    left-1/2 top-1/2
                    -translate-x-1/2 -translate-y-1/2
                    w-full sm:max-w-5xl
                    h-auto max-h-[90vh]
                    overflow-y-auto
                    p-0 gap-0
                    rounded-lg
                    bg-white
                    shadow-2xl
                    border border-slate-200
                    data-[state=open]:animate-in data-[state=closed]:animate-out
                    data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95
                    data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0
                "
            >
                <div className="flex flex-col h-full">
                    {/* HEADER */}
                <div className="p-6 pr-12 border-b border-slate-100 bg-slate-50/50">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <DialogTitle className="break-words text-2xl font-bold leading-tight text-slate-900">
                                    {project.title}
                                </DialogTitle>
                                {(departmentDisplay || project.year) && (
                                    <div className="mt-1.5 break-words text-sm font-medium text-slate-500">
                                        {departmentDisplay}
                                        {departmentDisplay &&
                                            project.year &&
                                            " - "}
                                        {project.year}
                                    </div>
                                )}
                            </div>
                            {statusLabel && (
                                <span
                                    className="shrink-0 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border bg-yellow-50 text-yellow-700 border-yellow-100"
                                >
                                    {statusLabel}
                                </span>
                            )}
                        </div>
                        {project.read_only_reason && (
                            <p className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                                {project.read_only_reason}
                            </p>
                        )}
                    </div>

                    {/* BODY */}
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {/* LEFT COLUMN: Description */}
                            <div className="md:col-span-2 space-y-6">
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-3">
                                        About the Project
                                    </h3>
                                    <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                                        {project.description}
                                    </p>
                                </div>

                                {/* Action Button */}
                                {showActionButton && onJoinProject && (
                                    <div className="pt-4">
                                        <Button
                                            onClick={() =>
                                                onJoinProject(projectId)
                                            }
                                            className={`w-full md:w-auto ${
                                                interestedProjects.has(
                                                    projectId
                                                )
                                                    ? "bg-green-600 hover:bg-green-700"
                                                    : ""
                                            }`}
                                        >
                                            {interestedProjects.has(
                                                projectId
                                            ) ? (
                                                <>
                                                    <Pencil className="w-4 h-4 mr-2" />
                                                    {activeActionLabel}
                                                </>
                                            ) : (
                                                <>
                                                    <ActionIcon className="w-4 h-4 mr-2" />
                                                    {actionLabel}
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* RIGHT COLUMN: Metadata */}
                            <div className="space-y-6">
                                {/* Skills */}
                                {project.skills &&
                                    project.skills.length > 0 && (
                                        <div>
                                            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                                                Skills
                                            </h3>
                                            <div className="flex flex-wrap gap-2">
                                                {project.skills.map(
                                                    (skill, idx) => (
                                                        <span
                                                            key={`skill-${idx}`}
                                                            className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-xs font-medium border border-slate-200"
                                                        >
                                                            {skill}
                                                        </span>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    )}

                                {(project.external_partner_name ||
                                    project.external_partner_organization ||
                                    project.external_partner_email ||
                                    project.external_partner_website) && (
                                    <div>
                                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                                            External Partner
                                        </h3>
                                        <div className="space-y-1 text-sm text-slate-700">
                                            {project.external_partner_name && (
                                                <p>{project.external_partner_name}</p>
                                            )}
                                            {project.external_partner_organization && (
                                                <p>{project.external_partner_organization}</p>
                                            )}
                                            {project.external_partner_email && (
                                                <a
                                                    href={`mailto:${project.external_partner_email}`}
                                                    className="block text-slate-900 underline"
                                                >
                                                    {project.external_partner_email}
                                                </a>
                                            )}
                                            {project.external_partner_website && (
                                                <a
                                                    href={project.external_partner_website}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="block text-slate-900 underline"
                                                >
                                                    Partner website
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {acceptedMentor && (
                                    <div>
                                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                                            Mentor
                                        </h3>
                                        <p className="text-sm text-slate-700 break-all">
                                            {mentorLabel}
                                        </p>
                                    </div>
                                )}

                                {/* Disciplines */}
                                {project.disciplines &&
                                    project.disciplines.length > 0 && (
                                        <div>
                                            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                                                Disciplines
                                            </h3>
                                            <div className="flex flex-wrap gap-2">
                                                {project.disciplines.map(
                                                    (disc, idx) => (
                                                        <span
                                                            key={`disc-${idx}`}
                                                            className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md text-xs font-medium border border-indigo-100"
                                                        >
                                                            {disc}
                                                        </span>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    )}

                                {/* Team */}
                                {students && students.length > 0 && (
                                    <div>
                                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                                            Team
                                        </h3>
                                        <ul className="space-y-2">
                                            {students.map((student, idx) => (
                                                <li
                                                    key={`student-${idx}`}
                                                    className="flex items-center text-sm text-slate-700"
                                                >
                                                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 mr-2">
                                                        {student
                                                            .charAt(0)
                                                            .toUpperCase()}
                                                    </div>
                                                    {student}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Additional metadata slot */}
                                {additionalMetadata}
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
