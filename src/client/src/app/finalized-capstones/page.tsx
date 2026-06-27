"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import ProtectedRoute from "@/components/ProtectedRoute";
import { userContext } from "@/contexts/UserContext";
import { useFinalizedCapstones } from "@/hooks/useCapstones";
import { offerMentor } from "@/services/capstones.service";
import { CapstoneCard } from "@/app/discover/CapstoneCard";
import { CapstoneModal } from "@/app/discover/CapstoneModal";
import { MessageModal } from "@/app/discover/MessageModal";

function FinalizedCapstonesContent() {
    const [search, setSearch] = useState("");
    const [dept, setDept] = useState("All");
    const [year, setYear] = useState("All");
    const [page, setPage] = useState(1);
    const [selectedProject, setSelectedProject] = useState<
        ReturnType<typeof useFinalizedCapstones>["projects"][number] | null
    >(null);
    const [mentorOfferProjectId, setMentorOfferProjectId] = useState<string | null>(null);
    const [mentorOfferText, setMentorOfferText] = useState("");
    const [mentorOfferSubmitting, setMentorOfferSubmitting] = useState(false);
    const [mentorOfferMessage, setMentorOfferMessage] = useState("");
    const pageSize = 10;
    const { user } = userContext();
    const normalizedRole = user?.role?.toLowerCase();
    const isMentor = normalizedRole === "mentor";
    const homeDepartmentName = user?.home_department?.name;

    const {
        projects,
        totalPages,
        isLoading,
        error,
        departments,
        years,
        mutate,
    } = useFinalizedCapstones({
        page,
        pageSize,
        search,
        department: dept,
        year,
    });

    useEffect(() => {
        if (homeDepartmentName && dept === "All") {
            setDept(homeDepartmentName);
        }
    }, [dept, homeDepartmentName]);

    useEffect(() => {
        setPage(1);
    }, [search, dept, year]);

    useEffect(() => {
        if (!isLoading && page > totalPages) {
            setPage(totalPages);
        }
    }, [isLoading, page, totalPages]);

    const projectAllowsMentorSupport = (
        project: ReturnType<typeof useFinalizedCapstones>["projects"][number] | null
    ) => {
        if (!project) return false;
        if (project.support_summary?.accepted_mentor) return false;
        if (typeof project.can_offer_mentor_support === "boolean") {
            return project.can_offer_mentor_support;
        }
        if (typeof project.can_offer_mentor === "boolean") {
            return project.can_offer_mentor;
        }
        return (
            project.carry_over_read_only === true &&
            project.closeout_decision !== "archive" &&
            (project.public_status || project.status || "").toLowerCase() !== "complete"
        );
    };

    const handleMentorOffer = (projectId: string) => {
        if (!isMentor) {
            return;
        }
        setMentorOfferProjectId(projectId);
        setMentorOfferText("");
        setMentorOfferMessage("");
    };

    const handleSubmitMentorOffer = async () => {
        if (!isMentor || !mentorOfferProjectId) {
            setMentorOfferProjectId(null);
            return;
        }
        setMentorOfferSubmitting(true);
        setMentorOfferMessage("");
        try {
            await offerMentor(mentorOfferProjectId, {
                message: mentorOfferText.trim() || null,
            });
            setMentorOfferProjectId(null);
            setMentorOfferText("");
            setMentorOfferMessage("Mentor support offer sent. The team, instructor, or admin can accept it.");
            await mutate();
        } catch (err) {
            console.error(err);
            setMentorOfferMessage(
                err instanceof Error ? err.message : "Could not send mentor support offer."
            );
        } finally {
            setMentorOfferSubmitting(false);
        }
    };

    return (
        <div className="min-h-full bg-slate-50 px-2 py-4 sm:px-4">
            <div className="mx-auto mb-4 w-full max-w-6xl">
                <div className="mb-4">
                    <h1 className="text-2xl font-semibold text-slate-900">
                        Finalized Projects
                    </h1>
                    <p className="mt-1 text-sm text-slate-600">
                        Browse live finalized and completed capstones before they move into the past archive.
                    </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(16rem,1fr)_minmax(12rem,260px)_minmax(8rem,150px)] xl:items-center">
                    <Input
                        placeholder="Search finalized or completed projects..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        className="min-w-0"
                    />

                    <Select value={dept} onValueChange={setDept}>
                        <SelectTrigger className="w-full min-w-0">
                            <SelectValue placeholder="Filter by department" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Departments</SelectItem>
                            {departments.map((department, index) => (
                                <SelectItem
                                    key={`dept-${index}-${department}`}
                                    value={department}
                                >
                                    {department}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={year} onValueChange={setYear}>
                        <SelectTrigger className="w-full min-w-0">
                            <SelectValue placeholder="Filter by year" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Years</SelectItem>
                            {years.map((option, index) => (
                                <SelectItem key={`year-${index}-${option}`} value={option}>
                                    {option}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {error && (
                <p className="mx-auto mb-3 w-full max-w-6xl break-words rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </p>
            )}
            {mentorOfferMessage && (
                <p
                    className={`mx-auto mb-3 w-full max-w-6xl break-words rounded-md border px-4 py-3 text-sm ${
                        mentorOfferMessage.toLowerCase().includes("could not") ||
                        mentorOfferMessage.toLowerCase().includes("failed")
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    }`}
                >
                    {mentorOfferMessage}
                </p>
            )}

            <div className="mx-auto w-full max-w-6xl space-y-3 pb-2">
                {isLoading ? (
                    <p className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">Loading finalized projects...</p>
                ) : projects.length ? (
                    projects.map((project) => (
                        <CapstoneCard
                            key={project.capstone_id}
                            project={project}
                            isInterested={false}
                            canExpressInterest={isMentor && projectAllowsMentorSupport(project)}
                            actionLabel="Offer mentor support"
                            actionKind="mentor"
                            onClick={() => setSelectedProject(project)}
                            onInterestClick={() => handleMentorOffer(String(project.capstone_id))}
                        />
                    ))
                ) : (
                    <p className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                        No finalized or completed projects match your filters.
                    </p>
                )}
            </div>

            <div className="mt-4 flex flex-col items-center justify-center gap-3 pb-2 sm:flex-row">
                <button
                    onClick={() => setPage((previous) => Math.max(1, previous - 1))}
                    disabled={page === 1 || isLoading}
                    className="w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50 sm:w-auto sm:min-w-28"
                >
                    Previous
                </button>
                <span className="text-sm text-slate-600">
                    Page {page} of {totalPages}
                </span>
                <button
                    onClick={() => setPage((previous) => Math.min(totalPages, previous + 1))}
                    disabled={page >= totalPages || isLoading}
                    className="w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50 sm:w-auto sm:min-w-28"
                >
                    Next
                </button>
            </div>

            <CapstoneModal
                project={selectedProject}
                isOpen={!!selectedProject}
                onClose={() => setSelectedProject(null)}
                showActionButton={isMentor && projectAllowsMentorSupport(selectedProject)}
                onJoinProject={(projectId) => handleMentorOffer(projectId)}
                actionLabel="Offer mentor support"
                actionKind="mentor"
                additionalMetadata={
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        {(selectedProject?.public_status || selectedProject?.status || "").toLowerCase() === "complete"
                            ? "This capstone is complete and read-only until staff publishes it to WatMatch completed capstones."
                            : selectedProject?.carry_over_read_only
                              ? "This project is read-only for students. Mentors may still offer support where the team has no accepted mentor."
                              : "Finalized projects are read-only."}
                    </div>
                }
            />
            <MessageModal
                isOpen={!!mentorOfferProjectId}
                onClose={() => setMentorOfferProjectId(null)}
                title="Offer mentor support"
                description="Share a short note about how you can support this read-only project. This does not reopen student marketplace participation."
                message={mentorOfferText}
                onMessageChange={setMentorOfferText}
                onSubmit={handleSubmitMentorOffer}
                isSubmitting={mentorOfferSubmitting}
                submitLabel="Send Offer"
            />
        </div>
    );
}

export default function FinalizedCapstonesPage() {
    return (
        <ProtectedRoute>
            <FinalizedCapstonesContent />
        </ProtectedRoute>
    );
}
