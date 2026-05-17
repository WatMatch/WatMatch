"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, MessageSquarePlus, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { userContext } from "@/contexts/UserContext";
import {
    fetchPendingCapstones,
    approveCapstone,
    rejectCapstone,
    requestCapstoneChanges,
} from "@/services/capstones.service";

interface Project {
    capstone_id: string;
    title?: string;
    description?: string;
    department?: string;
    year?: number;
}

interface CapstoneApiResponse {
    success: boolean;
    page?: number;
    page_size?: number;
    total?: number;
    total_pages?: number;
    data: Project[];
}

export function PendingCapstonesSection() {
    const { user } = userContext();
    const normalizedRole = user?.role?.toLowerCase();
    const isInstructor = normalizedRole === "instructor";

    const [pendingProjects, setPendingProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const pageSize = 10;

    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [feedbackText, setFeedbackText] = useState("");
    const [selectedCapstoneId, setSelectedCapstoneId] = useState<string | null>(
        null
    );
    const [submittingFeedback, setSubmittingFeedback] = useState(false);
    const [feedbackError, setFeedbackError] = useState<string | null>(null);

    const [submittingActions, setSubmittingActions] = useState<
        Record<string, boolean>
    >({});

    const isActionPending = useMemo(
        () => (capstoneId: string) => submittingActions[capstoneId] ?? false,
        [submittingActions]
    );

    const openRequestChangesModal = (capstoneId: string) => {
        setSelectedCapstoneId(capstoneId);
        setFeedbackText("");
        setFeedbackError(null);
        setIsFeedbackOpen(true);
    };

    const closeRequestChangesModal = () => {
        setIsFeedbackOpen(false);
        setSelectedCapstoneId(null);
        setFeedbackText("");
        setFeedbackError(null);
    };

    const handleDecision = async (
        capstoneId: string,
        decision: "approve" | "request_changes" | "reject",
        feedback?: string
    ) => {
        try {
            setSubmittingActions((previous) => ({
                ...previous,
                [capstoneId]: true,
            }));

            if (decision === "approve") {
                await approveCapstone(capstoneId);
            } else if (decision === "reject") {
                await rejectCapstone(capstoneId);
            } else if (decision === "request_changes" && feedback) {
                await requestCapstoneChanges(capstoneId, feedback);
            }

            setPendingProjects((previous) =>
                previous.filter((project) => project.capstone_id !== capstoneId)
            );
        } catch (decisionError) {
            console.error("Error performing decision request:", decisionError);
            setError("Could not update capstone status. Please try again.");
        } finally {
            setSubmittingActions((previous) => {
                const updated = { ...previous };
                delete updated[capstoneId];
                return updated;
            });
        }
    };

    const handleSubmitFeedback = async () => {
        if (!selectedCapstoneId) {
            return;
        }

        const trimmedFeedback = feedbackText.trim();
        if (!trimmedFeedback) {
            return;
        }

        setFeedbackError(null);
        setSubmittingFeedback(true);

        try {
            await handleDecision(
                selectedCapstoneId,
                "request_changes",
                trimmedFeedback
            );
            closeRequestChangesModal();
        } catch (submitError) {
            console.error("Error submitting feedback:", submitError);
            setFeedbackError("Could not submit feedback. Please try again.");
        } finally {
            setSubmittingFeedback(false);
        }
    };

    useEffect(() => {
        if (!isInstructor) {
            return;
        }

        async function fetchPending() {
            setLoading(true);
            setError(null);
            try {
                const data = await fetchPendingCapstones(page, pageSize);
                const resolvedTotalPages = Math.max(1, data.total_pages ?? 1);
                setTotalPages(resolvedTotalPages);
                if (page > resolvedTotalPages) {
                    setPage(resolvedTotalPages);
                    return;
                }
                setPendingProjects(data.data ?? []);
            } catch (err) {
                console.error("Error fetching pending capstones:", err);
                setError("Could not load pending capstones.");
            } finally {
                setLoading(false);
            }
        }

        fetchPending();
    }, [isInstructor, page, pageSize]);

    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
        }
    }, [page]);

    if (!isInstructor) {
        return null;
    }

    const hasProjects = pendingProjects.length > 0;

    return (
        <section className="flex flex-col gap-3 overflow-hidden">
            <h2 className="text-xl font-semibold text-slate-900">
                Pending Capstone Approvals
            </h2>
            {loading ? (
                <p className="text-sm text-slate-600">
                    Loading pending projects...
                </p>
            ) : error ? (
                <p className="text-sm text-red-600">{error}</p>
            ) : pendingProjects.length === 0 ? (
                <p className="text-sm text-slate-600">
                    No pending capstones awaiting approval.
                </p>
            ) : (
                <div className="relative flex-1 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                    <div className="pointer-events-none absolute top-0 left-0 w-full h-4 bg-gradient-to-b from-slate-100 to-transparent z-10" />
                    <div
                        ref={scrollContainerRef}
                        className="h-full overflow-auto py-2 scrollbar-none"
                    >
                        <div className="flex flex-col gap-4 px-2">
                            {pendingProjects.map((project) => (
                                <Card
                                    key={project.capstone_id}
                                    className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition w-full"
                                >
                                    <div className="flex flex-col gap-3 p-4 h-full">
                                        <CardTitle className="text-lg line-clamp-1">
                                            {project.title ??
                                                "Untitled Project"}
                                        </CardTitle>
                                        <p className="text-slate-600 text-sm line-clamp-4">
                                            {project.description ??
                                                "No description provided."}
                                        </p>
                                        <div className="flex items-center justify-end text-xs text-slate-500">
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="sm"
                                                    className="bg-emerald-400 hover:bg-emerald-500 text-white"
                                                    disabled={isActionPending(
                                                        project.capstone_id
                                                    )}
                                                    onClick={() =>
                                                        handleDecision(
                                                            project.capstone_id,
                                                            "approve"
                                                        )
                                                    }
                                                    aria-label="Approve capstone"
                                                    title="Approve"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    className="bg-rose-400 hover:bg-rose-500 text-white"
                                                    disabled={isActionPending(
                                                        project.capstone_id
                                                    )}
                                                    onClick={() =>
                                                        handleDecision(
                                                            project.capstone_id,
                                                            "reject"
                                                        )
                                                    }
                                                    aria-label="Reject capstone"
                                                    title="Reject"
                                                >
                                                    <X className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    className="bg-slate-700 hover:bg-slate-800 text-white"
                                                    onClick={() =>
                                                        openRequestChangesModal(
                                                            project.capstone_id
                                                        )
                                                    }
                                                    aria-label="Request changes"
                                                    title="Request changes"
                                                >
                                                    <MessageSquarePlus className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                    <div className="pointer-events-none absolute bottom-0 left-0 w-full h-4 bg-gradient-to-t from-slate-100 to-transparent z-10" />
                </div>
            )}
            {pendingProjects.length > 0 && (
                <div className="flex justify-center items-center gap-4">
                    <button
                        onClick={() =>
                            setPage((current) => Math.max(1, current - 1))
                        }
                        disabled={page === 1 || loading}
                        className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        type="button"
                    >
                        Previous
                    </button>
                    <span className="text-sm text-slate-600">
                        Page {page} of {totalPages}
                    </span>
                    <button
                        onClick={() =>
                            setPage((current) =>
                                Math.min(totalPages, current + 1)
                            )
                        }
                        disabled={page >= totalPages || loading}
                        className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        type="button"
                    >
                        Next
                    </button>
                </div>
            )}
            <Dialog
                open={isFeedbackOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        closeRequestChangesModal();
                    }
                }}
            >
                <DialogContent className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>Request Changes</DialogTitle>
                        <DialogDescription>
                            Share specific feedback so the student team knows
                            what to improve.
                        </DialogDescription>
                    </DialogHeader>
                    <Textarea
                        value={feedbackText}
                        onChange={(event) =>
                            setFeedbackText(event.target.value)
                        }
                        placeholder="Detail the updates you would like the team to make..."
                        rows={8}
                        className="min-h-[220px]"
                    />
                    {feedbackError && (
                        <p className="text-sm text-red-600">{feedbackError}</p>
                    )}
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={closeRequestChangesModal}
                            disabled={submittingFeedback}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmitFeedback}
                            disabled={
                                feedbackText.trim().length === 0 ||
                                submittingFeedback
                            }
                        >
                            {submittingFeedback
                                ? "Submitting..."
                                : "Submit Feedback"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}
