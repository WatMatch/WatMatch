"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { CapstoneModal } from "@/app/discover/CapstoneModal";
import ProtectedRoute from "@/components/ProtectedRoute";
import { usePastCapstones } from "@/hooks/usePastCapstones";
import { userContext } from "@/contexts/UserContext";
import {
    deletePastCapstoneShortlist,
    savePastCapstoneShortlist,
} from "@/services/capstones.service";
import { Search } from "lucide-react";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CapstoneCard } from "@/components/capstones/CapstoneCard";
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
import { TaxonomyChipList } from "@/components/ui/taxonomy-chip";

// Re-export the interface from the hook for type consistency
interface PastCapstone {
    id: string;
    source_type?: "historical" | "watmatch" | "scraped";
    source_id?: number;
    past_capstone_id?: number;
    past_watmatch_capstone_id?: number;
    title: string;
    description: string;
    department: string[];
    year: number;
    students: string[] | null;
    completed_term?: string | null;
    skills?: string[];
    deliverable_types?: string[];
    mentor_name?: string | null;
    external_partner_name?: string | null;
    external_partner_organization?: string | null;
    is_shortlisted?: boolean;
    shortlisted_at?: string | null;
    status?: string;
}

function PastCapstonesPageContent() {
    const { user } = userContext();
    const [search, setSearch] = useState("");
    const [dept, setDept] = useState("All");
    const [year, setYear] = useState("All");
    const [page, setPage] = useState(1);
    const [source, setSource] = useState<"scraped" | "watmatch">("scraped");
    const [savedOnly, setSavedOnly] = useState(false);
    const [actionError, setActionError] = useState("");
    const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null);
    const pageSize = 10;
    const [selectedCapstone, setSelectedCapstone] =
        useState<PastCapstone | null>(null);
    const isStudent = (user?.role || "").toLowerCase() === "student";

    const {
        pastCapstones,
        loading,
        metadataLoading,
        totalPages,
        departments,
        years,
        mutate,
        error,
        metadataError,
    } = usePastCapstones({
        page,
        pageSize,
        search,
        department: dept,
        year,
        source,
        savedOnly: isStudent && savedOnly,
    });

    const uniqueDepartments = departments;
    const uniqueYears = years;
    const loadError = error || metadataError;

    const filtered = pastCapstones;

    const getShortlistSource = () => (source === "watmatch" ? "watmatch" : "scraped");
    const getActionSourceType = (capstone: PastCapstone) =>
        capstone.source_type === "watmatch" ? "watmatch" : getShortlistSource();

    const getSourceId = (capstone: PastCapstone) => {
        const sourceId = capstone.source_id ?? Number(capstone.id);
        return Number.isFinite(sourceId) ? sourceId : null;
    };
    const selectedSourceId = selectedCapstone ? getSourceId(selectedCapstone) : null;
    const selectedActionKey =
        selectedCapstone && selectedSourceId
            ? `${getActionSourceType(selectedCapstone)}:${selectedSourceId}`
            : null;

    useEffect(() => {
        if (!loading && !metadataLoading && page > totalPages) {
            setPage(totalPages);
        }
    }, [loading, metadataLoading, page, totalPages]);

    const handleToggleShortlist = async (capstone: PastCapstone) => {
        if (!isStudent) return;
        const sourceId = getSourceId(capstone);
        if (!sourceId) {
            throw new Error(
                "This capstone cannot be saved because its source ID is missing."
            );
        }

        const sourceType = getActionSourceType(capstone);
        const actionKey = `${sourceType}:${sourceId}`;
        setActionLoadingKey(actionKey);
        setActionError("");
        try {
            if (capstone.is_shortlisted) {
                await deletePastCapstoneShortlist({
                    source_type: sourceType,
                    source_id: sourceId,
                });
            } else {
                await savePastCapstoneShortlist({
                    source_type: sourceType,
                    source_id: sourceId,
                });
            }
            await mutate();
            setSelectedCapstone((current) =>
                current && getSourceId(current) === sourceId
                    ? { ...current, is_shortlisted: !capstone.is_shortlisted }
                    : current
            );
        } catch (error) {
            throw error;
        } finally {
            setActionLoadingKey(null);
        }
    };

    const handleShortlistError = (error: unknown) => {
        setActionError(
            error instanceof Error
                ? error.message
                : "Could not update saved inspiration."
        );
    };

    const hasActiveFilters =
        search.trim() !== "" || dept !== "All" || year !== "All" || savedOnly;

    return (
        <BrowsePageShell>
            <BrowsePageHeader
                eyebrow="Inspiration archive"
                title="Previous capstones"
                description="Browse historical work for ideas. Saving here creates a private inspiration bookmark—not marketplace interest or team membership."
                actions={
                    <div
                        className="grid w-full grid-cols-2 rounded-lg border border-slate-200 bg-white p-1 shadow-sm sm:w-auto"
                        role="tablist"
                        aria-label="Previous capstone source"
                    >
                        {[
                            { value: "scraped", label: "Historical" },
                            { value: "watmatch", label: "WatMatch completed" },
                        ].map((item) => (
                            <button
                                key={item.value}
                                type="button"
                                role="tab"
                                aria-selected={source === item.value}
                                onClick={() => {
                                    setSource(item.value as "scraped" | "watmatch");
                                    setDept("All");
                                    setYear("All");
                                    setPage(1);
                                    setActionError("");
                                    setSelectedCapstone(null);
                                }}
                                className={`rounded-md px-3 py-1.5 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-slate-400 ${
                                    source === item.value
                                        ? "bg-slate-900 text-white shadow-sm"
                                        : "text-slate-600 hover:bg-slate-100"
                                }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                }
            />

            <BrowseToolbar>
                <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-[minmax(16rem,1fr)_minmax(12rem,260px)_minmax(8rem,160px)_auto_auto] xl:items-center">
                    <label className="relative min-w-0">
                        <span className="sr-only">Search previous capstones</span>
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                        <Input
                            placeholder={source === "watmatch" ? "Search completed WatMatch capstones" : "Search historical capstones"}
                            value={search}
                            onChange={(event) => {
                                setSearch(event.target.value);
                                setPage(1);
                            }}
                            className="min-w-0 pl-9"
                        />
                    </label>
                    <Select value={dept} onValueChange={(value) => { setDept(value); setPage(1); }}>
                        <SelectTrigger className="w-full min-w-0" aria-label="Filter by department">
                            <SelectValue placeholder="Department" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All departments</SelectItem>
                            {uniqueDepartments.map((department) => (
                                <SelectItem key={department} value={department}>{department}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={year} onValueChange={(value) => { setYear(value); setPage(1); }}>
                        <SelectTrigger className="w-full min-w-0" aria-label="Filter by year">
                            <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All years</SelectItem>
                            {uniqueYears.map((option) => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {isStudent && (
                        <label className="flex h-9 min-w-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                            <input
                                type="checkbox"
                                checked={savedOnly}
                                onChange={(event) => {
                                    setSavedOnly(event.target.checked);
                                    setPage(1);
                                    setActionError("");
                                }}
                                className="h-4 w-4 rounded border-slate-300 accent-slate-900"
                            />
                            Saved only
                        </label>
                    )}
                    <BrowseClearButton
                        active={hasActiveFilters}
                        onClear={() => {
                            setSearch("");
                            setDept("All");
                            setYear("All");
                            setSavedOnly(false);
                            setPage(1);
                        }}
                    />
                </div>
            </BrowseToolbar>

            {isStudent && (
                <BrowseNotice tone="info">
                    Saved inspiration is private. It never sends a message, creates project interest, or changes your official team.
                </BrowseNotice>
            )}
            {actionError && <BrowseNotice tone="error">{actionError}</BrowseNotice>}
            {loadError && <BrowseNotice tone="error">{loadError}</BrowseNotice>}

            {!loading && !metadataLoading && (
                <ResultsSummary
                    count={filtered.length}
                    singular="capstone"
                    page={page}
                    totalPages={totalPages}
                    detail={source === "watmatch" ? "Completed in WatMatch" : "Imported historical archive"}
                />
            )}

            <section className="space-y-3" aria-label="Previous capstone results">
                {loading || metadataLoading ? (
                    <BrowseLoading label="Loading previous capstones…" />
                ) : filtered.length ? (
                    filtered.map((capstone) => {
                        const actionKey = `${getActionSourceType(capstone)}:${getSourceId(capstone)}`;
                        const actionBusy = actionLoadingKey === actionKey;
                        return (
                            <CapstoneCard
                                key={capstone.id}
                                project={{
                                    capstone_id: capstone.id,
                                    title: capstone.title,
                                    description: capstone.description,
                                    department: capstone.department,
                                    year: capstone.completed_term || capstone.year,
                                    status: "complete",
                                    external_partner_organization:
                                        capstone.external_partner_organization || capstone.external_partner_name,
                                }}
                                onClick={() => setSelectedCapstone(capstone)}
                                showSaveAction={isStudent}
                                saveKind="inspiration"
                                isSaved={capstone.is_shortlisted === true}
                                canSave={getSourceId(capstone) !== null}
                                saveBusy={actionBusy}
                                onSaveClick={() => handleToggleShortlist(capstone)}
                                onSaveError={handleShortlistError}
                            />
                        );
                    })
                ) : (
                    <BrowseEmpty
                        title={loadError ? "Previous capstones unavailable" : "No capstones found"}
                        description={
                            loadError
                                ? "Try again after the archive is available."
                                : "Try a broader search, change the archive source, or clear a filter."
                        }
                        action={
                            !loadError && hasActiveFilters ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setSearch("");
                                        setDept("All");
                                        setYear("All");
                                        setSavedOnly(false);
                                        setPage(1);
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
                loading={loading || metadataLoading}
                onPrevious={() => setPage((current) => Math.max(1, current - 1))}
                onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
            />

            {/* Modal for Past Capstone Details */}
            <CapstoneModal
                project={selectedCapstone}
                isOpen={!!selectedCapstone}
                onClose={() => setSelectedCapstone(null)}
                showActionButton={false}
                showSaveAction={isStudent && !!selectedCapstone}
                saveKind="inspiration"
                isSaved={selectedCapstone?.is_shortlisted === true}
                canSave={selectedSourceId !== null}
                saveBusy={
                    !!selectedActionKey && actionLoadingKey === selectedActionKey
                }
                onSaveClick={
                    selectedCapstone
                        ? () => handleToggleShortlist(selectedCapstone)
                        : undefined
                }
                onSaveError={handleShortlistError}
                additionalMetadata={
                    selectedCapstone && (
                        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-900">Inspiration bookmark</p>
                                <p className="mt-0.5 text-xs leading-5 text-slate-600">
                                    Private to you and separate from marketplace interest.
                                </p>
                            </div>
                            {source === "watmatch" && (
                                <dl className="grid gap-3 border-t border-slate-200 pt-3 text-sm sm:grid-cols-2">
                                    {(selectedCapstone.mentor_name ||
                                        selectedCapstone.external_partner_name ||
                                        selectedCapstone.external_partner_organization) && (
                                        <div>
                                            <dt className="text-xs font-medium text-slate-500">Project support</dt>
                                            <dd className="mt-1 leading-5 text-slate-700 [overflow-wrap:anywhere]">
                                                {[
                                                    selectedCapstone.mentor_name && `Mentor: ${selectedCapstone.mentor_name}`,
                                                    (selectedCapstone.external_partner_organization || selectedCapstone.external_partner_name) &&
                                                        `Partner: ${selectedCapstone.external_partner_organization || selectedCapstone.external_partner_name}`,
                                                ].filter(Boolean).join(" · ")}
                                            </dd>
                                        </div>
                                    )}
                                    {selectedCapstone.skills?.length ? (
                                        <div>
                                            <dt className="text-xs font-medium text-slate-500">Skills used</dt>
                                            <dd className="mt-1">
                                                <TaxonomyChipList
                                                    namespace="skill"
                                                    values={selectedCapstone.skills}
                                                />
                                            </dd>
                                        </div>
                                    ) : null}
                                    {selectedCapstone.deliverable_types?.length ? (
                                        <div>
                                            <dt className="text-xs font-medium text-slate-500">Deliverables</dt>
                                            <dd className="mt-1">
                                                <TaxonomyChipList
                                                    namespace="deliverable"
                                                    values={selectedCapstone.deliverable_types}
                                                />
                                            </dd>
                                        </div>
                                    ) : null}
                                </dl>
                            )}
                        </div>
                    )
                }
            />
        </BrowsePageShell>
    );
}

export default function PastCapstonesPage() {
    return (
        <ProtectedRoute>
            <PastCapstonesPageContent />
        </ProtectedRoute>
    );
}
