"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { BlurredScrollView } from "@/components/BlurredScrollView";
import { CapstoneModal } from "@/app/discover/CapstoneModal";
import ProtectedRoute from "@/components/ProtectedRoute";
import { usePastCapstones } from "@/hooks/usePastCapstones";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";

// Re-export the interface from the hook for type consistency
interface PastCapstone {
    id: string;
    title: string;
    description: string;
    department: string[];
    year: number;
    students: string[] | null;
    status?: string;
}

function PastCapstonesPageContent() {
    const [search, setSearch] = useState("");
    const [dept, setDept] = useState("All");
    const [year, setYear] = useState("All");
    const [page, setPage] = useState(1);
    const pageSize = 10;
    const [selectedCapstone, setSelectedCapstone] =
        useState<PastCapstone | null>(null);

    const { pastCapstones, loading, totalPages } = usePastCapstones({
        page,
        pageSize,
    });

    // Filters
    const uniqueDepartments = [
        ...new Set(pastCapstones.flatMap((p) => p.department).filter(Boolean)),
    ];
    const uniqueYears = [
        ...new Set(pastCapstones.map((p) => p.year.toString()).filter(Boolean)),
    ];

    const filtered = pastCapstones.filter((p) => {
        const searchMatch =
            p.title.toLowerCase().includes(search.toLowerCase()) ||
            p.description.toLowerCase().includes(search.toLowerCase());

        const deptMatch = dept === "All" || p.department.includes(dept);
        const yearMatch = year === "All" || p.year.toString() === year;

        return searchMatch && deptMatch && yearMatch;
    });

    const departmentTags = selectedCapstone?.department ?? [];

    return (
        <div className="h-full bg-slate-50 py-4 px-8 flex flex-col">
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 justify-center items-center mb-4 flex-[1]">
                <Input
                    placeholder="Search past capstones..."
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
                            <SelectItem key={idx} value={d}>
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
                        {uniqueYears.map((y) => (
                            <SelectItem key={y} value={y}>
                                {y}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Project list */}
            <BlurredScrollView className="flex-[20]">
                {loading ? (
                    <p className="text-center text-slate-500">
                        Loading past capstones...
                    </p>
                ) : filtered.length ? (
                    filtered.map((p) => (
                        <Card
                            key={p.id}
                            className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition w-full h-[200px] cursor-pointer"
                            onClick={() => setSelectedCapstone(p)}
                        >
                            <div className="flex flex-col h-full">
                                <div className="flex-[1] mb-2 overflow-hidden">
                                    <CardTitle className="text-lg line-clamp-1">
                                        {p.title}
                                    </CardTitle>
                                </div>

                                <div className="flex-[3] overflow-hidden">
                                    <p className="text-slate-600 text-sm line-clamp-4">
                                        {p.description}
                                    </p>
                                </div>

                                <div className="flex-[1] flex items-center justify-between">
                                    <CardDescription className="text-xs">
                                        {p.department.join(", ")} • {p.year}
                                    </CardDescription>
                                </div>
                            </div>
                        </Card>
                    ))
                ) : (
                    <p className="text-center text-slate-500">
                        No matching projects.
                    </p>
                )}
            </BlurredScrollView>

            {/* Pagination */}
            <div className="flex justify-center items-center gap-4 mt-4 flex-[1]">
                <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                    className="px-4 py-2 text-sm border rounded-md bg-white disabled:opacity-50"
                >
                    Previous
                </button>

                <span className="text-sm text-slate-600">
                    Page {page} of {totalPages}
                </span>

                <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || loading}
                    className="px-4 py-2 text-sm border rounded-md bg-white disabled:opacity-50"
                >
                    Next
                </button>
            </div>

            {/* Modal for Past Capstone Details */}
            <CapstoneModal
                project={selectedCapstone}
                isOpen={!!selectedCapstone}
                onClose={() => setSelectedCapstone(null)}
                showActionButton={false}
                additionalMetadata={
                    selectedCapstone && (
                        <div>
                            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                                Details
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {departmentTags.map((dept, index) => (
                                    <span
                                        key={`department-chip-${index}`}
                                        className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md text-xs font-medium border border-blue-100"
                                    >
                                        {dept}
                                    </span>
                                ))}
                                <span className="bg-green-50 text-green-700 px-2.5 py-1 rounded-md text-xs font-medium border border-green-100">
                                    {selectedCapstone.year}
                                </span>
                            </div>
                        </div>
                    )
                }
            />
        </div>
    );
}

export default function PastCapstonesPage() {
    return (
        <ProtectedRoute>
            <PastCapstonesPageContent />
        </ProtectedRoute>
    );
}
