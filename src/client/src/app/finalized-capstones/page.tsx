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
import { CapstoneCard } from "@/components/capstones/CapstoneCard";
import { CapstoneModal } from "@/app/discover/CapstoneModal";
import { MessageModal } from "@/app/discover/MessageModal";
import {
    BrowseClearButton,
    BrowseEmpty,
    BrowseLoading,
    BrowseNotice,
    BrowsePageHeader,
    BrowsePageShell,
    BrowseToolbar,
    PaginationBar,
    ResultsSummary,
} from "@/components/capstones/BrowsePage";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

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
        if (!homeDepartmentName) return;
        setDept((currentDepartment) =>
            currentDepartment === "All" ? homeDepartmentName : currentDepartment
        );
    }, [homeDepartmentName]);

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

    const hasActiveFilters = search.trim() !== "" || dept !== "All" || year !== "All";

    return (
        <BrowsePageShell>
            <BrowsePageHeader
                eyebrow="Read-only project archive"
                title="Finalized projects"
                description="Browse current finalized and academically completed WatMatch projects. Student rosters and project membership cannot be changed here."
            />

            <BrowseToolbar>
                <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-[minmax(16rem,1fr)_minmax(12rem,260px)_minmax(8rem,160px)_auto] xl:items-center">
                    <label className="relative min-w-0">
                        <span className="sr-only">Search finalized projects</span>
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                        <Input
                            placeholder="Search finalized projects"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            className="min-w-0 pl-9"
                        />
                    </label>
                    <Select value={dept} onValueChange={setDept}>
                        <SelectTrigger className="w-full min-w-0" aria-label="Filter by department">
                            <SelectValue placeholder="Department" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All departments</SelectItem>
                            {departments.map((department, index) => (
                                <SelectItem key={`dept-${index}-${department}`} value={department}>
                                    {department}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={year} onValueChange={setYear}>
                        <SelectTrigger className="w-full min-w-0" aria-label="Filter by year">
                            <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All years</SelectItem>
                            {years.map((option, index) => (
                                <SelectItem key={`year-${index}-${option}`} value={option}>
                                    {option}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <BrowseClearButton
                        active={hasActiveFilters}
                        onClear={() => {
                            setSearch("");
                            setDept("All");
                            setYear("All");
                        }}
                    />
                </div>
            </BrowseToolbar>

            {error && <BrowseNotice tone="error">{error}</BrowseNotice>}
            {mentorOfferMessage && (
                <BrowseNotice
                    tone={
                        mentorOfferMessage.toLowerCase().includes("could not") ||
                        mentorOfferMessage.toLowerCase().includes("failed")
                            ? "error"
                            : "success"
                    }
                >
                    {mentorOfferMessage}
                </BrowseNotice>
            )}

            {!isLoading && (
                <ResultsSummary
                    count={projects.length}
                    singular="project"
                    page={page}
                    totalPages={totalPages}
                    detail="Finalized projects are read-only for students."
                />
            )}

            <section className="space-y-3" aria-label="Finalized project results">
                {isLoading ? (
                    <BrowseLoading label="Loading finalized projects…" />
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
                    <BrowseEmpty
                        title="No finalized projects found"
                        description="Try a broader search or clear one of the filters above."
                        action={
                            hasActiveFilters ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setSearch("");
                                        setDept("All");
                                        setYear("All");
                                    }}
                                >
                                    Clear filters
                                </Button>
                            ) : undefined
                        }
                    />
                )}
            </section>

            <PaginationBar
                page={page}
                totalPages={totalPages}
                loading={isLoading}
                onPrevious={() => setPage((previous) => Math.max(1, previous - 1))}
                onNext={() => setPage((previous) => Math.min(totalPages, previous + 1))}
            />

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
        </BrowsePageShell>
    );
}

export default function FinalizedCapstonesPage() {
    return (
        <ProtectedRoute>
            <FinalizedCapstonesContent />
        </ProtectedRoute>
    );
}
