"use client";

import { useState } from "react";
import { userContext } from "@/contexts/UserContext";
import { switchActiveRole } from "@/lib/api-client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function RoleSwitcher() {
    const { user } = userContext();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const roles = user?.assigned_roles || [];
    if (!roles.includes("instructor") || !roles.includes("mentor") || roles.length !== 2) return null;

    return <div className="mb-3 space-y-1.5 px-1">
        <Label htmlFor="active-workspace" className="text-xs text-slate-600">Active workspace</Label>
        <Select value={user?.role} disabled={busy} onValueChange={async (value) => {
            if (value === user?.role) return;
            setBusy(true);
            setError("");
            try { await switchActiveRole(value as "instructor" | "mentor"); }
            catch (err) { setError(err instanceof Error ? err.message : "Could not switch workspace."); setBusy(false); }
        }}>
            <SelectTrigger id="active-workspace" className="bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
                <SelectItem value="instructor">Instructor</SelectItem>
                <SelectItem value="mentor">University Mentor</SelectItem>
            </SelectContent>
        </Select>
        {busy && <p role="status" className="text-xs text-slate-500">Switching workspace…</p>}
        {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>;
}
