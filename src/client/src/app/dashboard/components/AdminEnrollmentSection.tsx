"use client";

import { useEffect, useState } from "react";
import { Pencil, ShieldCheck, Trash2, Upload, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { fetchCourses, type Course } from "@/services/courses.service";
import {
    createAdminUser,
    deleteAdminUser,
    fetchAdminUsers,
    importAdminUsersCsv,
    setAdminUserActive,
    setAdminUserCourse,
    updateAdminUser,
    type AdminUserEntry,
    type UserImportSummary,
} from "@/services/users.service";

const NONE = "none";
type ManagedRole = "student" | "instructor" | "admin" | "external_partner";

function formatRoleLabel(role: string): string {
    const normalized = role.toLowerCase();
    if (normalized === "external_partner") return "External Partner";
    if (normalized === "student") return "Student";
    if (normalized === "instructor") return "Instructor";
    if (normalized === "admin") return "Admin";
    return role.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function AdminEnrollmentSection() {
    const [users, setUsers] = useState<AdminUserEntry[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<number | null>(null);
    const [statusSavingId, setStatusSavingId] = useState<number | null>(null);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [draftCourses, setDraftCourses] = useState<Record<number, string>>({});
    const [newEmail, setNewEmail] = useState("");
    const [newRole, setNewRole] = useState<ManagedRole>("student");
    const [newCourse, setNewCourse] = useState(NONE);
    const [newActive, setNewActive] = useState(true);
    const [creating, setCreating] = useState(false);
    const [csvText, setCsvText] = useState("");
    const [importing, setImporting] = useState(false);
    const [statusTarget, setStatusTarget] = useState<AdminUserEntry | null>(null);
    const [editTarget, setEditTarget] = useState<AdminUserEntry | null>(null);
    const [editEmail, setEditEmail] = useState("");
    const [editRole, setEditRole] = useState<ManagedRole>("student");
    const [editCourse, setEditCourse] = useState(NONE);
    const [editActive, setEditActive] = useState(true);
    const [deleteTarget, setDeleteTarget] = useState<AdminUserEntry | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [importSummary, setImportSummary] =
        useState<UserImportSummary | null>(null);

    const loadData = async () => {
        setLoading(true);
        setError("");
        try {
            const [userRows, courseRows] = await Promise.all([
                fetchAdminUsers(),
                fetchCourses(false),
            ]);
            setUsers(userRows);
            setCourses(courseRows);
            setDraftCourses(
                Object.fromEntries(
                    userRows.map((user) => [
                        user.user_id,
                        user.course_fk ? String(user.course_fk) : NONE,
                    ])
                )
            );
        } catch (err) {
            console.error(err);
            setError("Could not load admin user data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const courseLabel = (course: Course) =>
        `${course.code} - ${course.name}${course.term ? ` (${course.term})` : ""}${
            course.active ? "" : " - Inactive"
        }`;

    const clearFeedback = () => {
        setError("");
        setNotice("");
    };

    const handleCreateUser = async () => {
        const email = newEmail.trim().toLowerCase();
        if (!email) {
            setError("User email is required.");
            return;
        }

        setCreating(true);
        clearFeedback();
        try {
            await createAdminUser({
                email,
                role: newRole,
                course_id:
                    newRole === "admin" || newRole === "external_partner" || newCourse === NONE
                        ? null
                        : Number(newCourse),
                active: newActive,
                reason: "admin_manual_user_management",
            });
            setNewEmail("");
            setNewRole("student");
            setNewCourse(NONE);
            setNewActive(true);
            setNotice("User saved.");
            await loadData();
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Failed to create user.");
        } finally {
            setCreating(false);
        }
    };

    const handleSaveCourse = async (user: AdminUserEntry) => {
        const draft = draftCourses[user.user_id] ?? NONE;
        const nextCourseId = draft === NONE ? null : Number(draft);
        setSavingId(user.user_id);
        clearFeedback();
        try {
            await setAdminUserCourse(user.user_id, {
                course_id: nextCourseId,
                reason: "admin_manual_user_management",
            });
            setNotice("Course assignment updated.");
            await loadData();
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Failed to update course.");
        } finally {
            setSavingId(null);
        }
    };

    const handleToggleActive = async (user: AdminUserEntry) => {
        const nextActive = !user.active;
        setStatusSavingId(user.user_id);
        clearFeedback();
        try {
            await setAdminUserActive(user.user_id, {
                active: nextActive,
                force: false,
                reason: "admin_manual_user_management",
            });
            setNotice(nextActive ? "User activated." : "User deactivated.");
            setStatusTarget(null);
            await loadData();
        } catch (err) {
            console.error(err);
            setError(
                err instanceof Error ? err.message : "Failed to update user status."
            );
        } finally {
            setStatusSavingId(null);
        }
    };

    const openEditUser = (user: AdminUserEntry) => {
        setEditTarget(user);
        setEditEmail(user.email);
        setEditRole(user.role as ManagedRole);
        setEditCourse(user.course_fk ? String(user.course_fk) : NONE);
        setEditActive(user.active);
        clearFeedback();
    };

    const handleUpdateUser = async () => {
        if (!editTarget) return;
        const email = editEmail.trim().toLowerCase();
        if (!email) {
            setError("User email is required.");
            return;
        }
        setSavingId(editTarget.user_id);
        clearFeedback();
        try {
            await updateAdminUser(editTarget.user_id, {
                email,
                role: editRole,
                course_id:
                    editRole === "admin" || editRole === "external_partner" || editCourse === NONE
                        ? null
                        : Number(editCourse),
                active: editActive,
                reason: "admin_manual_user_management",
            });
            setEditTarget(null);
            setNotice("User updated.");
            await loadData();
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Failed to update user.");
        } finally {
            setSavingId(null);
        }
    };

    const handleDeleteUser = async () => {
        if (!deleteTarget) return;
        setDeletingId(deleteTarget.user_id);
        clearFeedback();
        try {
            await deleteAdminUser(
                deleteTarget.user_id,
                "admin_manual_user_management"
            );
            setEditTarget(null);
            setDeleteTarget(null);
            setNotice("User deleted.");
            await loadData();
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Failed to delete user.");
        } finally {
            setDeletingId(null);
        }
    };

    const handleFileUpload = async (file: File | undefined) => {
        if (!file) return;
        const text = await file.text();
        setCsvText(text);
    };

    const handleImport = async () => {
        if (!csvText.trim()) {
            setError("CSV content is required.");
            return;
        }
        setImporting(true);
        clearFeedback();
        setImportSummary(null);
        try {
            const summary = await importAdminUsersCsv(csvText);
            setImportSummary(summary);
            setNotice("CSV import processed.");
            await loadData();
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Failed to import users.");
        } finally {
            setImporting(false);
        }
    };

    const canHaveCourse = (role: string) => role === "student" || role === "instructor";

    return (
        <div className="space-y-4">
            {(error || notice) && (
                <div
                    className={`rounded-md border px-3 py-2 text-sm ${
                        error
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    }`}
                >
                    {error || notice}
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Create User</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_150px_220px_140px_auto] gap-3 items-end">
                        <div className="space-y-2">
                            <Label htmlFor="user-email">Email</Label>
                            <Input
                                id="user-email"
                                type="email"
                                placeholder="person@uwaterloo.ca"
                                value={newEmail}
                                onChange={(event) => setNewEmail(event.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Role</Label>
                            <Select
                                value={newRole}
                                onValueChange={(value) => {
                                    const role = value as ManagedRole;
                                    setNewRole(role);
                                    if (role === "admin" || role === "external_partner") setNewCourse(NONE);
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="student">Student</SelectItem>
                                    <SelectItem value="instructor">Instructor</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="external_partner">External Partner</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Course</Label>
                            <Select
                                value={newCourse}
                                onValueChange={setNewCourse}
                                disabled={newRole === "admin" || newRole === "external_partner"}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="No course" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NONE}>No course</SelectItem>
                                    {courses.map((course) => (
                                        <SelectItem
                                            key={course.course_id}
                                            value={String(course.course_id)}
                                        >
                                            {courseLabel(course)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select
                                value={newActive ? "active" : "inactive"}
                                onValueChange={(value) =>
                                    setNewActive(value === "active")
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={handleCreateUser} disabled={creating}>
                            <UserPlus className="w-4 h-4 mr-2" />
                            {creating ? "Saving..." : "Save User"}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Import Users</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
                        <div className="space-y-2">
                            <Label htmlFor="user-csv">CSV</Label>
                            <Input
                                id="user-csv"
                                type="file"
                                accept=".csv,text/csv"
                                onChange={(event) =>
                                    handleFileUpload(event.target.files?.[0])
                                }
                            />
                        </div>
                        <Button onClick={handleImport} disabled={importing}>
                            <Upload className="w-4 h-4 mr-2" />
                            {importing ? "Importing..." : "Import CSV"}
                        </Button>
                    </div>
                    <Textarea
                        value={csvText}
                        onChange={(event) => setCsvText(event.target.value)}
                        placeholder={
                            "email,role,course_code,course_term,active\nstudent@uwaterloo.ca,student,SE 490,Fall 2026,true\ninstructor@uwaterloo.ca,instructor,SE 490,Fall 2026,true\npartner@example.org,external_partner,,,true\nadmin@uwaterloo.ca,admin,,,true"
                        }
                        rows={6}
                    />
                    {importSummary && (
                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 space-y-2">
                            <p>
                                Created: {importSummary.created} | Updated:{" "}
                                {importSummary.updated} | Unchanged:{" "}
                                {importSummary.unchanged}
                            </p>
                            {importSummary.errors.length > 0 && (
                                <div className="space-y-1">
                                    {importSummary.errors.slice(0, 8).map((item) => (
                                        <p key={`${item.row}-${item.email || ""}`}>
                                            Row {item.row}: {item.email ? `${item.email} - ` : ""}
                                            {item.error}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Users</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {loading ? (
                        <p className="text-sm text-slate-600">Loading users...</p>
                    ) : users.length === 0 ? (
                        <p className="text-sm text-slate-600">No users found.</p>
                    ) : (
                        <div className="space-y-3">
                            {users.map((user) => {
                                const currentCourse = user.course;
                                const draft = draftCourses[user.user_id] ?? NONE;
                                const hasTeam = Boolean(user.active_team_fk);
                                const courseEditable = canHaveCourse(user.role);
                                const changed =
                                    draft !==
                                    (user.course_fk ? String(user.course_fk) : NONE);
                                return (
                                    <div
                                        key={user.user_id}
                                        className="grid grid-cols-1 lg:grid-cols-[1fr_260px_auto_auto] gap-3 items-center border border-slate-200 rounded-md p-3"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-medium text-slate-900 break-all">
                                                    {user.email}
                                                </p>
                                                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs uppercase tracking-wide text-slate-700">
                                                    {formatRoleLabel(user.role)}
                                                </span>
                                                <span
                                                    className={`rounded px-2 py-0.5 text-xs ${
                                                        user.active
                                                            ? "bg-emerald-50 text-emerald-700"
                                                            : "bg-red-50 text-red-700"
                                                    }`}
                                                >
                                                    {user.active ? "Active" : "Inactive"}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-600">
                                                {currentCourse
                                                    ? courseLabel(currentCourse)
                                                    : "No course assigned"}
                                                {hasTeam ? " | In team" : ""}
                                            </p>
                                        </div>
                                        <Select
                                            value={draft}
                                            disabled={!courseEditable}
                                            onValueChange={(value) =>
                                                setDraftCourses((previous) => ({
                                                    ...previous,
                                                    [user.user_id]: value,
                                                }))
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="No course" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={NONE}>No course</SelectItem>
                                                {courses.map((course) => (
                                                    <SelectItem
                                                        key={course.course_id}
                                                        value={String(course.course_id)}
                                                    >
                                                        {courseLabel(course)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button
                                            variant="outline"
                                            onClick={() => handleSaveCourse(user)}
                                            disabled={
                                                !courseEditable ||
                                                !changed ||
                                                savingId === user.user_id ||
                                                (user.role === "student" && hasTeam && changed)
                                            }
                                            title={
                                                user.role === "student" && hasTeam && changed
                                                    ? "Students in active teams cannot change courses"
                                                    : undefined
                                            }
                                        >
                                            {savingId === user.user_id ? "Saving..." : "Save"}
                                        </Button>
                                        <Button
                                            variant={user.active ? "outline" : "default"}
                                            onClick={() => setStatusTarget(user)}
                                            disabled={statusSavingId === user.user_id}
                                        >
                                            <ShieldCheck className="w-4 h-4 mr-2" />
                                            {statusSavingId === user.user_id
                                                ? "Saving..."
                                                : user.active
                                                  ? "Deactivate"
                                                  : "Activate"}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => openEditUser(user)}
                                            disabled={savingId === user.user_id}
                                        >
                                            <Pencil className="w-4 h-4 mr-2" />
                                            Edit
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog
                open={!!statusTarget}
                onOpenChange={(open) => !open && setStatusTarget(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {statusTarget?.active ? "Deactivate User" : "Activate User"}
                        </DialogTitle>
                        <DialogDescription>
                            {statusTarget?.active
                                ? statusTarget.role === "external_partner"
                                    ? "Inactive external partners cannot log in. Their published opportunities will be archived."
                                    : "Inactive users cannot log in or use protected workflows."
                                : "This user will be able to log in again."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 break-all">
                        {statusTarget?.email}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline" disabled={statusSavingId !== null}>
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button
                            onClick={() => statusTarget && handleToggleActive(statusTarget)}
                            disabled={statusSavingId !== null}
                        >
                            {statusSavingId !== null
                                ? "Saving..."
                                : statusTarget?.active
                                  ? "Deactivate"
                                  : "Activate"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={!!editTarget}
                onOpenChange={(open) => !open && setEditTarget(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit User</DialogTitle>
                        <DialogDescription>
                            Update the user account managed by WatMatch.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input
                                type="email"
                                value={editEmail}
                                onChange={(event) => setEditEmail(event.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>Role</Label>
                                <Select
                                    value={editRole}
                                    onValueChange={(value) => {
                                        const role = value as ManagedRole;
                                        setEditRole(role);
                                        if (role === "admin" || role === "external_partner") setEditCourse(NONE);
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="student">Student</SelectItem>
                                        <SelectItem value="instructor">Instructor</SelectItem>
                                        <SelectItem value="admin">Admin</SelectItem>
                                        <SelectItem value="external_partner">External Partner</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Course</Label>
                                <Select
                                    value={editCourse}
                                    onValueChange={setEditCourse}
                                    disabled={editRole === "admin" || editRole === "external_partner"}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="No course" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={NONE}>No course</SelectItem>
                                        {courses.map((course) => (
                                            <SelectItem
                                                key={course.course_id}
                                                value={String(course.course_id)}
                                            >
                                                {courseLabel(course)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select
                                value={editActive ? "active" : "inactive"}
                                onValueChange={(value) =>
                                    setEditActive(value === "active")
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:justify-between">
                        <Button
                            variant="destructive"
                            onClick={() => editTarget && setDeleteTarget(editTarget)}
                            disabled={
                                deletingId !== null || savingId === editTarget?.user_id
                            }
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {deletingId !== null ? "Deleting..." : "Delete"}
                        </Button>
                        <div className="flex gap-2">
                            <DialogClose asChild>
                                <Button variant="outline" disabled={savingId !== null}>
                                    Cancel
                                </Button>
                            </DialogClose>
                            <Button
                                onClick={handleUpdateUser}
                                disabled={
                                    savingId === editTarget?.user_id ||
                                    deletingId === editTarget?.user_id
                                }
                            >
                                {savingId === editTarget?.user_id
                                    ? "Saving..."
                                    : "Save Changes"}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete User</DialogTitle>
                        <DialogDescription>
                            This permanently removes the user when they have no active
                            team or protected history. Deactivate the account instead
                            when you need to preserve access history.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 break-all">
                        {deleteTarget?.email}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline" disabled={deletingId !== null}>
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteUser}
                            disabled={deletingId !== null}
                        >
                            {deletingId !== null ? "Deleting..." : "Delete User"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
