"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Loader2,
    Pencil,
    Search,
    ShieldCheck,
    Trash2,
    Upload,
    UserPlus,
    Users,
} from "lucide-react";
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
import {
    Disclosure,
    EmptyState,
    Notice,
    OverflowMenu,
    PaginationBar,
    SectionHeader,
    StatusBadge,
} from "@/components/ui/workspace";
import { fetchCourses, type Course } from "@/services/courses.service";
import { fetchDepartments, type Department } from "@/services/departments.service";
import {
    createAdminUser,
    deleteAdminUser,
    fetchAdminUsers,
    importAdminUsersCsv,
    setAdminUserActive,
    setAdminUserCourse,
    updateAdminUser,
    type AdminManagedRole,
    type AdminUserEntry,
    type UserImportSummary,
} from "@/services/users.service";

const NONE = "none";
const ALL = "all";
const PAGE_SIZE = 10;

type ManagedRole = AdminManagedRole;

const ROLE_OPTIONS: Array<{ value: ManagedRole; label: string }> = [
    { value: "student", label: "Student" },
    { value: "instructor", label: "Instructor" },
    { value: "admin", label: "Admin" },
    { value: "academic_advisor", label: "Academic Advisor" },
    { value: "enrollment_operator", label: "Enrollment Operator" },
    { value: "external_partner", label: "External Partner" },
    { value: "mentor", label: "Mentor" },
];

function formatRoleLabel(role: string): string {
    return (
        ROLE_OPTIONS.find((option) => option.value === role)?.label ??
        role.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
    );
}

function roleTone(
    role: string
): "neutral" | "info" | "success" | "warning" | "danger" | "accent" {
    if (role === "admin") return "accent";
    if (role === "instructor") return "info";
    if (role === "academic_advisor" || role === "enrollment_operator") {
        return "warning";
    }
    if (role === "mentor" || role === "external_partner") return "success";
    return "neutral";
}

function CourseStatusBadge({ active }: { active: boolean }) {
    return (
        <StatusBadge
            tone={active ? "success" : "warning"}
            className="h-5 px-1.5 text-[10px]"
        >
            {active ? "Active" : "Inactive"}
        </StatusBadge>
    );
}

function CourseOptionLabel({ course }: { course: Course }) {
    return (
        <span className="flex min-w-0 items-center gap-2">
            <span className="truncate">
                {course.code} - {course.name}
            </span>
            <CourseStatusBadge active={course.active !== false} />
        </span>
    );
}

function DepartmentOptionLabel({ department }: { department: Department }) {
    return (
        <span className="flex min-w-0 items-center gap-2">
            <span className="truncate">{department.name}</span>
            <CourseStatusBadge active={department.active !== false} />
        </span>
    );
}

function formatCourse(course: AdminUserEntry["course"]): string {
    return course ? `${course.code} - ${course.name}` : "No course assigned";
}

