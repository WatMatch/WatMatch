"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { MessageModal } from "./MessageModal";
import ProtectedRoute from "@/components/ProtectedRoute";
import { userContext } from "@/contexts/UserContext";
import { useCapstones } from "@/hooks/useCapstones";
import { useInterest } from "@/hooks/useInterest";
import { fetchUserCapstone, fetchUserInvites } from "@/services/users.service";
import { offerMentor } from "@/services/capstones.service";
import {
    cancelProjectExploration,
    fetchMyProjectExplorations,
    saveProjectExploration,
    type ProjectExploration,
} from "@/services/marketplace.service";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { CapstoneModal } from "./CapstoneModal";
import { CapstoneCard } from "./CapstoneCard";

const INTEREST_LIKE_STATUSES = new Set<ProjectExploration["status"]>([
    "interested",
    "exploring",
    "pending_commitment",
    "committed",
]);

function DiscoverPageContent() {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [dept, setDept] = useState("All");
    const [year, setYear] = useState("All");
    const [page, setPage] = useState(1);
    const pageSize = 10;
    const { user } = userContext();
    const normalizedRole = user?.role?.toLowerCase();
    const isStudent = normalizedRole === "student";
    const isMentor = normalizedRole === "mentor";

    const {
        projects,
        totalPages,
        isLoading: loading,
        error: capstoneError,
        departments: allDepartments,
        years: allYears,
    } = useCapstones({
        page,
        pageSize,
        search,
        department: dept,
        year,
    });

    const {
        interestedProjects,
        interestMessages,
        submitInterest,
        isSubmittingInterest,
        error: interestError,
        clearError: clearInterestError,
    } = useInterest({ enabled: isStudent });
    const [selectedProject, setSelectedProject] = useState<
        (typeof projects)[0] | null
    >(null);
    const [myCapstoneIds, setMyCapstoneIds] = useState<Set<string>>(new Set());
    const [invitedCapstoneIds, setInvitedCapstoneIds] = useState<Set<string>>(
        new Set()
    );
    const [hasActiveTeam, setHasActiveTeam] = useState(false);
    const [eligibilityLoaded, setEligibilityLoaded] = useState(false);
    const [eligibilityError, setEligibilityError] = useState("");
    const [explorationStatusByCapstoneId, setExplorationStatusByCapstoneId] =
        useState<Record<string, ProjectExploration["status"]>>({});
    const [explorationIdByCapstoneId, setExplorationIdByCapstoneId] =
        useState<Record<string, number>>({});
    const [savedProjectIds, setSavedProjectIds] = useState<Set<string>>(new Set());
    const [marketplaceActionError, setMarketplaceActionError] = useState("");
    const [savingProjectId, setSavingProjectId] = useState<string | null>(null);
    const homeDepartmentName = user?.home_department?.name;

    // new interest-modal state
    const [isInterestOpen, setIsInterestOpen] = useState(false);
    const [interestText, setInterestText] = useState("");
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
    const [inviteBlockedProjectId, setInviteBlockedProjectId] = useState<
        string | null
    >(null);
    const [isMentorOfferOpen, setIsMentorOfferOpen] = useState(false);
    const [mentorOfferText, setMentorOfferText] = useState("");
    const [mentorOfferProjectId, setMentorOfferProjectId] = useState<string | null>(null);
    const [mentorOfferSubmitting, setMentorOfferSubmitting] = useState(false);
    const [mentorOfferMessage, setMentorOfferMessage] = useState("");

    const loadMyCapstones = useCallback(async () => {
        if (!user?.user_id || !isStudent) {
            setMyCapstoneIds(new Set());
            setInvitedCapstoneIds(new Set());
            setHasActiveTeam(false);
            setExplorationStatusByCapstoneId({});
            setExplorationIdByCapstoneId({});
            setSavedProjectIds(new Set());
            setMarketplaceActionError("");
            setEligibilityError("");
            setEligibilityLoaded(true);
            return;
        }
        setEligibilityLoaded(false);
        setEligibilityError("");
        setMarketplaceActionError("");
        try {
            const [data, invitesData, marketplaceData] = await Promise.all([
                fetchUserCapstone(),
                isStudent
                    ? fetchUserInvites(String(user.user_id))
                    : Promise.resolve({ data: [] }),
                fetchMyProjectExplorations(),
            ]);
            const ids = new Set<string>();
            const teams = Array.isArray((data as { teams?: unknown[] }).teams)
                ? ((data as { teams?: unknown[] }).teams as Array<{
                      project?: { capstone_id?: string | number } | null;
                  }>)
                : [];
            const pendingCommitments = Array.isArray(
                (data as { commitment_requests?: Array<{ status?: string }> }).commitment_requests
            )
                ? ((data as { commitment_requests?: Array<{ status?: string }> }).commitment_requests || []).filter(
                      (request) => (request.status || "").toLowerCase() === "pending"
                  )
                : [];
            teams.forEach((team) => {
                const cid = team?.project?.capstone_id;
                if (cid !== undefined && cid !== null) {
                    ids.add(String(cid));
                }
            });
            setMyCapstoneIds(ids);
            setHasActiveTeam(
                teams.length > 0 ||
                    pendingCommitments.length > 0
            );

            const inviteCapstoneIds = new Set<string>();
            (invitesData.data || []).forEach((invite) => {
                const capstoneId =
                    invite.capstone?.capstone_id ?? invite.team?.capstone_fk;
                if (capstoneId !== undefined && capstoneId !== null) {
                    inviteCapstoneIds.add(String(capstoneId));
                }
            });
            setInvitedCapstoneIds(inviteCapstoneIds);

            const statusByCapstone: Record<string, ProjectExploration["status"]> = {};
            const explorationIdsByCapstone: Record<string, number> = {};
            const savedIds = new Set<string>();
            const activeMarketplaceStatuses = new Set<ProjectExploration["status"]>([
                "shortlisted",
                "interested",
                "invited",
                "exploring",
                "pending_commitment",
                "committed",
            ]);
            (marketplaceData.data || []).forEach((exploration) => {
                const capstoneId = exploration.capstone?.capstone_id ?? exploration.capstone_fk;
                const status = exploration.status;
                if (capstoneId === undefined || capstoneId === null || !activeMarketplaceStatuses.has(status)) {
                    return;
                }
                const key = String(capstoneId);
                statusByCapstone[key] = status;
                if (exploration.exploration_id !== undefined && exploration.exploration_id !== null) {
                    explorationIdsByCapstone[key] = Number(exploration.exploration_id);
                }
                if (status === "shortlisted") {
                    savedIds.add(key);
                }
                if (status === "invited") {
                    inviteCapstoneIds.add(key);
                }
            });
            setExplorationStatusByCapstoneId(statusByCapstone);
            setExplorationIdByCapstoneId(explorationIdsByCapstone);
            setSavedProjectIds(savedIds);
            setInvitedCapstoneIds(new Set(inviteCapstoneIds));
        } catch (err) {
            console.error("Failed to load current user's capstones:", err);
            setMyCapstoneIds(new Set());
            setInvitedCapstoneIds(new Set());
            setExplorationStatusByCapstoneId({});
            setExplorationIdByCapstoneId({});
            setSavedProjectIds(new Set());
            setHasActiveTeam(true);
            setEligibilityError(
                "Could not verify whether you can express interest. Refresh eligibility before sending requests."
            );
        } finally {
            setEligibilityLoaded(true);
        }
    }, [isStudent, user?.user_id]);

    useEffect(() => {
        loadMyCapstones();
    }, [loadMyCapstones]);

    useEffect(() => {
        if (homeDepartmentName && dept === "All") {
            setDept(homeDepartmentName);
        }
    }, [dept, homeDepartmentName]);

    //
    // HANDLE JOIN PROJECT (opens interest modal)
    //
    const handleJoinProject = (projectId: string) => {
        if (!isStudent) {
            return;
        }
        clearInterestError();
        if (invitedCapstoneIds.has(String(projectId))) {
            setActiveProjectId(null);
            setInterestText("");
            setIsInterestOpen(false);
            setInviteBlockedProjectId(projectId);
            return;
        }
        setActiveProjectId(projectId);
        setInterestText(interestMessages[projectId] || "");
        setIsInterestOpen(true);
    };

    const handleMentorOffer = (projectId: string) => {
        if (!isMentor) {
            return;
        }
        setMentorOfferProjectId(projectId);
        setMentorOfferText("");
        setMentorOfferMessage("");
        setIsMentorOfferOpen(true);
    };

    //
    // SUBMIT INTEREST WITH MESSAGE
    //
    const handleSubmitInterest = async () => {
        if (!isStudent) {
            setIsInterestOpen(false);
            return;
        }
        if (!activeProjectId) return;
        if (invitedCapstoneIds.has(String(activeProjectId))) {
            setIsInterestOpen(false);
            setInviteBlockedProjectId(activeProjectId);
            return;
        }
        const result = await submitInterest(activeProjectId, interestText);
        if (result.success) {
            setSavedProjectIds((current) => {
                const next = new Set(current);
                next.delete(activeProjectId);
                return next;
            });
            setExplorationStatusByCapstoneId((current) => ({
                ...current,
                [activeProjectId]: "interested",
            }));
            setMarketplaceActionError("");
            setIsInterestOpen(false);
        }
    };

    const handleSaveProject = async (projectId: string) => {
        if (!isStudent) {
            return;
        }
        setSavingProjectId(projectId);
        setMarketplaceActionError("");
        try {
            if (isProjectSavedById(projectId)) {
                const explorationId = explorationIdByCapstoneId[projectId];
                if (!explorationId) {
                    setMarketplaceActionError("Saved project state was out of date. Refreshing your saved projects.");
                    await loadMyCapstones();
                    return;
                }
                await cancelProjectExploration(
                    explorationId,
                    "Student removed the project from their saved list."
                );
                setExplorationStatusByCapstoneId((current) => {
                    const next = { ...current };
                    delete next[projectId];
                    return next;
                });
                setExplorationIdByCapstoneId((current) => {
                    const next = { ...current };
                    delete next[projectId];
                    return next;
                });
                setSavedProjectIds((current) => {
                    const next = new Set(current);
                    next.delete(projectId);
                    return next;
                });
                return;
            }

            const exploration = await saveProjectExploration({
                capstone_id: Number(projectId),
                status: "shortlisted",
            });
            const status = exploration.status || "shortlisted";
            setExplorationStatusByCapstoneId((current) => ({
                ...current,
                [projectId]: status,
            }));
            if (exploration.exploration_id !== undefined && exploration.exploration_id !== null) {
                setExplorationIdByCapstoneId((current) => ({
                    ...current,
                    [projectId]: Number(exploration.exploration_id),
                }));
            }
            setSavedProjectIds((current) => {
                const next = new Set(current);
                if (status === "shortlisted") {
                    next.add(projectId);
                } else {
                    next.delete(projectId);
                }
                return next;
            });
        } catch (err) {
            console.error(err);
            setMarketplaceActionError(
                err instanceof Error ? err.message : "Could not save project."
            );
        } finally {
            setSavingProjectId(null);
        }
    };

    const handleSubmitMentorOffer = async () => {
        if (!isMentor || !mentorOfferProjectId) {
            setIsMentorOfferOpen(false);
            return;
        }
        setMentorOfferSubmitting(true);
        setMentorOfferMessage("");
        try {
            await offerMentor(mentorOfferProjectId, {
                message: mentorOfferText.trim() || null,
            });
            setIsMentorOfferOpen(false);
            setMentorOfferMessage("Mentor offer sent. The team or course staff can accept it.");
        } catch (err) {
            console.error(err);
            setMentorOfferMessage(
                err instanceof Error ? err.message : "Could not send mentor offer."
            );
        } finally {
            setMentorOfferSubmitting(false);
        }
    };

    //
    // UNIQUE FILTER OPTIONS
    //
    useEffect(() => {
        setPage(1);
    }, [search, dept, year]);

    useEffect(() => {
        if (!loading && page > totalPages) {
            setPage(totalPages);
        }
    }, [loading, page, totalPages]);

    const projectAllowsInterest = (project: (typeof projects)[0]) => {
        if (typeof project.can_express_interest === "boolean") {
            return project.can_express_interest;
        }
        return (
            (project.public_status || "").toLowerCase() === "recruiting" ||
            (project.status || "").toLowerCase() === "approved_recruiting"
        );
    };

    const projectAllowsSave = (project: (typeof projects)[0]) => {
        if (typeof project.can_shortlist === "boolean") {
            return project.can_shortlist;
        }
        return projectAllowsInterest(project);
    };

    const projectAllowsMentorOffer = (project: (typeof projects)[0]) => {
        if (typeof project.can_offer_mentor_support === "boolean") {
            return project.can_offer_mentor_support;
        }
        if (typeof project.can_offer_mentor === "boolean") {
            return project.can_offer_mentor;
        }
        return (
            (project.public_status || "").toLowerCase() === "recruiting" ||
            (project.status || "").toLowerCase() === "approved_recruiting"
        );
    };

    const isProjectInterestedById = (projectId: string | number) => {
        const key = String(projectId);
        const status = explorationStatusByCapstoneId[key];
        if (status) {
            return INTEREST_LIKE_STATUSES.has(status);
        }
        return interestedProjects.has(key);
    };

    const isProjectSavedById = (projectId: string | number) =>
        savedProjectIds.has(String(projectId)) &&
        explorationStatusByCapstoneId[String(projectId)] === "shortlisted";

    const canExpressInterest = (project: (typeof projects)[0]) => {
        if (!isStudent) {
            return false;
        }
        if (eligibilityError) {
            return false;
        }
        const isOwnProject = String(project.user_fk ?? "") === String(user?.user_id ?? "");
        const alreadyInThisCapstone = myCapstoneIds.has(String(project.capstone_id));
        const alreadyInvitedToThisCapstone = invitedCapstoneIds.has(
            String(project.capstone_id)
        );
        return (
            !hasActiveTeam &&
            !isOwnProject &&
            !alreadyInThisCapstone &&
            !alreadyInvitedToThisCapstone &&
            projectAllowsInterest(project)
        );
    };

    const canSaveProject = (project: (typeof projects)[0]) => {
        if (!isStudent || !eligibilityLoaded || eligibilityError) {
            return false;
        }
        const isOwnProject = String(project.user_fk ?? "") === String(user?.user_id ?? "");
        const projectId = String(project.capstone_id);
        return (
            !hasActiveTeam &&
            !isOwnProject &&
            !myCapstoneIds.has(projectId) &&
            !invitedCapstoneIds.has(projectId) &&
            !isProjectInterestedById(projectId) &&
            !isProjectSavedById(projectId) &&
            projectAllowsSave(project)
        );
    };

    const canOfferMentor = (project: (typeof projects)[0]) =>
        isMentor &&
        projectAllowsMentorOffer(project) &&
        !project.support_summary?.accepted_mentor;

    const getInterestBlockReason = (project: (typeof projects)[0]) => {
        if (!isStudent) {
            return "";
        }
        if (!eligibilityLoaded) {
            return "Checking whether you can request to join this capstone.";
        }
        if (eligibilityError) {
            return eligibilityError;
        }
        if (invitedCapstoneIds.has(String(project.capstone_id))) {
            return "You already have an invite to this capstone. Accept or decline it from your dashboard instead.";
        }
        if (myCapstoneIds.has(String(project.capstone_id))) {
            return "You are already on this capstone team.";
        }
        if (hasActiveTeam) {
            return "You already have an official team or pending commitment, so new join requests are paused.";
        }
        if (!projectAllowsInterest(project)) {
            return project.read_only_reason || "This capstone is not accepting join requests right now.";
        }
        return "";
    };

    const modalInterestProjectIds = new Set<string>();
    interestedProjects.forEach((projectId) => {
        if (isProjectInterestedById(projectId)) {
            modalInterestProjectIds.add(projectId);
        }
    });
    Object.entries(explorationStatusByCapstoneId).forEach(([projectId, status]) => {
        if (INTEREST_LIKE_STATUSES.has(status)) {
            modalInterestProjectIds.add(projectId);
        }
    });

    return (
        <div className="min-h-full bg-slate-50 px-2 py-4 sm:px-4">
            {/* FILTER BAR */}
            <div className="mx-auto mb-4 w-full max-w-6xl">
                <div className="mb-4">
                    <h1 className="text-2xl font-semibold text-slate-900">
                        Discover Projects
                    </h1>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                        Review active capstones, save strong fits, and manage project interest.
                    </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(16rem,1fr)_minmax(12rem,260px)_minmax(8rem,150px)] xl:items-center">
                <Input
                    placeholder="Search projects..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="min-w-0"
                />

                <Select value={dept} onValueChange={setDept}>
                    <SelectTrigger className="w-full min-w-0">
                        <SelectValue placeholder="Filter by department" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All">All Departments</SelectItem>
                        {allDepartments.map((d, idx) => (
                            <SelectItem key={`dept-${idx}-${d}`} value={d}>
                                {d}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select onValueChange={setYear}>
                    <SelectTrigger className="w-full min-w-0">
                        <SelectValue placeholder="Filter by year" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All">All Years</SelectItem>
                        {allYears.map((y, idx) => (
                            <SelectItem key={`year-${idx}-${y}`} value={y}>
                                {y}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                </div>
            </div>

            {(capstoneError || interestError || marketplaceActionError) && (
                <p className="mx-auto mb-3 w-full max-w-6xl break-words rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {capstoneError || interestError || marketplaceActionError}
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
            {eligibilityError && (
                <div className="mb-3 flex flex-col items-center justify-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900 md:flex-row">
                    <span>{eligibilityError}</span>
                    <button
                        type="button"
                        onClick={loadMyCapstones}
                        disabled={!eligibilityLoaded}
                        className="rounded-md border border-amber-300 bg-white px-3 py-1 font-medium text-amber-900 disabled:opacity-60"
                    >
                        {eligibilityLoaded ? "Refresh Eligibility" : "Checking..."}
                    </button>
                </div>
            )}

            {/* PROJECT LIST */}
            <div className="mx-auto w-full max-w-6xl space-y-3 pb-2">
                {loading ? (
                    <p className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                        Loading projects...
                    </p>
                ) : projects.length ? (
                    projects.map((p) => (
                        <CapstoneCard
                            key={p.capstone_id}
                            project={p}
                            isInterested={isProjectInterestedById(p.capstone_id)}
                            canExpressInterest={
                                isMentor ? canOfferMentor(p) : eligibilityLoaded && canExpressInterest(p)
                            }
                            showSaveAction={false}
                            isSaved={isProjectSavedById(p.capstone_id)}
                            canSave={canSaveProject(p)}
                            saveBusy={savingProjectId === String(p.capstone_id)}
                            onClick={() => setSelectedProject(p)}
                            onSaveClick={() => handleSaveProject(String(p.capstone_id))}
                            onInterestClick={() =>
                                isMentor
                                    ? handleMentorOffer(p.capstone_id)
                                    : handleJoinProject(p.capstone_id)
                            }
                            actionLabel={isMentor ? "Offer mentor support" : "Request to join"}
                            actionKind={isMentor ? "mentor" : "interest"}
                        />
                    ))
                ) : (
                    <p className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                        No projects match your filters.
                    </p>
                )}
            </div>

            {/* PAGINATION */}
            <div className="mt-4 flex flex-col items-center justify-center gap-3 pb-2 sm:flex-row">
                <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                    className="w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50 sm:w-auto sm:min-w-28"
                >
                    Previous
                </button>

                <span className="text-sm text-slate-600">
                    Page {page} of {totalPages}
                </span>

                <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || loading}
                    className="w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50 sm:w-auto sm:min-w-28"
                >
                    Next
                </button>
            </div>

            {/* DETAIL MODAL */}
            <CapstoneModal
                project={selectedProject}
                isOpen={!!selectedProject}
                onClose={() => setSelectedProject(null)}
                interestedProjects={modalInterestProjectIds}
                showActionButton={
                    !!selectedProject &&
                    ((isStudent &&
                        eligibilityLoaded &&
                        canExpressInterest(selectedProject)) ||
                        (isMentor && canOfferMentor(selectedProject)))
                }
                onJoinProject={
                    isMentor
                        ? (projectId) => handleMentorOffer(projectId)
                        : handleJoinProject
                }
                actionLabel={isMentor ? "Offer Mentor Support" : "Join Project"}
                actionKind={isMentor ? "mentor" : "interest"}
                additionalMetadata={
                    selectedProject &&
                    isStudent &&
                    !canExpressInterest(selectedProject) ? (
                        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                            {getInterestBlockReason(selectedProject)}
                        </div>
                    ) : undefined
                }
            />

            {/* INTEREST MESSAGE MODAL */}
            <MessageModal
                isOpen={isInterestOpen}
                onClose={() => setIsInterestOpen(false)}
                title={
                    activeProjectId && isProjectInterestedById(activeProjectId)
                        ? "Edit your note to the leader"
                        : "Send a message to the leader"
                }
                description={
                    activeProjectId && isProjectInterestedById(activeProjectId)
                        ? "Update the note attached to your existing request."
                        : "Include a note so the team leader knows why you're interested."
                }
                message={interestText}
                onMessageChange={setInterestText}
                onSubmit={handleSubmitInterest}
                isSubmitting={isSubmittingInterest}
                submitLabel={
                    activeProjectId && isProjectInterestedById(activeProjectId)
                        ? "Update Note"
                        : "Send Request"
                }
            />

            <MessageModal
                isOpen={isMentorOfferOpen}
                onClose={() => setIsMentorOfferOpen(false)}
                title="Offer mentor support"
                description="Share a short note about how you can support this project. This does not change student marketplace participation."
                message={mentorOfferText}
                onMessageChange={setMentorOfferText}
                onSubmit={handleSubmitMentorOffer}
                isSubmitting={mentorOfferSubmitting}
                submitLabel="Send Offer"
            />

            <Dialog
                open={!!inviteBlockedProjectId}
                onOpenChange={(open) => {
                    if (!open) {
                        setInviteBlockedProjectId(null);
                    }
                }}
            >
                <DialogContent className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>Invite Already Pending</DialogTitle>
                        <DialogDescription>
                            You already have an invite to this capstone. Accept
                            or decline the invite from your dashboard instead of
                            sending an interest request.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setInviteBlockedProjectId(null)}
                        >
                            Close
                        </Button>
                        <Button
                            onClick={() => {
                                setInviteBlockedProjectId(null);
                                router.push("/dashboard");
                            }}
                        >
                            Go to Dashboard
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function DiscoverPage() {
    return (
        <ProtectedRoute>
            <DiscoverPageContent />
        </ProtectedRoute>
    );
}

