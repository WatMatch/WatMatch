"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Notice } from "@/components/ui/workspace";
import { setAdminUserRoles, type AdminUserEntry } from "@/services/users.service";
import type { Course } from "@/services/courses.service";
import type { Department } from "@/services/departments.service";

type StaffRole = "instructor" | "mentor";

export function ManageUserRolesDialog({ user, courses, departments, onClose, onSaved }: {
    user: AdminUserEntry; courses: Course[]; departments: Department[];
    onClose: () => void; onSaved: () => void;
}) {
    const [roles, setRoles] = useState<StaffRole[]>((user.assigned_roles || [user.role]) as StaffRole[]);
    const [department, setDepartment] = useState(user.home_department_fk ? String(user.home_department_fk) : "none");
    const [course, setCourse] = useState("none");
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const addingInstructor = roles.includes("instructor") && user.role !== "instructor";
    const needsDepartment = roles.includes("instructor") && (addingInstructor || !user.home_department_fk);

    async function save() {
        if (!roles.length) { setError("Select at least one role."); return; }
        if (!reason.trim()) { setError("Enter an audit reason."); return; }
        if (needsDepartment && department === "none") { setError("Choose the instructor's home department."); return; }
        setBusy(true); setError("");
        try {
            await setAdminUserRoles(user.user_id, {
                roles, reason: reason.trim(),
                course_id: addingInstructor && course !== "none" ? Number(course) : null,
                home_department_id: department !== "none" ? Number(department) : null,
            });
            onSaved();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not update roles.");
            setBusy(false);
        }
    }

    return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
                <DialogTitle>Manage roles</DialogTitle>
                <DialogDescription>{user.email} keeps one account and can switch between the roles you assign.</DialogDescription>
            </DialogHeader>
            {error && <Notice tone="danger">{error}</Notice>}
            <fieldset disabled={busy} className="space-y-3">
                <legend className="mb-2 text-sm font-medium">Assigned roles</legend>
                {([['instructor', 'Instructor'], ['mentor', 'University Mentor']] as const).map(([role, label]) =>
                    <label key={role} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={roles.includes(role)} onCheckedChange={(checked) => setRoles(previous => checked === true ? [...previous, role] : previous.filter(value => value !== role))} />
                        {label}
                    </label>
                )}
            </fieldset>
            {needsDepartment && <div className="space-y-2">
                <Label htmlFor="role-department">Instructor home department</Label>
                <Select value={department} onValueChange={setDepartment} disabled={busy}>
                    <SelectTrigger id="role-department"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="none">Choose department</SelectItem>
                        {departments.filter(item => item.active).map(item => <SelectItem key={item.department_id} value={String(item.department_id)}>{item.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>}
            {addingInstructor && <div className="space-y-2">
                <Label htmlFor="role-course">Instructor course</Label>
                <Select value={course} onValueChange={setCourse} disabled={busy}>
                    <SelectTrigger id="role-course"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="none">No course assigned yet</SelectItem>
                        {courses.map(item => <SelectItem key={item.course_id} value={String(item.course_id)}>{item.code} — {item.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>}
            {user.role === "instructor" && !roles.includes("instructor") && <Notice tone="warning">Removing Instructor clears the course assignment. The last instructor on an active course cannot be removed.</Notice>}
            <p className="text-sm text-slate-600">Existing project and mentor history stays with this account. Resolve active mentoring commitments before removing University Mentor.</p>
            <div className="space-y-2"><Label htmlFor="role-reason">Audit reason</Label><Textarea id="role-reason" value={reason} onChange={event => setReason(event.target.value)} disabled={busy} /></div>
            <DialogFooter><Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save roles"}</Button></DialogFooter>
        </DialogContent>
    </Dialog>;
}
