"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { MessageModal } from "./MessageModal";
import { BlurredScrollView } from "@/components/BlurredScrollView";
import ProtectedRoute from "@/components/ProtectedRoute";
import { userContext } from "@/contexts/UserContext";
import { useCapstones } from "@/hooks/useCapstones";
import { useInterest } from "@/hooks/useInterest";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";
import { CapstoneModal } from "./CapstoneModal";
import { CapstoneCard } from "./CapstoneCard";

function DiscoverPageContent() {
    const [search, setSearch] = useState("");
    const [dept, setDept] = useState("All");
    const [year, setYear] = useState("All");
    const [page, setPage] = useState(1);
    const pageSize = 10;

    const {
        projects,
        totalPages,
        isLoading: loading,
    } = useCapstones({
        page,
        pageSize,
    });

    const { interestedProjects, submitInterest, isSubmittingInterest } =
        useInterest();
    const [selectedProject, setSelectedProject] = useState<
        (typeof projects)[0] | null
    >(null);
    const { user } = userContext();
    const normalizedRole = user?.role?.toLowerCase();

    // new interest-modal state
    const [isInterestOpen, setIsInterestOpen] = useState(false);
    const [interestText, setInterestText] = useState("");
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

    //
    // HANDLE JOIN PROJECT (opens interest modal)
    //
    const handleJoinProject = (projectId: string) => {
        setActiveProjectId(projectId);
        setInterestText("");
        setIsInterestOpen(true);
    };

    //
    // SUBMIT INTEREST WITH MESSAGE
    //
    const handleSubmitInterest = async () => {
        if (!activeProjectId) return;
        const result = await submitInterest(activeProjectId, interestText);
        if (result.success) {
            setIsInterestOpen(false);
        }
    };

    //
    // UNIQUE FILTER OPTIONS
    //
    const uniqueDepartments = [
        ...new Set(
            projects
                .map((p) => p.department)
                .filter((d): d is string => d !== undefined && d.trim() !== "")
        ),
    ];

    const uniqueYears = [
        ...new Set(
            projects
                .map((p) => p.year?.toString())
                .filter((y): y is string => y !== undefined && y.trim() !== "")
        ),
    ];

    //
    // FILTERING
    //
    const filtered = projects.filter((p) => {
        const searchMatch =
            (p.title ?? "").toLowerCase().includes(search.toLowerCase()) ||
            (p.description ?? "").toLowerCase().includes(search.toLowerCase());

        const deptMatch = dept === "All" || p.department === dept;
        const yearMatch = year === "All" || p.year?.toString() === year;

        return searchMatch && deptMatch && yearMatch;
    });

    return (
        <div className="h-full bg-slate-50 py-4 px-8 flex flex-col">
            {/* FILTER BAR */}
            <div className="flex flex-col md:flex-row gap-4 justify-center items-center mb-4 flex-[1]">
                <Input
                    placeholder="Search projects..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-sm"
                />

                <Select onValueChange={setDept}>
                    <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="Filter by department" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All">All Departments</SelectItem>
                        {uniqueDepartments.map((d, idx) => (
                            <SelectItem key={`dept-${idx}-${d}`} value={d}>
                                {d}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select onValueChange={setYear}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Filter by year" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All">All Years</SelectItem>
                        {uniqueYears.map((y, idx) => (
                            <SelectItem key={`year-${idx}-${y}`} value={y}>
                                {y}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* PROJECT LIST */}
            <BlurredScrollView className="flex-[20]">
                {loading ? (
                    <p className="text-center text-slate-500">
                        Loading projects...
                    </p>
                ) : filtered.length ? (
                    filtered.map((p) => (
                        <CapstoneCard
                            key={p.capstone_id}
                            project={p}
                            isInterested={interestedProjects.has(p.capstone_id)}
                            onClick={() => setSelectedProject(p)}
                            onInterestClick={() => {
                                setActiveProjectId(p.capstone_id);
                                setInterestText("");
                                setIsInterestOpen(true);
                            }}
                        />
                    ))
                ) : (
                    <p className="text-center text-slate-500">
                        No projects match your filters.
                    </p>
                )}
            </BlurredScrollView>

            {/* PAGINATION */}
            <div className="flex justify-center items-center gap-4 mt-4 flex-[1]">
                <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md disabled:opacity-50"
                >
                    Previous
                </button>

                <span className="text-sm text-slate-600">
                    Page {page} of {totalPages}
                </span>

                <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= totalPages || loading}
                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md disabled:opacity-50"
                >
                    Next
                </button>
            </div>

            {/* DETAIL MODAL */}
            <CapstoneModal
                project={selectedProject}
                isOpen={!!selectedProject}
                onClose={() => setSelectedProject(null)}
                interestedProjects={interestedProjects}
                onJoinProject={handleJoinProject}
            />

            {/* INTEREST MESSAGE MODAL */}
            <MessageModal
                isOpen={isInterestOpen}
                onClose={() => setIsInterestOpen(false)}
                title="Send a message to the leader"
                description="Include a note so the team leader knows why you're interested."
                message={interestText}
                onMessageChange={setInterestText}
                onSubmit={handleSubmitInterest}
                isSubmitting={isSubmittingInterest}
            />
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
