"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Search } from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { userContext } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { fetchCourses, type Course } from "@/services/courses.service";
import {
    fetchPartnerOpportunityPage,
    type PartnerOpportunity,
} from "@/services/partners.service";
import { courseTargetLabel } from "@/lib/opportunity-options";

function ExternalOpportunitiesContent() {
    const router = useRouter();
    const { user } = userContext();
    const isStudent = (user?.role || "").toLowerCase() === "student";
    const currentCourseId =
        user?.course_fk === null || user?.course_fk === undefined
            ? ""
            : String(user.course_fk);
    const [opportunities, setOpportunities] = useState<PartnerOpportunity[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [courseFilter, setCourseFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const opportunitiesRequestIdRef = useRef(0);

    useEffect(() => {
        const requestId = opportunitiesRequestIdRef.current + 1;
        opportunitiesRequestIdRef.current = requestId;

        async function loadOpportunities() {
            setLoading(true);
            setError("");
            try {
                const payload = await fetchPartnerOpportunityPage({
                    search,
                    status: "published",
                    targetCourseId:
                        courseFilter === "all" ? undefined : Number(courseFilter),
                    page,
                    pageSize: 8,
                });
                if (opportunitiesRequestIdRef.current !== requestId) return;
                const nextTotalPages = Math.max(1, payload.total_pages || 1);
                if (page > nextTotalPages) {
                    setTotalPages(nextTotalPages);
                    setPage(nextTotalPages);
                    return;
                }
                setOpportunities(payload.data || []);
                setTotalPages(nextTotalPages);
            } catch (loadError) {
                if (opportunitiesRequestIdRef.current !== requestId) return;
                console.error(loadError);
                setError(
                    loadError instanceof Error
                        ? loadError.message
                        : "Could not load external opportunities."
                );
            } finally {
                if (opportunitiesRequestIdRef.current === requestId) {
                    setLoading(false);
                }
            }
        }

        loadOpportunities();
    }, [courseFilter, search, page]);

    useEffect(() => {
        let isMounted = true;

        async function loadCourses() {
            try {
                const rows = await fetchCourses(true);
                if (isMounted) setCourses(rows);
            } catch (courseError) {
                console.error("Failed to load courses:", courseError);
            }
        }

        loadCourses();
        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        setCourseFilter(isStudent && currentCourseId ? currentCourseId : "all");
        setPage(1);
    }, [currentCourseId, isStudent]);

    useEffect(() => {
        if (
            courseFilter !== "all" &&
            courses.length > 0 &&
            !courses.some((course) => String(course.course_id) === courseFilter)
        ) {
            setCourseFilter("all");
            setPage(1);
        }
    }, [courseFilter, courses]);

    const visibleOpportunities = useMemo(() => opportunities, [opportunities]);
    const submitSearch = () => {
        setPage(1);
        setSearch(searchInput.trim());
    };
    const handleCourseFilterChange = (value: string) => {
        setCourseFilter(value);
        setPage(1);
    };

    return (
        <div className="min-h-full bg-slate-50 px-2 py-6 sm:px-4 sm:py-8">
            <div className="mx-auto max-w-6xl space-y-5">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                        External Opportunities
                    </h1>
                    <p className="text-slate-600 mt-2">
                        Browse capstone ideas from external partners. Contact the
                        partner first, then link the opportunity only after they
                        agree to support your team.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)_auto]">
                    <Input
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") submitSearch();
                        }}
                        placeholder="Search by title, organization, or description"
                    />
                    <Select
                        value={courseFilter}
                        onValueChange={handleCourseFilterChange}
                    >
                        <SelectTrigger className="min-w-0">
                            <SelectValue placeholder="Target course" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All courses</SelectItem>
                            {courses.map((course) => (
                                <SelectItem
                                    key={course.course_id}
                                    value={String(course.course_id)}
                                >
                                    {courseTargetLabel(course)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button onClick={submitSearch} className="w-full md:w-auto">
                        <Search className="w-4 h-4 mr-2" />
                        Search
                    </Button>
                </div>

                {error && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {loading ? (
                    <p className="text-sm text-slate-600">Loading opportunities...</p>
                ) : visibleOpportunities.length === 0 ? (
                    <Card>
                        <CardContent className="p-6 text-sm text-slate-600">
                            No published external opportunities found.
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {visibleOpportunities.map((opportunity) => {
                            const activeCount = Number(opportunity.active_team_count || 0);
                            const isFull = opportunity.is_available === false;
                            const tags = [
                                ...(opportunity.target_courses || []).map(courseTargetLabel),
                                ...(opportunity.disciplines || []),
                                ...(opportunity.skills || []),
                                ...(opportunity.deliverable_types || []),
                            ];
                            return (
                                <Card
                                    key={opportunity.partner_opportunity_id}
                                    className="overflow-hidden border-slate-200 shadow-sm"
                                >
                                    <CardHeader>
                                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                                            <div className="min-w-0">
                                                <CardTitle className="break-words leading-snug">
                                                    {opportunity.title}
                                                </CardTitle>
                                                <p className="mt-1 break-words text-sm text-slate-600">
                                                    {opportunity.organization}
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {opportunity.max_active_teams && (
                                                    <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
                                                        {activeCount}/{opportunity.max_active_teams} teams
                                                    </span>
                                                )}
                                                {isFull && (
                                                    <span className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                                                        Full
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                                            {opportunity.problem_area || opportunity.description}
                                        </p>
                                        {(opportunity.main_objectives ||
                                            opportunity.scope_of_work ||
                                            opportunity.deliverables ||
                                            opportunity.resources_needed) && (
                                            <div className="grid grid-cols-1 gap-3 rounded-md border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700 md:grid-cols-2">
                                                {opportunity.main_objectives && (
                                                    <div>
                                                        <p className="font-medium text-slate-900">Objectives</p>
                                                        <p className="mt-1 whitespace-pre-wrap break-words">{opportunity.main_objectives}</p>
                                                    </div>
                                                )}
                                                {opportunity.scope_of_work && (
                                                    <div>
                                                        <p className="font-medium text-slate-900">Scope</p>
                                                        <p className="mt-1 whitespace-pre-wrap break-words">{opportunity.scope_of_work}</p>
                                                    </div>
                                                )}
                                                {opportunity.deliverables && (
                                                    <div>
                                                        <p className="font-medium text-slate-900">Deliverables</p>
                                                        <p className="mt-1 whitespace-pre-wrap break-words">{opportunity.deliverables}</p>
                                                    </div>
                                                )}
                                                {opportunity.resources_needed && (
                                                    <div>
                                                        <p className="font-medium text-slate-900">Resources</p>
                                                        <p className="mt-1 whitespace-pre-wrap break-words">{opportunity.resources_needed}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <div className="flex flex-wrap gap-2">
                                            {tags
                                                .slice(0, 12)
                                                .map((tag, index) => (
                                                    <span
                                                        key={`${tag}-${index}`}
                                                        className="max-w-full break-words rounded bg-slate-100 px-2 py-1 text-xs text-slate-700"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                        </div>
                                        <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                                            <div className="min-w-0 text-sm text-slate-600">
                                                <p className="break-words">Contact: {opportunity.contact_email}</p>
                                                {opportunity.contact_url && (
                                                    <a
                                                        href={opportunity.contact_url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center text-slate-900 underline"
                                                    >
                                                        Partner link
                                                        <ExternalLink className="w-3 h-3 ml-1" />
                                                    </a>
                                                )}
                                            </div>
                                            {isStudent && (
                                                <div className="flex flex-col items-start md:items-end gap-2">
                                                    {isFull && (
                                                        <p className="text-xs text-amber-700">
                                                            This opportunity is not accepting more teams.
                                                        </p>
                                                    )}
                                                    <Button
                                                        disabled={isFull}
                                                        onClick={() =>
                                                            router.push(
                                                                `/project-form?opportunityId=${opportunity.partner_opportunity_id}`
                                                            )
                                                        }
                                                        className="w-full md:w-auto"
                                                    >
                                                        Use in Capstone Form
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}

                <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
                    <Button
                        variant="outline"
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        disabled={loading || page <= 1}
                        className="w-full sm:w-auto"
                    >
                        Previous
                    </Button>
                    <span className="text-sm text-slate-600">
                        Page {page} of {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        onClick={() =>
                            setPage((current) => Math.min(totalPages, current + 1))
                        }
                        disabled={loading || page >= totalPages}
                        className="w-full sm:w-auto"
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default function ExternalOpportunitiesPage() {
    return (
        <ProtectedRoute>
            <ExternalOpportunitiesContent />
        </ProtectedRoute>
    );
}