export function AdminEnrollmentSection() {
    const [users, setUsers] = useState<AdminUserEntry[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<number | null>(null);
    const [statusSavingId, setStatusSavingId] = useState<number | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const [searchTerm, setSearchTerm] = useState("");
    const [roleFilter, setRoleFilter] = useState(ALL);
    const [statusFilter, setStatusFilter] = useState(ALL);
    const [page, setPage] = useState(1);

    const [createOpen, setCreateOpen] = useState(false);
    const [newEmail, setNewEmail] = useState("");
    const [newRole, setNewRole] = useState<ManagedRole>("student");
    const [newCourse, setNewCourse] = useState(NONE);
    const [newDepartment, setNewDepartment] = useState(NONE);
    const [newActive, setNewActive] = useState(true);
    const [newReason, setNewReason] = useState("");
    const [creating, setCreating] = useState(false);

    const [importOpen, setImportOpen] = useState(false);
    const [csvText, setCsvText] = useState("");
    const [importing, setImporting] = useState(false);
    const [importSummary, setImportSummary] =
        useState<UserImportSummary | null>(null);

    const [draftCourses, setDraftCourses] = useState<Record<number, string>>({});
    const [courseTarget, setCourseTarget] = useState<AdminUserEntry | null>(null);
    const [courseReason, setCourseReason] = useState("");

    const [statusTarget, setStatusTarget] = useState<AdminUserEntry | null>(null);
    const [statusReason, setStatusReason] = useState("");

    const [editTarget, setEditTarget] = useState<AdminUserEntry | null>(null);
    const [editEmail, setEditEmail] = useState("");
    const [editRole, setEditRole] = useState<ManagedRole>("student");
    const [editDepartment, setEditDepartment] = useState(NONE);
    const [editReason, setEditReason] = useState("");

    const [deleteTarget, setDeleteTarget] = useState<AdminUserEntry | null>(null);
    const [deleteReason, setDeleteReason] = useState("");

    const loadRequestIdRef = useRef(0);

    const loadData = useCallback(async () => {
        const requestId = loadRequestIdRef.current + 1;
        loadRequestIdRef.current = requestId;
        setLoading(true);
        setError("");
        try {
            const [userRows, courseRows, departmentRows] = await Promise.all([
                fetchAdminUsers(),
                fetchCourses(false),
                fetchDepartments(false),
            ]);
            if (loadRequestIdRef.current !== requestId) return;
            setUsers(userRows);
            setCourses(courseRows);
            setDepartments(departmentRows);
            setDraftCourses(
                Object.fromEntries(
                    userRows.map((user) => [
                        user.user_id,
                        user.course_fk ? String(user.course_fk) : NONE,
                    ])
                )
            );
        } catch (err) {
            if (loadRequestIdRef.current !== requestId) return;
            console.error(err);
            setError("Could not load admin user data.");
        } finally {
            if (loadRequestIdRef.current === requestId) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        setPage(1);
    }, [searchTerm, roleFilter, statusFilter]);

    const activeDepartmentOptions = departments.filter(
        (department) => department.active !== false
    );

    const editDepartmentOptions = (() => {
        if (!editTarget?.home_department_fk) {
            return activeDepartmentOptions;
        }
        const existingDepartment = departments.find(
            (department) =>
                department.department_id === editTarget.home_department_fk
        );
        if (
            !existingDepartment ||
            activeDepartmentOptions.some(
                (department) =>
                    department.department_id === existingDepartment.department_id
            )
        ) {
            return activeDepartmentOptions;
        }
        return [...activeDepartmentOptions, existingDepartment];
    })();

    const filteredUsers = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        return users.filter((user) => {
            const matchesQuery =
                !query ||
                [
                    user.email,
                    formatRoleLabel(user.role),
                    user.course?.code,
                    user.course?.name,
                    user.home_department?.name,
                ]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(query));
            const matchesRole = roleFilter === ALL || user.role === roleFilter;
            const matchesStatus =
                statusFilter === ALL ||
                (statusFilter === "active" ? user.active : !user.active);
            return matchesQuery && matchesRole && matchesStatus;
        });
    }, [roleFilter, searchTerm, statusFilter, users]);

    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const visibleUsers = filteredUsers.slice(
        (safePage - 1) * PAGE_SIZE,
        safePage * PAGE_SIZE
    );
    const hasFilters =
        Boolean(searchTerm.trim()) || roleFilter !== ALL || statusFilter !== ALL;

    const canHaveDepartment = (role: string) =>
        role === "student" || role === "instructor";
    const canHaveCourse = (role: string) =>
        role === "student" || role === "instructor";

    const clearFeedback = () => {
        setError("");
        setNotice("");
    };

    const resetCreateForm = () => {
        setNewEmail("");
        setNewRole("student");
        setNewCourse(NONE);
        setNewDepartment(NONE);
        setNewActive(true);
        setNewReason("");
    };

    const openCreateDialog = () => {
        clearFeedback();
        resetCreateForm();
        setCreateOpen(true);
    };

    const openImportDialog = () => {
        clearFeedback();
        setImportSummary(null);
        setImportOpen(true);
    };

    const openCourseDialog = (user: AdminUserEntry) => {
        clearFeedback();
        setDraftCourses((previous) => ({
            ...previous,
            [user.user_id]: user.course_fk ? String(user.course_fk) : NONE,
        }));
        setCourseReason("");
        setCourseTarget(user);
    };

    const openStatusDialog = (user: AdminUserEntry) => {
        clearFeedback();
        setStatusReason("");
        setStatusTarget(user);
    };

    const openEditUser = (user: AdminUserEntry) => {
        clearFeedback();
        setEditTarget(user);
        setEditEmail(user.email);
        setEditRole(user.role as ManagedRole);
        setEditDepartment(
            user.home_department_fk ? String(user.home_department_fk) : NONE
        );
        setEditReason("");
    };

    const clearFilters = () => {
        setSearchTerm("");
        setRoleFilter(ALL);
        setStatusFilter(ALL);
    };

    const handleCreateUser = async () => {
        const email = newEmail.trim().toLowerCase();
        if (!email) {
            setError("User email is required.");
            return;
        }
        if (canHaveDepartment(newRole) && newDepartment === NONE) {
            setError("Home department is required for students and instructors.");
            return;
        }
        const reason = newReason.trim();
        if (!reason) {
            setError("An audit reason is required when creating a user.");
            return;
        }

        setCreating(true);
        clearFeedback();
        try {
            await createAdminUser({
                email,
                role: newRole,
                course_id:
                    canHaveCourse(newRole) && newCourse !== NONE
                        ? Number(newCourse)
                        : null,
                home_department_id: canHaveDepartment(newRole)
                    ? Number(newDepartment)
                    : null,
                active: newActive,
                reason,
            });
            resetCreateForm();
            setCreateOpen(false);
            setNotice("User created.");
            await loadData();
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Failed to create user.");
        } finally {
            setCreating(false);
        }
    };

    const handleSaveCourse = async (
        user: AdminUserEntry,
        reasonInput: string
    ) => {
        if (user.role === "student" && user.active_team_fk) {
            setError("Students in active teams cannot change courses.");
            return;
        }
        const draft = draftCourses[user.user_id] ?? NONE;
        const nextCourseId = draft === NONE ? null : Number(draft);
        const reason = reasonInput.trim();
        if (!reason) {
            setError("An audit reason is required when changing a user course.");
            return;
        }
        setSavingId(user.user_id);
        clearFeedback();
        try {
            await setAdminUserCourse(user.user_id, {
                course_id: nextCourseId,
                reason,
            });
            setCourseTarget(null);
            setCourseReason("");
            setNotice("Course assignment updated.");
            await loadData();
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Failed to update course.");
        } finally {
            setSavingId(null);
        }
    };

    const handleToggleActive = async (
        user: AdminUserEntry,
        reasonInput: string
    ) => {
        const nextActive = !user.active;
        const reason = reasonInput.trim();
        if (!reason) {
            setError("An audit reason is required when changing user active status.");
            return;
        }
        setStatusSavingId(user.user_id);
        clearFeedback();
        try {
            await setAdminUserActive(user.user_id, {
                active: nextActive,
                force: false,
                reason,
            });
            setNotice(nextActive ? "User activated." : "User deactivated.");
            setStatusTarget(null);
            setStatusReason("");
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

    const handleUpdateUser = async () => {
        if (!editTarget) return;
        const email = editEmail.trim().toLowerCase();
        if (!email) {
            setError("User email is required.");
            return;
        }
        if (
            editTarget.role === "student" &&
            editTarget.active_team_fk &&
            editRole !== editTarget.role
        ) {
            setError("A student in an active team cannot change roles.");
            return;
        }
        if (canHaveDepartment(editRole) && editDepartment === NONE) {
            setError("Home department is required for students and instructors.");
            return;
        }
        const reason = editReason.trim();
        if (!reason) {
            setError("An audit reason is required when updating a user.");
            return;
        }

        setSavingId(editTarget.user_id);
        clearFeedback();
        try {
            await updateAdminUser(editTarget.user_id, {
                email,
                role: editRole,
                course_id: canHaveCourse(editRole) ? editTarget.course_fk : null,
                home_department_id: canHaveDepartment(editRole)
                    ? Number(editDepartment)
                    : null,
                active: editTarget.active,
                reason,
            });
            setEditTarget(null);
            setEditReason("");
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
        const reason = deleteReason.trim();
        if (!reason) {
            setError("An audit reason is required when deleting a user.");
            return;
        }
        setDeletingId(deleteTarget.user_id);
        clearFeedback();
        try {
            await deleteAdminUser(deleteTarget.user_id, reason);
            setDeleteTarget(null);
            setDeleteReason("");
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
        clearFeedback();
        setImportSummary(null);
        setCsvText(await file.text());
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

    const courseDraft = courseTarget
        ? (draftCourses[courseTarget.user_id] ?? NONE)
        : NONE;
    const courseChanged = courseTarget
        ? courseDraft !==
          (courseTarget.course_fk ? String(courseTarget.course_fk) : NONE)
        : false;
    const courseLocked = Boolean(
        courseTarget?.role === "student" && courseTarget.active_team_fk
    );

    return (
        <div className="space-y-4">
            <SectionHeader
                title="User administration"
                description="Search the directory first, then open only the workflow you need."
                actions={
                    <>
                        <Button variant="outline" onClick={openImportDialog}>
                            <Upload className="size-4" aria-hidden="true" />
                            Import CSV
                        </Button>
                        <Button onClick={openCreateDialog}>
                            <UserPlus className="size-4" aria-hidden="true" />
                            Create user
                        </Button>
                    </>
                }
            />

            {error ? <Notice tone="danger">{error}</Notice> : null}
            {notice ? <Notice tone="success">{notice}</Notice> : null}

            <Card>
                <CardHeader className="gap-4">
                    <div>
                        <CardTitle>User directory</CardTitle>
                        <CardDescription className="mt-1">
                            {filteredUsers.length === users.length
                                ? `${users.length} user${users.length === 1 ? "" : "s"}`
                                : `${filteredUsers.length} of ${users.length} users`}
                        </CardDescription>
                    </div>
                    <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_190px_160px_auto]">
                        <div className="relative">
                            <Search
                                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                                aria-hidden="true"
                            />
                            <Label htmlFor="user-search" className="sr-only">
                                Search users
                            </Label>
                            <Input
                                id="user-search"
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="Search email, course, or department"
                                className="pl-9"
                            />
                        </div>
                        <div>
                            <Label htmlFor="user-role-filter" className="sr-only">
                                Filter by role
                            </Label>
                            <Select value={roleFilter} onValueChange={setRoleFilter}>
                                <SelectTrigger id="user-role-filter">
                                    <SelectValue placeholder="All roles" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>All roles</SelectItem>
                                    {ROLE_OPTIONS.map((option) => (
                                        <SelectItem
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="user-status-filter" className="sr-only">
                                Filter by status
                            </Label>
                            <Select
                                value={statusFilter}
                                onValueChange={setStatusFilter}
                            >
                                <SelectTrigger id="user-status-filter">
                                    <SelectValue placeholder="Any status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>Any status</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            variant="ghost"
                            onClick={clearFilters}
                            disabled={!hasFilters}
                            className="justify-self-start md:justify-self-stretch"
                        >
                            Clear
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="space-y-2">
                    {loading ? (
                        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                            Loading users...
                        </div>
                    ) : visibleUsers.length === 0 ? (
                        <EmptyState
                            icon={Users}
                            title={users.length === 0 ? "No users yet" : "No matching users"}
                            description={
                                users.length === 0
                                    ? "Create a user or import a CSV to populate the directory."
                                    : "Try a broader search or clear the current filters."
                            }
                            action={
                                users.length === 0 ? (
                                    <Button onClick={openCreateDialog}>
                                        <UserPlus className="size-4" aria-hidden="true" />
                                        Create user
                                    </Button>
                                ) : (
                                    <Button variant="outline" onClick={clearFilters}>
                                        Clear filters
                                    </Button>
                                )
                            }
                        />
                    ) : (
                        visibleUsers.map((user) => {
                            const courseEditable = canHaveCourse(user.role);
                            const teamCourseLocked = Boolean(
                                user.role === "student" && user.active_team_fk
                            );
                            return (
                                <Disclosure
                                    key={user.user_id}
                                    summary={
                                        <span className="grid w-full min-w-0 gap-3 text-left lg:grid-cols-[minmax(220px,1.35fr)_minmax(170px,0.9fr)_minmax(170px,0.9fr)] lg:items-center">
                                            <span className="min-w-0">
                                                <span className="block truncate font-semibold text-slate-950">
                                                    {user.email}
                                                </span>
                                                <span className="mt-1 flex flex-wrap items-center gap-1.5">
                                                    <StatusBadge tone={roleTone(user.role)}>
                                                        {formatRoleLabel(user.role)}
                                                    </StatusBadge>
                                                    <StatusBadge
                                                        tone={user.active ? "success" : "danger"}
                                                    >
                                                        {user.active ? "Active" : "Inactive"}
                                                    </StatusBadge>
                                                    {user.active_team_fk ? (
                                                        <StatusBadge tone="info">
                                                            In active team
                                                        </StatusBadge>
                                                    ) : null}
                                                </span>
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                                    Course
                                                </span>
                                                <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm text-slate-700">
                                                    <span className="truncate">
                                                        {formatCourse(user.course)}
                                                    </span>
                                                    {user.course ? (
                                                        <CourseStatusBadge
                                                            active={user.course.active !== false}
                                                        />
                                                    ) : null}
                                                </span>
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                                    Home department
                                                </span>
                                                <span className="mt-0.5 block truncate text-sm text-slate-700">
                                                    {user.home_department?.name ??
                                                        "No department"}
                                                </span>
                                            </span>
                                        </span>
                                    }
                                    contentClassName="space-y-3 bg-slate-50/60"
                                >
                                    {teamCourseLocked ? (
                                        <Notice
                                            tone="warning"
                                            title="Course assignment locked"
                                        >
                                            Students in active teams cannot change courses.
                                            Resolve the team workflow before changing this
                                            enrollment route.
                                        </Notice>
                                    ) : null}
                                    {courseEditable && !teamCourseLocked ? (
                                        <p className="text-xs leading-5 text-slate-500">
                                            Course changes update WatMatch&apos;s intended
                                            route only. Registrar/Quest enrollment must still
                                            be updated manually when required.
                                        </p>
                                    ) : null}
                                    <div className="flex min-w-0 items-start gap-2">
                                        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap">
                                            {courseEditable ? (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => openCourseDialog(user)}
                                                    disabled={
                                                        teamCourseLocked ||
                                                        savingId === user.user_id
                                                    }
                                                >
                                                    Change course
                                                </Button>
                                            ) : null}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => openEditUser(user)}
                                                disabled={savingId === user.user_id}
                                            >
                                                <Pencil
                                                    className="size-4"
                                                    aria-hidden="true"
                                                />
                                                Edit account
                                            </Button>
                                        </div>
                                        <OverflowMenu
                                            label={`More actions for ${user.email}`}
                                            items={[
                                                {
                                                    id: `account-status-${user.user_id}`,
                                                    label: user.active
                                                        ? "Deactivate account"
                                                        : "Activate account",
                                                    icon: ShieldCheck,
                                                    disabled:
                                                        statusSavingId === user.user_id,
                                                    destructive: user.active,
                                                    onSelect: () =>
                                                        openStatusDialog(user),
                                                },
                                            ]}
                                        />
                                    </div>
                                </Disclosure>
                            );
                        })
                    )}
                </CardContent>

                <PaginationBar
                    page={safePage}
                    totalPages={totalPages}
                    loading={loading}
                    onPrevious={() =>
                        setPage((current) => Math.max(1, current - 1))
                    }
                    onNext={() =>
                        setPage((current) => Math.min(totalPages, current + 1))
                    }
                />
            </Card>

            <Dialog
                open={createOpen}
                onOpenChange={(open) => {
                    if (!open && !creating) {
                        setCreateOpen(false);
                        setError("");
                    }
                }}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Create user</DialogTitle>
                        <DialogDescription>
                            Provision one WatMatch account with its initial role and
                            routing context.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        {error ? <Notice tone="danger">{error}</Notice> : null}
                        <div className="space-y-2">
                            <Label htmlFor="new-user-email">Email</Label>
                            <Input
                                id="new-user-email"
                                type="email"
                                autoComplete="off"
                                placeholder="person@uwaterloo.ca"
                                value={newEmail}
                                onChange={(event) => setNewEmail(event.target.value)}
                            />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="new-user-role">Role</Label>
                                <Select
                                    value={newRole}
                                    onValueChange={(value) => {
                                        const role = value as ManagedRole;
                                        setNewRole(role);
                                        if (!canHaveCourse(role)) setNewCourse(NONE);
                                        if (!canHaveDepartment(role)) {
                                            setNewDepartment(NONE);
                                        }
                                    }}
                                >
                                    <SelectTrigger id="new-user-role">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ROLE_OPTIONS.map((option) => (
                                            <SelectItem
                                                key={option.value}
                                                value={option.value}
                                            >
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="new-user-status">Status</Label>
                                <Select
                                    value={newActive ? "active" : "inactive"}
                                    onValueChange={(value) =>
                                        setNewActive(value === "active")
                                    }
                                >
                                    <SelectTrigger id="new-user-status">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="new-user-course">Course</Label>
                                <Select
                                    value={newCourse}
                                    onValueChange={setNewCourse}
                                    disabled={!canHaveCourse(newRole)}
                                >
                                    <SelectTrigger id="new-user-course">
                                        <SelectValue placeholder="No course" />
                                    </SelectTrigger>
                                    <SelectContent className="max-w-[min(520px,calc(100vw-2rem))]">
                                        <SelectItem value={NONE}>No course</SelectItem>
                                        {courses.map((course) => (
                                            <SelectItem
                                                key={course.course_id}
                                                value={String(course.course_id)}
                                            >
                                                <CourseOptionLabel course={course} />
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="new-user-department">
                                    Home department
                                </Label>
                                <Select
                                    value={newDepartment}
                                    onValueChange={setNewDepartment}
                                    disabled={!canHaveDepartment(newRole)}
                                >
                                    <SelectTrigger id="new-user-department">
                                        <SelectValue placeholder="Select department" />
                                    </SelectTrigger>
                                    <SelectContent className="max-w-[min(520px,calc(100vw-2rem))]">
                                        <SelectItem value={NONE}>
                                            No department
                                        </SelectItem>
                                        {activeDepartmentOptions.map((department) => (
                                            <SelectItem
                                                key={department.department_id}
                                                value={String(
                                                    department.department_id
                                                )}
                                            >
                                                <DepartmentOptionLabel
                                                    department={department}
                                                />
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        {canHaveCourse(newRole) ? (
                            <Notice tone="warning" title="Enrollment remains manual">
                                WatMatch records the intended course assignment. Any
                                required Registrar/Quest enrollment change must be
                                completed outside WatMatch.
                            </Notice>
                        ) : null}
                        <div className="space-y-2">
                            <Label htmlFor="new-user-reason">
                                Audit reason <span aria-hidden="true">*</span>
                            </Label>
                            <Textarea
                                id="new-user-reason"
                                value={newReason}
                                onChange={(event) => setNewReason(event.target.value)}
                                placeholder="Why is this account being provisioned?"
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button
                                variant="outline"
                                disabled={creating}
                                type="button"
                            >
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button
                            onClick={handleCreateUser}
                            disabled={creating || !newReason.trim()}
                        >
                            {creating ? (
                                <Loader2
                                    className="size-4 animate-spin"
                                    aria-hidden="true"
                                />
                            ) : (
                                <UserPlus className="size-4" aria-hidden="true" />
                            )}
                            {creating ? "Creating..." : "Create user"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={importOpen}
                onOpenChange={(open) => {
                    if (!open && !importing) {
                        setImportOpen(false);
                        setError("");
                    }
                }}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Import users from CSV</DialogTitle>
                        <DialogDescription>
                            Create or update a batch of accounts using WatMatch&apos;s
                            supported user fields.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        {error ? <Notice tone="danger">{error}</Notice> : null}
                        <Notice tone="info" title="Expected columns">
                            email, role, course_code, home_department, active
                        </Notice>
                        <div className="space-y-2">
                            <Label htmlFor="user-csv">CSV file</Label>
                            <Input
                                id="user-csv"
                                type="file"
                                accept=".csv,text/csv"
                                onChange={(event) =>
                                    handleFileUpload(event.target.files?.[0])
                                }
                            />
                        </div>
                        <Disclosure
                            summary={
                                csvText.trim()
                                    ? "Review or edit CSV content"
                                    : "Paste CSV content instead"
                            }
                            contentClassName="space-y-2"
                        >
                            <Label htmlFor="user-csv-text">CSV content</Label>
                            <Textarea
                                id="user-csv-text"
                                value={csvText}
                                onChange={(event) => {
                                    setCsvText(event.target.value);
                                    setImportSummary(null);
                                }}
                                placeholder={
                                    "email,role,course_code,home_department,active\nstudent@uwaterloo.ca,student,SE 490,Software Engineering,true\nadvisor@uwaterloo.ca,academic_advisor,,,true"
                                }
                                rows={8}
                                className="font-mono text-xs"
                            />
                        </Disclosure>
                        {importSummary ? (
                            <div className="space-y-3">
                                <Notice
                                    tone={
                                        importSummary.errors.length > 0
                                            ? "warning"
                                            : "success"
                                    }
                                    title="Import processed"
                                >
                                    Created {importSummary.created}, updated{" "}
                                    {importSummary.updated}, unchanged{" "}
                                    {importSummary.unchanged}.
                                </Notice>
                                {importSummary.errors.length > 0 ? (
                                    <Disclosure
                                        summary={`${importSummary.errors.length} row${importSummary.errors.length === 1 ? "" : "s"} need attention`}
                                        contentClassName="max-h-56 space-y-2 overflow-y-auto"
                                    >
                                        {importSummary.errors.map((item, index) => (
                                            <p
                                                key={`${item.row}-${item.email ?? ""}-${index}`}
                                                className="border-b border-slate-100 pb-2 last:border-0 last:pb-0"
                                            >
                                                <span className="font-medium">
                                                    Row {item.row}
                                                    {item.email
                                                        ? ` · ${item.email}`
                                                        : ""}
                                                </span>
                                                <span className="block text-slate-600">
                                                    {item.error}
                                                </span>
                                            </p>
                                        ))}
                                    </Disclosure>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button
                                variant="outline"
                                disabled={importing}
                                type="button"
                            >
                                Close
                            </Button>
                        </DialogClose>
                        <Button
                            onClick={handleImport}
                            disabled={importing || !csvText.trim()}
                        >
                            {importing ? (
                                <Loader2
                                    className="size-4 animate-spin"
                                    aria-hidden="true"
                                />
                            ) : (
                                <Upload className="size-4" aria-hidden="true" />
                            )}
                            {importing ? "Importing..." : "Import CSV"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(courseTarget)}
                onOpenChange={(open) => {
                    if (!open && savingId === null) {
                        setCourseTarget(null);
                        setCourseReason("");
                        setError("");
                    }
                }}
            >
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Change intended course</DialogTitle>
                        <DialogDescription>
                            Update the WatMatch course route for {courseTarget?.email}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        {error ? <Notice tone="danger">{error}</Notice> : null}
                        {courseLocked ? (
                            <Notice tone="warning" title="Course assignment locked">
                                Students in active teams cannot change courses.
                            </Notice>
                        ) : null}
                        <div className="space-y-2">
                            <Label htmlFor="course-change-value">Intended course</Label>
                            <Select
                                value={courseDraft}
                                onValueChange={(value) => {
                                    if (!courseTarget) return;
                                    setDraftCourses((previous) => ({
                                        ...previous,
                                        [courseTarget.user_id]: value,
                                    }));
                                }}
                                disabled={courseLocked}
                            >
                                <SelectTrigger id="course-change-value">
                                    <SelectValue placeholder="No course" />
                                </SelectTrigger>
                                <SelectContent className="max-w-[min(520px,calc(100vw-2rem))]">
                                    <SelectItem value={NONE}>No course</SelectItem>
                                    {courses.map((course) => (
                                        <SelectItem
                                            key={course.course_id}
                                            value={String(course.course_id)}
                                        >
                                            <CourseOptionLabel course={course} />
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Notice tone="warning" title="Registrar action may be required">
                            WatMatch records the intended route only. Update
                            Registrar/Quest outside WatMatch when the student&apos;s
                            enrollment must change.
                        </Notice>
                        <div className="space-y-2">
                            <Label htmlFor="course-change-reason">
                                Audit reason <span aria-hidden="true">*</span>
                            </Label>
                            <Textarea
                                id="course-change-reason"
                                value={courseReason}
                                onChange={(event) =>
                                    setCourseReason(event.target.value)
                                }
                                placeholder="Why is this course assignment changing?"
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button
                                variant="outline"
                                disabled={savingId !== null}
                                type="button"
                            >
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button
                            onClick={() =>
                                courseTarget &&
                                handleSaveCourse(courseTarget, courseReason)
                            }
                            disabled={
                                savingId !== null ||
                                courseLocked ||
                                !courseChanged ||
                                !courseReason.trim()
                            }
                        >
                            {savingId !== null ? "Saving..." : "Save course"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(statusTarget)}
                onOpenChange={(open) => {
                    if (!open && statusSavingId === null) {
                        setStatusTarget(null);
                        setStatusReason("");
                        setError("");
                    }
                }}
            >
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {statusTarget?.active ? "Deactivate user" : "Activate user"}
                        </DialogTitle>
                        <DialogDescription>
                            Confirm the account lifecycle change for{" "}
                            {statusTarget?.email}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        {error ? <Notice tone="danger">{error}</Notice> : null}
                        <Notice
                            tone={statusTarget?.active ? "warning" : "info"}
                            title={
                                statusTarget?.active
                                    ? "Access and workflows will change"
                                    : "Access will be restored"
                            }
                        >
                            {statusTarget?.active
                                ? statusTarget.role === "external_partner"
                                    ? "The partner will not be able to log in, and their published opportunities will be archived."
                                    : statusTarget.role === "mentor"
                                      ? "The mentor will not be able to log in, and pending mentor requests will be cancelled."
                                      : "The user will not be able to log in or use protected workflows."
                                : "This user will be able to log in again."}
                        </Notice>
                        <div className="space-y-2">
                            <Label htmlFor="status-change-reason">
                                Audit reason <span aria-hidden="true">*</span>
                            </Label>
                            <Textarea
                                id="status-change-reason"
                                value={statusReason}
                                onChange={(event) =>
                                    setStatusReason(event.target.value)
                                }
                                placeholder={
                                    statusTarget?.active
                                        ? "Why is this user being deactivated?"
                                        : "Why is this user being activated?"
                                }
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button
                                variant="outline"
                                disabled={statusSavingId !== null}
                                type="button"
                            >
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button
                            variant={statusTarget?.active ? "destructive" : "default"}
                            onClick={() =>
                                statusTarget &&
                                handleToggleActive(statusTarget, statusReason)
                            }
                            disabled={
                                statusSavingId !== null || !statusReason.trim()
                            }
                        >
                            {statusSavingId !== null
                                ? "Saving..."
                                : statusTarget?.active
                                  ? "Deactivate user"
                                  : "Activate user"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(editTarget)}
                onOpenChange={(open) => {
                    if (!open && savingId === null) {
                        setEditTarget(null);
                        setEditReason("");
                        setError("");
                    }
                }}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Edit account</DialogTitle>
                        <DialogDescription>
                            Update identity metadata for this WatMatch user. Course and
                            lifecycle changes use their dedicated audited workflows.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        {error ? <Notice tone="danger">{error}</Notice> : null}
                        {editTarget?.role === "student" &&
                        editTarget.active_team_fk ? (
                            <Notice tone="warning" title="Team safeguards are active">
                                The role and course route are locked while this student
                                belongs to an active team.
                            </Notice>
                        ) : null}
                        <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm sm:grid-cols-2">
                            <div>
                                <p className="text-xs font-medium text-slate-500">
                                    Status
                                </p>
                                <StatusBadge
                                    className="mt-1"
                                    tone={editTarget?.active ? "success" : "danger"}
                                >
                                    {editTarget?.active ? "Active" : "Inactive"}
                                </StatusBadge>
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-medium text-slate-500">
                                    Intended course
                                </p>
                                <p className="mt-1 truncate text-slate-800">
                                    {formatCourse(editTarget?.course ?? null)}
                                </p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-user-email">Email</Label>
                            <Input
                                id="edit-user-email"
                                type="email"
                                value={editEmail}
                                onChange={(event) => setEditEmail(event.target.value)}
                            />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="edit-user-role">Role</Label>
                                <Select
                                    value={editRole}
                                    onValueChange={(value) => {
                                        const role = value as ManagedRole;
                                        setEditRole(role);
                                        if (!canHaveDepartment(role)) {
                                            setEditDepartment(NONE);
                                        }
                                    }}
                                    disabled={Boolean(
                                        editTarget?.role === "student" &&
                                            editTarget.active_team_fk
                                    )}
                                >
                                    <SelectTrigger id="edit-user-role">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ROLE_OPTIONS.map((option) => (
                                            <SelectItem
                                                key={option.value}
                                                value={option.value}
                                            >
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-user-department">
                                    Home department
                                </Label>
                                <Select
                                    value={editDepartment}
                                    onValueChange={setEditDepartment}
                                    disabled={!canHaveDepartment(editRole)}
                                >
                                    <SelectTrigger id="edit-user-department">
                                        <SelectValue placeholder="Select department" />
                                    </SelectTrigger>
                                    <SelectContent className="max-w-[min(520px,calc(100vw-2rem))]">
                                        <SelectItem value={NONE}>
                                            No department
                                        </SelectItem>
                                        {editDepartmentOptions.map((department) => (
                                            <SelectItem
                                                key={department.department_id}
                                                value={String(
                                                    department.department_id
                                                )}
                                            >
                                                <DepartmentOptionLabel
                                                    department={department}
                                                />
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        {editTarget?.course_fk && !canHaveCourse(editRole) ? (
                            <Notice tone="warning" title="Course route will be cleared">
                                This role does not carry a WatMatch course assignment.
                                Any related Registrar/Quest change remains a manual
                                responsibility.
                            </Notice>
                        ) : null}
                        <div className="space-y-2">
                            <Label htmlFor="edit-user-reason">
                                Audit reason <span aria-hidden="true">*</span>
                            </Label>
                            <Textarea
                                id="edit-user-reason"
                                value={editReason}
                                onChange={(event) =>
                                    setEditReason(event.target.value)
                                }
                                placeholder="Why is this user record changing?"
                                rows={3}
                            />
                        </div>
                        <Disclosure
                            summary="Danger zone"
                            contentClassName="space-y-3 bg-red-50/50"
                        >
                            <p className="text-sm text-slate-600">
                                Delete only accounts with no active team or protected
                                history. Deactivation is the safer lifecycle action when
                                history should remain.
                            </p>
                            <Button
                                variant="destructive"
                                type="button"
                                onClick={() => {
                                    if (!editTarget) return;
                                    setDeleteTarget(editTarget);
                                    setDeleteReason("");
                                    setEditTarget(null);
                                    setEditReason("");
                                    clearFeedback();
                                }}
                            >
                                <Trash2 className="size-4" aria-hidden="true" />
                                Delete user...
                            </Button>
                        </Disclosure>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button
                                variant="outline"
                                disabled={savingId !== null}
                                type="button"
                            >
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button
                            onClick={handleUpdateUser}
                            disabled={
                                savingId === editTarget?.user_id ||
                                !editReason.trim()
                            }
                        >
                            {savingId === editTarget?.user_id
                                ? "Saving..."
                                : "Save changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(deleteTarget)}
                onOpenChange={(open) => {
                    if (!open && deletingId === null) {
                        setDeleteTarget(null);
                        setDeleteReason("");
                        setError("");
                    }
                }}
            >
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Delete user</DialogTitle>
                        <DialogDescription>
                            Permanently remove {deleteTarget?.email} from WatMatch.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        {error ? <Notice tone="danger">{error}</Notice> : null}
                        <Notice tone="danger" title="This cannot be undone">
                            Deletion succeeds only when the account has no active team or
                            protected history. Deactivate the account instead when access
                            should stop but history must remain.
                        </Notice>
                        <div className="space-y-2">
                            <Label htmlFor="delete-user-reason">
                                Audit reason <span aria-hidden="true">*</span>
                            </Label>
                            <Textarea
                                id="delete-user-reason"
                                value={deleteReason}
                                onChange={(event) =>
                                    setDeleteReason(event.target.value)
                                }
                                placeholder="Why is this user being deleted instead of deactivated?"
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button
                                variant="outline"
                                disabled={deletingId !== null}
                                type="button"
                            >
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteUser}
                            disabled={deletingId !== null || !deleteReason.trim()}
                        >
                            {deletingId !== null ? "Deleting..." : "Delete user"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
