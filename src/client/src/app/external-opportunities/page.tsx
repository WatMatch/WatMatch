"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Building2,
    CalendarDays,
    ExternalLink,
    Mail,
    Search,
    Users,
} from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { userContext } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import {
    BrowseClearButton,
    BrowseEmpty,
    BrowseLoading,
    BrowseNotice,
    BrowsePageHeader,
    BrowsePageShell,
    BrowseToolbar,
    DetailDisclosure,
    PaginationBar,
    ResultsSummary,
} from "@/components/capstones/BrowsePage";
import { TaxonomyChipList } from "@/components/ui/taxonomy-chip";

function formatDate(value?: string | null) {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function OpportunityCard({
    opportunity,
    isStudent,
    onUse,
}: {
    opportunity: PartnerOpportunity;
    isStudent: boolean;
    onUse: () => void;
}) {
    const activeCount = Number(opportunity.active_team_count || 0);
    const isFull = opportunity.is_available === false;
    const targetCourses = (opportunity.target_courses || []).map(courseTargetLabel);
    const deliverableTypes = opportunity.deliverable_types || [];
    const projectDetails = [
        ["Objectives", opportunity.main_objectives],
        ["Scope", opportunity.scope_of_work],
        ["Deliverables", opportunity.deliverables],
        ["Resources", opportunity.resources_needed],
    ].filter(([, value]) => Boolean(value));

    return (
        <Card className="gap-0 p-0">
            <article>
                <div className="space-y-4 p-4 sm:p-5">
                    <header className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                            <p className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-slate-500 [overflow-wrap:anywhere]">
                                <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                {opportunity.organization}
                            </p>
                            <h2 className="mt-1 text-lg font-semibold leading-snug tracking-[-0.015em] text-slate-950 [overflow-wrap:anywhere]">
                                {opportunity.title}
                            </h2>
                        </div>
                        <span
                            className={`w-fit shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                                isFull
                                    ? "border-amber-200 bg-amber-50 text-amber-800"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                            }`}
                        >
                            {isFull ? "At capacity" : "Accepting teams"}
                        </span>
                    </header>

                    <p className="line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-slate-600 [overflow-wrap:anywhere]">
                        {opportunity.problem_area || opportunity.description}
                    </p>

                    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                        {opportunity.preferred_team_size && (
                            <div>
                                <dt className="text-xs text-slate-500">Preferred team</dt>
                                <dd className="mt-0.5 inline-flex items-center gap-1.5 font-medium text-slate-800">
                                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                                    {opportunity.preferred_team_size}
                                </dd>
                            </div>
                        )}
                        {opportunity.max_active_teams && (
                            <div>
                                <dt className="text-xs text-slate-500">Team capacity</dt>
                                <dd className="mt-0.5 font-medium text-slate-800">
                                    {activeCount} of {opportunity.max_active_teams} active
                                </dd>
                            </div>
                        )}
                        {opportunity.meeting_frequency && (
                            <div>
                                <dt className="text-xs text-slate-500">Partner cadence</dt>
                                <dd className="mt-0.5 font-medium text-slate-800 [overflow-wrap:anywhere]">
                                    {opportunity.meeting_frequency}
                                </dd>
                            </div>
                        )}
                        {opportunity.project_start_date && (
                            <div>
                                <dt className="text-xs text-slate-500">Target start</dt>
                                <dd className="mt-0.5 inline-flex items-center gap-1.5 font-medium text-slate-800">
                                    <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                                    {formatDate(opportunity.project_start_date)}
                                </dd>
                            </div>
                        )}
                    </dl>

                    {targetCourses.length > 0 && (
                        <div className="space-y-1.5">
                            <p className="text-xs font-medium text-slate-700">Target courses</p>
                            <TaxonomyChipList
                                namespace="course"
                                values={targetCourses}
                                maxVisible={2}
                            />
                        </div>
                    )}

                    {(projectDetails.length > 0 ||
                        opportunity.disciplines.length > 0 ||
                        opportunity.skills.length > 0 ||
                        deliverableTypes.length > 0 ||
                        opportunity.organization_description) && (
                        <DetailDisclosure label="Opportunity details">
                            <div className="space-y-5">
                                {opportunity.organization_description && (
                                    <section>
                                        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Organization</h3>
                                        <p className="mt-1.5 whitespace-pre-wrap leading-6 [overflow-wrap:anywhere]">
                                            {opportunity.organization_description}
                                        </p>
                                    </section>
                                )}
                                {projectDetails.map(([label, value]) => (
                                    <section key={label}>
                                        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</h3>
                                        <p className="mt-1.5 whitespace-pre-wrap leading-6 [overflow-wrap:anywhere]">{value}</p>
                                    </section>
                                ))}
                                {(opportunity.disciplines.length > 0 || opportunity.skills.length > 0 || deliverableTypes.length > 0) && (
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        {opportunity.disciplines.length > 0 && (
                                            <div>
                                                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Disciplines</h3>
                                                <TaxonomyChipList
                                                    namespace="discipline"
                                                    values={opportunity.disciplines}
                                                    className="mt-2"
                                                />
                                            </div>
                                        )}
                                        {opportunity.skills.length > 0 && (
                                            <div>
                                                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Useful skills</h3>
                                                <TaxonomyChipList
                                                    namespace="skill"
                                                    values={opportunity.skills}
                                                    className="mt-2"
                                                />
                                            </div>
                                        )}
                                        {deliverableTypes.length > 0 && (
                                            <div>
                                                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deliverable types</h3>
                                                <TaxonomyChipList
                                                    namespace="deliverable"
                                                    values={deliverableTypes}
                                                    className="mt-2"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </DetailDisclosure>
                    )}
                </div>

                <footer className="flex min-w-0 flex-col gap-3 border-t border-slate-100 bg-slate-50/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="min-w-0 text-xs leading-5 text-slate-600">
                        <p>Contact the partner and confirm support before creating a proposal.</p>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                            <a href={`mailto:${opportunity.contact_email}`} className="inline-flex min-w-0 items-center gap-1 font-medium text-slate-800 underline underline-offset-4 [overflow-wrap:anywhere]">
                                <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                {opportunity.contact_email}
                            </a>
                            {opportunity.contact_url && (
                                <a href={opportunity.contact_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-slate-800 underline underline-offset-4">
                                    Partner link
                                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                                </a>
                            )}
                        </div>
                    </div>
                    {isStudent && (
                        <Button type="button" onClick={onUse} disabled={isFull} className="w-full sm:w-auto">
                            {isFull ? "Opportunity full" : "Use in proposal"}
                        </Button>
                    )}
                </footer>
            </article>
        </Card>
    );
}

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

    const hasActiveFilters =
        searchInput.trim() !== "" || search.trim() !== "" || courseFilter !== "all";

    return (
        <BrowsePageShell>
            <BrowsePageHeader
                eyebrow="Partner project ideas"
                title="External opportunities"
                description="Find partner-backed ideas, contact the organization to confirm support, then bring the agreed opportunity into a WatMatch proposal."
            />

            <BrowseToolbar>
                <form
                    className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)_auto_auto]"
                    onSubmit={(event) => {
                        event.preventDefault();
                        submitSearch();
                    }}
                >
                    <label className="relative min-w-0">
                        <span className="sr-only">Search opportunities</span>
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                        <Input
                            value={searchInput}
                            onChange={(event) => setSearchInput(event.target.value)}
                            placeholder="Search title, organization, or problem"
                            className="pl-9"
                        />
                    </label>
                    <Select value={courseFilter} onValueChange={handleCourseFilterChange}>
                        <SelectTrigger className="min-w-0" aria-label="Filter by target course">
                            <SelectValue placeholder="Target course" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All target courses</SelectItem>
                            {courses.map((course) => (
                                <SelectItem key={course.course_id} value={String(course.course_id)}>
                                    {courseTargetLabel(course)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button type="submit">
                        <Search aria-hidden="true" />
                        Search
                    </Button>
                    <BrowseClearButton
                        active={hasActiveFilters}
                        onClear={() => {
                            setSearchInput("");
                            setSearch("");
                            setCourseFilter("all");
                            setPage(1);
                        }}
                    />
                </form>
            </BrowseToolbar>

            {error && <BrowseNotice tone="error">{error}</BrowseNotice>}

            {!loading && (
                <ResultsSummary
                    count={visibleOpportunities.length}
                    singular="opportunity"
                    page={page}
                    totalPages={totalPages}
                    detail="Partner agreement is required before proposal submission."
                />
            )}

            <section className="space-y-3" aria-label="External opportunity results">
                {loading ? (
                    <BrowseLoading label="Loading partner opportunities…" />
                ) : visibleOpportunities.length === 0 ? (
                    <BrowseEmpty
                        title="No opportunities found"
                        description="Try another search or broaden the target-course filter."
                        action={
                            hasActiveFilters ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setSearchInput("");
                                        setSearch("");
                                        setCourseFilter("all");
                                        setPage(1);
                                    }}
                                >
                                    Clear filters
                                </Button>
                            ) : undefined
                        }
                    />
                ) : (
                    visibleOpportunities.map((opportunity) => (
                        <OpportunityCard
                            key={opportunity.partner_opportunity_id}
                            opportunity={opportunity}
                            isStudent={isStudent}
                            onUse={() =>
                                router.push(
                                    `/project-form?opportunityId=${opportunity.partner_opportunity_id}`
                                )
                            }
                        />
                    ))
                )}
            </section>

            <PaginationBar
                page={page}
                totalPages={totalPages}
                loading={loading}
                onPrevious={() => setPage((current) => Math.max(1, current - 1))}
                onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
            />
        </BrowsePageShell>
    );
}

export default function ExternalOpportunitiesPage() {
    return (
        <ProtectedRoute>
            <ExternalOpportunitiesContent />
        </ProtectedRoute>
    );
}
