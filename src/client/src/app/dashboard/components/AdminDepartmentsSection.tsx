"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    ConfirmActionDialog,
    EmptyState,
    Notice,
    SectionHeader,
    StatusBadge,
} from "@/components/ui/workspace";
import {
    createDepartment,
    fetchFaculties,
    fetchDepartments,
    updateDepartment,
    type Department,
    type Faculty,
} from "@/services/departments.service";

export function AdminDepartmentsSection() {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [faculties, setFaculties] = useState<Faculty[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [createOpen, setCreateOpen] = useState(false);
    const [name, setName] = useState("");
    const [facultyId, setFacultyId] = useState("none");
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState("");
    const [editFacultyId, setEditFacultyId] = useState("none");
    const [statusTarget, setStatusTarget] = useState<Department | null>(null);

    const visibleDepartments = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return departments;
        return departments.filter((department) =>
            [department.name, department.faculty?.name].some((value) => value?.toLowerCase().includes(query))
        );
    }, [departments, search]);

    const loadDepartments = async () => {
        setLoading(true);
        setError(null);
        try {
            const [departmentRows, facultyRows] = await Promise.all([
                fetchDepartments(false),
                fetchFaculties(false),
            ]);
            setDepartments(departmentRows);
            setFaculties(facultyRows);
        } catch (err) {
            console.error(err);
            setError("Could not load departments.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadDepartments(); }, []);

    const handleCreateDepartment = async () => {
        if (!name.trim()) { setError("Department name is required."); return; }
        setSubmitting(true);
        setError(null);
        try {
            await createDepartment({ name: name.trim(), faculty_id: facultyId === "none" ? null : Number(facultyId) });
            setName("");
            setFacultyId("none");
            setCreateOpen(false);
            await loadDepartments();
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Failed to create department.");
        } finally { setSubmitting(false); }
    };

    const startEdit = (department: Department) => {
        setEditingId(department.department_id);
        setEditName(department.name);
        setEditFacultyId(String(department.faculty_id || department.faculty_fk || "none"));
        setError(null);
    };

    const saveEdit = async () => {
        if (!editingId || !editName.trim()) { setError("Department name is required."); return; }
        setSubmitting(true);
        setError(null);
        try {
            await updateDepartment(editingId, { name: editName.trim(), faculty_id: editFacultyId === "none" ? null : Number(editFacultyId) });
            setEditingId(null);
            await loadDepartments();
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Failed to update department.");
        } finally { setSubmitting(false); }
    };

    const toggleDepartmentActive = async (
        department: Department,
        reason?: string
    ) => {
        const nextActive = department.active === false;
        setSubmitting(true);
        setError(null);
        try {
            await updateDepartment(department.department_id, {
                active: nextActive,
                reason: reason?.trim() || undefined,
            });
            setStatusTarget(null);
            await loadDepartments();
        } catch (err) {
            console.error(err);
            const message =
                err instanceof Error
                    ? err.message
                    : "Failed to update department status.";
            setError(message);
            throw err instanceof Error ? err : new Error(message);
        } finally { setSubmitting(false); }
    };

    const facultySelect = (value: string, onChange: (value: string) => void) => (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger><SelectValue placeholder="Faculty" /></SelectTrigger>
            <SelectContent>
                <SelectItem value="none">No faculty</SelectItem>
                {faculties.map((faculty) => <SelectItem key={faculty.faculty_id} value={String(faculty.faculty_id)}>{faculty.name}</SelectItem>)}
            </SelectContent>
        </Select>
    );

    return (
        <section className="space-y-4">
            <SectionHeader
                title="Departments"
                description="Manage the active department vocabulary used for identity and routing context."
                actions={<Button size="sm" onClick={() => { setError(null); setCreateOpen(true); }}><Plus /> Create department</Button>}
            />
            {error ? <Notice tone="danger">{error}</Notice> : null}

            <div className="wm-panel overflow-hidden">
                <div className="border-b border-slate-100 p-3">
                    <div className="relative max-w-md">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search departments or faculties" className="pl-9" />
                    </div>
                </div>
                {loading ? (
                    <div className="space-y-px bg-slate-100" aria-label="Loading departments">{[0, 1, 2].map((item) => <div key={item} className="h-14 animate-pulse bg-white" />)}</div>
                ) : visibleDepartments.length === 0 ? (
                    <EmptyState title={departments.length === 0 ? "No departments yet" : "No matching departments"} description={departments.length === 0 ? "Create the first department to make it available in WatMatch." : "Try a different search term."} className="border-0" />
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {visibleDepartments.map((department) => (
                            <li key={department.department_id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-medium text-slate-900">{department.name}</p>
                                        <StatusBadge tone={department.active !== false ? "success" : "neutral"}>{department.active !== false ? "Active" : "Inactive"}</StatusBadge>
                                    </div>
                                    <p className="mt-1 text-xs text-slate-500">{department.faculty?.name || "No faculty assigned"}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Button variant="outline" size="sm" onClick={() => startEdit(department)}>Edit</Button>
                                    <Button variant="ghost" size="sm" onClick={() => setStatusTarget(department)}>{department.active !== false ? "Deactivate" : "Activate"}</Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Create department</DialogTitle><DialogDescription>Add a stable department choice. A faculty assignment is optional.</DialogDescription></DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1.5"><label htmlFor="department-name" className="text-sm font-medium text-slate-800">Department name</label><Input id="department-name" value={name} onChange={(event) => setName(event.target.value)} autoFocus /></div>
                        <div className="space-y-1.5"><label className="text-sm font-medium text-slate-800">Faculty</label>{facultySelect(facultyId, setFacultyId)}</div>
                    </div>
                    <DialogFooter><DialogClose asChild><Button variant="outline" disabled={submitting}>Cancel</Button></DialogClose><Button onClick={handleCreateDepartment} disabled={submitting}>{submitting ? <Loader2 className="animate-spin" /> : null}{submitting ? "Creating…" : "Create department"}</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={editingId !== null} onOpenChange={(open) => !open && setEditingId(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Edit department</DialogTitle><DialogDescription>Update the display name or faculty assignment without changing existing relationships.</DialogDescription></DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1.5"><label htmlFor="edit-department-name" className="text-sm font-medium text-slate-800">Department name</label><Input id="edit-department-name" value={editName} onChange={(event) => setEditName(event.target.value)} /></div>
                        <div className="space-y-1.5"><label className="text-sm font-medium text-slate-800">Faculty</label>{facultySelect(editFacultyId, setEditFacultyId)}</div>
                    </div>
                    <DialogFooter><DialogClose asChild><Button variant="outline" disabled={submitting}>Cancel</Button></DialogClose><Button onClick={saveEdit} disabled={submitting}>{submitting ? <Loader2 className="animate-spin" /> : null}{submitting ? "Saving…" : "Save changes"}</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmActionDialog
                open={statusTarget !== null}
                onOpenChange={(open) => {
                    if (!open) setStatusTarget(null);
                }}
                title={
                    statusTarget?.active !== false
                        ? "Deactivate department?"
                        : "Activate department?"
                }
                description={
                    statusTarget?.active !== false ? (
                        <>
                            <span className="font-medium text-slate-800">
                                {statusTarget?.name}
                            </span>{" "}
                            will remain on existing records but disappear from new selections.
                        </>
                    ) : (
                        <>
                            <span className="font-medium text-slate-800">
                                {statusTarget?.name}
                            </span>{" "}
                            will become available in new department selections again.
                        </>
                    )
                }
                confirmLabel={
                    statusTarget?.active !== false ? "Deactivate" : "Activate"
                }
                tone={statusTarget?.active !== false ? "destructive" : "default"}
                reasonRequired={Boolean(statusTarget && statusTarget.active !== false)}
                reasonLabel={
                    statusTarget && statusTarget.active !== false
                        ? "Reason for deactivation"
                        : undefined
                }
                reasonDescription={
                    statusTarget && statusTarget.active !== false
                        ? "Record why this department should no longer appear in new selections."
                        : undefined
                }
                reasonPlaceholder={
                    statusTarget && statusTarget.active !== false
                        ? "Enter the operational reason for deactivation"
                        : undefined
                }
                onConfirm={async (reason) => {
                    if (!statusTarget) return;
                    await toggleDepartmentActive(statusTarget, reason);
                }}
            />
        </section>
    );
}
