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
import { EmptyState, Notice, SectionHeader } from "@/components/ui/workspace";
import { createSkill, fetchSkills, updateSkill, type Skill } from "@/services/skills.service";

export function AdminSkillsSection() {
    const [skills, setSkills] = useState<Skill[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [createOpen, setCreateOpen] = useState(false);
    const [name, setName] = useState("");
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState("");

    const visibleSkills = useMemo(() => {
        const query = search.trim().toLowerCase();
        return query ? skills.filter((skill) => skill.name.toLowerCase().includes(query)) : skills;
    }, [search, skills]);

    const loadSkills = async () => {
        setLoading(true);
        setError(null);
        try { setSkills(await fetchSkills()); }
        catch (err) { console.error(err); setError("Could not load skills."); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadSkills(); }, []);

    const handleCreateSkill = async () => {
        if (!name.trim()) { setError("Skill name is required."); return; }
        setSubmitting(true);
        setError(null);
        try {
            await createSkill({ name: name.trim() });
            setName("");
            setCreateOpen(false);
            await loadSkills();
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Failed to create skill.");
        } finally { setSubmitting(false); }
    };

    const startEdit = (skill: Skill) => {
        setEditingId(skill.skill_id);
        setEditName(skill.name);
        setError(null);
    };

    const saveEdit = async () => {
        if (!editingId || !editName.trim()) { setError("Skill name is required."); return; }
        setSubmitting(true);
        setError(null);
        try {
            await updateSkill(editingId, { name: editName.trim() });
            setEditingId(null);
            await loadSkills();
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Failed to update skill.");
        } finally { setSubmitting(false); }
    };

    return (
        <section className="space-y-4">
            <SectionHeader
                title="Skills"
                description="Maintain the shared skill vocabulary used by projects and student profiles."
                actions={<Button size="sm" onClick={() => { setError(null); setCreateOpen(true); }}><Plus /> Create skill</Button>}
            />
            {error ? <Notice tone="danger">{error}</Notice> : null}

            <div className="wm-panel overflow-hidden">
                <div className="border-b border-slate-100 p-3">
                    <div className="relative max-w-md">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search skill presets" className="pl-9" />
                    </div>
                </div>
                {loading ? (
                    <div className="space-y-px bg-slate-100" aria-label="Loading skills">{[0, 1, 2].map((item) => <div key={item} className="h-14 animate-pulse bg-white" />)}</div>
                ) : visibleSkills.length === 0 ? (
                    <EmptyState title={skills.length === 0 ? "No skill presets yet" : "No matching skills"} description={skills.length === 0 ? "Create a preset to make consistent skill tagging easier." : "Try a different search term."} className="border-0" />
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {visibleSkills.map((skill) => (
                            <li key={skill.skill_id} className="flex items-center justify-between gap-3 px-4 py-3">
                                <p className="min-w-0 truncate text-sm font-medium text-slate-900">{skill.name}</p>
                                <Button variant="outline" size="sm" onClick={() => startEdit(skill)}>Edit</Button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Create skill</DialogTitle><DialogDescription>Add a reusable skill label for profiles and project requirements.</DialogDescription></DialogHeader>
                    <div className="space-y-1.5"><label htmlFor="skill-name" className="text-sm font-medium text-slate-800">Skill name</label><Input id="skill-name" value={name} onChange={(event) => setName(event.target.value)} autoFocus /></div>
                    <DialogFooter><DialogClose asChild><Button variant="outline" disabled={submitting}>Cancel</Button></DialogClose><Button onClick={handleCreateSkill} disabled={submitting}>{submitting ? <Loader2 className="animate-spin" /> : null}{submitting ? "Creating…" : "Create skill"}</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={editingId !== null} onOpenChange={(open) => !open && setEditingId(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Edit skill</DialogTitle><DialogDescription>Renaming a preset keeps existing project and profile relationships intact.</DialogDescription></DialogHeader>
                    <div className="space-y-1.5"><label htmlFor="edit-skill-name" className="text-sm font-medium text-slate-800">Skill name</label><Input id="edit-skill-name" value={editName} onChange={(event) => setEditName(event.target.value)} /></div>
                    <DialogFooter><DialogClose asChild><Button variant="outline" disabled={submitting}>Cancel</Button></DialogClose><Button onClick={saveEdit} disabled={submitting}>{submitting ? <Loader2 className="animate-spin" /> : null}{submitting ? "Saving…" : "Save changes"}</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}
