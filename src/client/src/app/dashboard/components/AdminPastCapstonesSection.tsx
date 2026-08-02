"use client";

import { useCallback, useEffect, useState } from "react";
import { Archive, Loader2, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TaxonomyChipList } from "@/components/ui/taxonomy-chip";
import {
    createAdminPastCapstone,
    deleteAdminPastCapstone,
    fetchPastCapstoneMetadata,
    fetchPastCapstones,
    importAdminPastCapstonesCsv,
    updateAdminPastCapstone,
    type PastCapstone,
    type PastCapstoneImportSummary,
} from "@/services/capstones.service";
import { fetchCourses, type Course } from "@/services/courses.service";
import {
    Disclosure,
    EmptyState,
    Notice,
    PaginationBar,
    SectionHeader,
    StatusBadge,
} from "@/components/ui/workspace";

const NONE = "none";
const ALL = "all";
const PAGE_SIZE = 20;

function pastCapstoneId(row: PastCapstone): number | null {
    const value = row.past_capstone_id ?? row.id;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function departmentText(department: PastCapstone["department"]): string {
    return Array.isArray(department) ? department.join(", ") : String(department || "");
}

function departmentValues(department: PastCapstone["department"]): string[] {
    const values = Array.isArray(department)
        ? department
        : String(department || "").split(",");
    return values.map((value) => String(value).trim()).filter(Boolean);
}

function studentsText(students: PastCapstone["students"]): string {
    return Array.isArray(students) ? students.join("; ") : "";
}

function courseLabel(course: Course): string {
    return `${course.code} - ${course.name}${course.active === false ? " - Inactive" : ""}`;
}

function isWatMatchRecord(row: PastCapstone): boolean {
    return Boolean(
        row.source_type === "watmatch" ||
            row.past_watmatch_capstone_id ||
            row.source_capstone_fk
    );
}

function provenanceLabel(row: PastCapstone): string {
    return isWatMatchRecord(row) ? "WatMatch" : "Historical";
}

export function AdminPastCapstonesSection() {
    const [rows, setRows] = useState<PastCapstone[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [departments, setDepartments] = useState<string[]>([]);
    const [years, setYears] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editorOpen, setEditorOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<PastCapstone | null>(null);
    const [deleteReason, setDeleteReason] = useState("");
    const [csvText, setCsvText] = useState("");
    const [importSummary, setImportSummary] =
        useState<PastCapstoneImportSummary | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [departmentFilter, setDepartmentFilter] = useState(ALL);
    const [yearFilter, setYearFilter] = useState(ALL);
    const [form, setForm] = useState({
        title: "",
        description: "",
        department: "",
        year: "",
        students: "",
        sourceCourseId: NONE,
        reason: "",
    });

    const clearFeedback = () => {
        setError("");
        setNotice("");
    };

    const loadData = useCallback(async (targetPage = page) => {
        setLoading(true);
        setError("");
        try {
            const [capstones, metadata, courseRows] = await Promise.all([
                fetchPastCapstones(targetPage, PAGE_SIZE, {
                    search,
                    department: departmentFilter,
                    year: yearFilter,
                }),
                fetchPastCapstoneMetadata(),
                fetchCourses(false),
            ]);
            setRows((capstones.data || []) as PastCapstone[]);
            setCourses(courseRows || []);
            setDepartments(metadata.data?.departments || []);
            setYears(metadata.data?.years || []);
            setTotalPages(
                Math.max(
                    1,
                    Number(capstones.total_pages || capstones.totalPages || 1)
                )
            );
        } catch (err) {
            console.error(err);
            setError("Could not load past capstone data.");
        } finally {
            setLoading(false);
        }
    }, [departmentFilter, page, search, yearFilter]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const applyFilters = () => {
        clearFeedback();
        setPage(1);
        setSearch(searchInput.trim());
    };

    const clearFilters = () => {
        clearFeedback();
        setPage(1);
        setSearch("");
        setSearchInput("");
        setDepartmentFilter(ALL);
        setYearFilter(ALL);
    };

    const resetForm = () => {
        setEditingId(null);
        setForm({
            title: "",
            description: "",
            department: "",
            year: "",
            students: "",
            sourceCourseId: NONE,
            reason: "",
        });
    };

    const openCreateEditor = () => {
        resetForm();
        clearFeedback();
        setEditorOpen(true);
    };

    const closeEditor = () => {
        setEditorOpen(false);
        resetForm();
    };

    const startEdit = (row: PastCapstone) => {
        const id = pastCapstoneId(row);
        if (!id) {
            setError("This row cannot be edited because it has no valid ID.");
            return;
        }
        setEditingId(id);
        setForm({
            title: row.title || "",
            description: row.description || "",
            department: departmentText(row.department),
            year: String(row.year || ""),
            students: studentsText(row.students),
            sourceCourseId: row.source_fk ? String(row.source_fk) : NONE,
            reason: "",
        });
        clearFeedback();
        setEditorOpen(true);
    };

    const submitForm = async () => {
        clearFeedback();
        if (!form.title.trim() || !form.department.trim() || !form.year.trim()) {
            setError("Title, at least one department, and year are required.");
            return;
        }
        if (!form.reason.trim()) {
            setError("An audit reason is required for manual past capstone changes.");
            return;
        }
        setSaving(true);
        try {
            const payload = {
                title: form.title.trim(),
                description: form.description.trim() || null,
                department: form.department.trim(),
                year: form.year.trim(),
                students: form.students
                    .split(";")
                    .map((student) => student.trim())
                    .filter(Boolean),
                source_course_id:
                    form.sourceCourseId === NONE ? null : Number(form.sourceCourseId),
                reason: form.reason.trim(),
            };
            if (editingId) {
                await updateAdminPastCapstone(editingId, payload);
                setNotice("Past capstone updated.");
            } else {
                await createAdminPastCapstone(payload);
                setNotice("Past capstone created.");
            }
            resetForm();
            setEditorOpen(false);
            setPage(1);
            await loadData(1);
        } catch (err) {
            console.error(err);
            setError(
                err instanceof Error ? err.message : "Failed to save past capstone."
            );
        } finally {
            setSaving(false);
        }
    };

    const handleFileUpload = async (file: File | undefined) => {
        if (!file) return;
        const text = await file.text();
        setCsvText(text);
    };

    const importCsv = async () => {
        if (!csvText.trim()) {
            setError("CSV content is required.");
            return;
        }
        setImporting(true);
        clearFeedback();
        setImportSummary(null);
        try {
            const summary = await importAdminPastCapstonesCsv(csvText);
            setImportSummary(summary);
            setNotice("Past capstone import processed.");
            setPage(1);
            await loadData(1);
        } catch (err) {
            console.error(err);
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to import past capstones."
            );
        } finally {
            setImporting(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        const id = pastCapstoneId(deleteTarget);
        if (!id) {
            setError("This row cannot be deleted because it has no valid ID.");
            setDeleteTarget(null);
            return;
        }
        const trimmedReason = deleteReason.trim();
        if (!trimmedReason) {
            setError("An audit reason is required when deleting a past capstone.");
            return;
        }
        setDeleting(true);
        clearFeedback();
        try {
            await deleteAdminPastCapstone(id, trimmedReason);
            setNotice("Past capstone deleted.");
            setDeleteTarget(null);
            setDeleteReason("");
            await loadData(rows.length === 1 && page > 1 ? page - 1 : page);
            if (rows.length === 1 && page > 1) {
                setPage((previous) => previous - 1);
            }
        } catch (err) {
            console.error(err);
            setError(
                err instanceof Error ? err.message : "Failed to delete past capstone."
            );
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="space-y-5">
            <SectionHeader
                title="Past capstones"
                description="Search the imported historical archive and maintain manual records without changing completed WatMatch-native history."
                actions={
                    <>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                clearFeedback();
                                setImportOpen(true);
                            }}
                        >
                            <Upload className="h-4 w-4" aria-hidden="true" />
                            Import CSV
                        </Button>
                        <Button type="button" onClick={openCreateEditor}>
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            Add historical record
                        </Button>
                    </>
                }
            />

            {(error || notice) && (
                <Notice tone={error ? "danger" : "success"}>
                    {error || notice}
                </Notice>
            )}

            <Dialog
                open={editorOpen}
                onOpenChange={(open) => {
                    if (open) setEditorOpen(true);
                    else closeEditor();
                }}
            >
                <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {editingId ? "Edit historical capstone" : "Add historical capstone"}
                        </DialogTitle>
                        <DialogDescription>
                            Manual archive changes require a staff-entered audit reason. Completed WatMatch records are managed by closeout instead.
                        </DialogDescription>
                    </DialogHeader>
                    {error && <Notice tone="danger">{error}</Notice>}
                    <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_160px]">
                        <div className="min-w-0 space-y-2">
                            <Label htmlFor="admin-past-title">
                                Title <span className="font-normal text-slate-500">(required)</span>
                            </Label>
                            <Input
                                id="admin-past-title"
                                required
                                value={form.title}
                                onChange={(event) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        title: event.target.value,
                                    }))
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="admin-past-year">
                                Year <span className="font-normal text-slate-500">(required)</span>
                            </Label>
                            <Input
                                id="admin-past-year"
                                required
                                value={form.year}
                                onChange={(event) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        year: event.target.value,
                                    }))
                                }
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        <div className="min-w-0 space-y-2">
                            <Label htmlFor="admin-past-departments">
                                Departments <span className="font-normal text-slate-500">(required)</span>
                            </Label>
                            <Input
                                id="admin-past-departments"
                                required
                                value={form.department}
                                placeholder="Example: Software Engineering, Health, Mechanical Engineering"
                                onChange={(event) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        department: event.target.value,
                                    }))
                                }
                            />
                            <p className="text-xs text-slate-500">
                                Separate multiple departments with commas.
                            </p>
                        </div>
                        <div className="min-w-0 space-y-2">
                            <Label htmlFor="admin-past-source-course">Source Course</Label>
                            <Select
                                value={form.sourceCourseId}
                                onValueChange={(value) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        sourceCourseId: value,
                                    }))
                                }
                            >
                                <SelectTrigger id="admin-past-source-course" className="min-w-0 overflow-hidden">
                                    <SelectValue placeholder="No source course" />
                                </SelectTrigger>
                                <SelectContent className="max-w-[min(520px,calc(100vw-2rem))]">
                                    <SelectItem value={NONE}>No source course</SelectItem>
                                    {courses.map((course) => (
                                        <SelectItem
                                            key={course.course_id}
                                            value={String(course.course_id)}
                                            className="max-w-full"
                                        >
                                            <span className="block truncate">
                                                {courseLabel(course)}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="admin-past-description">Description</Label>
                        <Textarea
                            id="admin-past-description"
                            value={form.description}
                            onChange={(event) =>
                                setForm((previous) => ({
                                    ...previous,
                                    description: event.target.value,
                                }))
                            }
                            rows={4}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="admin-past-students">Students</Label>
                        <Input
                            id="admin-past-students"
                            value={form.students}
                            onChange={(event) =>
                                setForm((previous) => ({
                                    ...previous,
                                    students: event.target.value,
                                }))
                            }
                            placeholder="Name One; Name Two"
                        />
                        <p className="text-xs text-slate-500">
                            Separate student names with semicolons.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="admin-past-reason">
                            Audit reason <span className="font-normal text-slate-500">(required)</span>
                        </Label>
                        <Textarea
                            id="admin-past-reason"
                            required
                            value={form.reason}
                            onChange={(event) =>
                                setForm((previous) => ({
                                    ...previous,
                                    reason: event.target.value,
                                }))
                            }
                            placeholder="Required: explain why this historical record is being changed"
                            rows={3}
                        />
                    </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={closeEditor} disabled={saving}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={submitForm}
                            disabled={saving || !form.reason.trim()}
                        >
                            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                            {saving ? "Saving…" : editingId ? "Save changes" : "Add record"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={importOpen} onOpenChange={setImportOpen}>
                <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Import historical capstones</DialogTitle>
                        <DialogDescription>
                            Upload a CSV or review its text before importing. Imported rows remain distinct from completed WatMatch-native records.
                        </DialogDescription>
                    </DialogHeader>
                    {error && <Notice tone="danger">{error}</Notice>}
                    <div className="space-y-3">
                    <div className="space-y-2">
                        <div className="space-y-2">
                            <Label htmlFor="past-capstones-csv">CSV</Label>
                            <Input
                                id="past-capstones-csv"
                                type="file"
                                accept=".csv,text/csv"
                                onChange={(event) =>
                                    handleFileUpload(event.target.files?.[0])
                                }
                            />
                        </div>
                    </div>
                    <Label htmlFor="past-capstones-csv-text">CSV preview</Label>
                    <Textarea
                        id="past-capstones-csv-text"
                        value={csvText}
                        onChange={(event) => setCsvText(event.target.value)}
                        placeholder={
                            "title,description,department,year,students,source_course_code\nProject title,Short description,Engineering,2025,Name One; Name Two,SE 490"
                        }
                        rows={5}
                    />
                    {importSummary && (
                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 space-y-2">
                            <p>
                                Created: {importSummary.created} | Updated:{" "}
                                {importSummary.updated}
                            </p>
                            {importSummary.errors.length > 0 && (
                                <div className="space-y-1">
                                    {importSummary.errors.slice(0, 8).map((item) => (
                                        <p key={`${item.row}-${item.title || ""}`}>
                                            Row {item.row}: {item.title ? `${item.title} - ` : ""}
                                            {item.error}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setImportOpen(false)} disabled={importing}>
                            Close
                        </Button>
                        <Button type="button" onClick={importCsv} disabled={importing || !csvText.trim()}>
                            {importing ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : (
                                <Upload className="h-4 w-4" aria-hidden="true" />
                            )}
                            {importing ? "Importing…" : "Import CSV"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Card>
                <CardHeader className="border-b border-slate-100">
                    <CardTitle>Historical archive</CardTitle>
                    <CardDescription>
                        Search imported history and distinguish it from read-only WatMatch completion records.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="border-b border-slate-100 bg-slate-50/50 p-4">
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_180px_140px_auto_auto] lg:items-end">
                        <div className="min-w-0 space-y-2">
                            <Label htmlFor="past-capstone-admin-search">Search</Label>
                            <Input
                                id="past-capstone-admin-search"
                                value={searchInput}
                                onChange={(event) => setSearchInput(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        applyFilters();
                                    }
                                }}
                                placeholder="Search title, description, department, or student"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="past-capstone-admin-department">Department</Label>
                            <Select
                                value={departmentFilter}
                                onValueChange={(value) => {
                                    setDepartmentFilter(value);
                                    setPage(1);
                                }}
                            >
                                <SelectTrigger id="past-capstone-admin-department">
                                    <SelectValue placeholder="All departments" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>All departments</SelectItem>
                                    {departments.map((department) => (
                                        <SelectItem key={department} value={department}>
                                            {department}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="past-capstone-admin-year">Year</Label>
                            <Select
                                value={yearFilter}
                                onValueChange={(value) => {
                                    setYearFilter(value);
                                    setPage(1);
                                }}
                            >
                                <SelectTrigger id="past-capstone-admin-year">
                                    <SelectValue placeholder="All years" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>All years</SelectItem>
                                    {years.map((year) => (
                                        <SelectItem key={year} value={year}>
                                            {year}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button type="button" className="w-full lg:w-auto" onClick={applyFilters} variant="outline">
                            <Search className="h-4 w-4" aria-hidden="true" />
                            Search
                        </Button>
                        <Button type="button" className="w-full lg:w-auto" onClick={clearFilters} variant="ghost">
                            Clear
                        </Button>
                    </div>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-slate-600">
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            Loading past capstones…
                        </div>
                    ) : rows.length === 0 ? (
                        <EmptyState
                            icon={Archive}
                            title="No past capstones found"
                            description="Try clearing the current filters or add a historical record."
                        />
                    ) : (
                        <div>
                            {rows.map((row) => {
                                const recordId = pastCapstoneId(row);
                                const watMatchRecord = isWatMatchRecord(row);
                                const canManage = Boolean(recordId) && !watMatchRecord;
                                const rowDepartments = departmentValues(row.department);
                                const sourceCourse = courses.find(
                                    (course) => course.course_id === Number(row.source_fk)
                                );
                                return (
                                    <article
                                        key={recordId || row.id || row.title}
                                        className="border-b border-slate-100 p-4 last:border-b-0 sm:p-5"
                                    >
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="break-words font-semibold text-slate-950">
                                                        {row.title}
                                                    </h3>
                                                    <StatusBadge tone={watMatchRecord ? "success" : "neutral"}>
                                                        {provenanceLabel(row)}
                                                    </StatusBadge>
                                                </div>
                                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                                    {rowDepartments.length > 0 ? (
                                                        <TaxonomyChipList
                                                            namespace="department"
                                                            values={rowDepartments}
                                                        />
                                                    ) : (
                                                        <span className="text-sm text-slate-600">No department</span>
                                                    )}
                                                    <span className="text-xs text-slate-500">{row.year || "No year"}</span>
                                                </div>
                                                {watMatchRecord && (
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        Published from academic closeout; this record is read-only here.
                                                    </p>
                                                )}
                                            </div>
                                            {canManage && (
                                                <Button
                                                    type="button"
                                                    className="w-full shrink-0 sm:w-auto"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => startEdit(row)}
                                                >
                                                    <Pencil className="h-4 w-4" aria-hidden="true" />
                                                    Edit record
                                                </Button>
                                            )}
                                        </div>
                                        <Disclosure summary="Record details" className="mt-4 shadow-none">
                                            <div className="space-y-4">
                                                {row.description && (
                                                    <p className="whitespace-pre-wrap leading-6 text-slate-700 [overflow-wrap:anywhere]">
                                                        {row.description}
                                                    </p>
                                                )}
                                                <dl className="grid gap-4 sm:grid-cols-3">
                                                    <div>
                                                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Provenance</dt>
                                                        <dd className="mt-1">
                                                            {watMatchRecord
                                                                ? "Completed in WatMatch"
                                                                : row.source_type === "scraped"
                                                                  ? "Imported archive"
                                                                  : "Manual or CSV historical record"}
                                                        </dd>
                                                    </div>
                                                    <div>
                                                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Source course</dt>
                                                        <dd className="mt-1">{sourceCourse ? courseLabel(sourceCourse) : "Not specified"}</dd>
                                                    </div>
                                                    <div>
                                                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Students</dt>
                                                        <dd className="mt-1 [overflow-wrap:anywhere]">{studentsText(row.students) || "Not listed"}</dd>
                                                    </div>
                                                </dl>
                                                {canManage && (
                                                    <div className="border-t border-slate-100 pt-3">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                                clearFeedback();
                                                                setDeleteTarget(row);
                                                                setDeleteReason("");
                                                            }}
                                                            className="text-red-700 hover:bg-red-50 hover:text-red-800"
                                                        >
                                                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                                                            Delete historical record
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </Disclosure>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                    <PaginationBar
                        page={page}
                        totalPages={totalPages}
                        loading={loading}
                        onPrevious={() => setPage((previous) => Math.max(1, previous - 1))}
                        onNext={() => setPage((previous) => Math.min(totalPages, previous + 1))}
                    />
                </CardContent>
            </Card>

            <Dialog
                open={!!deleteTarget}
                onOpenChange={(open) => {
                    if (!open) {
                        setDeleteTarget(null);
                        setDeleteReason("");
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete historical record</DialogTitle>
                        <DialogDescription>
                            This permanently removes “{deleteTarget?.title || "this capstone"}” from historical search. Completed WatMatch-native records cannot be deleted here.
                        </DialogDescription>
                    </DialogHeader>
                    {error && <Notice tone="danger">{error}</Notice>}
                    <div className="space-y-2">
                        <Label htmlFor="past-capstone-delete-reason">
                            Audit reason <span className="font-normal text-slate-500">(required)</span>
                        </Label>
                        <Textarea
                            id="past-capstone-delete-reason"
                            required
                            value={deleteReason}
                            onChange={(event) => setDeleteReason(event.target.value)}
                            placeholder="Required: explain why this historical record is being deleted"
                            rows={3}
                        />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline" disabled={deleting}>
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button type="button" variant="destructive" onClick={confirmDelete} disabled={deleting || !deleteReason.trim()}>
                            {deleting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                            {deleting ? "Deleting…" : "Delete record"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
